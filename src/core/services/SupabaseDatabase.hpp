#pragma once

#include "HttpClient.hpp"
#include "SupabaseAuth.hpp"

#include <QJsonArray>
#include <QJsonObject>
#include <QObject>
#include <QPointer>
#include <QUrlQuery>

class SupabaseDatabase;

class SupabaseQueryBuilder {
public:
    SupabaseQueryBuilder(SupabaseDatabase* database, const QString& tableName);

    SupabaseQueryBuilder& select(const QString& columns);
    SupabaseQueryBuilder& eq(const QString& key, const QVariant& value);
    SupabaseQueryBuilder& order(const QString& column, bool ascending = true);
    SupabaseQueryBuilder& limit(int value);

    QString execute();

private:
    SupabaseDatabase* m_database = nullptr;
    QString m_table;
    QString m_columns = QStringLiteral("*");
    QVariantMap m_filters;
    QString m_orderBy;
    bool m_orderAscending = true;
    int m_limit = -1;
};

class SupabaseDatabase : public QObject {
    Q_OBJECT

    Q_PROPERTY(QString supabaseUrl READ supabaseUrl WRITE setSupabaseUrl NOTIFY configChanged)
    Q_PROPERTY(QString anonKey READ anonKey WRITE setAnonKey NOTIFY configChanged)
    Q_PROPERTY(QString schema READ schema WRITE setSchema NOTIFY configChanged)

public:
    explicit SupabaseDatabase(SupabaseAuth* auth, QObject* parent = nullptr);
    SupabaseDatabase(SupabaseAuth* auth, HttpClient* httpClient, QObject* parent = nullptr);

    QString supabaseUrl() const;
    void setSupabaseUrl(const QString& url);

    QString anonKey() const;
    void setAnonKey(const QString& key);

    QString schema() const;
    void setSchema(const QString& value);

    Q_INVOKABLE QString select(
        const QString& table,
        const QString& columns = QStringLiteral("*"),
        const QVariantMap& filters = {},
        const QString& orderBy = QString(),
        bool ascending = true,
        int limit = -1);

    Q_INVOKABLE QString insert(
        const QString& table,
        const QVariant& payload,
        bool returningRepresentation = true);

    Q_INVOKABLE QString update(
        const QString& table,
        const QVariantMap& payload,
        const QVariantMap& filters,
        bool returningRepresentation = true);

    Q_INVOKABLE QString upsert(
        const QString& table,
        const QVariant& payload,
        const QString& onConflict = QString(),
        bool ignoreDuplicates = false,
        bool returningRepresentation = true);

    Q_INVOKABLE QString remove(
        const QString& table,
        const QVariantMap& filters,
        bool returningRepresentation = true);

    Q_INVOKABLE QString rpc(const QString& functionName, const QVariantMap& args = {});

    SupabaseQueryBuilder from(const QString& table);

signals:
    void configChanged();
    void querySucceeded(
        const QString& requestId,
        const QString& action,
        const QString& table,
        const QJsonValue& data,
        int statusCode);
    void queryFailed(
        const QString& requestId,
        const QString& action,
        const QString& table,
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
        QString table;
    };

    friend class SupabaseQueryBuilder;

    QHash<QString, QString> postgrestHeaders(const QString& prefer = QString()) const;
    QString restUrl(const QString& path) const;
    QUrl buildTableUrl(
        const QString& table,
        const QString& columns,
        const QVariantMap& filters,
        const QString& orderBy,
        bool ascending,
        int limit,
        const QString& onConflict = QString()) const;

    static void appendFilters(QUrlQuery& query, const QVariantMap& filters);
    static QJsonValue parseJsonPayload(const QByteArray& body);

    QString executeSelect(
        const QString& table,
        const QString& columns,
        const QVariantMap& filters,
        const QString& orderBy,
        bool ascending,
        int limit);

    QPointer<SupabaseAuth> m_auth;
    QPointer<HttpClient> m_httpClient;
    HttpClient* m_ownedHttpClient = nullptr;

    QString m_supabaseUrl;
    QString m_anonKey;
    QString m_schema = QStringLiteral("public");

    QHash<QUuid, RequestContext> m_pending;
};
