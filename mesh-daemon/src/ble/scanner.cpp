#include "ble/scanner.h"

#include "utils/logger.h"

namespace spann::ble {

void Scanner::Start() {
  if (running_.exchange(true)) {
    return;
  }
  utils::Logger::Instance().Info("ble_scanner_started");
}

void Scanner::Stop() {
  if (!running_.exchange(false)) {
    return;
  }
  utils::Logger::Instance().Info("ble_scanner_stopped");
}

std::vector<routing::PeerInfo> Scanner::GetPeers() const {
  std::lock_guard<std::mutex> lock(mutex_);
  std::vector<routing::PeerInfo> peers;
  peers.reserve(peers_.size());
  for (const auto& [_, peer] : peers_) {
    peers.push_back(peer);
  }
  return peers;
}

void Scanner::UpsertPeer(const routing::PeerInfo& peer) {
  std::lock_guard<std::mutex> lock(mutex_);
  peers_[peer.id] = peer;
  utils::Logger::Instance().Info("ble_peer_discovered", {{"peerId", peer.id}, {"name", peer.name}});
}

void Scanner::RemovePeer(const std::string& peer_id) {
  std::lock_guard<std::mutex> lock(mutex_);
  peers_.erase(peer_id);
  utils::Logger::Instance().Info("ble_peer_lost", {{"peerId", peer_id}});
}

}  // namespace spann::ble
