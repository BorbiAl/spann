#pragma once

#include <cstddef>
#include <mutex>
#include <string>
#include <vector>

namespace spann::routing {

class DedupFilter {
 public:
  explicit DedupFilter(std::size_t bit_count = 1 << 20, std::size_t hash_count = 3);

  bool Contains(const std::string& id);
  void Add(const std::string& id);

 private:
  std::size_t Hash(const std::string& input, std::size_t seed) const;

  std::size_t bit_count_;
  std::size_t hash_count_;
  std::vector<bool> bits_;
  std::mutex mutex_;
};

}  // namespace spann::routing
