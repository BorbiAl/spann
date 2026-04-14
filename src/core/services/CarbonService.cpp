#include "CarbonService.hpp"

#include <QDate>
#include <QJsonArray>
#include <QJsonObject>
#include <QSet>

CarbonService::CarbonService(SupabaseDatabase* database, QObject* parent)
    : QObject(parent)
    , m_database(database) {
    connect(m_database, &SupabaseDatabase::querySucceeded, this, &CarbonService::onQuerySucceeded);
    connect(m_database, &SupabaseDatabase::queryFailed, this, &CarbonService::onQueryFailed);
}

void CarbonService::loadDailyFootprint(const QString& userId) {
    m_dailyUser = userId;
    const QString today = QDate::currentDate().toString(Qt::ISODate);
    const QString yesterday = QDate::currentDate().addDays(-1).toString(Qt::ISODate);

    const QString todayReq = m_database->select(
        QStringLiteral("carbon_logs"),
        QStringLiteral("kg_co2"),
        {
            {QStringLiteral("user_id"), userId},
            {QStringLiteral("logged_date"), today}
        },
        QString(),
        true,
        500);
    m_pending.insert(todayReq, PendingType::Today);

    const QString yReq = m_database->select(
        QStringLiteral("carbon_logs"),
        QStringLiteral("kg_co2"),
        {
            {QStringLiteral("user_id"), userId},
            {QStringLiteral("logged_date"), yesterday}
        },
        QString(),
        true,
        500);
    m_pending.insert(yReq, PendingType::Yesterday);
}

void CarbonService::loadBadges(const QString& userId) {
    const QString req = m_database->select(
        QStringLiteral("carbon_badges"),
        QStringLiteral("badge_key,earned_at"),
        {{QStringLiteral("user_id"), userId}},
        QStringLiteral("earned_at"),
        false,
        12);
    m_pending.insert(req, PendingType::Badges);
}

void CarbonService::loadLeaderboard(const QString& workspaceId) {
    m_leaderboardWorkspace = workspaceId;
    const QString since = QDate::currentDate().addDays(-7).toString(Qt::ISODate);

    const QString req = m_database->select(
        QStringLiteral("carbon_logs"),
        QStringLiteral("user_id,kg_co2,profiles(name,avatar_url)"),
        {
            {QStringLiteral("workspace_id"), workspaceId},
            {QStringLiteral("logged_date"), QVariantMap{{QStringLiteral("op"), QStringLiteral("gte")}, {QStringLiteral("value"), since}}}
        },
        QStringLiteral("logged_date"),
        true,
        1000);

    m_pending.insert(req, PendingType::Leaderboard);
}

void CarbonService::loadCompanyGoal(const QString& workspaceId) {
    m_companyWorkspace = workspaceId;
    const QString req = m_database->select(
        QStringLiteral("carbon_logs"),
        QStringLiteral("kg_co2"),
        {{QStringLiteral("workspace_id"), workspaceId}},
        QString(),
        true,
        5000);
    m_pending.insert(req, PendingType::Company);
}

void CarbonService::quickLogAction(const QString& userId, const QString& workspaceId, const QString& transportType, double kgCo2) {
    const QString today = QDate::currentDate().toString(Qt::ISODate);
    const QVariantMap row {
        {QStringLiteral("user_id"), userId},
        {QStringLiteral("workspace_id"), workspaceId},
        {QStringLiteral("transport_type"), transportType},
        {QStringLiteral("kg_co2"), kgCo2},
        {QStringLiteral("logged_date"), today}
    };

    const QString req = m_database->upsert(
        QStringLiteral("carbon_logs"),
        row,
        QStringLiteral("user_id,logged_date,transport_type"),
        false,
        true);
    m_pending.insert(req, PendingType::QuickUpsert);

    handleBadgeChecks(userId, workspaceId, transportType, kgCo2);
}

void CarbonService::handleBadgeChecks(const QString& userId, const QString& workspaceId, const QString& transportType, double kgCo2) {
    Q_UNUSED(workspaceId)

    if (kgCo2 <= 0.0) {
        m_database->upsert(
            QStringLiteral("carbon_badges"),
            QVariantMap{{QStringLiteral("user_id"), userId}, {QStringLiteral("badge_key"), QStringLiteral("zero_emission")}, {QStringLiteral("earned_at"), QDateTime::currentDateTimeUtc().toString(Qt::ISODate)}},
            QStringLiteral("user_id,badge_key"),
            true,
            false);
    }

    if (transportType == QStringLiteral("bike")) {
        const QString req = m_database->select(
            QStringLiteral("carbon_logs"),
            QStringLiteral("id"),
            {
                {QStringLiteral("user_id"), userId},
                {QStringLiteral("transport_type"), QStringLiteral("bike")}
            },
            QString(),
            true,
            2000);
        m_pending.insert(req, PendingType::BikeCount);
        m_badgeUserByRequest.insert(req, userId);
    }

    if (transportType == QStringLiteral("bus") || transportType == QStringLiteral("train")) {
        const QString since = QDate::currentDate().addDays(-30).toString(Qt::ISODate);
        const QString req = m_database->select(
            QStringLiteral("carbon_logs"),
            QStringLiteral("logged_date,transport_type"),
            {
                {QStringLiteral("user_id"), userId},
                {QStringLiteral("logged_date"), QVariantMap{{QStringLiteral("op"), QStringLiteral("gte")}, {QStringLiteral("value"), since}}},
                {QStringLiteral("transport_type"), QVariantList{QStringLiteral("bus"), QStringLiteral("train")}}
            },
            QStringLiteral("logged_date"),
            true,
            500);
        m_pending.insert(req, PendingType::TransitCheck);
        m_badgeUserByRequest.insert(req, userId);
    }
}

double CarbonService::sumKgFromRows(const QVariantList& rows) const {
    double sum = 0.0;
    for (const QVariant& rowVariant : rows) {
        const QVariantMap row = rowVariant.toMap();
        sum += row.value(QStringLiteral("kg_co2")).toDouble();
    }
    return sum;
}

void CarbonService::onQuerySucceeded(
    const QString& requestId,
    const QString& action,
    const QString& table,
    const QJsonValue& data,
    int statusCode) {
    Q_UNUSED(action)
    Q_UNUSED(table)
    Q_UNUSED(statusCode)

    const PendingType type = m_pending.take(requestId);
    const QVariant payload = data.toVariant();
    const QVariantList rows = payload.toList();

    switch (type) {
    case PendingType::Today:
        m_todayKg = sumKgFromRows(rows);
        emit dailyFootprintLoaded(m_todayKg, m_yesterdayKg);
        break;
    case PendingType::Yesterday:
        m_yesterdayKg = sumKgFromRows(rows);
        emit dailyFootprintLoaded(m_todayKg, m_yesterdayKg);
        break;
    case PendingType::Badges:
        emit badgesLoaded(rows);
        break;
    case PendingType::Leaderboard: {
        QHash<QString, QVariantMap> grouped;
        for (const QVariant& rowVariant : rows) {
            const QVariantMap row = rowVariant.toMap();
            const QString userId = row.value(QStringLiteral("user_id")).toString();
            QVariantMap agg = grouped.value(userId);
            agg[QStringLiteral("user_id")] = userId;
            agg[QStringLiteral("total")] = agg.value(QStringLiteral("total")).toDouble() + row.value(QStringLiteral("kg_co2")).toDouble();

            const QVariantMap profile = row.value(QStringLiteral("profiles")).toMap();
            agg[QStringLiteral("name")] = profile.value(QStringLiteral("name")).toString();
            agg[QStringLiteral("avatar_url")] = profile.value(QStringLiteral("avatar_url")).toString();
            grouped[userId] = agg;
        }

        QVariantList result;
        for (auto it = grouped.begin(); it != grouped.end(); ++it) {
            QVariantMap r = it.value();
            const double total = r.value(QStringLiteral("total")).toDouble();
            r[QStringLiteral("score")] = qMax(0.0, 1000.0 - total * 50.0);
            result.append(r);
        }

        std::sort(result.begin(), result.end(), [](const QVariant& a, const QVariant& b) {
            return a.toMap().value(QStringLiteral("total")).toDouble() < b.toMap().value(QStringLiteral("total")).toDouble();
        });

        if (result.size() > 10) {
            result = result.mid(0, 10);
        }

        emit leaderboardLoaded(result);
        break;
    }
    case PendingType::Company:
        emit companyGoalLoaded(sumKgFromRows(rows));
        break;
    case PendingType::QuickUpsert:
        emit quickLogCompleted();
        break;
    case PendingType::BikeCount:
        if (rows.size() >= 50) {
            const QString badgeUserId = m_badgeUserByRequest.take(requestId);
            if (badgeUserId.isEmpty()) {
                break;
            }
            m_database->upsert(
                QStringLiteral("carbon_badges"),
                QVariantMap{{QStringLiteral("user_id"), badgeUserId}, {QStringLiteral("badge_key"), QStringLiteral("biker_100km")}, {QStringLiteral("earned_at"), QDateTime::currentDateTimeUtc().toString(Qt::ISODate)}},
                QStringLiteral("user_id,badge_key"),
                true,
                false);
        } else {
            m_badgeUserByRequest.remove(requestId);
        }
        break;
    case PendingType::TransitCheck:
        {
            const QString badgeUserId = m_badgeUserByRequest.take(requestId);
            if (badgeUserId.isEmpty()) {
                break;
            }

            QSet<QDate> loggedDays;
            for (const QVariant& rowVariant : rows) {
                const QVariantMap row = rowVariant.toMap();
                const QDate d = QDate::fromString(row.value(QStringLiteral("logged_date")).toString(), Qt::ISODate);
                if (d.isValid()) {
                    loggedDays.insert(d);
                }
            }

            bool consecutive = true;
            const QDate today = QDate::currentDate();
            for (int i = 0; i < 30; ++i) {
                if (!loggedDays.contains(today.addDays(-i))) {
                    consecutive = false;
                    break;
                }
            }

            if (!consecutive) {
                break;
            }

            m_database->upsert(
                QStringLiteral("carbon_badges"),
                QVariantMap{{QStringLiteral("user_id"), badgeUserId}, {QStringLiteral("badge_key"), QStringLiteral("transit_pro")}, {QStringLiteral("earned_at"), QDateTime::currentDateTimeUtc().toString(Qt::ISODate)}},
                QStringLiteral("user_id,badge_key"),
                true,
                false);
        }
        }
        break;
    default:
        break;
    }
}

void CarbonService::onQueryFailed(
    const QString& requestId,
    const QString& action,
    const QString& table,
    const QString& errorText,
    int statusCode) {
    Q_UNUSED(requestId)
    Q_UNUSED(action)
    Q_UNUSED(table)
    Q_UNUSED(statusCode)

    emit carbonError(errorText);
}
