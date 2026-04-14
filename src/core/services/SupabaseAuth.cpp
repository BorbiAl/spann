#include "SupabaseAuth.hpp"

#include <QJsonDocument>
#include <QJsonValue>

namespace {
constexpr const char* kSettingsGroup = "supabase/auth";
}

SupabaseAuth::SupabaseAuth(QObject* parent)
    : QObject(parent)
    , m_ownedHttpClient(new HttpClient(this))
    , m_httpClient(m_ownedHttpClient) {
    connect(m_httpClient, &HttpClient::requestFinished, this, &SupabaseAuth::onHttpFinished);
    connect(m_httpClient, &HttpClient::requestFailed, this, &SupabaseAuth::onHttpFailed);
}

SupabaseAuth::SupabaseAuth(HttpClient* httpClient, QObject* parent)
    : QObject(parent)
    , m_httpClient(httpClient) {
    if (!m_httpClient) {
        m_ownedHttpClient = new HttpClient(this);
        m_httpClient = m_ownedHttpClient;
    }

    connect(m_httpClient, &HttpClient::requestFinished, this, &SupabaseAuth::onHttpFinished);
    connect(m_httpClient, &HttpClient::requestFailed, this, &SupabaseAuth::onHttpFailed);
}

QString SupabaseAuth::supabaseUrl() const {
    return m_supabaseUrl;
}

void SupabaseAuth::setSupabaseUrl(const QString& url) {
    if (m_supabaseUrl == url) {
        return;
    }
    m_supabaseUrl = url;
    emit configChanged();
}

QString SupabaseAuth::anonKey() const {
    return m_anonKey;
}

void SupabaseAuth::setAnonKey(const QString& key) {
    if (m_anonKey == key) {
        return;
    }
    m_anonKey = key;
    emit configChanged();
}

QString SupabaseAuth::accessToken() const {
    return m_accessToken;
}

QString SupabaseAuth::refreshToken() const {
    return m_refreshToken;
}

QString SupabaseAuth::userId() const {
    return m_userId;
}

bool SupabaseAuth::authenticated() const {
    return !m_accessToken.isEmpty() && !m_userId.isEmpty();
}

QHash<QString, QString> SupabaseAuth::authHeaders(bool withAuth) const {
    QHash<QString, QString> headers;
    headers.insert(QStringLiteral("apikey"), m_anonKey);
    headers.insert(QStringLiteral("Content-Type"), QStringLiteral("application/json"));
    if (withAuth && !m_accessToken.isEmpty()) {
        headers.insert(QStringLiteral("Authorization"), QStringLiteral("Bearer %1").arg(m_accessToken));
    }
    return headers;
}

QString SupabaseAuth::endpointUrl(const QString& path) const {
    QString base = m_supabaseUrl;
    if (base.endsWith('/')) {
        base.chop(1);
    }
    QString normalized = path;
    if (!normalized.startsWith('/')) {
        normalized.prepend('/');
    }
    return base + normalized;
}

QString SupabaseAuth::signIn(const QString& email, const QString& password) {
    QJsonObject body;
    body.insert(QStringLiteral("email"), email);
    body.insert(QStringLiteral("password"), password);

    const QUuid requestId = m_httpClient->post(
        QUrl(endpointUrl(QStringLiteral("/auth/v1/token?grant_type=password"))),
        authHeaders(false),
        QJsonDocument(body).toJson(QJsonDocument::Compact));

    m_pendingOps.insert(requestId, QStringLiteral("signIn"));
    return requestId.toString(QUuid::WithoutBraces);
}

QString SupabaseAuth::signUp(const QString& email, const QString& password, const QVariantMap& metadata) {
    QJsonObject body;
    body.insert(QStringLiteral("email"), email);
    body.insert(QStringLiteral("password"), password);
    body.insert(QStringLiteral("data"), QJsonObject::fromVariantMap(metadata));

    const QUuid requestId = m_httpClient->post(
        QUrl(endpointUrl(QStringLiteral("/auth/v1/signup"))),
        authHeaders(false),
        QJsonDocument(body).toJson(QJsonDocument::Compact));

    m_pendingOps.insert(requestId, QStringLiteral("signUp"));
    return requestId.toString(QUuid::WithoutBraces);
}

QString SupabaseAuth::refreshSession() {
    QJsonObject body;
    body.insert(QStringLiteral("refresh_token"), m_refreshToken);

    const QUuid requestId = m_httpClient->post(
        QUrl(endpointUrl(QStringLiteral("/auth/v1/token?grant_type=refresh_token"))),
        authHeaders(false),
        QJsonDocument(body).toJson(QJsonDocument::Compact));

    m_pendingOps.insert(requestId, QStringLiteral("refresh"));
    return requestId.toString(QUuid::WithoutBraces);
}

QString SupabaseAuth::signOut() {
    const QUuid requestId = m_httpClient->post(
        QUrl(endpointUrl(QStringLiteral("/auth/v1/logout"))),
        authHeaders(true),
        QByteArray("{}"));

    m_pendingOps.insert(requestId, QStringLiteral("signOut"));
    return requestId.toString(QUuid::WithoutBraces);
}

void SupabaseAuth::restoreSession() {
    QSettings settings;
    settings.beginGroup(QString::fromUtf8(kSettingsGroup));
    m_accessToken = settings.value(QStringLiteral("accessToken")).toString();
    m_refreshToken = settings.value(QStringLiteral("refreshToken")).toString();
    m_userId = settings.value(QStringLiteral("userId")).toString();
    settings.endGroup();
    emit sessionChanged();
}

void SupabaseAuth::clearSession() {
    m_accessToken.clear();
    m_refreshToken.clear();
    m_userId.clear();

    QSettings settings;
    settings.beginGroup(QString::fromUtf8(kSettingsGroup));
    settings.remove(QString());
    settings.endGroup();

    emit sessionChanged();
}

void SupabaseAuth::persistSession() const {
    QSettings settings;
    settings.beginGroup(QString::fromUtf8(kSettingsGroup));
    settings.setValue(QStringLiteral("accessToken"), m_accessToken);
    settings.setValue(QStringLiteral("refreshToken"), m_refreshToken);
    settings.setValue(QStringLiteral("userId"), m_userId);
    settings.endGroup();
}

void SupabaseAuth::updateSessionFromPayload(const QJsonObject& payload) {
    const QJsonObject sessionObject = payload.contains(QStringLiteral("session"))
        ? payload.value(QStringLiteral("session")).toObject()
        : payload;

    m_accessToken = sessionObject.value(QStringLiteral("access_token")).toString();
    m_refreshToken = sessionObject.value(QStringLiteral("refresh_token")).toString();

    QJsonObject userObject = payload.value(QStringLiteral("user")).toObject();
    if (userObject.isEmpty()) {
        userObject = sessionObject.value(QStringLiteral("user")).toObject();
    }
    m_userId = userObject.value(QStringLiteral("id")).toString();

    persistSession();
    emit sessionChanged();
}

void SupabaseAuth::onHttpFinished(
    const QUuid& requestId,
    int statusCode,
    const QByteArray& body,
    const QVariantMap& headers) {
    Q_UNUSED(headers)

    if (!m_pendingOps.contains(requestId)) {
        return;
    }

    const QString op = m_pendingOps.take(requestId);
    QJsonParseError parseError;
    const QJsonDocument doc = QJsonDocument::fromJson(body, &parseError);

    if (op == QStringLiteral("signOut")) {
        clearSession();
        emit loggedOut();
        emit authSucceeded(op, QJsonObject());
        return;
    }

    if (parseError.error != QJsonParseError::NoError || !doc.isObject()) {
        emit authFailed(op, QStringLiteral("Invalid auth response payload"), statusCode);
        return;
    }

    const QJsonObject obj = doc.object();
    if (statusCode >= 200 && statusCode < 300) {
        updateSessionFromPayload(obj);
        emit authSucceeded(op, obj);
        return;
    }

    const QString message = obj.value(QStringLiteral("msg")).toString(
        obj.value(QStringLiteral("message")).toString(QStringLiteral("Auth request failed")));
    emit authFailed(op, message, statusCode);
}

void SupabaseAuth::onHttpFailed(
    const QUuid& requestId,
    const QString& errorText,
    int networkError,
    int statusCode,
    const QByteArray& body) {
    Q_UNUSED(networkError)
    Q_UNUSED(body)

    if (!m_pendingOps.contains(requestId)) {
        return;
    }

    const QString op = m_pendingOps.take(requestId);
    emit authFailed(op, errorText, statusCode);
}
