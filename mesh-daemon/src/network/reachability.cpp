#include "network/reachability.h"

#include <arpa/inet.h>
#include <fcntl.h>
#include <sys/select.h>
#include <sys/socket.h>
#include <unistd.h>

#include "utils/logger.h"

namespace spann::network {

namespace {
constexpr int kConnectTimeoutSeconds = 2;
constexpr const char* kProbeHost = "1.1.1.1";
constexpr int kProbePort = 53;
}  // namespace

ReachabilityMonitor::ReachabilityMonitor(const std::chrono::seconds interval)
    : interval_(interval) {}

ReachabilityMonitor::~ReachabilityMonitor() { Stop(); }

void ReachabilityMonitor::Start(Callback callback) {
  if (running_.exchange(true)) {
    return;
  }

  thread_ = std::thread([this, callback = std::move(callback)]() mutable {
    bool last_state = false;
    while (running_.load()) {
      const bool current = ProbeInternet();
      reachable_.store(current);
      if (current != last_state) {
        callback(current);
        last_state = current;
      }
      std::this_thread::sleep_for(interval_);
    }
  });

  utils::Logger::Instance().Info("reachability_monitor_started");
}

void ReachabilityMonitor::Stop() {
  if (!running_.exchange(false)) {
    return;
  }

  if (thread_.joinable()) {
    thread_.join();
  }

  utils::Logger::Instance().Info("reachability_monitor_stopped");
}

bool ReachabilityMonitor::IsReachable() const { return reachable_.load(); }

bool ReachabilityMonitor::ProbeInternet() const {
  const int sock = socket(AF_INET, SOCK_STREAM, 0);
  if (sock < 0) {
    return false;
  }

  const int old_flags = fcntl(sock, F_GETFL, 0);
  if (old_flags < 0) {
    close(sock);
    return false;
  }

  if (fcntl(sock, F_SETFL, old_flags | O_NONBLOCK) < 0) {
    close(sock);
    return false;
  }

  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_port = htons(kProbePort);
  inet_pton(AF_INET, kProbeHost, &address.sin_addr);

  connect(sock, reinterpret_cast<sockaddr*>(&address), sizeof(address));

  fd_set write_set;
  FD_ZERO(&write_set);
  FD_SET(sock, &write_set);

  timeval timeout{};
  timeout.tv_sec = kConnectTimeoutSeconds;

  const int select_result = select(sock + 1, nullptr, &write_set, nullptr, &timeout);
  close(sock);

  return select_result > 0;
}

}  // namespace spann::network
