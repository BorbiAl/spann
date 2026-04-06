#pragma once

#include <map>
#include <mutex>
#include <string>

namespace spann::utils {

class Logger {
 public:
  static Logger& Instance();

  void Info(const std::string& message,
            const std::map<std::string, std::string>& fields = {});
  void Warn(const std::string& message,
            const std::map<std::string, std::string>& fields = {});
  void Error(const std::string& message,
             const std::map<std::string, std::string>& fields = {});

 private:
  Logger() = default;
  void Log(const std::string& level,
           const std::string& message,
           const std::map<std::string, std::string>& fields);

  std::mutex mutex_;
};

}  // namespace spann::utils
