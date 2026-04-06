#pragma once

#include <functional>
#include <mutex>
#include <string>
#include <unordered_set>
#include <vector>

#include "routing/types.h"

namespace spann::webrtc {

class PeerConnectionManager {
 public:
  using MessageHandler = std::function<void(const routing::MeshMessage&)>;

  void ConnectPeer(const std::string& peer_id);
  void DisconnectPeer(const std::string& peer_id);
  std::vector<std::string> ConnectedPeerIds() const;

  void SendToPeer(const std::string& peer_id, const routing::MeshMessage& message) const;
  void SetMessageHandler(MessageHandler handler);
  void SimulateIncoming(const routing::MeshMessage& message) const;

 private:
  mutable std::mutex mutex_;
  std::unordered_set<std::string> peers_;
  MessageHandler message_handler_;
};

}  // namespace spann::webrtc
