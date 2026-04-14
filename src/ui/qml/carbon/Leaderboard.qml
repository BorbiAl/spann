import QtQuick

Rectangle {
    id: root
    property var rows: []
    property real companyTotalKg: 0
    property real companyTargetKg: 10000

    radius: 20
    color: Theme.cardBg
    border.color: Theme.panelBorder

    Column {
        anchors.fill: parent
        anchors.margins: 14
        spacing: 10

        Text { text: "Team Leaderboard"; color: Theme.onSurface; font.pixelSize: 18; font.weight: Font.Bold }

        Repeater {
            model: root.rows
            delegate: Rectangle {
                width: parent.width
                height: 56
                radius: 12
                color: modelData.isMe ? Theme.accentSoft : Theme.surfaceContainerLow
                border.color: Theme.panelBorder

                Row {
                    anchors.fill: parent
                    anchors.margins: 8
                    spacing: 8

                    Text {
                        text: String(index + 1)
                        color: index === 0 ? "#f59e0b" : (index === 1 ? "#c0c0c0" : (index === 2 ? "#cd7f32" : Theme.onSurfaceVariant))
                        font.pixelSize: 13
                        font.weight: Font.ExtraBold
                    }

                    Rectangle {
                        width: 40
                        height: 40
                        radius: 20
                        clip: true
                        color: Theme.surfaceContainer
                        Image {
                            anchors.fill: parent
                            source: modelData.avatar_url && modelData.avatar_url.length > 0
                                    ? modelData.avatar_url
                                    : ("https://api.dicebear.com/8.x/personas/svg?seed=" + modelData.user_id)
                            fillMode: Image.PreserveAspectCrop
                        }
                    }

                    Column {
                        width: parent.width - 150
                        Text { text: modelData.name || "Member"; color: Theme.onSurface; font.pixelSize: 13; font.weight: Font.DemiBold; elide: Text.ElideRight }
                        Text { text: Number(modelData.total || 0).toFixed(1) + "kg avg"; color: Theme.onSurfaceVariant; font.pixelSize: 10 }
                    }

                    Text {
                        text: Number(modelData.score || 0).toFixed(0) + " pts"
                        color: Theme.onSurface
                        font.pixelSize: 12
                        font.weight: Font.Bold
                    }
                }
            }
        }

        Rectangle {
            width: parent.width
            height: 72
            radius: 12
            color: Theme.tertiary
            Column {
                anchors.fill: parent
                anchors.margins: 10
                spacing: 6
                Text { text: "Company Goal: 10,000kg"; color: Theme.onPrimary; font.pixelSize: 11 }
                Rectangle {
                    width: parent.width
                    height: 7
                    radius: 4
                    color: "rgba(255,255,255,0.2)"
                    Rectangle {
                        width: Math.max(0, Math.min(parent.width, parent.width * root.companyTotalKg / root.companyTargetKg))
                        height: parent.height
                        radius: parent.radius
                        color: "white"
                    }
                }
                Text {
                    text: Number(root.companyTotalKg).toFixed(0) + "kg reached (" + Number(Math.min(100, (root.companyTotalKg / root.companyTargetKg) * 100)).toFixed(0) + "%)"
                    color: Theme.onPrimary
                    font.pixelSize: 10
                    font.weight: Font.Bold
                }
            }
        }
    }
}
