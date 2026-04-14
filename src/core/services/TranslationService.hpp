#pragma once

#include "HttpClient.hpp"

#include <QObject>
#include <QPointer>

class TranslationService : public QObject {
    Q_OBJECT

    Q_PROPERTY(QString apiBaseUrl READ apiBaseUrl WRITE setApiBaseUrl NOTIFY configChanged)

public:
    explicit TranslationService(QObject* parent = nullptr);
    explicit TranslationService(HttpClient* httpClient, QObject* parent = nullptr);

    QString apiBaseUrl() const;
    void setApiBaseUrl(const QString& value);

    Q_INVOKABLE QString translate(const QVariantMap& payload);

signals:
    void configChanged();
    void translated(const QVariantMap& payload);
    void translationFailed(const QString& message);

private slots:
    void onHttpFinished(const QUuid& requestId, int statusCode, const QByteArray& body, const QVariantMap& headers);
    void onHttpFailed(const QUuid& requestId, const QString& errorText, int networkError, int statusCode, const QByteArray& body);

private:
    QPointer<HttpClient> m_httpClient;
    HttpClient* m_ownedHttpClient = nullptr;
    QString m_apiBaseUrl;
    QUuid m_pendingRequest;
};
