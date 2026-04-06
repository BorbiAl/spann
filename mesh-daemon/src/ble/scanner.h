#pragma once

#include <atomic>
#include <mutex>
#include <unordered_map>
#include <vector>

#include "routing/types.h"

namespace spann::ble {

class Scanner {
 public:
  void Start();
  void Stop();

  std::vector<routing::PeerInfo> GetPeers() const;
  void UpsertPeer(const routing::PeerInfo& peer);
  void RemovePeer(const std::string& peer_id);

 private:
  std::atomic<bool> running_{false};
  mutable std::mutex mutex_;
  std::unordered_map<std::string, routing::PeerInfo> peers_;
};

}  // namespace spann::ble
