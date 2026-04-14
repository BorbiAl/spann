import QtQuick

Item {
    id: root
    property var earnedBadges: []

    function iconForKey(key) {
        if (key === "biker_100km") return "pedal_bike"
        if (key === "forest_guardian") return "forest"
        if (key === "transit_pro") return "commute"
        if (key === "zero_emission") return "eco"
        return "workspace_premium"
    }

    function titleForKey(key) {
        if (key === "biker_100km") return "Biker 100km"
        if (key === "forest_guardian") return "Forest Guardian"
        if (key === "transit_pro") return "Transit Pro"
        if (key === "zero_emission") return "Zero Emission"
        return "Achievement"
    }

    Grid {
        columns: 4
        spacing: 10

        Repeater {
            model: 8
            delegate: Rectangle {
                width: 142
                height: 148
                radius: 16
                color: Theme.cardBg
                border.color: Theme.panelBorder

                readonly property bool unlocked: index < root.earnedBadges.length
                readonly property var badge: unlocked ? root.earnedBadges[index] : ({})

                Column {
                    anchors.centerIn: parent
                    spacing: 8

                    Rectangle {
                        width: 58
                        height: 58
                        radius: 14
                        color: unlocked ? Theme.tertiaryContainer : Theme.surfaceContainerHigh
                        Text {
                            anchors.centerIn: parent
                            text: unlocked ? root.iconForKey(badge.badge_key) : "lock"
                            color: unlocked ? Theme.tertiary : Theme.onSurfaceVariant
                            font.family: "Material Symbols Outlined"
                            font.pixelSize: 28
                        }
                    }

                    Text {
                        text: unlocked ? root.titleForKey(badge.badge_key) : "???"
                        color: Theme.onSurface
                        font.pixelSize: 12
                        font.weight: Font.DemiBold
                        horizontalAlignment: Text.AlignHCenter
                    }

                    Text {
                        text: unlocked ? Qt.formatDateTime(new Date(badge.earned_at), "MMM dd") : "Locked"
                        color: Theme.onSurfaceVariant
                        font.pixelSize: 10
                        horizontalAlignment: Text.AlignHCenter
                    }
                }
            }
        }
    }
}
