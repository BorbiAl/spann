cmake_minimum_required(VERSION 3.20)
project(spann_mesh_daemon LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Threads REQUIRED)
find_package(leveldb REQUIRED)
find_package(nlohmann_json REQUIRED)
find_path(CROW_INCLUDE_DIRS crow.h PATHS /usr/local/include /usr/include REQUIRED)

add_executable(mesh-daemon
  src/main.cpp
  src/ble/advertiser.cpp
  src/ble/scanner.cpp
  src/ble/gatt_server.cpp
  src/webrtc/peer_connection.cpp
  src/webrtc/signaling.cpp
  src/routing/epidemic_router.cpp
  src/routing/message_store.cpp
  src/routing/dedup_filter.cpp
  src/network/reachability.cpp
  src/network/failover.cpp
  src/api/http_server.cpp
  src/api/handlers.cpp
  src/utils/logger.cpp
  src/utils/uuid.cpp
)

target_include_directories(mesh-daemon PRIVATE src ${CROW_INCLUDE_DIRS})

target_link_libraries(mesh-daemon
  PRIVATE
    leveldb::leveldb
    nlohmann_json::nlohmann_json
    Threads::Threads
)
