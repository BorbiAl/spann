import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../../mesh"

Item {
    id: root
    property var appState
    property var meshService
    property bool meshActive: true
    property bool busy: false
    property string errorText: ""
    property var meshNodes: []
    property bool showAllNodes: false

    function reload() {
        if (!meshService || !appState) return
        busy = true
        meshService.loadNodes(appState.workspaceId)
    }

    function mapNode(raw, i) {
        var seen = raw.last_seen || raw.last_ping_at || ""
        var time = seen ? Qt.formatDateTime(new Date(seen), "hh:mm") : "--:--"
        var signal = Number(raw.signal_strength || 2)
        var bars = signal <= 3 ? signal : (signal >= 70 ? 3 : (signal >= 35 ? 2 : 1))
        var progress = raw.revoked ? 15 : (bars === 3 ? 85 : (bars === 2 ? 62 : 35))
        return {
            index: i,
            nodeId: String(raw.node_id || raw.id || ""),
            name: String(raw.user && raw.user.display_name ? raw.user.display_name : (raw.name || "Node")),
            shortName: String(raw.user && raw.user.display_name ? raw.user.display_name : (raw.name || "Node")).split(" ")[0],
            statusLabel: raw.revoked ? "Standby" : "Active",
            lastSeen: time,
            progress: progress,
            revoked: Boolean(raw.revoked)
        }
    }

    Component.onCompleted: reload()

    Connections {
        target: meshService
        function onNodesLoaded(nodes) {
            root.busy = false
            var prepared = []
            for (var i = 0; i < nodes.length; ++i) prepared.push(root.mapNode(nodes[i], i))
            root.meshNodes = prepared
            root.errorText = ""
        }
        function onMeshError(message) {
            root.busy = false
            root.errorText = message
        }
        function onNodeRegistered() { root.reload() }
        function onNodeRevoked() { root.reload() }
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
                anchors.margins: 10

                Text {
                    text: "Spann"
                    color: Theme.onSurface
                    font.pixelSize: 18
                    font.weight: Font.DemiBold
                }

                Row {
                    spacing: 4
                    Rectangle {
                        width: 132
                        height: 30
                        radius: 15
                        color: Theme.surfaceContainerLow
                        border.color: Theme.panelBorder

                        Row {
                            anchors.centerIn: parent
                            spacing: 2
                            Repeater {
                                model: ["Internet", "Mesh"]
                                delegate: Button {
                                    text: modelData
                                    onClicked: root.meshActive = modelData === "Mesh"
                                    background: Rectangle {
                                        radius: 13
                                        color: (root.meshActive && modelData === "Mesh") || (!root.meshActive && modelData === "Internet")
                                            ? Theme.surfaceContainerLowest : "transparent"
                                    }
                                    contentItem: Text {
                                        text: parent.text
                                        color: Theme.onSurface
                                        font.pixelSize: 11
                                    }
                                }
                            }
                        }
                    }
                }

                Item { Layout.fillWidth: true }

                Repeater {
                    model: ["settings", "help_outline", "account_circle"]
                    delegate: Button {
                        text: modelData
                        background: Rectangle { color: "transparent" }
                        contentItem: Text {
                            text: parent.text
                            color: Theme.onSurfaceVariant
                            font.family: "Material Symbols Outlined"
                            font.pixelSize: 20
                        }
                    }
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 1
            gradient: Gradient {
                GradientStop { position: 0; color: "transparent" }
                GradientStop { position: 0.5; color: Theme.panelBorder }
                GradientStop { position: 1; color: "transparent" }
            }
        }

        AlertBanner {
            Layout.fillWidth: true
            Layout.margins: 16
            peerCount: root.meshNodes.filter(function(n) { return !n.revoked }).length
            busy: root.busy
            onReconnectClicked: root.reload()
        }

        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            Layout.margins: 16
            spacing: 12

            Rectangle {
                Layout.fillWidth: true
                Layout.fillHeight: true
                radius: 24
                color: Theme.surfaceContainerLowest
                border.color: Theme.panelBorder

                MeshMap {
                    anchors.fill: parent
                    anchors.margins: 18
                    nodes: root.meshNodes
                }

                Column {
                    anchors.left: parent.left
                    anchors.top: parent.top
                    anchors.margins: 18
                    spacing: 4
                    Text { text: "Mesh Status"; color: Theme.onSurfaceVariant; font.pixelSize: 10; font.weight: Font.Bold }
                    Text { text: root.meshActive ? "Self-Healing Active" : "Gateway Priority"; color: Theme.onSurface; font.pixelSize: 13 }
                }

                Row {
                    anchors.right: parent.right
                    anchors.bottom: parent.bottom
                    anchors.margins: 16
                    spacing: 8

                    Rectangle {
                        width: 110
                        height: 56
                        radius: 14
                        color: Theme.surfaceContainerLow
                        border.color: Theme.panelBorder
                        Column {
                            anchors.centerIn: parent
                            Text { text: "Total Peers"; color: Theme.onSurfaceVariant; font.pixelSize: 10 }
                            Text { text: String(root.meshNodes.filter(function(n) { return !n.revoked }).length); color: Theme.primary; font.pixelSize: 24; font.weight: Font.Bold }
                        }
                    }

                    Button {
                        text: "add"
                        onClicked: meshService.registerNode(appState.workspaceId)
                        background: Rectangle { radius: 14; color: Theme.primary }
                        contentItem: Text {
                            text: parent.text
                            color: Theme.onPrimary
                            font.family: "Material Symbols Outlined"
                            font.pixelSize: 22
                            horizontalAlignment: Text.AlignHCenter
                            verticalAlignment: Text.AlignVCenter
                        }
                    }
                }
            }

            Rectangle {
                Layout.preferredWidth: 320
                Layout.fillHeight: true
                radius: 22
                color: Theme.cardBg
                border.color: Theme.panelBorder

                Column {
                    anchors.fill: parent
                    anchors.margins: 14
                    spacing: 10

                    Text { text: "Connected Devices"; color: Theme.onSurface; font.pixelSize: 18; font.weight: Font.Bold }
                    Text {
                        text: root.meshNodes.filter(function(n) { return !n.revoked }).length + " nodes active"
                        color: Theme.onSurfaceVariant
                        font.pixelSize: 12
                    }

                    ScrollView {
                        width: parent.width
                        height: parent.height - 170
                        clip: true

                        Column {
                            width: parent.width
                            spacing: 8
                            Repeater {
                                model: root.showAllNodes ? root.meshNodes : root.meshNodes.slice(0, 4)
                                delegate: NodeCard {
                                    width: parent.width
                                    nodeData: modelData
                                    onRevoke: meshService.revokeNode(nodeId)
                                }
                            }
                        }
                    }

                    Button {
                        visible: root.meshNodes.length > 4
                        text: root.showAllNodes ? "Show Less" : "View All " + root.meshNodes.length + " Nodes"
                        onClicked: root.showAllNodes = !root.showAllNodes
                        background: Rectangle { radius: 12; color: Theme.surfaceContainerHigh }
                        contentItem: Text { text: parent.text; color: Theme.onSurface; font.pixelSize: 12 }
                    }

                    Rectangle {
                        width: parent.width
                        height: 90
                        radius: 16
                        color: Theme.primaryContainer
                        border.color: Theme.panelBorder

                        Column {
                            anchors.fill: parent
                            anchors.margins: 10
                            spacing: 6
                            Text { text: "security"; color: Theme.onPrimary; font.family: "Material Symbols Outlined"; font.pixelSize: 20 }
                            Text { text: "256-bit AES"; color: Theme.onPrimary; font.pixelSize: 15; font.weight: Font.DemiBold }
                            Button {
                                text: "Audit Security"
                                background: Rectangle { radius: 8; color: Theme.surfaceContainerLowest }
                                contentItem: Text { text: parent.text; color: Theme.primary; font.pixelSize: 11 }
                            }
                        }
                    }
                }
            }
        }
    }
}
