import QtQuick
import QtQuick.Controls

Rectangle {
    id: root
    property string iconName: ""
    property string title: ""
    property string description: ""
    property bool checked: false
    signal toggled(bool value)

    radius: 12
    color: rowHover.hovered ? Theme.surfaceContainerHigh : Theme.surfaceContainerLow
    border.color: Theme.panelBorder
    implicitHeight: 62

    Row {
        anchors.fill: parent
        anchors.margins: 10
        spacing: 10

        Text {
            text: iconName
            color: Theme.onSurfaceVariant
            font.family: "Material Symbols Outlined"
            font.pixelSize: 20
        }

        Column {
            width: parent.width - 100
            Text { text: root.title; color: Theme.onSurface; font.pixelSize: 14; font.weight: Font.DemiBold }
            Text { text: root.description; color: Theme.onSurfaceVariant; font.pixelSize: 11; elide: Text.ElideRight }
        }

        Switch {
            checked: root.checked
            onToggled: root.toggled(checked)
            indicator: Rectangle {
                implicitWidth: 44
                implicitHeight: 24
                radius: 12
                color: parent.checked ? Theme.tertiary : Theme.surfaceContainerHigh
                Rectangle {
                    width: 20
                    height: 20
                    radius: 10
                    y: 2
                    x: parent.parent.checked ? 22 : 2
                    color: Theme.surfaceContainerLowest
                    Behavior on x { NumberAnimation { duration: 150 } }
                }
            }
        }
    }

    HoverHandler { id: rowHover }
}
