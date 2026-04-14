#pragma once

#include <QObject>
#include <QSettings>
#include <QVariantList>

class ChatState : public QObject {
    Q_OBJECT

    Q_PROPERTY(bool liveFeedEnabled READ liveFeedEnabled WRITE setLiveFeedEnabled NOTIFY liveFeedEnabledChanged)
    Q_PROPERTY(QString activeTypistName READ activeTypistName WRITE setActiveTypistName NOTIFY activeTypistNameChanged)

public:
    explicit ChatState(QObject* parent = nullptr);

    bool liveFeedEnabled() const;
    void setLiveFeedEnabled(bool value);

    QString activeTypistName() const;
    void setActiveTypistName(const QString& value);

    Q_INVOKABLE void setTypingUser(const QString& userId, const QString& displayName, bool typing);
    Q_INVOKABLE QStringList typingUsers() const;

    Q_INVOKABLE void setNudgeForMessage(const QString& messageId, const QString& text);
    Q_INVOKABLE QString nudgeForMessage(const QString& messageId) const;
    Q_INVOKABLE void dismissNudge(const QString& messageId);

    Q_INVOKABLE void enqueueOfflineMessage(const QVariantMap& messagePayload);
    Q_INVOKABLE QVariantList offlineQueue() const;
    Q_INVOKABLE QVariantMap dequeueOfflineMessage();
    Q_INVOKABLE void clearOfflineQueue();

signals:
    void liveFeedEnabledChanged();
    void activeTypistNameChanged();
    void typingUsersChanged();
    void nudgeChanged(const QString& messageId);
    void offlineQueueChanged();

private:
    void persistOfflineQueue() const;
    void loadOfflineQueue();

    bool m_liveFeedEnabled = true;
    QString m_activeTypistName;

    QHash<QString, QString> m_typingByUser;
    QHash<QString, QString> m_nudgeByMessage;
    QVariantList m_offlineQueue;
};
