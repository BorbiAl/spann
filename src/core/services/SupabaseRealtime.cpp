#include "SupabaseRealtime.hpp"

#include <QJsonDocument>
#include <QJsonObject>
#include <QUrl>
#include <QUrlQuery>

SupabaseRealtime::SupabaseRealtime(QObject* parent)
    : QObject(parent) {
    connect(&m_socket, &QWebSocket::connected, this, &SupabaseRealtime::onConnected);
    connect(&m_socket, &QWebSocket::disconnected, this, &SupabaseRealtime::onDisconnected);
    connect(&m_socket, &QWebSocket::textMessageReceived, this, &SupabaseRealtime::onTextMessageReceived);

    m_reconnectTimer.setSingleShot(true);
    m_reconnectTimer.setInterval(2000);
    connect(&m_reconnectTimer, &QTimer::timeout, this, [this]() {
        if (m_shouldReconnect && !m_connected) {
            connectSocket();
        }
    });
}

QString SupabaseRealtime::supabaseUrl() const {
    return m_supabaseUrl;
}

void SupabaseRealtime::setSupabaseUrl(const QString& value) {
    if (m_supabaseUrl == value) {
        return;
    }
    m_supabaseUrl = value;
    emit configChanged();
}

QString SupabaseRealtime::anonKey() const {
    return m_anonKey;
}

void SupabaseRealtime::setAnonKey(const QString& value) {
    if (m_anonKey == value) {
        return;
    }
    m_anonKey = value;
    emit configChanged();
}

QString SupabaseRealtime::accessToken() const {
    return m_accessToken;
}

void SupabaseRealtime::setAccessToken(const QString& value) {
    if (m_accessToken == value) {
        return;
    }
    m_accessToken = value;
    emit configChanged();
}

QString SupabaseRealtime::presenceKey() const {
    return m_presenceKey;
}

void SupabaseRealtime::setPresenceKey(const QString& value) {
    if (m_presenceKey == value) {
        return;
    }
    m_presenceKey = value;
    emit configChanged();
}

bool SupabaseRealtime::connected() const {
    return m_connected;
}

QString SupabaseRealtime::websocketUrl() const {
    QUrl base(m_supabaseUrl);
    if (!base.isValid()) {
        return QString();
    }

    base.setPath(QStringLiteral("/realtime/v1/websocket"));
    base.setScheme(base.scheme() == QStringLiteral("https") ? QStringLiteral("wss") : QStringLiteral("ws"));

    QUrlQuery query;
    query.addQueryItem(QStringLiteral("apikey"), m_anonKey);
    query.addQueryItem(QStringLiteral("vsn"), QStringLiteral("1.0.0"));
    if (!m_accessToken.isEmpty()) {
        query.addQueryItem(QStringLiteral("access_token"), m_accessToken);
    }
    base.setQuery(query);

    return base.toString(QUrl::FullyEncoded);
}

QString SupabaseRealtime::nextRef() {
    ++m_refCounter;
    return QString::number(m_refCounter);
}

void SupabaseRealtime::connectSocket() {
    if (m_connected || m_socket.state() == QAbstractSocket::ConnectingState) {
        return;
    }

    const QString url = websocketUrl();
    if (url.isEmpty()) {
        emit realtimeError(QStringLiteral("SupabaseRealtime config is incomplete"));
        return;
    }

    m_shouldReconnect = true;
    emit connectionStateChanged(QStringLiteral("connecting"));
    m_socket.open(QUrl(url));
}

void SupabaseRealtime::disconnectSocket() {
    m_shouldReconnect = false;
    m_reconnectTimer.stop();

    if (m_socket.state() == QAbstractSocket::ConnectedState
        || m_socket.state() == QAbstractSocket::ConnectingState) {
        m_socket.close();
    }
}

void SupabaseRealtime::onConnected() {
    m_connected = true;
    emit connectedChanged();
    emit connectionStateChanged(QStringLiteral("connected"));
    resubscribeAll();
}

void SupabaseRealtime::onDisconnected() {
    const bool wasConnected = m_connected;
    m_connected = false;

    if (wasConnected) {
        emit connectedChanged();
    }

    emit connectionStateChanged(m_shouldReconnect ? QStringLiteral("reconnecting") : QStringLiteral("disconnected"));
    scheduleReconnect();
}

void SupabaseRealtime::scheduleReconnect() {
    if (m_shouldReconnect && !m_reconnectTimer.isActive()) {
        m_reconnectTimer.start();
    }
}

void SupabaseRealtime::sendPhoenix(
    const QString& topic,
    const QString& eventName,
    const QVariantMap& payload,
    const QString& ref) {
    QJsonObject message;
    message.insert(QStringLiteral("topic"), topic);
    message.insert(QStringLiteral("event"), eventName);
    message.insert(QStringLiteral("payload"), QJsonObject::fromVariantMap(payload));
    message.insert(QStringLiteral("ref"), ref.isEmpty() ? nextRef() : ref);

    m_socket.sendTextMessage(QString::fromUtf8(QJsonDocument(message).toJson(QJsonDocument::Compact)));
}

QString SupabaseRealtime::subscribeChannel(const QString& topic, const QVariantMap& config) {
    m_topics.insert(topic);

    QVariantMap payload = config;
    if (!payload.contains(QStringLiteral("config"))) {
        payload.insert(QStringLiteral("config"), QVariantMap());
    }

    const QVariantMap configMap = payload.value(QStringLiteral("config")).toMap();
    if (!configMap.contains(QStringLiteral("presence"))) {
        QVariantMap updatedConfig = configMap;
        updatedConfig.insert(QStringLiteral("presence"), QVariantMap{{QStringLiteral("key"), m_presenceKey}});
        payload.insert(QStringLiteral("config"), updatedConfig);
    }

    const QString joinRef = nextRef();
    m_topicJoinRefs.insert(topic, joinRef);

    if (m_connected) {
        sendPhoenix(topic, QStringLiteral("phx_join"), payload, joinRef);
    }

    return joinRef;
}

void SupabaseRealtime::unsubscribeChannel(const QString& topic) {
    m_topics.remove(topic);
    m_topicJoinRefs.remove(topic);
    m_presenceByTopic.remove(topic);

    if (m_connected) {
        sendPhoenix(topic, QStringLiteral("phx_leave"), {}, nextRef());
    }

    emit channelUnsubscribed(topic);
}

QString SupabaseRealtime::subscribeTable(
    const QString& table,
    const QString& eventName,
    const QString& schema,
    const QString& filter) {
    const QString topic = QStringLiteral("realtime:%1:%2").arg(schema, table);

    QVariantMap change;
    change.insert(QStringLiteral("event"), eventName);
    change.insert(QStringLiteral("schema"), schema);
    change.insert(QStringLiteral("table"), table);
    if (!filter.isEmpty()) {
        change.insert(QStringLiteral("filter"), filter);
    }

    QVariantMap payload;
    payload.insert(
        QStringLiteral("config"),
        QVariantMap{
            {QStringLiteral("broadcast"), QVariantMap{{QStringLiteral("self"), true}}},
            {QStringLiteral("presence"), QVariantMap{{QStringLiteral("key"), m_presenceKey}}},
            {QStringLiteral("postgres_changes"), QVariantList{change}}});

    return subscribeChannel(topic, payload);
}

void SupabaseRealtime::trackPresence(const QString& topic, const QVariantMap& payload) {
    if (!m_connected) {
        return;
    }
    sendPhoenix(topic, QStringLiteral("presence"), QVariantMap{{QStringLiteral("type"), QStringLiteral("track")}, {QStringLiteral("payload"), payload}});
}

void SupabaseRealtime::untrackPresence(const QString& topic) {
    if (!m_connected) {
        return;
    }
    sendPhoenix(topic, QStringLiteral("presence"), QVariantMap{{QStringLiteral("type"), QStringLiteral("untrack")}});
}

void SupabaseRealtime::sendBroadcast(const QString& topic, const QString& eventName, const QVariantMap& payload) {
    if (!m_connected) {
        return;
    }

    sendPhoenix(
        topic,
        QStringLiteral("broadcast"),
        QVariantMap{{QStringLiteral("type"), eventName}, {QStringLiteral("event"), eventName}, {QStringLiteral("payload"), payload}});
}

void SupabaseRealtime::resubscribeAll() {
    for (const QString& topic : std::as_const(m_topics)) {
        const QString joinRef = m_topicJoinRefs.value(topic, nextRef());
        m_topicJoinRefs.insert(topic, joinRef);

        QVariantMap payload;
        payload.insert(
            QStringLiteral("config"),
            QVariantMap{{QStringLiteral("presence"), QVariantMap{{QStringLiteral("key"), m_presenceKey}}}});

        sendPhoenix(topic, QStringLiteral("phx_join"), payload, joinRef);
    }
}

void SupabaseRealtime::onTextMessageReceived(const QString& message) {
    QJsonParseError parseError;
    const QJsonDocument doc = QJsonDocument::fromJson(message.toUtf8(), &parseError);
    if (parseError.error != QJsonParseError::NoError || !doc.isObject()) {
        emit realtimeError(QStringLiteral("Invalid realtime payload"));
        return;
    }

    const QJsonObject obj = doc.object();
    const QString topic = obj.value(QStringLiteral("topic")).toString();
    const QString eventName = obj.value(QStringLiteral("event")).toString();
    const QVariantMap payload = obj.value(QStringLiteral("payload")).toObject().toVariantMap();

    if (eventName == QStringLiteral("phx_reply")) {
        const QVariantMap response = payload.value(QStringLiteral("response")).toMap();
        const QString status = payload.value(QStringLiteral("status")).toString();
        if (status == QStringLiteral("ok")) {
            emit channelSubscribed(topic);
        } else {
            emit realtimeError(
                response.value(QStringLiteral("message")).toString(QStringLiteral("Realtime channel join failed")));
        }
    }

    if (eventName == QStringLiteral("presence_state")) {
        m_presenceByTopic.insert(topic, payload);
        emit presenceUpdated(topic, payload);
    } else if (eventName == QStringLiteral("presence_diff")) {
        QVariantMap current = m_presenceByTopic.value(topic);
        const QVariantMap joins = payload.value(QStringLiteral("joins")).toMap();
        const QVariantMap leaves = payload.value(QStringLiteral("leaves")).toMap();

        for (auto it = joins.constBegin(); it != joins.constEnd(); ++it) {
            current.insert(it.key(), it.value());
        }
        for (auto it = leaves.constBegin(); it != leaves.constEnd(); ++it) {
            current.remove(it.key());
        }

        m_presenceByTopic.insert(topic, current);
        emit presenceUpdated(topic, current);
    }

    if (eventName == QStringLiteral("postgres_changes")) {
        emit postgresChangeReceived(topic, payload);
    }

    emit eventReceived(topic, eventName, payload);
}
