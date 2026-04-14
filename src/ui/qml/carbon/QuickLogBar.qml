import QtQuick
import QtQuick.Controls

Rectangle {
    id: root
    signal logAction(string transportType, real kgCo2)
    property bool submitting: false

    radius: 26
    color: Theme.surfaceContainerLowest
    border.color: Theme.panelBorder

    readonly property var actions: [
        { key: "walk", label: "Walk", icon: "directions_walk", kg: 0.0, tertiary: true },
        { key: "bike", label: "Bike", icon: "pedal_bike", kg: 0.0, tertiary: true },
        { key: "bus", label: "Bus", icon: "directions_bus", kg: 0.5, tertiary: false },
        { key: "train", label: "Train", icon: "train", kg: 0.3, tertiary: false },
        { key: "car", label: "Car", icon: "directions_car", kg: 2.8, tertiary: false }
    ]

    Row {
        anchors.fill: parent
        anchors.margins: 8
        spacing: 10

        Text {
            text: "Quick Log Transport"
            color: Theme.onSurfaceVariant
            font.pixelSize: 10
            font.weight: Font.Black
            anchors.verticalCenter: parent.verticalCenter
        }

        Repeater {
            model: root.actions
            delegate: Button {
                width: 62
                height: 62
                enabled: !root.submitting
                onClicked: root.logAction(modelData.key, modelData.kg)
                background: Rectangle {
                    radius: 31
                    color: modelData.tertiary ? Theme.tertiaryContainer : Theme.accentSoft
                }
                contentItem: Column {
                    anchors.centerIn: parent
                    spacing: 1
                    Text {
                        text: modelData.icon
                        color: modelData.tertiary ? Theme.tertiary : Theme.primary
                        font.family: "Material Symbols Outlined"
                        font.pixelSize: 18
                        horizontalAlignment: Text.AlignHCenter
                    }
                    Text {
                        text: modelData.label
                        color: modelData.tertiary ? Theme.tertiary : Theme.primary
                        font.pixelSize: 10
                        font.weight: Font.Bold
                        horizontalAlignment: Text.AlignHCenter
                    }
                }
            }
        }
    }
}
