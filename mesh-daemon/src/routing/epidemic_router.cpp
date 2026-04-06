#include "routing/epidemic_router.h"

#include <chrono>

#include "utils/logger.h"
#include "utils/uuid.h"

namespace spann::routing {

EpidemicRouter::EpidemicRouter(DedupFilter& dedup_filter,
                               MessageStore& message_store,
                               PeerProvider peer_provider,
                               PeerSender peer_sender)
    : dedup_filter_(dedup_filter),
      message_store_(message_store),
      peer_provider_(std::move(peer_provider)),
      peer_sender_(std::move(peer_sender)) {}

void EpidemicRouter::OnMessageReceived(MeshMessage message) {
  // on message_received(msg):
  //   if dedup_filter.contains(msg.id): discard
  if (dedup_filter_.Contains(message.id)) {
    utils::Logger::Instance().Info("routing_discard_duplicate", {{"messageId", message.id}});
    return;
  }

  // dedup_filter.add(msg.id)
  dedup_filter_.Add(message.id);

  // message_store.save(msg)
  message_store_.Save(message);

  // if msg.ttl <= 0: discard
  if (message.ttl <= 0) {
    utils::Logger::Instance().Info("routing_discard_ttl_expired", {{"messageId", message.id}});
    return;
  }

  // msg.ttl -= 1
  message.ttl -= 1;
  message.hop_count += 1;

  // for each peer in connected_peers:
  const auto peers = peer_provider_();
  for (const auto& peer : peers) {
    //   if peer.id != msg.origin:
    if (peer.id != message.origin) {
      //      peer.send(msg)
      peer_sender_(peer, message);
      utils::Logger::Instance().Info(
          "routing_forwarded",
          {
              {"messageId", message.id},
              {"peerId", peer.id},
              {"hopCount", std::to_string(message.hop_count)},
              {"ttl", std::to_string(message.ttl)},
          });
    }
  }
}

MeshMessage EpidemicRouter::InjectMessage(const std::string& channel_id,
                                          const std::string& text,
                                          const int ttl,
                                          const std::string& origin) {
  MeshMessage message;
  message.id = utils::GenerateUuid();
  message.channel_id = channel_id;
  message.text = text;
  message.origin = origin;
  message.ttl = ttl;
  message.hop_count = 0;
  message.created_at_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                              std::chrono::system_clock::now().time_since_epoch())
                              .count();

  OnMessageReceived(message);
  return message;
}

}  // namespace spann::routing
