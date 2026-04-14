import QtQuick

Item {
    id: root
    property var history: []

    Column {
        anchors.fill: parent
        spacing: 6

        Repeater {
            model: root.history
            delegate: Rectangle {
                width: parent.width
                height: 44
                radius: 10
                color: Theme.surfaceContainerLow
                border.color: Theme.panelBorder

                Row {
                    anchors.fill: parent
                    anchors.margins: 8
                    spacing: 8
                    Text { text: modelData.sourceEmoji + "->" + modelData.targetEmoji; color: Theme.onSurfaceVariant; font.pixelSize: 12 }
                    Text {
                        width: parent.width - 100
                        text: modelData.literal + " | " + modelData.cultural
                        color: Theme.onSurface
                        font.pixelSize: 12
                        elide: Text.ElideRight
                    }
                    Text { text: modelData.time; color: Theme.onSurfaceVariant; font.pixelSize: 10 }
                }
            }
        }
    }
}
