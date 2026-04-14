import QtQuick
import QtQuick.Controls

Item {
    id: root
    property string localeCode: ""
    readonly property string countryCode: localeCode.indexOf("-") >= 0 ? localeCode.split("-")[1].toUpperCase() : localeCode.toUpperCase()

    function flagEmoji(code) {
        if (!code || code.length !== 2) return "🌐"
        var first = 0x1F1E6 + (code.charCodeAt(0) - 65)
        var second = 0x1F1E6 + (code.charCodeAt(1) - 65)
        return String.fromCodePoint(first) + String.fromCodePoint(second)
    }

    width: badgeRow.implicitWidth
    height: badgeRow.implicitHeight
    visible: localeCode.length > 0

    Row {
        id: badgeRow
        spacing: 4

        Rectangle {
            width: 18
            height: 14
            radius: 3
            color: Theme.accentSoft
            border.color: Theme.panelBorder

            Text {
                anchors.centerIn: parent
                text: root.flagEmoji(root.countryCode)
                color: Theme.accent
                font.pixelSize: 9
                font.weight: Font.Bold
            }
        }

        Text {
            text: "Translated"
            color: Theme.accent
            font.pixelSize: 11
            font.weight: Font.DemiBold
        }
    }
}
