#pragma once

#include <functional>

#include <nlohmann/json.hpp>

#include "ble/scanner.h"
#include "network/failover.h"
#include "routing/epidemic_router.h"
#include "routing/message_store.h"

namespace spann::api {

class Handlers {
 public:
  using SyncCallback = std::function<int()>;

  Handlers(network::FailoverController& failover,
           ble::Scanner& scanner,
           routing::MessageStore& message_store,
           routing::EpidemicRouter& router,
           SyncCallback sync_callback);

  nlohmann::json GetStatus() const;
  nlohmann::json GetNodes() const;
  nlohmann::json PostSend(const nlohmann::json& body);
  nlohmann::json GetQueue() const;
  nlohmann::json PostSync() const;

 private:
  network::FailoverController& failover_;
  ble::Scanner& scanner_;
  routing::MessageStore& message_store_;
  routing::EpidemicRouter& router_;
  SyncCallback sync_callback_;
};

}  // namespace spann::api
