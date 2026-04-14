import QtQuick
import QtQuick.Controls

Rectangle {
    id: root
    property var nodeData: ({})
    signal revoke(string nodeId)

    radius: 12
    color: nodeHover.hovered ? Theme.surfaceContainerHigh : Theme.surfaceContainerLow
    border.color: Theme.panelBorder
    implicitHeight: 70

    readonly property var iconNames: ["smartphone", "laptop", "tablet", "desktop_windows"]
    readonly property string iconName: iconNames[(nodeData.index || 0) % iconNames.length]

    Column {
        anchors.fill: parent
        anchors.margins: 10
        spacing: 8

        Row {
            spacing: 8
            Text {
                text: root.iconName
                color: Theme.onSurfaceVariant
                font.family: "Material Symbols Outlined"
                font.pixelSize: 20
            }
            Column {
                width: parent.width - 30
                Text {
                    text: nodeData.name || "Unnamed node"
                    color: Theme.onSurface
                    font.pixelSize: 13
                    font.weight: Font.DemiBold
                    elide: Text.ElideRight
                }
                Text {
                    text: (nodeData.statusLabel || "Active") + " - " + (nodeData.lastSeen || "--:--")
                    color: Theme.onSurfaceVariant
                    font.pixelSize: 11
                }
            }
        }

        Rectangle {
            width: parent.width
            height: 6
            radius: 3
            color: Theme.surfaceContainerHighest
            Rectangle {
                width: Math.max(8, Math.min(parent.width, Number(nodeData.progress || 0) * parent.width / 100.0))
                height: parent.height
                radius: 3
                color: Theme.primary
            }
        }
    }

    HoverHandler { id: nodeHover }
    TapHandler {
        onTapped: {
            if (nodeData.nodeId) root.revoke(nodeData.nodeId)
        }
    }
}
