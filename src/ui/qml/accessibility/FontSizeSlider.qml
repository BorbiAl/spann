import QtQuick
import QtQuick.Controls

Item {
    id: root
    property int value: 16
    signal valueChangedByUser(int value)

    Column {
        anchors.fill: parent
        spacing: 8

        Slider {
            id: slider
            from: 13
            to: 22
            stepSize: 1
            value: root.value
            onMoved: root.valueChangedByUser(Math.round(value))
        }

        Text {
            text: "Currently set to " + Math.round((root.value / 16) * 100) + "% (" + (root.value > 16 ? "Large" : "Standard") + ")"
            color: Theme.onSurfaceVariant
            font.pixelSize: 12
        }
    }
}
