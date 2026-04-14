import QtQuick
import QtQuick.Controls

Rectangle {
    id: root
    property real score: 65
    property string label: score > 70 ? "Collaborative" : (score >= 45 ? "Neutral" : "Critical")

    radius: 10
    color: Theme.surfaceContainerLow
    border.color: Theme.panelBorder
    implicitHeight: 56

    Column {
        anchors.fill: parent
        anchors.margins: 10
        spacing: 6

        Row {
            width: parent.width

            Text {
                text: "TONE SENTIMENT"
                color: Theme.onSurfaceVariant
                font.pixelSize: 10
                font.weight: Font.Bold
            }

            Item { width: parent.width - toneLabel.width - 110 }

            Text {
                id: toneLabel
                text: root.label
                color: root.score > 70 ? Theme.primary : (root.score >= 45 ? "#f59e0b" : Theme.error)
                font.pixelSize: 12
                font.weight: Font.DemiBold
            }
        }

        Rectangle {
            width: parent.width
            height: 12
            radius: 6
            color: Theme.surfaceContainerHighest

            Rectangle {
                width: Math.max(0, Math.min(parent.width, parent.width * root.score / 100.0))
                height: parent.height
                radius: 6
                color: root.score > 70 ? Theme.primary : (root.score >= 45 ? "#f59e0b" : Theme.error)

                Behavior on width {
                    NumberAnimation { duration: 500; easing.type: Easing.InOutQuad }
                }
            }
        }
    }
}
