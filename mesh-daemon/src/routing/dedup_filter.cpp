#include "routing/dedup_filter.h"

#include <functional>

namespace spann::routing {

DedupFilter::DedupFilter(const std::size_t bit_count, const std::size_t hash_count)
    : bit_count_(bit_count),
      hash_count_(hash_count),
      bits_(bit_count, false) {}

bool DedupFilter::Contains(const std::string& id) {
  std::lock_guard<std::mutex> lock(mutex_);
  for (std::size_t i = 0; i < hash_count_; ++i) {
    const std::size_t index = Hash(id, i) % bit_count_;
    if (!bits_[index]) {
      return false;
    }
  }
  return true;
}

void DedupFilter::Add(const std::string& id) {
  std::lock_guard<std::mutex> lock(mutex_);
  for (std::size_t i = 0; i < hash_count_; ++i) {
    const std::size_t index = Hash(id, i) % bit_count_;
    bits_[index] = true;
  }
}

std::size_t DedupFilter::Hash(const std::string& input, const std::size_t seed) const {
  const std::hash<std::string> hasher;
  return hasher(input + std::to_string(seed));
}

}  // namespace spann::routing
