#pragma once

#include "HttpClient.hpp"
#include "SupabaseAuth.hpp"

#include <QObject>
#include <QPointer>

class SupabaseStorage : public QObject {
    Q_OBJECT

    Q_PROPERTY(QString supabaseUrl READ supabaseUrl WRITE setSupabaseUrl NOTIFY configChanged)
    Q_PROPERTY(QString anonKey READ anonKey WRITE setAnonKey NOTIFY configChanged)

public:
    explicit SupabaseStorage(SupabaseAuth* auth, QObject* parent = nullptr);
    SupabaseStorage(SupabaseAuth* auth, HttpClient* httpClient, QObject* parent = nullptr);

    QString supabaseUrl() const;
    void setSupabaseUrl(const QString& value);

    QString anonKey() const;
    void setAnonKey(const QString& value);

    Q_INVOKABLE QString upload(
        const QString& bucket,
        const QString& objectPath,
        const QByteArray& content,
        const QString& contentType,
        bool upsert = true);

    Q_INVOKABLE QString download(const QString& bucket, const QString& objectPath);
    Q_INVOKABLE QString remove(const QString& bucket, const QString& objectPath);

    Q_INVOKABLE QString getPublicUrl(const QString& bucket, const QString& objectPath) const;

signals:
    void configChanged();
    void operationSucceeded(
        const QString& requestId,
        const QString& action,
        const QString& path,
        const QByteArray& payload,
        int statusCode);
    void operationFailed(
        const QString& requestId,
        const QString& action,
        const QString& path,
        const QString& errorText,
        int statusCode);

private slots:
    void onHttpFinished(
        const QUuid& requestId,
        int statusCode,
        const QByteArray& body,
        const QVariantMap& headers);
    void onHttpFailed(
        const QUuid& requestId,
        const QString& errorText,
        int networkError,
        int statusCode,
        const QByteArray& body);

private:
    struct RequestContext {
        QString action;
        QString path;
    };

    QString storageUrl(const QString& path) const;
    QHash<QString, QString> storageHeaders(const QString& contentType = QString(), bool withAuth = true) const;

    QPointer<SupabaseAuth> m_auth;
    QPointer<HttpClient> m_httpClient;
    HttpClient* m_ownedHttpClient = nullptr;

    QString m_supabaseUrl;
    QString m_anonKey;

    QHash<QUuid, RequestContext> m_pending;
};
