import QtQuick
import QtQuick.Controls

Item {
    id: root
    property string updateState: "idle"

    Timer {
        id: updateTimer
        interval: 1200
        repeat: false
        onTriggered: root.updateState = "done"
    }

    Column {
        anchors.fill: parent
        spacing: 10

        Text { text: "About"; color: Theme.onSurface; font.pixelSize: 32; font.weight: Font.ExtraBold }

        Row {
            spacing: 10
            Rectangle {
                width: 52
                height: 52
                radius: 10
                color: Theme.primary
                Text { anchors.centerIn: parent; text: "S"; color: Theme.onPrimary; font.pixelSize: 24; font.weight: Font.Black }
            }
            Column {
                Text { text: "Spann"; color: Theme.onSurface; font.pixelSize: 20; font.weight: Font.Bold }
                Text { text: "Version 1.0.0  Build 2026.04"; color: Theme.onSurfaceVariant; font.pixelSize: 12 }
                Text { text: "Copyright 2026 Spann"; color: Theme.onSurfaceVariant; font.pixelSize: 11 }
            }
        }

        Button {
            text: root.updateState === "checking" ? "Checking..." : (root.updateState === "done" ? "✓ Up to date" : "Check for Updates")
            onClicked: {
                root.updateState = "checking"
                updateTimer.start()
            }
        }

        Grid {
            columns: 2
            spacing: 8
            Repeater {
                model: ["Release Notes", "Privacy Policy", "Terms of Service", "Support"]
                delegate: Rectangle {
                    width: 170
                    height: 36
                    radius: 8
                    color: Theme.surfaceContainerLow
                    border.color: Theme.panelBorder
                    Text { anchors.centerIn: parent; text: modelData; color: Theme.onSurface; font.pixelSize: 12 }
                }
            }
        }
    }
}
