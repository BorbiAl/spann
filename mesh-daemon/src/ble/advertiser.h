#pragma once

#include <atomic>
#include <string>

namespace spann::ble {

class Advertiser {
 public:
  void Start(const std::string& node_name);
  void Stop();
  bool IsRunning() const;

 private:
  std::atomic<bool> running_{false};
};

}  // namespace spann::ble
