import QtQuick

Item {
    id: root
    property var result: ({})

    Column {
        anchors.fill: parent
        spacing: 10

        Rectangle {
            width: parent.width
            radius: 12
            color: Theme.surfaceContainerLow
            border.color: Theme.panelBorder
            Column {
                anchors.fill: parent
                anchors.margins: 10
                spacing: 6
                Row {
                    spacing: 6
                    Text { text: "translate"; color: Theme.onSurfaceVariant; font.family: "Material Symbols Outlined"; font.pixelSize: 16 }
                    Text { text: "Literal Translation"; color: Theme.onSurface; font.pixelSize: 13; font.weight: Font.DemiBold }
                }
                Text { text: result.literal || ""; color: Theme.onSurface; wrapMode: Text.WordWrap; font.pixelSize: 14 }
            }
        }

        Rectangle {
            width: parent.width
            radius: 12
            color: Theme.surfaceContainerLow
            border.color: Theme.accentSoft
            Column {
                anchors.fill: parent
                anchors.margins: 10
                spacing: 6
                Row {
                    spacing: 6
                    Text { text: "auto_awesome"; color: Theme.onSurfaceVariant; font.family: "Material Symbols Outlined"; font.pixelSize: 16 }
                    Text { text: "Cultural Context"; color: Theme.onSurface; font.pixelSize: 13; font.weight: Font.DemiBold }
                }
                Text { text: result.cultural || ""; color: Theme.onSurface; wrapMode: Text.WordWrap; font.pixelSize: 14 }
            }
        }

        Rectangle {
            width: parent.width
            radius: 12
            color: Theme.tertiaryContainer
            Column {
                anchors.fill: parent
                anchors.margins: 10
                spacing: 6
                Row {
                    spacing: 6
                    Text { text: "lightbulb"; color: Theme.tertiary; font.family: "Material Symbols Outlined"; font.pixelSize: 16 }
                    Text { text: "Nuance Explanation"; color: Theme.tertiary; font.pixelSize: 12; font.weight: Font.DemiBold }
                }
                Text { text: result.explanation || ""; color: Theme.tertiary; wrapMode: Text.WordWrap; font.pixelSize: 12 }

                Row {
                    spacing: 6
                    Repeater {
                        model: result.tags || []
                        delegate: Rectangle {
                            radius: 10
                            color: Theme.surfaceContainerLowest
                            implicitHeight: 22
                            implicitWidth: t.implicitWidth + 10
                            Text { id: t; anchors.centerIn: parent; text: modelData; color: Theme.onSurfaceVariant; font.pixelSize: 10 }
                        }
                    }
                }
            }
        }

        Column {
            spacing: 4
            Text { text: "Sentiment & Politeness"; color: Theme.onSurfaceVariant; font.pixelSize: 11; font.weight: Font.Bold }
            Rectangle {
                width: parent.width
                height: 10
                radius: 5
                color: Theme.surfaceContainerHigh
                Rectangle {
                    width: parent.width * Number(result.sentiment_score || 0)
                    height: parent.height
                    radius: parent.radius
                    gradient: Gradient {
                        GradientStop { position: 0; color: Theme.primaryContainer }
                        GradientStop { position: 1; color: Theme.primary }
                    }
                }
            }
            Text {
                text: result.sentiment_label || ""
                color: Theme.onSurfaceVariant
                font.pixelSize: 11
            }
        }
    }
}
