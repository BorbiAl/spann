#pragma once

#include <atomic>

namespace spann::ble {

class GattServer {
 public:
  void Start();
  void Stop();
  bool IsRunning() const;

 private:
  std::atomic<bool> running_{false};
};

}  // namespace spann::ble
