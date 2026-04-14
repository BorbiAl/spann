#pragma once

#include <QByteArray>
#include <QHash>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QObject>
#include <QTimer>
#include <QUuid>
#include <QVariantMap>

class HttpClient : public QObject {
    Q_OBJECT

public:
    explicit HttpClient(QObject* parent = nullptr);

    void setDefaultHeader(const QString& key, const QString& value);
    void removeDefaultHeader(const QString& key);
    void clearDefaultHeaders();

    QUuid request(
        const QString& method,
        const QUrl& url,
        const QHash<QString, QString>& headers = {},
        const QByteArray& body = {},
        int timeoutMs = 30000);

    QUuid get(const QUrl& url, const QHash<QString, QString>& headers = {}, int timeoutMs = 30000);
    QUuid post(
        const QUrl& url,
        const QHash<QString, QString>& headers = {},
        const QByteArray& body = {},
        int timeoutMs = 30000);
    QUuid patch(
        const QUrl& url,
        const QHash<QString, QString>& headers = {},
        const QByteArray& body = {},
        int timeoutMs = 30000);
    QUuid del(
        const QUrl& url,
        const QHash<QString, QString>& headers = {},
        const QByteArray& body = {},
        int timeoutMs = 30000);

signals:
    void requestFinished(
        const QUuid& requestId,
        int statusCode,
        const QByteArray& body,
        const QVariantMap& headers);
    void requestFailed(
        const QUuid& requestId,
        const QString& errorText,
        int networkError,
        int statusCode,
        const QByteArray& body);

private:
    struct PendingRequest {
        QNetworkReply* reply = nullptr;
        QTimer* timer = nullptr;
    };

    QHash<QString, QString> mergedHeaders(const QHash<QString, QString>& headers) const;
    QVariantMap extractHeaders(QNetworkReply* reply) const;
    void finalizeRequest(const QUuid& requestId, bool isTimeout = false);

    QNetworkAccessManager m_network;
    QHash<QString, QString> m_defaultHeaders;
    QHash<QUuid, PendingRequest> m_pending;
};
