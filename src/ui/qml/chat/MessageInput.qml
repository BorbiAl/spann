import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

Rectangle {
    id: root
    property bool translateEnabled: false
    property bool sending: false
    property string draftText: ""

    signal sendRequested(string text, bool translate)
    signal typingChanged(bool active)

    radius: 12
    color: Theme.surfaceContainerLowest
    border.color: Theme.panelBorder
    implicitHeight: inputCol.implicitHeight + 14

    Column {
        id: inputCol
        anchors.fill: parent
        anchors.margins: 8
        spacing: 8

        TextArea {
            id: inputField
            text: root.draftText
            placeholderText: "Write a message"
            color: Theme.onSurface
            placeholderTextColor: Theme.onSurfaceVariant
            font.pixelSize: 14
            wrapMode: TextArea.Wrap
            selectByMouse: true
            background: null
            implicitHeight: Math.min(120, Math.max(48, contentHeight + 10))
            onTextChanged: {
                root.draftText = text
                root.typingChanged(text.length > 0)
            }
        }

        RowLayout {
            width: parent.width
            spacing: 8

            Repeater {
                model: ["add_circle", "mic", "sentiment_satisfied", "alternate_email"]
                delegate: Button {
                    text: modelData
                    Layout.preferredWidth: 28
                    Layout.preferredHeight: 28
                    background: Rectangle { color: "transparent" }
                    contentItem: Text {
                        text: parent.text
                        color: Theme.onSurfaceVariant
                        font.family: "Material Symbols Outlined"
                        font.pixelSize: 20
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                    }
                }
            }

            Item { Layout.fillWidth: true }

            Text {
                text: "TRANSLATE"
                color: Theme.onSurfaceVariant
                font.pixelSize: 11
                font.weight: Font.Bold
                Layout.alignment: Qt.AlignVCenter
            }

            Switch {
                checked: root.translateEnabled
                indicator: Rectangle {
                    implicitWidth: 32
                    implicitHeight: 18
                    radius: 9
                    color: parent.checked ? "#10b981" : Theme.surfaceContainerHigh
                    border.color: Theme.panelBorder

                    Rectangle {
                        width: 14
                        height: 14
                        radius: 7
                        y: 2
                        x: parent.parent.checked ? parent.width - 16 : 2
                        color: "white"
                        Behavior on x { NumberAnimation { duration: 150 } }
                    }
                }
                onToggled: root.translateEnabled = checked
            }

            Button {
                text: root.sending ? "Sending" : "Send"
                enabled: !root.sending && inputField.text.trim().length > 0
                onClicked: {
                    root.sendRequested(inputField.text, root.translateEnabled)
                    inputField.text = ""
                }
                background: Rectangle {
                    radius: 16
                    color: parent.enabled ? Theme.primary : Theme.surfaceContainerHigh
                }
                contentItem: Row {
                    spacing: 4
                    Text {
                        text: parent.parent.text
                        color: Theme.onPrimary
                        font.pixelSize: 13
                        font.weight: Font.DemiBold
                    }
                    Text {
                        text: "send"
                        color: Theme.onPrimary
                        font.family: "Material Symbols Outlined"
                        font.pixelSize: 16
                    }
                }
            }
        }
    }
}
