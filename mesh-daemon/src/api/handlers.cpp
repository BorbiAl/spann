#include "api/handlers.h"

#include <algorithm>

#include "utils/logger.h"

namespace spann::api {

Handlers::Handlers(network::FailoverController& failover,
                   ble::Scanner& scanner,
                   routing::MessageStore& message_store,
                   routing::EpidemicRouter& router,
                   SyncCallback sync_callback)
    : failover_(failover),
      scanner_(scanner),
      message_store_(message_store),
      router_(router),
      sync_callback_(std::move(sync_callback)) {}

nlohmann::json Handlers::GetStatus() const {
  const auto nodes = scanner_.GetPeers();
  const auto mode = failover_.CurrentMode() == network::Mode::kInternet ? "internet" : "mesh";

  nlohmann::json node_array = nlohmann::json::array();
  for (const auto& peer : nodes) {
    node_array.push_back({
        {"id", peer.id},
        {"name", peer.name},
        {"signal", peer.signal},
    });
  }

  return {
      {"mode", mode},
      {"nodes", node_array},
      {"queueSize", message_store_.Size()},
  };
}

nlohmann::json Handlers::GetNodes() const {
  nlohmann::json node_array = nlohmann::json::array();
  for (const auto& peer : scanner_.GetPeers()) {
    node_array.push_back({
        {"id", peer.id},
        {"name", peer.name},
        {"signal", peer.signal},
    });
  }
  return node_array;
}

nlohmann::json Handlers::PostSend(const nlohmann::json& body) {
  const std::string channel_id = body.value("channelId", "");
  const std::string text = body.value("text", "");
  const int ttl = std::clamp(body.value("ttl", 6), 0, 6);

  if (channel_id.empty() || text.empty()) {
    return {{"error", "channelId and text are required"}};
  }

  auto message = router_.InjectMessage(channel_id, text, ttl, "local");
  utils::Logger::Instance().Info("api_send_injected", {{"messageId", message.id}});

  return {
      {"id", message.id},
      {"channelId", message.channel_id},
      {"ttl", message.ttl},
      {"hopCount", message.hop_count},
  };
}

nlohmann::json Handlers::GetQueue() const {
  nlohmann::json queue = nlohmann::json::array();
  for (const auto& message : message_store_.ListPending()) {
    queue.push_back({
        {"id", message.id},
        {"channelId", message.channel_id},
        {"text", message.text},
        {"ttl", message.ttl},
        {"hopCount", message.hop_count},
    });
  }
  return queue;
}

nlohmann::json Handlers::PostSync() const {
  const int synced_count = sync_callback_ ? sync_callback_() : 0;
  return {{"synced", synced_count}};
}

}  // namespace spann::api
