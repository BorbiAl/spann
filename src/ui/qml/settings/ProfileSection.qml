import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../settings"

Item {
    id: root
    property var appState
    property var settingsService
    property var storageService
    property var profile: ({})
    property var draft: ({})
    property bool loading: false
    property bool dirty: false

    signal profileSaved(var data)

    function setProfile(p) {
        profile = p
        draft = JSON.parse(JSON.stringify(p))
        dirty = false
    }

    function save() {
        if (!settingsService || !appState) return
        settingsService.saveProfile(appState.currentUserId, draft)
    }

    Column {
        anchors.fill: parent
        spacing: 10

        Text { text: "Profile"; color: Theme.onSurface; font.pixelSize: 32; font.weight: Font.ExtraBold }
        Text { text: "Manage your account profile details"; color: Theme.onSurfaceVariant; font.pixelSize: 13 }

        Row {
            spacing: 10
            Rectangle {
                width: 80
                height: 80
                radius: 40
                clip: true
                color: Theme.surfaceContainer
                Image {
                    anchors.fill: parent
                    source: draft.avatar_url && draft.avatar_url.length > 0
                            ? draft.avatar_url
                            : ("https://api.dicebear.com/8.x/personas/svg?seed=" + (appState ? appState.currentUserId : "user"))
                    fillMode: Image.PreserveAspectCrop
                }
            }
            Button {
                text: "photo_camera"
                onClicked: settingsService.pickAndUploadAvatar(appState.currentUserId)
                contentItem: Text { text: parent.text; color: Theme.onSurfaceVariant; font.family: "Material Symbols Outlined"; font.pixelSize: 18 }
            }
        }

        GridLayout {
            columns: 2
            columnSpacing: 8
            rowSpacing: 8

            TextField {
                Layout.columnSpan: 2
                placeholderText: "Display Name"
                text: draft.name || ""
                onTextChanged: { draft.name = text; dirty = true }
            }
            TextField {
                Layout.columnSpan: 2
                readOnly: true
                placeholderText: "Email"
                text: draft.email || ""
            }
            TextArea {
                Layout.columnSpan: 2
                placeholderText: "Bio"
                text: draft.bio || ""
                wrapMode: TextArea.Wrap
                height: 90
                onTextChanged: {
                    if (text.length > 500) text = text.slice(0, 500)
                    draft.bio = text
                    dirty = true
                }
            }
            Text { text: String((draft.bio || "").length) + "/500"; color: Theme.onSurfaceVariant; font.pixelSize: 10 }
            Item { width: 1; height: 1 }

            ComboBox {
                Layout.columnSpan: 1
                model: ["UTC", "Europe/Sofia", "Asia/Tokyo", "America/New_York"]
                currentIndex: Math.max(0, model.indexOf(String(draft.timezone || "UTC")))
                onActivated: { draft.timezone = currentText; dirty = true }
            }
            ComboBox {
                Layout.columnSpan: 1
                model: ["en-US", "en-GB", "bg-BG", "ja-JP", "de-DE", "pt-BR", "ar-SA", "fr-FR", "hi-IN", "zh-CN"]
                currentIndex: Math.max(0, model.indexOf(String(draft.locale || "en-US")))
                onActivated: { draft.locale = currentText; dirty = true }
            }
        }

        SaveBar {
            dirty: root.dirty
            onDiscardClicked: root.setProfile(root.profile)
            onSaveClicked: root.save()
        }
    }

    Connections {
        target: settingsService
        function onAvatarUploaded(url) {
            root.draft.avatar_url = url
            root.dirty = true
        }
        function onProfileSaved(saved) {
            root.setProfile(saved)
            root.profileSaved(saved)
        }
    }
}
