import QtQuick
import QtQuick.Controls
import Qt.labs.settings

Item {
    id: root
    property var settingsService
    property int fontSize: 16
    property string themeMode: "system"

    Settings {
        id: appearanceSettings
        category: "appearance"
        property string mode: "system"
        property int size: 16
    }

    function applyTheme(mode) {
        root.themeMode = mode
        appearanceSettings.mode = mode
        if (settingsService) settingsService.saveTheme(mode)
        Theme.mode = mode
    }

    function applyFontSize(v) {
        root.fontSize = v
        appearanceSettings.size = v
        if (settingsService) settingsService.saveFontSize(v)
        settingsService.applyToEngine({ font_size: v })
    }

    Column {
        anchors.fill: parent
        spacing: 10

        Text { text: "Appearance"; color: Theme.onSurface; font.pixelSize: 32; font.weight: Font.ExtraBold }

        Row {
            spacing: 10
            Repeater {
                model: [
                    { key: "light", label: "Light", color: "#f9f9f9" },
                    { key: "dark", label: "Dark", color: "#0b1220" },
                    { key: "system", label: "System", color: "#0f67b7" }
                ]
                delegate: Rectangle {
                    width: 130
                    height: 90
                    radius: 12
                    color: modelData.color
                    border.width: root.themeMode === modelData.key ? 2 : 1
                    border.color: root.themeMode === modelData.key ? Theme.primary : Theme.panelBorder
                    Text {
                        anchors.centerIn: parent
                        text: modelData.label
                        color: root.themeMode === modelData.key ? Theme.primary : Theme.onSurface
                        font.pixelSize: 12
                        font.weight: Font.DemiBold
                    }
                    TapHandler { onTapped: root.applyTheme(modelData.key) }
                }
            }
        }

        Text { text: "Font Size"; color: Theme.onSurface; font.pixelSize: 14; font.weight: Font.DemiBold }
        Slider {
            from: 13
            to: 20
            stepSize: 1
            value: root.fontSize
            onMoved: root.applyFontSize(Math.round(value))
        }
        Text {
            text: "Preview text at " + root.fontSize + "px"
            color: Theme.onSurfaceVariant
            font.pixelSize: root.fontSize
        }
    }
}
