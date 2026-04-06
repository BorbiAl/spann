#include <atomic>
#include <chrono>
#include <csignal>
#include <cstdlib>
#include <string>
#include <thread>
#include <unordered_set>
#include <vector>

#include "api/handlers.h"
#include "api/http_server.h"
#include "ble/advertiser.h"
#include "ble/gatt_server.h"
#include "ble/scanner.h"
#include "network/failover.h"
#include "network/reachability.h"
#include "routing/dedup_filter.h"
#include "routing/epidemic_router.h"
#include "routing/message_store.h"
#include "routing/types.h"
#include "utils/logger.h"
#include "webrtc/peer_connection.h"

namespace {
std::atomic<bool> g_running{true};

void HandleSignal(int) { g_running.store(false); }

std::string GetEnvOrDefault(const char* key, const std::string& fallback) {
  const char* value = std::getenv(key);
  return value == nullptr ? fallback : value;
}

}  // namespace

int main() {
  std::signal(SIGINT, HandleSignal);
  std::signal(SIGTERM, HandleSignal);

  const auto node_name = GetEnvOrDefault("NODE_NAME", "spann-mesh-node");
  const auto db_path = GetEnvOrDefault("MESH_DB_PATH", "/tmp/spann-mesh-db");
  const auto api_bind = GetEnvOrDefault("MESH_DAEMON_BIND", "127.0.0.1");
  const std::uint16_t port = static_cast<std::uint16_t>(std::stoi(GetEnvOrDefault("MESH_DAEMON_PORT", "7070")));

  spann::utils::Logger::Instance().Info("mesh_daemon_starting", {{"port", std::to_string(port)}});

  spann::ble::Advertiser advertiser;
  spann::ble::Scanner scanner;
  spann::ble::GattServer gatt_server;

  spann::network::FailoverController failover;
  spann::network::ReachabilityMonitor reachability_monitor(std::chrono::seconds(5));

  spann::routing::DedupFilter dedup_filter;
  spann::routing::MessageStore message_store(db_path);

  spann::webrtc::PeerConnectionManager peer_connections;

  auto peer_provider = [&scanner, &peer_connections]() {
    std::vector<spann::routing::PeerInfo> peers = scanner.GetPeers();

    std::unordered_set<std::string> known_ids;
    for (const auto& peer : peers) {
      known_ids.insert(peer.id);
    }

    for (const auto& peer_id : peer_connections.ConnectedPeerIds()) {
      if (!known_ids.contains(peer_id)) {
        peers.push_back({peer_id, peer_id, 3});
      }
    }

    return peers;
  };

  auto peer_sender = [&peer_connections](const spann::routing::PeerInfo& peer,
                                         const spann::routing::MeshMessage& message) {
    peer_connections.SendToPeer(peer.id, message);
  };

  spann::routing::EpidemicRouter router(
      dedup_filter,
      message_store,
      peer_provider,
      peer_sender);

  peer_connections.SetMessageHandler([&router](const spann::routing::MeshMessage& message) {
    router.OnMessageReceived(message);
  });

  failover.SetCallback([](const spann::network::Mode mode) {
    spann::utils::Logger::Instance().Info(
        "mesh_mode_changed",
        {{"mode", mode == spann::network::Mode::kInternet ? "internet" : "mesh"}});
  });

  reachability_monitor.Start([&failover](const bool reachable) {
    failover.OnReachabilityChanged(reachable);
  });

  advertiser.Start(node_name);
  scanner.Start();
  gatt_server.Start();

  auto sync_callback = [&message_store]() {
    int synced = 0;
    for (const auto& message : message_store.ListPending(500)) {
      if (message_store.Remove(message.id)) {
        ++synced;
      }
    }
    spann::utils::Logger::Instance().Info("mesh_sync_completed", {{"synced", std::to_string(synced)}});
    return synced;
  };

  spann::api::Handlers handlers(failover, scanner, message_store, router, sync_callback);
  spann::api::HttpServer http_server(api_bind, port, handlers);
  http_server.Start();

  while (g_running.load()) {
    std::this_thread::sleep_for(std::chrono::seconds(1));
  }

  http_server.Stop();
  gatt_server.Stop();
  scanner.Stop();
  advertiser.Stop();
  reachability_monitor.Stop();

  spann::utils::Logger::Instance().Info("mesh_daemon_stopped");
  return 0;
}
