#include "utils/logger.h"

#include <chrono>
#include <iomanip>
#include <iostream>
#include <sstream>

namespace spann::utils {

namespace {

std::string ToIsoTimestamp() {
  const auto now = std::chrono::system_clock::now();
  const std::time_t now_time = std::chrono::system_clock::to_time_t(now);
  std::tm utc{};
#if defined(_WIN32)
  gmtime_s(&utc, &now_time);
#else
  gmtime_r(&now_time, &utc);
#endif
  std::ostringstream oss;
  oss << std::put_time(&utc, "%Y-%m-%dT%H:%M:%SZ");
  return oss.str();
}

std::string EscapeJson(const std::string& input) {
  std::ostringstream oss;
  for (const char ch : input) {
    switch (ch) {
      case '"':
        oss << "\\\"";
        break;
      case '\\':
        oss << "\\\\";
        break;
      case '\n':
        oss << "\\n";
        break;
      case '\r':
        oss << "\\r";
        break;
      case '\t':
        oss << "\\t";
        break;
      default:
        oss << ch;
        break;
    }
  }
  return oss.str();
}

}  // namespace

Logger& Logger::Instance() {
  static Logger instance;
  return instance;
}

void Logger::Info(const std::string& message,
                  const std::map<std::string, std::string>& fields) {
  Log("INFO", message, fields);
}

void Logger::Warn(const std::string& message,
                  const std::map<std::string, std::string>& fields) {
  Log("WARN", message, fields);
}

void Logger::Error(const std::string& message,
                   const std::map<std::string, std::string>& fields) {
  Log("ERROR", message, fields);
}

void Logger::Log(const std::string& level,
                 const std::string& message,
                 const std::map<std::string, std::string>& fields) {
  std::lock_guard<std::mutex> lock(mutex_);

  std::ostringstream output;
  output << "{";
  output << "\"timestamp\":\"" << ToIsoTimestamp() << "\",";
  output << "\"level\":\"" << EscapeJson(level) << "\",";
  output << "\"message\":\"" << EscapeJson(message) << "\"";

  for (const auto& [key, value] : fields) {
    output << ",\"" << EscapeJson(key) << "\":\"" << EscapeJson(value)
           << "\"";
  }
  output << "}";

  std::cout << output.str() << '\n';
}

}  // namespace spann::utils
