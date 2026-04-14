#include "TranslationService.hpp"

#include <QJsonDocument>
#include <QJsonObject>
#include <QUrl>

TranslationService::TranslationService(QObject* parent)
    : QObject(parent)
    , m_ownedHttpClient(new HttpClient(this))
    , m_httpClient(m_ownedHttpClient) {
    connect(m_httpClient, &HttpClient::requestFinished, this, &TranslationService::onHttpFinished);
    connect(m_httpClient, &HttpClient::requestFailed, this, &TranslationService::onHttpFailed);
}

TranslationService::TranslationService(HttpClient* httpClient, QObject* parent)
    : QObject(parent)
    , m_httpClient(httpClient) {
    if (!m_httpClient) {
        m_ownedHttpClient = new HttpClient(this);
        m_httpClient = m_ownedHttpClient;
    }

    connect(m_httpClient, &HttpClient::requestFinished, this, &TranslationService::onHttpFinished);
    connect(m_httpClient, &HttpClient::requestFailed, this, &TranslationService::onHttpFailed);
}

QString TranslationService::apiBaseUrl() const {
    return m_apiBaseUrl;
}

void TranslationService::setApiBaseUrl(const QString& value) {
    if (m_apiBaseUrl == value) {
        return;
    }
    m_apiBaseUrl = value;
    emit configChanged();
}

QString TranslationService::translate(const QVariantMap& payload) {
    QString base = m_apiBaseUrl;
    if (base.endsWith('/')) {
        base.chop(1);
    }

    const QJsonDocument bodyDoc(QJsonObject::fromVariantMap(payload));
    m_pendingRequest = m_httpClient->post(
        QUrl(base + QStringLiteral("/translate")),
        {
            {QStringLiteral("Content-Type"), QStringLiteral("application/json")},
            {QStringLiteral("Accept"), QStringLiteral("application/json")}
        },
        bodyDoc.toJson(QJsonDocument::Compact));

    return m_pendingRequest.toString(QUuid::WithoutBraces);
}

void TranslationService::onHttpFinished(
    const QUuid& requestId,
    int statusCode,
    const QByteArray& body,
    const QVariantMap& headers) {
    Q_UNUSED(headers)

    if (requestId != m_pendingRequest) {
        return;
    }

    QJsonParseError err;
    const QJsonDocument doc = QJsonDocument::fromJson(body, &err);
    if (statusCode < 200 || statusCode >= 300 || err.error != QJsonParseError::NoError || !doc.isObject()) {
        emit translationFailed(QStringLiteral("Translation request failed"));
        return;
    }

    emit translated(doc.object().toVariantMap());
}

void TranslationService::onHttpFailed(
    const QUuid& requestId,
    const QString& errorText,
    int networkError,
    int statusCode,
    const QByteArray& body) {
    Q_UNUSED(networkError)
    Q_UNUSED(statusCode)
    Q_UNUSED(body)

    if (requestId != m_pendingRequest) {
        return;
    }

    emit translationFailed(errorText);
}
