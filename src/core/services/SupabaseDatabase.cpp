#include "SupabaseDatabase.hpp"

#include <QJsonDocument>

SupabaseQueryBuilder::SupabaseQueryBuilder(SupabaseDatabase* database, const QString& tableName)
    : m_database(database)
    , m_table(tableName) {}

SupabaseQueryBuilder& SupabaseQueryBuilder::select(const QString& columns) {
    m_columns = columns;
    return *this;
}

SupabaseQueryBuilder& SupabaseQueryBuilder::eq(const QString& key, const QVariant& value) {
    m_filters.insert(key, value);
    return *this;
}

SupabaseQueryBuilder& SupabaseQueryBuilder::order(const QString& column, bool ascending) {
    m_orderBy = column;
    m_orderAscending = ascending;
    return *this;
}

SupabaseQueryBuilder& SupabaseQueryBuilder::limit(int value) {
    m_limit = value;
    return *this;
}

QString SupabaseQueryBuilder::execute() {
    if (!m_database) {
        return QString();
    }
    return m_database->executeSelect(m_table, m_columns, m_filters, m_orderBy, m_orderAscending, m_limit);
}

SupabaseDatabase::SupabaseDatabase(SupabaseAuth* auth, QObject* parent)
    : QObject(parent)
    , m_auth(auth)
    , m_ownedHttpClient(new HttpClient(this))
    , m_httpClient(m_ownedHttpClient) {
    connect(m_httpClient, &HttpClient::requestFinished, this, &SupabaseDatabase::onHttpFinished);
    connect(m_httpClient, &HttpClient::requestFailed, this, &SupabaseDatabase::onHttpFailed);
}

SupabaseDatabase::SupabaseDatabase(SupabaseAuth* auth, HttpClient* httpClient, QObject* parent)
    : QObject(parent)
    , m_auth(auth)
    , m_httpClient(httpClient) {
    if (!m_httpClient) {
        m_ownedHttpClient = new HttpClient(this);
        m_httpClient = m_ownedHttpClient;
    }

    connect(m_httpClient, &HttpClient::requestFinished, this, &SupabaseDatabase::onHttpFinished);
    connect(m_httpClient, &HttpClient::requestFailed, this, &SupabaseDatabase::onHttpFailed);
}

QString SupabaseDatabase::supabaseUrl() const {
    return m_supabaseUrl;
}

void SupabaseDatabase::setSupabaseUrl(const QString& url) {
    if (m_supabaseUrl == url) {
        return;
    }
    m_supabaseUrl = url;
    emit configChanged();
}

QString SupabaseDatabase::anonKey() const {
    return m_anonKey;
}

void SupabaseDatabase::setAnonKey(const QString& key) {
    if (m_anonKey == key) {
        return;
    }
    m_anonKey = key;
    emit configChanged();
}

QString SupabaseDatabase::schema() const {
    return m_schema;
}

void SupabaseDatabase::setSchema(const QString& value) {
    if (m_schema == value) {
        return;
    }
    m_schema = value;
    emit configChanged();
}

QHash<QString, QString> SupabaseDatabase::postgrestHeaders(const QString& prefer) const {
    QHash<QString, QString> headers;
    headers.insert(QStringLiteral("apikey"), m_anonKey);
    headers.insert(QStringLiteral("Content-Type"), QStringLiteral("application/json"));
    headers.insert(QStringLiteral("Accept"), QStringLiteral("application/json"));
    headers.insert(QStringLiteral("Accept-Profile"), m_schema);
    headers.insert(QStringLiteral("Content-Profile"), m_schema);

    if (m_auth && !m_auth->accessToken().isEmpty()) {
        headers.insert(QStringLiteral("Authorization"), QStringLiteral("Bearer %1").arg(m_auth->accessToken()));
    }

    if (!prefer.isEmpty()) {
        headers.insert(QStringLiteral("Prefer"), prefer);
    }

    return headers;
}

QString SupabaseDatabase::restUrl(const QString& path) const {
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

void SupabaseDatabase::appendFilters(QUrlQuery& query, const QVariantMap& filters) {
    for (auto it = filters.constBegin(); it != filters.constEnd(); ++it) {
        const QString key = it.key();
        const QVariant value = it.value();

        if (value.typeId() == QMetaType::QVariantMap) {
            const QVariantMap filterSpec = value.toMap();
            const QString op = filterSpec.value(QStringLiteral("op"), QStringLiteral("eq")).toString();
            const QString payload = filterSpec.value(QStringLiteral("value")).toString();
            query.addQueryItem(key, QStringLiteral("%1.%2").arg(op, payload));
            continue;
        }

        if (value.typeId() == QMetaType::QVariantList || value.typeId() == QMetaType::QStringList) {
            QStringList parts;
            const QVariantList list = value.toList();
            for (const QVariant& item : list) {
                parts.append(item.toString());
            }
            query.addQueryItem(key, QStringLiteral("in.(%1)").arg(parts.join(',')));
            continue;
        }

        query.addQueryItem(key, QStringLiteral("eq.%1").arg(value.toString()));
    }
}

QUrl SupabaseDatabase::buildTableUrl(
    const QString& table,
    const QString& columns,
    const QVariantMap& filters,
    const QString& orderBy,
    bool ascending,
    int limit,
    const QString& onConflict) const {
    QUrl url(restUrl(QStringLiteral("/rest/v1/%1").arg(table)));
    QUrlQuery query;

    if (!columns.isEmpty()) {
        query.addQueryItem(QStringLiteral("select"), columns);
    }

    appendFilters(query, filters);

    if (!orderBy.isEmpty()) {
        query.addQueryItem(
            QStringLiteral("order"),
            QStringLiteral("%1.%2").arg(orderBy, ascending ? QStringLiteral("asc") : QStringLiteral("desc")));
    }

    if (limit >= 0) {
        query.addQueryItem(QStringLiteral("limit"), QString::number(limit));
    }

    if (!onConflict.isEmpty()) {
        query.addQueryItem(QStringLiteral("on_conflict"), onConflict);
    }

    url.setQuery(query);
    return url;
}

QJsonValue SupabaseDatabase::parseJsonPayload(const QByteArray& body) {
    QJsonParseError error;
    const QJsonDocument doc = QJsonDocument::fromJson(body, &error);
    if (error.error != QJsonParseError::NoError) {
        return QJsonValue(QString::fromUtf8(body));
    }

    if (doc.isArray()) {
        return doc.array();
    }

    if (doc.isObject()) {
        return doc.object();
    }

    return QJsonValue();
}

QString SupabaseDatabase::executeSelect(
    const QString& table,
    const QString& columns,
    const QVariantMap& filters,
    const QString& orderBy,
    bool ascending,
    int limit) {
    const QUuid requestId = m_httpClient->get(
        buildTableUrl(table, columns, filters, orderBy, ascending, limit),
        postgrestHeaders());

    RequestContext context;
    context.action = QStringLiteral("select");
    context.table = table;
    m_pending.insert(requestId, context);

    return requestId.toString(QUuid::WithoutBraces);
}

QString SupabaseDatabase::select(
    const QString& table,
    const QString& columns,
    const QVariantMap& filters,
    const QString& orderBy,
    bool ascending,
    int limit) {
    return executeSelect(table, columns, filters, orderBy, ascending, limit);
}

QString SupabaseDatabase::insert(const QString& table, const QVariant& payload, bool returningRepresentation) {
    const QString prefer = returningRepresentation
        ? QStringLiteral("return=representation")
        : QStringLiteral("return=minimal");

    const QUuid requestId = m_httpClient->post(
        buildTableUrl(table, QString(), {}, QString(), true, -1),
        postgrestHeaders(prefer),
        QJsonDocument::fromVariant(payload).toJson(QJsonDocument::Compact));

    m_pending.insert(requestId, {QStringLiteral("insert"), table});
    return requestId.toString(QUuid::WithoutBraces);
}

QString SupabaseDatabase::update(
    const QString& table,
    const QVariantMap& payload,
    const QVariantMap& filters,
    bool returningRepresentation) {
    const QString prefer = returningRepresentation
        ? QStringLiteral("return=representation")
        : QStringLiteral("return=minimal");

    const QUuid requestId = m_httpClient->patch(
        buildTableUrl(table, QString(), filters, QString(), true, -1),
        postgrestHeaders(prefer),
        QJsonDocument(QJsonObject::fromVariantMap(payload)).toJson(QJsonDocument::Compact));

    m_pending.insert(requestId, {QStringLiteral("update"), table});
    return requestId.toString(QUuid::WithoutBraces);
}

QString SupabaseDatabase::upsert(
    const QString& table,
    const QVariant& payload,
    const QString& onConflict,
    bool ignoreDuplicates,
    bool returningRepresentation) {
    QStringList preferValues;
    preferValues.append(ignoreDuplicates
            ? QStringLiteral("resolution=ignore-duplicates")
            : QStringLiteral("resolution=merge-duplicates"));
    preferValues.append(returningRepresentation
            ? QStringLiteral("return=representation")
            : QStringLiteral("return=minimal"));

    const QUuid requestId = m_httpClient->post(
        buildTableUrl(table, QString(), {}, QString(), true, -1, onConflict),
        postgrestHeaders(preferValues.join(',')),
        QJsonDocument::fromVariant(payload).toJson(QJsonDocument::Compact));

    m_pending.insert(requestId, {QStringLiteral("upsert"), table});
    return requestId.toString(QUuid::WithoutBraces);
}

QString SupabaseDatabase::remove(const QString& table, const QVariantMap& filters, bool returningRepresentation) {
    const QString prefer = returningRepresentation
        ? QStringLiteral("return=representation")
        : QStringLiteral("return=minimal");

    const QUuid requestId = m_httpClient->del(
        buildTableUrl(table, QString(), filters, QString(), true, -1),
        postgrestHeaders(prefer));

    m_pending.insert(requestId, {QStringLiteral("delete"), table});
    return requestId.toString(QUuid::WithoutBraces);
}

QString SupabaseDatabase::rpc(const QString& functionName, const QVariantMap& args) {
    const QUuid requestId = m_httpClient->post(
        QUrl(restUrl(QStringLiteral("/rest/v1/rpc/%1").arg(functionName))),
        postgrestHeaders(),
        QJsonDocument(QJsonObject::fromVariantMap(args)).toJson(QJsonDocument::Compact));

    m_pending.insert(requestId, {QStringLiteral("rpc"), functionName});
    return requestId.toString(QUuid::WithoutBraces);
}

SupabaseQueryBuilder SupabaseDatabase::from(const QString& table) {
    return SupabaseQueryBuilder(this, table);
}

void SupabaseDatabase::onHttpFinished(
    const QUuid& requestId,
    int statusCode,
    const QByteArray& body,
    const QVariantMap& headers) {
    Q_UNUSED(headers)

    if (!m_pending.contains(requestId)) {
        return;
    }

    const RequestContext context = m_pending.take(requestId);
    const QJsonValue payload = parseJsonPayload(body);

    if (statusCode >= 200 && statusCode < 300) {
        emit querySucceeded(
            requestId.toString(QUuid::WithoutBraces),
            context.action,
            context.table,
            payload,
            statusCode);
        return;
    }

    QString message = QStringLiteral("Database request failed");
    if (payload.isObject()) {
        const QJsonObject obj = payload.toObject();
        message = obj.value(QStringLiteral("message")).toString(
            obj.value(QStringLiteral("hint")).toString(message));
    }

    emit queryFailed(
        requestId.toString(QUuid::WithoutBraces),
        context.action,
        context.table,
        message,
        statusCode);
}

void SupabaseDatabase::onHttpFailed(
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
    emit queryFailed(
        requestId.toString(QUuid::WithoutBraces),
        context.action,
        context.table,
        errorText,
        statusCode);
}
