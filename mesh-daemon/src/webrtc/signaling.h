#pragma once

#include <mutex>
#include <optional>
#include <string>
#include <unordered_map>

namespace spann::webrtc {

class SignalingStore {
 public:
  void SaveOffer(const std::string& peer_id, const std::string& offer_sdp);
  void SaveAnswer(const std::string& peer_id, const std::string& answer_sdp);

  std::optional<std::string> GetOffer(const std::string& peer_id) const;
  std::optional<std::string> GetAnswer(const std::string& peer_id) const;

 private:
  mutable std::mutex mutex_;
  std::unordered_map<std::string, std::string> offers_;
  std::unordered_map<std::string, std::string> answers_;
};

}  // namespace spann::webrtc
