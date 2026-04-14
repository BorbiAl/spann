#include "HttpClient.hpp"

#include <QNetworkRequest>

HttpClient::HttpClient(QObject* parent)
    : QObject(parent) {}

void HttpClient::setDefaultHeader(const QString& key, const QString& value) {
    m_defaultHeaders.insert(key, value);
}

void HttpClient::removeDefaultHeader(const QString& key) {
    m_defaultHeaders.remove(key);
}

void HttpClient::clearDefaultHeaders() {
    m_defaultHeaders.clear();
}

QHash<QString, QString> HttpClient::mergedHeaders(const QHash<QString, QString>& headers) const {
    QHash<QString, QString> combined = m_defaultHeaders;
    for (auto it = headers.constBegin(); it != headers.constEnd(); ++it) {
        combined.insert(it.key(), it.value());
    }
    return combined;
}

QVariantMap HttpClient::extractHeaders(QNetworkReply* reply) const {
    QVariantMap out;
    const auto pairs = reply->rawHeaderPairs();
    for (const auto& pair : pairs) {
        out.insert(QString::fromUtf8(pair.first), QString::fromUtf8(pair.second));
    }
    return out;
}

QUuid HttpClient::request(
    const QString& method,
    const QUrl& url,
    const QHash<QString, QString>& headers,
    const QByteArray& body,
    int timeoutMs) {
    const QUuid requestId = QUuid::createUuid();

    QNetworkRequest req(url);
    const auto finalHeaders = mergedHeaders(headers);
    for (auto it = finalHeaders.constBegin(); it != finalHeaders.constEnd(); ++it) {
        req.setRawHeader(it.key().toUtf8(), it.value().toUtf8());
    }

    const QByteArray verb = method.trimmed().toUpper().toUtf8();
    QNetworkReply* reply = m_network.sendCustomRequest(req, verb, body);

    auto* timer = new QTimer(this);
    timer->setSingleShot(true);

    PendingRequest pending;
    pending.reply = reply;
    pending.timer = timer;
    m_pending.insert(requestId, pending);

    connect(timer, &QTimer::timeout, this, [this, requestId]() {
        finalizeRequest(requestId, true);
    });

    connect(reply, &QNetworkReply::finished, this, [this, requestId]() {
        finalizeRequest(requestId, false);
    });

    timer->start(qMax(timeoutMs, 1));
    return requestId;
}

void HttpClient::finalizeRequest(const QUuid& requestId, bool isTimeout) {
    if (!m_pending.contains(requestId)) {
        return;
    }

    PendingRequest pending = m_pending.take(requestId);
    QNetworkReply* reply = pending.reply;
    QTimer* timer = pending.timer;

    if (timer) {
        timer->stop();
        timer->deleteLater();
    }

    if (!reply) {
        emit requestFailed(requestId, QStringLiteral("Reply object unavailable"), -1, -1, QByteArray());
        return;
    }

    if (isTimeout) {
        reply->abort();
        const int statusCode = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QByteArray body = reply->readAll();
        emit requestFailed(requestId, QStringLiteral("Request timed out"), -1, statusCode, body);
        reply->deleteLater();
        return;
    }

    const int statusCode = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
    const QByteArray body = reply->readAll();

    if (reply->error() == QNetworkReply::NoError) {
        emit requestFinished(requestId, statusCode, body, extractHeaders(reply));
    } else {
        emit requestFailed(
            requestId,
            reply->errorString(),
            static_cast<int>(reply->error()),
            statusCode,
            body);
    }

    reply->deleteLater();
}

QUuid HttpClient::get(const QUrl& url, const QHash<QString, QString>& headers, int timeoutMs) {
    return request(QStringLiteral("GET"), url, headers, {}, timeoutMs);
}

QUuid HttpClient::post(
    const QUrl& url,
    const QHash<QString, QString>& headers,
    const QByteArray& body,
    int timeoutMs) {
    return request(QStringLiteral("POST"), url, headers, body, timeoutMs);
}

QUuid HttpClient::patch(
    const QUrl& url,
    const QHash<QString, QString>& headers,
    const QByteArray& body,
    int timeoutMs) {
    return request(QStringLiteral("PATCH"), url, headers, body, timeoutMs);
}

QUuid HttpClient::del(
    const QUrl& url,
    const QHash<QString, QString>& headers,
    const QByteArray& body,
    int timeoutMs) {
    return request(QStringLiteral("DELETE"), url, headers, body, timeoutMs);
}
