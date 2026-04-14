#pragma once

#include "HttpClient.hpp"

#include <QJsonObject>
#include <QObject>
#include <QPointer>
#include <QSettings>

class SupabaseAuth : public QObject {
    Q_OBJECT

    Q_PROPERTY(QString supabaseUrl READ supabaseUrl WRITE setSupabaseUrl NOTIFY configChanged)
    Q_PROPERTY(QString anonKey READ anonKey WRITE setAnonKey NOTIFY configChanged)
    Q_PROPERTY(QString accessToken READ accessToken NOTIFY sessionChanged)
    Q_PROPERTY(QString refreshToken READ refreshToken NOTIFY sessionChanged)
    Q_PROPERTY(QString userId READ userId NOTIFY sessionChanged)
    Q_PROPERTY(bool authenticated READ authenticated NOTIFY sessionChanged)

public:
    explicit SupabaseAuth(QObject* parent = nullptr);
    explicit SupabaseAuth(HttpClient* httpClient, QObject* parent = nullptr);

    QString supabaseUrl() const;
    void setSupabaseUrl(const QString& url);

    QString anonKey() const;
    void setAnonKey(const QString& key);

    QString accessToken() const;
    QString refreshToken() const;
    QString userId() const;
    bool authenticated() const;

    Q_INVOKABLE QString signIn(const QString& email, const QString& password);
    Q_INVOKABLE QString signUp(
        const QString& email,
        const QString& password,
        const QVariantMap& metadata = {});
    Q_INVOKABLE QString refreshSession();
    Q_INVOKABLE QString signOut();

    Q_INVOKABLE void restoreSession();
    Q_INVOKABLE void clearSession();

signals:
    void configChanged();
    void sessionChanged();

    void authSucceeded(const QString& operation, const QJsonObject& session);
    void authFailed(const QString& operation, const QString& message, int statusCode);
    void loggedOut();

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
    QHash<QString, QString> authHeaders(bool withAuth = false) const;
    QString endpointUrl(const QString& path) const;

    void updateSessionFromPayload(const QJsonObject& payload);
    void persistSession() const;

    QPointer<HttpClient> m_httpClient;
    HttpClient* m_ownedHttpClient = nullptr;

    QString m_supabaseUrl;
    QString m_anonKey;

    QString m_accessToken;
    QString m_refreshToken;
    QString m_userId;

    QHash<QUuid, QString> m_pendingOps;
};
