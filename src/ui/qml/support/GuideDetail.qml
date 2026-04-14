import QtQuick

Rectangle {
    id: root
    property var guide: ({ steps: [] })

    radius: 12
    color: Theme.surfaceContainerLow
    border.color: Theme.panelBorder

    Column {
        anchors.fill: parent
        anchors.margins: 10
        spacing: 8

        Text { text: guide.title || "Guide"; color: Theme.onSurface; font.pixelSize: 15; font.weight: Font.Bold }

        Repeater {
            model: guide.steps || []
            delegate: Row {
                spacing: 8
                Rectangle {
                    width: 20
                    height: 20
                    radius: 10
                    color: Theme.primary
                    Text {
                        anchors.centerIn: parent
                        text: String(index + 1)
                        color: Theme.onPrimary
                        font.pixelSize: 11
                        font.weight: Font.Bold
                    }
                }
                Text {
                    width: parent.width - 40
                    text: modelData
                    wrapMode: Text.WordWrap
                    color: Theme.onSurface
                    font.pixelSize: 12
                }
            }
        }
    }
}
