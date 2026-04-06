#pragma once

#include <functional>
#include <string>
#include <vector>

#include "routing/dedup_filter.h"
#include "routing/message_store.h"
#include "routing/types.h"

namespace spann::routing {

class EpidemicRouter {
 public:
  using PeerProvider = std::function<std::vector<PeerInfo>()>;
  using PeerSender = std::function<void(const PeerInfo&, const MeshMessage&)>;

  EpidemicRouter(DedupFilter& dedup_filter,
                 MessageStore& message_store,
                 PeerProvider peer_provider,
                 PeerSender peer_sender);

  void OnMessageReceived(MeshMessage message);
  MeshMessage InjectMessage(const std::string& channel_id,
                            const std::string& text,
                            int ttl,
                            const std::string& origin);

 private:
  DedupFilter& dedup_filter_;
  MessageStore& message_store_;
  PeerProvider peer_provider_;
  PeerSender peer_sender_;
};

}  // namespace spann::routing
