import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../chat"

Item {
    id: root
    property var messageData: ({})
    property string currentUserId: ""

    function renderInlineMarkdown(value) {
        var raw = String(value || "")
        var escaped = raw
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
        return escaped.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    }

    signal reactRequested(string messageId, string emoji)
    signal editRequested(string messageId)
    signal deleteRequested(string messageId)

    width: parent ? parent.width : 800
    implicitHeight: contentCol.implicitHeight + 10

    Column {
        id: contentCol
        width: parent.width
        spacing: 6

        Row {
            spacing: 10

            Rectangle {
                width: 34
                height: 34
                radius: 17
                color: Theme.surfaceContainerHighest
                clip: true

                Image {
                    id: avatarImage
                    anchors.fill: parent
                    fillMode: Image.PreserveAspectCrop
                    source: messageData.avatar_url && messageData.avatar_url.length > 0
                            ? messageData.avatar_url
                            : ("https://api.dicebear.com/8.x/personas/svg?seed=" + (messageData.user_id || "user"))
                }

                Text {
                    anchors.centerIn: parent
                    visible: avatarImage.status === Image.Error
                    text: (messageData.user_name || "U").slice(0, 2).toUpperCase()
                    color: Theme.onSurface
                    font.pixelSize: 12
                    font.weight: Font.Bold
                }
            }

            Column {
                width: parent.width - 44
                spacing: 4

                Row {
                    spacing: 8
                    Text {
                        text: messageData.user_name || "Unknown"
                        color: Theme.onSurface
                        font.pixelSize: 13
                        font.weight: Font.DemiBold
                    }
                    Text {
                        text: messageData.time_label || ""
                        color: Theme.onSurfaceVariant
                        font.pixelSize: 11
                    }
                }

                Text {
                    width: parent.width
                    text: Boolean(messageData.deleted_at) ? "[deleted]" : root.renderInlineMarkdown(messageData.text || "")
                    textFormat: Boolean(messageData.deleted_at) ? Text.PlainText : Text.RichText
                    wrapMode: Text.WordWrap
                    color: Theme.onSurface
                    font.pixelSize: 14
                    font.italic: Boolean(messageData.deleted_at)
                }

                TranslationBadge {
                    localeCode: messageData.translated_locale || ""
                }

                Rectangle {
                    visible: Boolean(messageData.via_mesh)
                    radius: 8
                    color: Theme.surfaceContainer
                    implicitHeight: 20
                    implicitWidth: meshText.implicitWidth + 10

                    Text {
                        id: meshText
                        anchors.centerIn: parent
                        text: "📡 Via Mesh"
                        color: Theme.onSurfaceVariant
                        font.pixelSize: 10
                    }
                }

                Row {
                    spacing: 6
                    Repeater {
                        model: (messageData.reactions || [])
                        delegate: Button {
                            text: modelData.emoji + " " + modelData.count
                            onClicked: root.reactRequested(String(messageData.id || ""), modelData.emoji)
                            background: Rectangle {
                                radius: 10
                                color: Theme.surfaceContainerLow
                                border.color: Theme.panelBorder
                            }
                            contentItem: Text {
                                text: parent.text
                                color: Theme.onSurface
                                font.pixelSize: 11
                                horizontalAlignment: Text.AlignHCenter
                                verticalAlignment: Text.AlignVCenter
                            }
                        }
                    }
                }

                CoachingNudge {
                    visible: Boolean(messageData.nudge_text)
                    width: parent.width
                    nudgeText: messageData.nudge_text || ""
                    onDismissed: {}
                }

                Row {
                    visible: hoverArea.containsMouse && !Boolean(messageData.deleted_at)
                    spacing: 6

                    Repeater {
                        model: ["add_reaction", "reply", "edit", "delete"]
                        delegate: Button {
                            text: modelData
                            onClicked: {
                                if (modelData === "edit") root.editRequested(String(messageData.id || ""))
                                if (modelData === "delete") root.deleteRequested(String(messageData.id || ""))
                                if (modelData === "add_reaction") root.reactRequested(String(messageData.id || ""), "👍")
                            }
                            font.pixelSize: 10
                            background: Rectangle {
                                radius: 8
                                color: Theme.surfaceContainerLow
                                border.color: Theme.panelBorder
                            }
                            contentItem: Text {
                                text: parent.text
                                color: Theme.onSurfaceVariant
                                font: parent.font
                                horizontalAlignment: Text.AlignHCenter
                                verticalAlignment: Text.AlignVCenter
                            }
                        }
                    }
                }
            }
        }
    }

    HoverHandler { id: hoverArea }
}
