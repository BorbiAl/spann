#pragma once

#include <atomic>
#include <string>
#include <thread>

#include <crow.h>

#include "api/handlers.h"

namespace spann::api {

class HttpServer {
 public:
  HttpServer(std::string bind_address, std::uint16_t port, Handlers& handlers);
  ~HttpServer();

  void Start();
  void Stop();

 private:
  std::string bind_address_;
  std::uint16_t port_;
  Handlers& handlers_;
  crow::SimpleApp app_;
  std::thread thread_;
  std::atomic<bool> running_{false};
};

}  // namespace spann::api
