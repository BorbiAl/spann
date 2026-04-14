#pragma once

#include <QHash>
#include <QObject>
#include <QSet>
#include <QTimer>
#include <QVariantMap>
#include <QWebSocket>

class SupabaseRealtime : public QObject {
    Q_OBJECT

    Q_PROPERTY(QString supabaseUrl READ supabaseUrl WRITE setSupabaseUrl NOTIFY configChanged)
    Q_PROPERTY(QString anonKey READ anonKey WRITE setAnonKey NOTIFY configChanged)
    Q_PROPERTY(QString accessToken READ accessToken WRITE setAccessToken NOTIFY configChanged)
    Q_PROPERTY(QString presenceKey READ presenceKey WRITE setPresenceKey NOTIFY configChanged)
    Q_PROPERTY(bool connected READ connected NOTIFY connectedChanged)

public:
    explicit SupabaseRealtime(QObject* parent = nullptr);

    QString supabaseUrl() const;
    void setSupabaseUrl(const QString& value);

    QString anonKey() const;
    void setAnonKey(const QString& value);

    QString accessToken() const;
    void setAccessToken(const QString& value);

    QString presenceKey() const;
    void setPresenceKey(const QString& value);

    bool connected() const;

    Q_INVOKABLE void connectSocket();
    Q_INVOKABLE void disconnectSocket();

    Q_INVOKABLE QString subscribeChannel(const QString& topic, const QVariantMap& config = {});
    Q_INVOKABLE void unsubscribeChannel(const QString& topic);

    Q_INVOKABLE QString subscribeTable(
        const QString& table,
        const QString& eventName = QStringLiteral("*"),
        const QString& schema = QStringLiteral("public"),
        const QString& filter = QString());

    Q_INVOKABLE void trackPresence(const QString& topic, const QVariantMap& payload);
    Q_INVOKABLE void untrackPresence(const QString& topic);
    Q_INVOKABLE void sendBroadcast(const QString& topic, const QString& eventName, const QVariantMap& payload);

signals:
    void configChanged();
    void connectedChanged();
    void connectionStateChanged(const QString& state);

    void channelSubscribed(const QString& topic);
    void channelUnsubscribed(const QString& topic);

    void eventReceived(const QString& topic, const QString& eventName, const QVariantMap& payload);
    void postgresChangeReceived(const QString& topic, const QVariantMap& payload);

    void presenceUpdated(const QString& topic, const QVariantMap& state);
    void realtimeError(const QString& message);

private slots:
    void onConnected();
    void onDisconnected();
    void onTextMessageReceived(const QString& message);

private:
    QString websocketUrl() const;
    QString nextRef();

    void sendPhoenix(
        const QString& topic,
        const QString& eventName,
        const QVariantMap& payload,
        const QString& ref = QString());

    void resubscribeAll();
    void scheduleReconnect();

    QWebSocket m_socket;
    QTimer m_reconnectTimer;

    QString m_supabaseUrl;
    QString m_anonKey;
    QString m_accessToken;
    QString m_presenceKey;

    bool m_connected = false;
    bool m_shouldReconnect = true;
    int m_refCounter = 0;

    QSet<QString> m_topics;
    QHash<QString, QString> m_topicJoinRefs;
    QHash<QString, QVariantMap> m_presenceByTopic;
};
