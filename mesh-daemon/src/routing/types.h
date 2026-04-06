#pragma once

#include <cstdint>
#include <string>

namespace spann::routing {

struct MeshMessage {
  std::string id;
  std::string channel_id;
  std::string text;
  std::string origin;
  int ttl = 6;
  int hop_count = 0;
  std::int64_t created_at_ms = 0;
};

struct PeerInfo {
  std::string id;
  std::string name;
  int signal = 0;
};

}  // namespace spann::routing
