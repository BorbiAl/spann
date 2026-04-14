import QtQuick
import QtQuick.Controls

Rectangle {
    id: root
    property int peerCount: 0
    property bool busy: false
    signal reconnectClicked()

    radius: 12
    color: Theme.errorContainer
    border.color: Theme.error
    implicitHeight: 52

    Row {
        anchors.fill: parent
        anchors.margins: 10
        spacing: 8

        Text {
            text: "wifi_off"
            color: Theme.error
            font.family: "Material Symbols Outlined"
            font.pixelSize: 20
        }

        Text {
            width: parent.width - reconnectButton.width - 42
            text: "Internet disconnected. Mesh network active with " + root.peerCount + " peers."
            wrapMode: Text.WordWrap
            color: Theme.onSurface
            font.pixelSize: 13
        }

        Button {
            id: reconnectButton
            text: root.busy ? "Checking..." : "Reconnect"
            enabled: !root.busy
            onClicked: root.reconnectClicked()
            background: Rectangle {
                radius: 8
                color: Theme.surfaceContainerLowest
                border.color: Theme.panelBorder
            }
            contentItem: Text {
                text: reconnectButton.text
                color: Theme.onSurface
                font.pixelSize: 12
                font.weight: Font.DemiBold
                horizontalAlignment: Text.AlignHCenter
                verticalAlignment: Text.AlignVCenter
            }
        }
    }
}
