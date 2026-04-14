import QtQuick

Item {
    id: root

    readonly property var groups: [
        { name: "Navigation", items: [
            { label: "Open Search", keys: ["Ctrl", "K"] },
            { label: "Switch View", keys: ["Ctrl", "1-9"] }
        ]},
        { name: "Messaging", items: [
            { label: "Send Message", keys: ["Enter"] },
            { label: "New Line", keys: ["Shift", "Enter"] }
        ]},
        { name: "Interface", items: [
            { label: "Toggle TTS", keys: ["Alt", "Z"] },
            { label: "Open Settings", keys: ["Ctrl", ","] }
        ]}
    ]

    Column {
        anchors.fill: parent
        spacing: 10

        Text { text: "Keyboard Shortcuts"; color: Theme.onSurface; font.pixelSize: 32; font.weight: Font.ExtraBold }

        Repeater {
            model: root.groups
            delegate: Rectangle {
                width: parent.width
                radius: 12
                color: Theme.surfaceContainerLow
                border.color: Theme.panelBorder

                Column {
                    anchors.fill: parent
                    anchors.margins: 10
                    spacing: 8

                    Text { text: modelData.name; color: Theme.onSurface; font.pixelSize: 14; font.weight: Font.Bold }

                    Repeater {
                        model: modelData.items
                        delegate: Row {
                            width: parent.width
                            spacing: 8
                            Text { text: modelData.label; color: Theme.onSurface; font.pixelSize: 12 }
                            Item { width: parent.width - keyRow.width - 130 }
                            Row {
                                id: keyRow
                                spacing: 4
                                Repeater {
                                    model: modelData.keys
                                    delegate: Rectangle {
                                        radius: 6
                                        color: Theme.surfaceContainerHighest
                                        border.color: Theme.panelBorder
                                        implicitWidth: k.implicitWidth + 10
                                        implicitHeight: 22
                                        Text { id: k; anchors.centerIn: parent; text: modelData; color: Theme.onSurfaceVariant; font.family: "Consolas"; font.pixelSize: 10 }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
