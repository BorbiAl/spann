#pragma once

#include "SupabaseDatabase.hpp"

#include <QObject>
#include <QPointer>

class PulseService : public QObject {
    Q_OBJECT

public:
    explicit PulseService(SupabaseDatabase* database, QObject* parent = nullptr);

    Q_INVOKABLE void loadChannelEnergy(const QString& workspaceId);
    Q_INVOKABLE void loadSevenDayTrend(const QString& workspaceId);
    Q_INVOKABLE void loadLatestChannelSentiment(const QString& channelId);

signals:
    void channelEnergyLoaded(const QVariantList& rows);
    void sevenDayTrendLoaded(const QVariantList& points);
    void channelSentimentLoaded(const QString& channelId, double score);
    void pulseError(const QString& message);

private slots:
    void onQuerySucceeded(const QString& requestId, const QString& action, const QString& table, const QJsonValue& data, int statusCode);
    void onQueryFailed(const QString& requestId, const QString& action, const QString& table, const QString& errorText, int statusCode);

private:
    enum class PendingType {
        None,
        ChannelEnergySnapshots,
        ChannelNames,
        SevenDaySnapshots,
        LatestChannel
    };

    QPointer<SupabaseDatabase> m_database;
    QHash<QString, PendingType> m_pending;
    QVariantList m_snapshotCache;
    QHash<QString, QString> m_channelNames;
    QString m_latestChannelId;
};
