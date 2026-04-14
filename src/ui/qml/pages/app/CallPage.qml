import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Item {
    id: root
    property var appState
    property var supabaseRealtime
    property bool micActive: true
    property bool videoActive: true
    property bool deafened: false
    property int seconds: 0
    property var participants: []

    signal endCall()

    function initialsFromName(name) {
        var n = String(name || "").trim()
        if (n.length === 0) return "--"
        var parts = n.split(/\s+/)
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
        return (parts[0][0] + parts[1][0]).toUpperCase()
    }

    function colorForInitials(initials) {
        if (initials === "US") return "#3b82f6"
        if (initials === "AK") return "#6366f1"
        if (initials === "MG") return "#a855f7"
        var sum = 0
        for (var i = 0; i < initials.length; ++i) sum += initials.charCodeAt(i)
        var palette = ["#3b82f6", "#6366f1", "#a855f7", "#0ea5e9", "#14b8a6"]
        return palette[sum % palette.length]
    }

    function formatDuration(v) {
        var m = Math.floor(v / 60)
        var s = v % 60
        return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s
    }

    Component.onCompleted: {
        timer.start()
        if (supabaseRealtime && appState) supabaseRealtime.subscribeChannel("presence:" + appState.workspaceId)
    }

    Component.onDestruction: {
        if (supabaseRealtime && appState) supabaseRealtime.unsubscribeChannel("presence:" + appState.workspaceId)
    }

    Timer {
        id: timer
        interval: 1000
        repeat: true
        onTriggered: root.seconds += 1
    }

    Connections {
        target: supabaseRealtime
        function onPresenceUpdated(topic, state) {
            if (!appState || topic !== "presence:" + appState.workspaceId) return
            var users = []
            for (var k in state) {
                if (state.hasOwnProperty(k)) {
                    var metas = state[k].metas || []
                    if (metas.length > 0) users.push(metas[0])
                }
            }
            root.participants = users
        }
    }

    Rectangle {
        anchors.centerIn: parent
        width: Math.min(parent.width - 40, 900)
        height: Math.min(parent.height - 40, 620)
        radius: 24
        color: Qt.rgba(1, 1, 1, 0.6)
        border.color: Theme.panelBorder

        ColumnLayout {
            anchors.fill: parent
            spacing: 0

            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 80
                color: "transparent"
                RowLayout {
                    anchors.fill: parent
                    anchors.margins: 12
                    spacing: 10

                    Rectangle {
                        width: 42
                        height: 42
                        radius: 10
                        color: Theme.accentSoft
                        Text { anchors.centerIn: parent; text: "record_voice_over"; color: Theme.primary; font.family: "Material Symbols Outlined" }
                    }

                    Column {
                        Text { text: "#" + (appState ? appState.activeChannelName : "general") + " Voice Room"; color: Theme.onSurface; font.pixelSize: 18; font.weight: Font.DemiBold }
                        Row {
                            spacing: 8
                            Rectangle { width: 8; height: 8; radius: 4; color: Theme.tertiary }
                            Text { text: root.formatDuration(root.seconds); color: Theme.onSurfaceVariant; font.pixelSize: 12 }
                        }
                    }

                    Item { Layout.fillWidth: true }

                    Repeater {
                        model: Math.min(3, root.participants.length)
                        delegate: Rectangle {
                            readonly property string initials: root.initialsFromName(modelData.name || modelData.user_id || "")
                            width: 32
                            height: 32
                            radius: 16
                            color: root.colorForInitials(initials)
                            Text { anchors.centerIn: parent; text: initials; color: "white"; font.pixelSize: 11; font.weight: Font.Bold }
                        }
                    }

                    Rectangle {
                        visible: root.participants.length > 3
                        width: 32
                        height: 32
                        radius: 16
                        color: Theme.surfaceContainerHigh
                        Text { anchors.centerIn: parent; text: "+" + (root.participants.length - 3); color: Theme.onSurfaceVariant; font.pixelSize: 11 }
                    }

                    Button { text: "person_add"; contentItem: Text { text: parent.text; font.family: "Material Symbols Outlined" } }
                    Button { text: "more_vert"; contentItem: Text { text: parent.text; font.family: "Material Symbols Outlined" } }
                }
            }

            Rectangle {
                Layout.fillWidth: true
                Layout.fillHeight: true
                color: "#f8f9fa"

                Column {
                    anchors.centerIn: parent
                    spacing: 10

                    Rectangle {
                        width: 128
                        height: 128
                        radius: 64
                        color: Theme.surfaceContainer
                        border.color: root.micActive ? Theme.primary : Theme.panelBorder
                        border.width: 4
                        Text { anchors.centerIn: parent; text: "You"; color: Theme.onSurface; font.pixelSize: 24; font.weight: Font.Bold }
                    }

                    Text {
                        text: root.micActive && !root.deafened ? "Speaking..." : "Muted"
                        color: Theme.onSurfaceVariant
                        font.pixelSize: 14
                    }
                }
            }

            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 90
                color: "transparent"

                Row {
                    anchors.centerIn: parent
                    spacing: 10

                    Button {
                        text: root.micActive ? "mic" : "mic_off"
                        onClicked: root.micActive = !root.micActive
                        background: Rectangle { radius: 20; color: root.micActive ? "#334155" : Theme.error }
                        contentItem: Text { text: parent.text; color: "white"; font.family: "Material Symbols Outlined" }
                    }
                    Button {
                        text: root.videoActive ? "videocam" : "videocam_off"
                        onClicked: root.videoActive = !root.videoActive
                        background: Rectangle { radius: 20; color: root.videoActive ? "#334155" : "#0ea5e9" }
                        contentItem: Text { text: parent.text; color: "white"; font.family: "Material Symbols Outlined" }
                    }
                    Button {
                        text: root.deafened ? "hearing_disabled" : "hearing"
                        onClicked: root.deafened = !root.deafened
                        background: Rectangle { radius: 20; color: "#334155" }
                        contentItem: Text { text: parent.text; color: root.deafened ? "#f59e0b" : "white"; font.family: "Material Symbols Outlined" }
                    }
                    Rectangle { width: 1; height: 26; color: Theme.panelBorder }
                    Button {
                        text: "Leave Call"
                        onClicked: root.endCall()
                        background: Rectangle { radius: 18; color: Theme.error }
                        contentItem: Row {
                            spacing: 6
                            Text { text: "call_end"; color: "white"; font.family: "Material Symbols Outlined" }
                            Text { text: parent.parent.text; color: "white"; font.pixelSize: 12; font.weight: Font.DemiBold }
                        }
                    }
                }
            }
        }
    }
}
