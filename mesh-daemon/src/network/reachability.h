#pragma once

#include <atomic>
#include <chrono>
#include <functional>
#include <thread>

namespace spann::network {

class ReachabilityMonitor {
 public:
  using Callback = std::function<void(bool reachable)>;

  explicit ReachabilityMonitor(std::chrono::seconds interval = std::chrono::seconds(5));
  ~ReachabilityMonitor();

  void Start(Callback callback);
  void Stop();

  bool IsReachable() const;

 private:
  bool ProbeInternet() const;

  std::chrono::seconds interval_;
  std::atomic<bool> running_{false};
  std::atomic<bool> reachable_{false};
  std::thread thread_;
};

}  // namespace spann::network
