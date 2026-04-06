#include "routing/message_store.h"

#include <stdexcept>

#include <nlohmann/json.hpp>

#include "utils/logger.h"

namespace spann::routing {

namespace {

constexpr const char* kMessagePrefix = "msg:";
const leveldb::Slice kMessagePrefixSlice(kMessagePrefix);

nlohmann::json ToJson(const MeshMessage& message) {
  return nlohmann::json{
      {"id", message.id},
      {"channel_id", message.channel_id},
      {"text", message.text},
      {"origin", message.origin},
      {"ttl", message.ttl},
      {"hop_count", message.hop_count},
      {"created_at_ms", message.created_at_ms},
  };
}

MeshMessage FromJson(const nlohmann::json& payload) {
  MeshMessage message;
  message.id = payload.value("id", "");
  message.channel_id = payload.value("channel_id", "");
  message.text = payload.value("text", "");
  message.origin = payload.value("origin", "");
  message.ttl = payload.value("ttl", 0);
  message.hop_count = payload.value("hop_count", 0);
  message.created_at_ms = payload.value("created_at_ms", static_cast<std::int64_t>(0));
  return message;
}

}  // namespace

MessageStore::MessageStore(const std::string& db_path) {
  leveldb::Options options;
  options.create_if_missing = true;

  leveldb::DB* database = nullptr;
  const leveldb::Status status = leveldb::DB::Open(options, db_path, &database);
  if (!status.ok()) {
    throw std::runtime_error("Failed to open LevelDB: " + status.ToString());
  }

  db_.reset(database);
}

MessageStore::~MessageStore() = default;

bool MessageStore::Save(const MeshMessage& message) {
  std::lock_guard<std::mutex> lock(mutex_);
  const std::string key = BuildKey(message.id);
  const std::string value = ToJson(message).dump();

  const leveldb::Status status = db_->Put(leveldb::WriteOptions(), key, value);
  if (!status.ok()) {
    utils::Logger::Instance().Error("leveldb_save_failed", {{"error", status.ToString()}});
    return false;
  }
  return true;
}

std::vector<MeshMessage> MessageStore::ListPending(const std::size_t limit) const {
  std::lock_guard<std::mutex> lock(mutex_);

  std::vector<MeshMessage> messages;
  std::unique_ptr<leveldb::Iterator> iterator(db_->NewIterator(leveldb::ReadOptions()));

  for (iterator->Seek(kMessagePrefix); iterator->Valid() && messages.size() < limit;
       iterator->Next()) {
    if (!iterator->key().starts_with(kMessagePrefixSlice)) {
      break;
    }

    const auto payload = nlohmann::json::parse(iterator->value().ToString(), nullptr, false);
    if (payload.is_discarded()) {
      continue;
    }
    messages.push_back(FromJson(payload));
  }

  return messages;
}

std::size_t MessageStore::Size() const {
  std::lock_guard<std::mutex> lock(mutex_);

  std::size_t count = 0;
  std::unique_ptr<leveldb::Iterator> iterator(db_->NewIterator(leveldb::ReadOptions()));
  for (iterator->Seek(kMessagePrefix); iterator->Valid(); iterator->Next()) {
    if (!iterator->key().starts_with(kMessagePrefixSlice)) {
      break;
    }
    ++count;
  }
  return count;
}

bool MessageStore::Remove(const std::string& message_id) {
  std::lock_guard<std::mutex> lock(mutex_);

  const leveldb::Status status = db_->Delete(leveldb::WriteOptions(), BuildKey(message_id));
  if (!status.ok()) {
    utils::Logger::Instance().Warn("leveldb_remove_failed", {{"error", status.ToString()}});
    return false;
  }
  return true;
}

std::string MessageStore::BuildKey(const std::string& id) {
  return std::string(kMessagePrefix) + id;
}

}  // namespace spann::routing
