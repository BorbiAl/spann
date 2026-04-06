#include "webrtc/peer_connection.h"

#include "utils/logger.h"

namespace spann::webrtc {

void PeerConnectionManager::ConnectPeer(const std::string& peer_id) {
  std::lock_guard<std::mutex> lock(mutex_);
  peers_.insert(peer_id);
  utils::Logger::Instance().Info("webrtc_peer_connected", {{"peerId", peer_id}});
}

void PeerConnectionManager::DisconnectPeer(const std::string& peer_id) {
  std::lock_guard<std::mutex> lock(mutex_);
  peers_.erase(peer_id);
  utils::Logger::Instance().Info("webrtc_peer_disconnected", {{"peerId", peer_id}});
}

std::vector<std::string> PeerConnectionManager::ConnectedPeerIds() const {
  std::lock_guard<std::mutex> lock(mutex_);
  std::vector<std::string> peers(peers_.begin(), peers_.end());
  return peers;
}

void PeerConnectionManager::SendToPeer(const std::string& peer_id,
                                       const routing::MeshMessage& message) const {
  std::lock_guard<std::mutex> lock(mutex_);
  if (!peers_.contains(peer_id)) {
    utils::Logger::Instance().Warn("webrtc_send_skipped_peer_not_connected",
                                   {{"peerId", peer_id}, {"messageId", message.id}});
    return;
  }

  utils::Logger::Instance().Info(
      "webrtc_message_sent",
      {{"peerId", peer_id}, {"messageId", message.id}, {"channelId", message.channel_id}});
}

void PeerConnectionManager::SetMessageHandler(MessageHandler handler) {
  std::lock_guard<std::mutex> lock(mutex_);
  message_handler_ = std::move(handler);
}

void PeerConnectionManager::SimulateIncoming(const routing::MeshMessage& message) const {
  MessageHandler handler;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    handler = message_handler_;
  }
  if (handler) {
    handler(message);
  }
}

}  // namespace spann::webrtc
