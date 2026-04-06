#pragma once

#include <atomic>
#include <functional>
#include <mutex>

namespace spann::network {

enum class Mode { kInternet, kMesh };

class FailoverController {
 public:
  using Callback = std::function<void(Mode mode)>;

  void SetCallback(Callback callback);
  void OnReachabilityChanged(bool reachable);
  Mode CurrentMode() const;

 private:
  std::atomic<Mode> mode_{Mode::kMesh};
  std::mutex callback_mutex_;
  Callback callback_;
};

}  // namespace spann::network
