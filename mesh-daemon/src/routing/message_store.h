#pragma once

#include <memory>
#include <mutex>
#include <string>
#include <vector>

#include <leveldb/db.h>

#include "routing/types.h"

namespace spann::routing {

class MessageStore {
 public:
  explicit MessageStore(const std::string& db_path);
  ~MessageStore();

  bool Save(const MeshMessage& message);
  std::vector<MeshMessage> ListPending(std::size_t limit = 200) const;
  std::size_t Size() const;
  bool Remove(const std::string& message_id);

 private:
  static std::string BuildKey(const std::string& id);

  std::unique_ptr<leveldb::DB> db_;
  mutable std::mutex mutex_;
};

}  // namespace spann::routing
