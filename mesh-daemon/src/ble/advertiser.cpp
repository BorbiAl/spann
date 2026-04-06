#include "ble/advertiser.h"

#include "utils/logger.h"

namespace spann::ble {

void Advertiser::Start(const std::string& node_name) {
  if (running_.exchange(true)) {
    return;
  }

  utils::Logger::Instance().Info("ble_advertiser_started", {{"nodeName", node_name}});
}

void Advertiser::Stop() {
  if (!running_.exchange(false)) {
    return;
  }

  utils::Logger::Instance().Info("ble_advertiser_stopped");
}

bool Advertiser::IsRunning() const { return running_.load(); }

}  // namespace spann::ble
