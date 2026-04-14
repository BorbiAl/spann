#include "SupabaseStorage.hpp"

SupabaseStorage::SupabaseStorage(SupabaseAuth* auth, QObject* parent)
    : QObject(parent)
    , m_auth(auth)
    , m_ownedHttpClient(new HttpClient(this))
    , m_httpClient(m_ownedHttpClient) {
    connect(m_httpClient, &HttpClient::requestFinished, this, &SupabaseStorage::onHttpFinished);
    connect(m_httpClient, &HttpClient::requestFailed, this, &SupabaseStorage::onHttpFailed);
}

SupabaseStorage::SupabaseStorage(SupabaseAuth* auth, HttpClient* httpClient, QObject* parent)
    : QObject(parent)
    , m_auth(auth)
    , m_httpClient(httpClient) {
    if (!m_httpClient) {
        m_ownedHttpClient = new HttpClient(this);
        m_httpClient = m_ownedHttpClient;
    }

    connect(m_httpClient, &HttpClient::requestFinished, this, &SupabaseStorage::onHttpFinished);
    connect(m_httpClient, &HttpClient::requestFailed, this, &SupabaseStorage::onHttpFailed);
}

QString SupabaseStorage::supabaseUrl() const {
    return m_supabaseUrl;
}

void SupabaseStorage::setSupabaseUrl(const QString& value) {
    if (m_supabaseUrl == value) {
        return;
    }
    m_supabaseUrl = value;
    emit configChanged();
}

QString SupabaseStorage::anonKey() const {
    return m_anonKey;
}

void SupabaseStorage::setAnonKey(const QString& value) {
    if (m_anonKey == value) {
        return;
    }
    m_anonKey = value;
    emit configChanged();
}

QString SupabaseStorage::storageUrl(const QString& path) const {
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

QHash<QString, QString> SupabaseStorage::storageHeaders(const QString& contentType, bool withAuth) const {
    QHash<QString, QString> headers;
    headers.insert(QStringLiteral("apikey"), m_anonKey);

    if (!contentType.isEmpty()) {
        headers.insert(QStringLiteral("Content-Type"), contentType);
    }

    if (withAuth && m_auth && !m_auth->accessToken().isEmpty()) {
        headers.insert(QStringLiteral("Authorization"), QStringLiteral("Bearer %1").arg(m_auth->accessToken()));
    }

    return headers;
}

QString SupabaseStorage::upload(
    const QString& bucket,
    const QString& objectPath,
    const QByteArray& content,
    const QString& contentType,
    bool upsert) {
    const QString encodedPath = QUrl::toPercentEncoding(objectPath);
    QHash<QString, QString> headers = storageHeaders(contentType, true);
    headers.insert(QStringLiteral("x-upsert"), upsert ? QStringLiteral("true") : QStringLiteral("false"));

    const QUuid requestId = m_httpClient->post(
        QUrl(storageUrl(QStringLiteral("/storage/v1/object/%1/%2").arg(bucket, encodedPath))),
        headers,
        content);

    m_pending.insert(requestId, {QStringLiteral("upload"), QStringLiteral("%1/%2").arg(bucket, objectPath)});
    return requestId.toString(QUuid::WithoutBraces);
}

QString SupabaseStorage::download(const QString& bucket, const QString& objectPath) {
    const QString encodedPath = QUrl::toPercentEncoding(objectPath);
    const QUuid requestId = m_httpClient->get(
        QUrl(storageUrl(QStringLiteral("/storage/v1/object/%1/%2").arg(bucket, encodedPath))),
        storageHeaders(QString(), true));

    m_pending.insert(requestId, {QStringLiteral("download"), QStringLiteral("%1/%2").arg(bucket, objectPath)});
    return requestId.toString(QUuid::WithoutBraces);
}

QString SupabaseStorage::remove(const QString& bucket, const QString& objectPath) {
    const QString encodedPath = QUrl::toPercentEncoding(objectPath);
    const QUuid requestId = m_httpClient->del(
        QUrl(storageUrl(QStringLiteral("/storage/v1/object/%1/%2").arg(bucket, encodedPath))),
        storageHeaders(QString(), true));

    m_pending.insert(requestId, {QStringLiteral("delete"), QStringLiteral("%1/%2").arg(bucket, objectPath)});
    return requestId.toString(QUuid::WithoutBraces);
}

QString SupabaseStorage::getPublicUrl(const QString& bucket, const QString& objectPath) const {
    const QString encodedPath = QUrl::toPercentEncoding(objectPath);
    return storageUrl(QStringLiteral("/storage/v1/object/public/%1/%2").arg(bucket, encodedPath));
}

void SupabaseStorage::onHttpFinished(
    const QUuid& requestId,
    int statusCode,
    const QByteArray& body,
    const QVariantMap& headers) {
    Q_UNUSED(headers)

    if (!m_pending.contains(requestId)) {
        return;
    }

    const RequestContext context = m_pending.take(requestId);

    if (statusCode >= 200 && statusCode < 300) {
        emit operationSucceeded(
            requestId.toString(QUuid::WithoutBraces),
            context.action,
            context.path,
            body,
            statusCode);
        return;
    }

    emit operationFailed(
        requestId.toString(QUuid::WithoutBraces),
        context.action,
        context.path,
        QString::fromUtf8(body),
        statusCode);
}

void SupabaseStorage::onHttpFailed(
    const QUuid& requestId,
    const QString& errorText,
    int networkError,
    int statusCode,
    const QByteArray& body) {
    Q_UNUSED(networkError)
    Q_UNUSED(body)

    if (!m_pending.contains(requestId)) {
        return;
    }

    const RequestContext context = m_pending.take(requestId);

    emit operationFailed(
        requestId.toString(QUuid::WithoutBraces),
        context.action,
        context.path,
        errorText,
        statusCode);
}
