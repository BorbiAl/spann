#include "api/http_server.h"

#include <nlohmann/json.hpp>

#include "utils/logger.h"

namespace spann::api {

HttpServer::HttpServer(const std::uint16_t port, Handlers& handlers)
    : port_(port), handlers_(handlers) {}

HttpServer::~HttpServer() { Stop(); }

void HttpServer::Start() {
  if (running_.exchange(true)) {
    return;
  }

  CROW_ROUTE(app_, "/health")([]() {
    return crow::response{200, R"({"status":"ok"})"};
  });

  CROW_ROUTE(app_, "/status")([this]() {
    return crow::response{handlers_.GetStatus().dump()};
  });

  CROW_ROUTE(app_, "/nodes")([this]() {
    return crow::response{handlers_.GetNodes().dump()};
  });

  CROW_ROUTE(app_, "/send").methods(crow::HTTPMethod::Post)([this](const crow::request& request) {
    const auto payload = nlohmann::json::parse(request.body, nullptr, false);
    if (payload.is_discarded()) {
      return crow::response{400, R"({"error":"invalid JSON body"})"};
    }
    const auto response = handlers_.PostSend(payload);
    if (response.contains("error")) {
      return crow::response{400, response.dump()};
    }
    return crow::response{201, response.dump()};
  });

  CROW_ROUTE(app_, "/queue")([this]() {
    return crow::response{handlers_.GetQueue().dump()};
  });

  CROW_ROUTE(app_, "/sync").methods(crow::HTTPMethod::Post)([this]() {
    return crow::response{handlers_.PostSync().dump()};
  });

  thread_ = std::thread([this]() {
    utils::Logger::Instance().Info("http_server_started", {{"port", std::to_string(port_)}});
    app_.port(port_).multithreaded().run();
  });
}

void HttpServer::Stop() {
  if (!running_.exchange(false)) {
    return;
  }

  app_.stop();
  if (thread_.joinable()) {
    thread_.join();
  }

  utils::Logger::Instance().Info("http_server_stopped");
}

}  // namespace spann::api
