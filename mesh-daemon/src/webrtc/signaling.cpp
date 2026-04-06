#include "webrtc/signaling.h"

namespace spann::webrtc {

void SignalingStore::SaveOffer(const std::string& peer_id,
                               const std::string& offer_sdp) {
  std::lock_guard<std::mutex> lock(mutex_);
  offers_[peer_id] = offer_sdp;
}

void SignalingStore::SaveAnswer(const std::string& peer_id,
                                const std::string& answer_sdp) {
  std::lock_guard<std::mutex> lock(mutex_);
  answers_[peer_id] = answer_sdp;
}

std::optional<std::string> SignalingStore::GetOffer(const std::string& peer_id) const {
  std::lock_guard<std::mutex> lock(mutex_);
  const auto iterator = offers_.find(peer_id);
  if (iterator == offers_.end()) {
    return std::nullopt;
  }
  return iterator->second;
}

std::optional<std::string> SignalingStore::GetAnswer(const std::string& peer_id) const {
  std::lock_guard<std::mutex> lock(mutex_);
  const auto iterator = answers_.find(peer_id);
  if (iterator == answers_.end()) {
    return std::nullopt;
  }
  return iterator->second;
}

}  // namespace spann::webrtc
