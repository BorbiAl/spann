#include "network/failover.h"

#include "utils/logger.h"

namespace spann::network {

void FailoverController::SetCallback(Callback callback) {
  std::lock_guard<std::mutex> lock(callback_mutex_);
  callback_ = std::move(callback);
}

void FailoverController::OnReachabilityChanged(const bool reachable) {
  const Mode next_mode = reachable ? Mode::kInternet : Mode::kMesh;
  const Mode current_mode = mode_.load();

  if (current_mode == next_mode) {
    return;
  }

  mode_.store(next_mode);

  utils::Logger::Instance().Info("failover_mode_changed",
                                 {{"mode", reachable ? "internet" : "mesh"}});

  Callback callback;
  {
    std::lock_guard<std::mutex> lock(callback_mutex_);
    callback = callback_;
  }

  if (callback) {
    callback(next_mode);
  }
}

Mode FailoverController::CurrentMode() const { return mode_.load(); }

}  // namespace spann::network
