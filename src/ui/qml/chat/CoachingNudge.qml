import QtQuick
import QtQuick.Controls

Rectangle {
    id: root
    property string nudgeText: ""
    signal dismissed()

    radius: 12
    color: Theme.accentSoft
    border.color: Theme.accent
    border.width: 1
    implicitHeight: contentCol.implicitHeight + 20

    Column {
        id: contentCol
        anchors.fill: parent
        anchors.margins: 10
        spacing: 8

        Row {
            spacing: 8

            Text {
                text: "info"
                color: Theme.accent
                font.pixelSize: 14
                font.family: "Material Symbols Outlined"
            }

            Text {
                width: root.width - dismissButton.width - 52
                text: root.nudgeText
                wrapMode: Text.WordWrap
                color: Theme.onSurface
                font.pixelSize: 13
            }

            Button {
                id: dismissButton
                text: "DISMISS"
                onClicked: root.dismissed()
                font.pixelSize: 11
                font.weight: Font.DemiBold
                background: Rectangle {
                    radius: 8
                    color: "transparent"
                    border.color: Theme.panelBorder
                }
                contentItem: Text {
                    text: dismissButton.text
                    color: Theme.onSurfaceVariant
                    font: dismissButton.font
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                }
            }
        }
    }
}
