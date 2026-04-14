#pragma once

#include "SupabaseDatabase.hpp"

#include <QObject>
#include <QPointer>

class CarbonService : public QObject {
    Q_OBJECT

public:
    explicit CarbonService(SupabaseDatabase* database, QObject* parent = nullptr);

    Q_INVOKABLE void loadDailyFootprint(const QString& userId);
    Q_INVOKABLE void loadBadges(const QString& userId);
    Q_INVOKABLE void loadLeaderboard(const QString& workspaceId);
    Q_INVOKABLE void loadCompanyGoal(const QString& workspaceId);
    Q_INVOKABLE void quickLogAction(const QString& userId, const QString& workspaceId, const QString& transportType, double kgCo2);

signals:
    void dailyFootprintLoaded(double todayKg, double yesterdayKg);
    void badgesLoaded(const QVariantList& items);
    void leaderboardLoaded(const QVariantList& rows);
    void companyGoalLoaded(double totalKg);
    void quickLogCompleted();
    void carbonError(const QString& message);

private slots:
    void onQuerySucceeded(const QString& requestId, const QString& action, const QString& table, const QJsonValue& data, int statusCode);
    void onQueryFailed(const QString& requestId, const QString& action, const QString& table, const QString& errorText, int statusCode);

private:
    enum class PendingType {
        None,
        Today,
        Yesterday,
        Badges,
        Leaderboard,
        Company,
        QuickUpsert,
        BikeCount,
        TransitCheck
    };

    void handleBadgeChecks(const QString& userId, const QString& workspaceId, const QString& transportType, double kgCo2);
    double sumKgFromRows(const QVariantList& rows) const;

    QPointer<SupabaseDatabase> m_database;
    QHash<QString, PendingType> m_pending;
    QHash<QString, QString> m_badgeUserByRequest;
    QString m_dailyUser;
    double m_todayKg = 0;
    double m_yesterdayKg = 0;
    QString m_leaderboardWorkspace;
    QString m_companyWorkspace;
};
