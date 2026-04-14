import QtQuick

Rectangle {
    id: root
    property var rowData: ({})

    radius: 12
    color: Theme.surfaceContainerLow
    border.color: Theme.panelBorder
    implicitHeight: 52

    Column {
        anchors.fill: parent
        anchors.margins: 8
        spacing: 4

        Row {
            Text { text: rowData.name || "#channel"; color: Theme.onSurface; font.pixelSize: 13; font.weight: Font.DemiBold }
            Item { width: parent.width - scoreText.width - 130 }
            Text {
                id: scoreText
                text: Number(rowData.energy || 0).toFixed(0) + "% - " + (rowData.label || "Neutral")
                color: Theme.onSurfaceVariant
                font.pixelSize: 11
            }
        }

        Rectangle {
            width: parent.width
            height: 7
            radius: 4
            color: Theme.surfaceContainerHigh
            Rectangle {
                width: Math.max(0, Math.min(parent.width, parent.width * Number(rowData.energy || 0) / 100.0))
                height: parent.height
                radius: parent.radius
                gradient: Gradient {
                    GradientStop { position: 0; color: Theme.primaryContainer }
                    GradientStop { position: 1; color: Theme.primary }
                }
            }
        }
    }
}
