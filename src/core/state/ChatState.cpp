#include "ChatState.hpp"

ChatState::ChatState(QObject* parent)
    : QObject(parent) {
    loadOfflineQueue();
}

bool ChatState::liveFeedEnabled() const {
    return m_liveFeedEnabled;
}

void ChatState::setLiveFeedEnabled(bool value) {
    if (m_liveFeedEnabled == value) {
        return;
    }
    m_liveFeedEnabled = value;
    emit liveFeedEnabledChanged();
}

QString ChatState::activeTypistName() const {
    return m_activeTypistName;
}

void ChatState::setActiveTypistName(const QString& value) {
    if (m_activeTypistName == value) {
        return;
    }
    m_activeTypistName = value;
    emit activeTypistNameChanged();
}

void ChatState::setTypingUser(const QString& userId, const QString& displayName, bool typing) {
    if (typing) {
        m_typingByUser.insert(userId, displayName);
    } else {
        m_typingByUser.remove(userId);
    }

    setActiveTypistName(m_typingByUser.isEmpty() ? QString() : m_typingByUser.begin().value());
    emit typingUsersChanged();
}

QStringList ChatState::typingUsers() const {
    return m_typingByUser.values();
}

void ChatState::setNudgeForMessage(const QString& messageId, const QString& text) {
    if (text.isEmpty()) {
        m_nudgeByMessage.remove(messageId);
    } else {
        m_nudgeByMessage.insert(messageId, text);
    }
    emit nudgeChanged(messageId);
}

QString ChatState::nudgeForMessage(const QString& messageId) const {
    return m_nudgeByMessage.value(messageId);
}

void ChatState::dismissNudge(const QString& messageId) {
    if (!m_nudgeByMessage.contains(messageId)) {
        return;
    }
    m_nudgeByMessage.remove(messageId);
    emit nudgeChanged(messageId);
}

void ChatState::enqueueOfflineMessage(const QVariantMap& messagePayload) {
    m_offlineQueue.append(messagePayload);
    persistOfflineQueue();
    emit offlineQueueChanged();
}

QVariantList ChatState::offlineQueue() const {
    return m_offlineQueue;
}

QVariantMap ChatState::dequeueOfflineMessage() {
    if (m_offlineQueue.isEmpty()) {
        return {};
    }

    const QVariantMap first = m_offlineQueue.takeFirst().toMap();
    persistOfflineQueue();
    emit offlineQueueChanged();
    return first;
}

void ChatState::clearOfflineQueue() {
    if (m_offlineQueue.isEmpty()) {
        return;
    }

    m_offlineQueue.clear();
    persistOfflineQueue();
    emit offlineQueueChanged();
}

void ChatState::persistOfflineQueue() const {
    QSettings settings;
    settings.setValue(QStringLiteral("offlineMessageQueue"), m_offlineQueue);
}

void ChatState::loadOfflineQueue() {
    QSettings settings;
    m_offlineQueue = settings.value(QStringLiteral("offlineMessageQueue")).toList();
}
