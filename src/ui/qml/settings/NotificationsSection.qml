import QtQuick
import QtQuick.Controls

Item {
    id: root
    property var settingsService
    property var appState
    property var prefs: ({
        direct_messages: true,
        mentions: true,
        channel_updates: true,
        pulse_alerts: true,
        email_digest: false,
        sounds: true
    })

    readonly property var keys: ["direct_messages", "mentions", "channel_updates", "pulse_alerts", "email_digest", "sounds"]

    function save(key, value) {
        prefs[key] = value
        if (settingsService && appState) settingsService.saveNotificationPref(appState.currentUserId, key, value)
    }

    Column {
        anchors.fill: parent
        spacing: 10

        Text { text: "Notifications"; color: Theme.onSurface; font.pixelSize: 32; font.weight: Font.ExtraBold }
        Text { text: "Changes are saved automatically..."; color: Theme.onSurfaceVariant; font.pixelSize: 12 }

        Repeater {
            model: root.keys
            delegate: Rectangle {
                width: parent.width
                height: 46
                radius: 10
                color: Theme.surfaceContainerLow
                border.color: Theme.panelBorder

                Row {
                    anchors.fill: parent
                    anchors.margins: 8
                    Text {
                        text: modelData
                        color: Theme.onSurface
                        font.pixelSize: 13
                    }
                    Item { width: parent.width - toggle.width - 120 }
                    Switch {
                        id: toggle
                        checked: Boolean(root.prefs[modelData])
                        onToggled: root.save(modelData, checked)
                    }
                }
            }
        }
    }
}
