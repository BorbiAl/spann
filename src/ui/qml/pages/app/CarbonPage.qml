import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../../carbon"

Item {
    id: root
    property var appState
    property var carbonService

    property real todayKg: 0
    property real yesterdayKg: 0
    property var badges: []
    property var leaderboardRows: []
    property real companyTotalKg: 0
    property string errorText: ""
    property bool isSubmitting: false

    signal openSettings()
    signal openSupport()

    function reloadAll() {
        if (!carbonService || !appState) return
        carbonService.loadDailyFootprint(appState.currentUserId)
        carbonService.loadBadges(appState.currentUserId)
        carbonService.loadLeaderboard(appState.workspaceId)
        carbonService.loadCompanyGoal(appState.workspaceId)
    }

    Component.onCompleted: reloadAll()

    Connections {
        target: carbonService
        function onDailyFootprintLoaded(today, yesterday) {
            root.todayKg = today
            root.yesterdayKg = yesterday
        }
        function onBadgesLoaded(items) { root.badges = items }
        function onLeaderboardLoaded(rows) { root.leaderboardRows = rows }
        function onCompanyGoalLoaded(totalKg) { root.companyTotalKg = totalKg }
        function onCarbonError(message) { root.errorText = message; root.isSubmitting = false }
        function onQuickLogCompleted() { root.isSubmitting = false; root.reloadAll() }
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 48
            color: Theme.surface
            border.color: Theme.panelBorder

            RowLayout {
                anchors.fill: parent
                anchors.margins: 8
                spacing: 10

                Text { text: "Spann"; color: Theme.onSurface; font.pixelSize: 18; font.weight: Font.DemiBold }

                Rectangle {
                    Layout.preferredWidth: 220
                    Layout.preferredHeight: 30
                    radius: 15
                    color: Theme.surfaceContainerLow
                    Row {
                        anchors.verticalCenter: parent.verticalCenter
                        anchors.left: parent.left
                        anchors.leftMargin: 8
                        spacing: 6
                        Text { text: "search"; color: Theme.onSurfaceVariant; font.family: "Material Symbols Outlined"; font.pixelSize: 16 }
                        Text { text: "Search workspace..."; color: Theme.onSurfaceVariant; font.pixelSize: 11 }
                    }
                }

                Text { text: "Insights"; color: Theme.primary; font.pixelSize: 13; font.weight: Font.DemiBold }

                Item { Layout.fillWidth: true }

                Button { text: "Settings"; onClicked: root.openSettings() }
                Button { text: "Support"; onClicked: root.openSupport() }
            }
        }

        Text {
            Layout.leftMargin: 16
            Layout.topMargin: 8
            text: root.errorText
            color: Theme.error
            visible: root.errorText.length > 0
            font.pixelSize: 12
        }

        GridLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.margins: 16
            columns: 12
            rowSpacing: 12
            columnSpacing: 12

            Rectangle {
                Layout.columnSpan: 8
                Layout.fillWidth: true
                Layout.fillHeight: true
                radius: 24
                color: Theme.cardBg
                border.color: Theme.panelBorder
                ProgressRing {
                    anchors.fill: parent
                    anchors.margins: 14
                    kgValue: root.todayKg
                    yesterdayKg: root.yesterdayKg
                }
            }

            Leaderboard {
                Layout.columnSpan: 4
                Layout.fillWidth: true
                Layout.fillHeight: true
                rows: root.leaderboardRows
                companyTotalKg: root.companyTotalKg
            }

            Rectangle {
                Layout.columnSpan: 8
                Layout.fillWidth: true
                Layout.preferredHeight: 340
                radius: 24
                color: Theme.cardBg
                border.color: Theme.panelBorder

                Column {
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 10
                    Text { text: "Environmental Achievements"; color: Theme.onSurface; font.pixelSize: 18; font.weight: Font.Bold }
                    BadgeShelf { earnedBadges: root.badges }
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 92
            color: "transparent"
            QuickLogBar {
                anchors.centerIn: parent
                width: Math.min(parent.width - 24, 840)
                height: 78
                submitting: root.isSubmitting
                onLogAction: function(type, kg) {
                    if (!carbonService || !appState) return
                    root.isSubmitting = true
                    carbonService.quickLogAction(appState.currentUserId, appState.workspaceId, type, kg)
                }
            }
        }
    }
}
