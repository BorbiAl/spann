#include "PulseService.hpp"

#include <QDateTime>

PulseService::PulseService(SupabaseDatabase* database, QObject* parent)
    : QObject(parent)
    , m_database(database) {
    connect(m_database, &SupabaseDatabase::querySucceeded, this, &PulseService::onQuerySucceeded);
    connect(m_database, &SupabaseDatabase::queryFailed, this, &PulseService::onQueryFailed);
}

void PulseService::loadChannelEnergy(const QString& workspaceId) {
    const QString since = QDateTime::currentDateTimeUtc().addSecs(-24 * 3600).toString(Qt::ISODate);

    const QString snapshotsReq = m_database->select(
        QStringLiteral("pulse_snapshots"),
        QStringLiteral("channel_id,score,snapshot_at"),
        {
            {QStringLiteral("workspace_id"), workspaceId},
            {QStringLiteral("snapshot_at"), QVariantMap{{QStringLiteral("op"), QStringLiteral("gte")}, {QStringLiteral("value"), since}}}
        },
        QStringLiteral("snapshot_at"),
        false,
        5000);
    m_pending.insert(snapshotsReq, PendingType::ChannelEnergySnapshots);

    const QString channelReq = m_database->select(
        QStringLiteral("channels"),
        QStringLiteral("id,name"),
        {{QStringLiteral("workspace_id"), workspaceId}},
        QStringLiteral("name"),
        true,
        500);
    m_pending.insert(channelReq, PendingType::ChannelNames);
}

void PulseService::loadSevenDayTrend(const QString& workspaceId) {
    const QString since = QDateTime::currentDateTimeUtc().addDays(-7).toString(Qt::ISODate);

    const QString req = m_database->select(
        QStringLiteral("pulse_snapshots"),
        QStringLiteral("score,snapshot_at"),
        {
            {QStringLiteral("workspace_id"), workspaceId},
            {QStringLiteral("snapshot_at"), QVariantMap{{QStringLiteral("op"), QStringLiteral("gte")}, {QStringLiteral("value"), since}}}
        },
        QStringLiteral("snapshot_at"),
        true,
        5000);
    m_pending.insert(req, PendingType::SevenDaySnapshots);
}

void PulseService::loadLatestChannelSentiment(const QString& channelId) {
    m_latestChannelId = channelId;
    const QString req = m_database->select(
        QStringLiteral("pulse_snapshots"),
        QStringLiteral("score"),
        {{QStringLiteral("channel_id"), channelId}},
        QStringLiteral("snapshot_at"),
        false,
        1);
    m_pending.insert(req, PendingType::LatestChannel);
}

void PulseService::onQuerySucceeded(
    const QString& requestId,
    const QString& action,
    const QString& table,
    const QJsonValue& data,
    int statusCode) {
    Q_UNUSED(action)
    Q_UNUSED(table)
    Q_UNUSED(statusCode)

    const PendingType type = m_pending.take(requestId);
    const QVariantList rows = data.toVariant().toList();

    switch (type) {
    case PendingType::ChannelEnergySnapshots:
        m_snapshotCache = rows;
        break;
    case PendingType::ChannelNames: {
        m_channelNames.clear();
        for (const QVariant& rowV : rows) {
            const QVariantMap row = rowV.toMap();
            m_channelNames.insert(row.value(QStringLiteral("id")).toString(), row.value(QStringLiteral("name")).toString());
        }

        QHash<QString, double> sumByChannel;
        QHash<QString, int> countByChannel;
        for (const QVariant& snapV : m_snapshotCache) {
            const QVariantMap snap = snapV.toMap();
            const QString channelId = snap.value(QStringLiteral("channel_id")).toString();
            sumByChannel[channelId] += snap.value(QStringLiteral("score")).toDouble();
            countByChannel[channelId] += 1;
        }

        QVariantList output;
        for (auto it = sumByChannel.begin(); it != sumByChannel.end(); ++it) {
            const QString channelId = it.key();
            const double energy = countByChannel.value(channelId) > 0 ? it.value() / countByChannel.value(channelId) : 0.0;
            QVariantMap row;
            row[QStringLiteral("channel_id")] = channelId;
            row[QStringLiteral("name")] = m_channelNames.value(channelId, QStringLiteral("#channel"));
            row[QStringLiteral("energy")] = energy;
            row[QStringLiteral("label")] = energy > 80 ? QStringLiteral("Positive") : (energy >= 50 ? QStringLiteral("Neutral") : QStringLiteral("Alert"));
            output.append(row);
        }

        std::sort(output.begin(), output.end(), [](const QVariant& a, const QVariant& b) {
            return a.toMap().value(QStringLiteral("energy")).toDouble() > b.toMap().value(QStringLiteral("energy")).toDouble();
        });

        emit channelEnergyLoaded(output);
        break;
    }
    case PendingType::SevenDaySnapshots: {
        QMap<QDate, QList<double>> byDate;
        for (const QVariant& rowV : rows) {
            const QVariantMap row = rowV.toMap();
            const QDateTime dt = QDateTime::fromString(row.value(QStringLiteral("snapshot_at")).toString(), Qt::ISODate);
            byDate[dt.date()].append(row.value(QStringLiteral("score")).toDouble());
        }

        QVariantList points;
        const QDate today = QDate::currentDate();
        for (int i = 6; i >= 0; --i) {
            const QDate day = today.addDays(-i);
            const QList<double> vals = byDate.value(day);
            double avg = 0.0;
            if (!vals.isEmpty()) {
                for (double v : vals) {
                    avg += v;
                }
                avg /= vals.size();
            }
            points.append(avg);
        }

        emit sevenDayTrendLoaded(points);
        break;
    }
    case PendingType::LatestChannel:
        if (!rows.isEmpty()) {
            emit channelSentimentLoaded(m_latestChannelId, rows.first().toMap().value(QStringLiteral("score")).toDouble());
        }
        break;
    default:
        break;
    }
}

void PulseService::onQueryFailed(
    const QString& requestId,
    const QString& action,
    const QString& table,
    const QString& errorText,
    int statusCode) {
    Q_UNUSED(requestId)
    Q_UNUSED(action)
    Q_UNUSED(table)
    Q_UNUSED(statusCode)

    emit pulseError(errorText);
}
