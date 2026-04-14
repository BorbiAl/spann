import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../../pulse"

Item {
    id: root
    property var appState
    property var pulseService
    property var supabaseRealtime

    property var channelEnergy: []
    property var trendPoints: [45, 52, 50, 63, 71, 66, 74]
    property int activeCount: 0
    property real teamEnergy: 0
    property bool micActive: false
    property string errorText: ""

    readonly property string teamLabel: teamEnergy > 80 ? "Vibrant" : (teamEnergy >= 60 ? "Energetic" : (teamEnergy >= 40 ? "Neutral" : "Muted"))

    function refreshAll() {
        if (!pulseService || !appState) return
        pulseService.loadChannelEnergy(appState.workspaceId)
        pulseService.loadSevenDayTrend(appState.workspaceId)
    }

    function recalcTeamEnergy() {
        if (channelEnergy.length === 0) {
            teamEnergy = 0
            return
        }
        var sum = 0
        for (var i = 0; i < channelEnergy.length; ++i) sum += Number(channelEnergy[i].energy || 0)
        teamEnergy = sum / channelEnergy.length
    }

    Component.onCompleted: {
        refreshAll()
        if (supabaseRealtime && appState) {
            supabaseRealtime.subscribeTable("pulse_snapshots", "INSERT", "public", "workspace_id=eq." + appState.workspaceId)
            supabaseRealtime.subscribeChannel("presence:" + appState.workspaceId)
        }
    }

    Component.onDestruction: {
        if (supabaseRealtime && appState) {
            supabaseRealtime.unsubscribeChannel("realtime:public:pulse_snapshots")
            supabaseRealtime.unsubscribeChannel("presence:" + appState.workspaceId)
        }
    }

    Connections {
        target: pulseService
        function onChannelEnergyLoaded(rows) {
            root.channelEnergy = rows
            root.recalcTeamEnergy()
        }
        function onSevenDayTrendLoaded(points) { root.trendPoints = points }
        function onPulseError(message) { root.errorText = message }
    }

    Connections {
        target: supabaseRealtime
        function onPostgresChangeReceived(topic, payload) {
            if (topic.indexOf("pulse_snapshots") !== -1) root.refreshAll()
        }
        function onPresenceUpdated(topic, state) {
            if (!appState || topic !== "presence:" + appState.workspaceId) return
            var count = 0
            for (var k in state) if (state.hasOwnProperty(k)) count += 1
            root.activeCount = count
        }
        function onConnectionStateChanged(state) {
            reconnectText.visible = state === "reconnecting"
            if (state === "connected") root.refreshAll()
        }
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 64
            color: Theme.surface
            border.color: Theme.panelBorder
            RowLayout {
                anchors.fill: parent
                anchors.margins: 12
                Text { text: "Pulse Dashboard"; color: Theme.onSurface; font.pixelSize: 30; font.weight: Font.ExtraBold }
                Rectangle {
                    Layout.preferredWidth: 220
                    Layout.preferredHeight: 32
                    radius: 16
                    color: Theme.surfaceContainerLow
                    Text { anchors.centerIn: parent; text: "Search workspace..."; color: Theme.onSurfaceVariant; font.pixelSize: 11 }
                }
                Item { Layout.fillWidth: true }
                Button { text: "settings"; contentItem: Text { text: parent.text; color: Theme.onSurfaceVariant; font.family: "Material Symbols Outlined" } }
                Button { text: "help"; contentItem: Text { text: parent.text; color: Theme.onSurfaceVariant; font.family: "Material Symbols Outlined" } }
                Button {
                    text: root.micActive ? "Mic Live" : "Join via Mic"
                    onClicked: root.micActive = !root.micActive
                    background: Rectangle {
                        radius: 14
                        gradient: Gradient {
                            GradientStop { position: 0; color: root.micActive ? Theme.error : Theme.primary }
                            GradientStop { position: 1; color: root.micActive ? "#7f1d1d" : Theme.primaryContainer }
                        }
                    }
                    contentItem: Row {
                        spacing: 6
                        Text { text: "mic"; color: Theme.onPrimary; font.family: "Material Symbols Outlined" }
                        Text { text: parent.parent.text; color: Theme.onPrimary; font.pixelSize: 12; font.weight: Font.DemiBold }
                    }
                }
            }
        }

        Text {
            id: reconnectText
            visible: false
            text: "Reconnecting..."
            color: Theme.onSurfaceVariant
            Layout.leftMargin: 16
            Layout.topMargin: 4
            font.pixelSize: 11
        }

        Text {
            text: root.errorText
            color: Theme.error
            visible: root.errorText.length > 0
            Layout.leftMargin: 16
            Layout.topMargin: 2
            font.pixelSize: 12
        }

        GridLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.margins: 16
            columns: 12
            columnSpacing: 12
            rowSpacing: 12

            Rectangle {
                Layout.columnSpan: 8
                Layout.fillWidth: true
                Layout.preferredHeight: 400
                radius: 18
                color: Theme.surfaceContainerLow
                border.color: Theme.panelBorder

                Column {
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 8
                    Text { text: "LIVE ACTIVITY"; color: Theme.onSurfaceVariant; font.pixelSize: 10; font.weight: Font.Bold }
                    Text { text: "Team Pulse Wave"; color: Theme.onSurface; font.pixelSize: 24; font.weight: Font.ExtraBold }
                    Row {
                        spacing: 8
                        Rectangle { width: 8; height: 8; radius: 4; color: Theme.tertiary }
                        Text { text: root.activeCount + " Active Now"; color: Theme.onSurface; font.pixelSize: 12 }
                        Button { text: "Refresh"; onClicked: root.refreshAll() }
                    }

                    WaveformBars {
                        width: parent.width
                        height: 240
                        values: root.channelEnergy.map(function(c) { return Math.max(20, Number(c.energy || 0) * 2.8) })
                    }
                }
            }

            Rectangle {
                Layout.columnSpan: 4
                Layout.fillWidth: true
                Layout.preferredHeight: 400
                radius: 18
                gradient: Gradient {
                    GradientStop { position: 0; color: Theme.primary }
                    GradientStop { position: 1; color: Theme.primaryContainer }
                }

                Column {
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 10
                    Text { text: "VELOCITY METRIC"; color: Theme.onPrimary; font.pixelSize: 10; font.weight: Font.Bold }
                    Text { text: "Team Energy"; color: Theme.onPrimary; font.pixelSize: 16; font.weight: Font.DemiBold }
                    Text { text: Number(root.teamEnergy).toFixed(0); color: Theme.onPrimary; font.pixelSize: 100; font.weight: Font.Black }
                    Text { text: root.teamLabel; color: Theme.onPrimary; font.pixelSize: 15; font.weight: Font.DemiBold }
                    Rectangle {
                        width: parent.width
                        height: 10
                        radius: 5
                        color: "rgba(255,255,255,0.2)"
                        Rectangle {
                            width: parent.width * root.teamEnergy / 100.0
                            height: parent.height
                            radius: parent.radius
                            color: "white"
                        }
                    }
                    Row {
                        spacing: 16
                        Text { text: "Muted"; color: Theme.onPrimary; font.pixelSize: 10 }
                        Text { text: "Optimal"; color: Theme.onPrimary; font.pixelSize: 10 }
                        Text { text: "Exhausted"; color: Theme.onPrimary; font.pixelSize: 10 }
                    }
                }
            }

            Rectangle {
                Layout.columnSpan: 5
                Layout.fillWidth: true
                Layout.preferredHeight: 250
                radius: 16
                color: Theme.cardBg
                border.color: Theme.panelBorder
                Column {
                    anchors.fill: parent
                    anchors.margins: 12
                    spacing: 8
                    Text { text: "Channel Sentiment"; color: Theme.onSurface; font.pixelSize: 16; font.weight: Font.Bold }
                    Repeater {
                        model: root.channelEnergy
                        delegate: ChannelEnergyRow { width: parent.width; rowData: modelData }
                    }
                }
            }

            Rectangle {
                Layout.columnSpan: 7
                Layout.fillWidth: true
                Layout.preferredHeight: 250
                radius: 16
                color: Theme.cardBg
                border.color: Theme.panelBorder
                Column {
                    anchors.fill: parent
                    anchors.margins: 12
                    spacing: 8
                    Text { text: "7-Day Trend"; color: Theme.onSurface; font.pixelSize: 16; font.weight: Font.Bold }
                    TrendChart { width: parent.width; height: 190; points: root.trendPoints }
                }
            }
        }

        Rectangle {
            anchors.right: parent.right
            anchors.bottom: parent.bottom
            anchors.margins: 18
            width: 56
            height: 56
            radius: 28
            gradient: Gradient {
                GradientStop { position: 0; color: Theme.primary }
                GradientStop { position: 1; color: Theme.primaryContainer }
            }
            Text {
                anchors.centerIn: parent
                text: "refresh"
                color: Theme.onPrimary
                font.family: "Material Symbols Outlined"
                font.pixelSize: 22
            }
            TapHandler { onTapped: root.refreshAll() }
        }
    }
}
