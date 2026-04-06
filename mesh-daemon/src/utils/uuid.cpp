#include "utils/uuid.h"

#include <array>
#include <random>
#include <sstream>

namespace spann::utils {

std::string GenerateUuid() {
  std::random_device random_device;
  std::mt19937_64 generator(random_device());
  std::uniform_int_distribution<uint32_t> distribution(0, 0xFFFFFFFF);

  std::array<uint32_t, 4> values = {
      distribution(generator),
      distribution(generator),
      distribution(generator),
      distribution(generator),
  };

  std::ostringstream output;
  output << std::hex;
  output << (values[0] >> 16);
  output << "-";
  output << (values[0] & 0xFFFF);
  output << "-";
  output << (values[1] & 0x0FFF) | 0x4000;
  output << "-";
  output << (values[2] & 0x3FFF) | 0x8000;
  output << "-";
  output << values[3];
  return output.str();
}

}  // namespace spann::utils
