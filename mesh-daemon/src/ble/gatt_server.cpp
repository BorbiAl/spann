#include "ble/gatt_server.h"

#include "utils/logger.h"

namespace spann::ble {

void GattServer::Start() {
  if (running_.exchange(true)) {
    return;
  }
  utils::Logger::Instance().Info("ble_gatt_server_started");
}

void GattServer::Stop() {
  if (!running_.exchange(false)) {
    return;
  }
  utils::Logger::Instance().Info("ble_gatt_server_stopped");
}

bool GattServer::IsRunning() const { return running_.load(); }

}  // namespace spann::ble
