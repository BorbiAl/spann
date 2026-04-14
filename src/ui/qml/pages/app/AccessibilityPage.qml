import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../../accessibility"

Item {
    id: root
    property var settingsService
    property var appState

    property var loaded: ({})
    property var draft: ({})
    property string saveState: "idle"

    readonly property bool hasChanges: JSON.stringify(loaded) !== JSON.stringify(draft)

    function loadSettings() {
        if (!settingsService || !appState) return
        settingsService.loadUserSettings(appState.currentUserId)
    }

    function applySettings() {
        if (!settingsService || !appState) return
        saveState = "saving"
        settingsService.saveAccessibility(appState.currentUserId, draft)
    }

    function discardSettings() {
        draft = JSON.parse(JSON.stringify(loaded))
        saveState = "idle"
    }

    Component.onCompleted: loadSettings()

    Connections {
        target: settingsService
        function onUserSettingsLoaded(settings) {
            root.loaded = {
                dyslexia_font: Boolean(settings.dyslexia_font),
                high_contrast: Boolean(settings.high_contrast),
                simplified_language: Boolean(settings.simplified_language),
                tts_enabled: Boolean(settings.tts_enabled),
                font_size: Number(settings.font_size || 16),
                color_blind_mode: String(settings.color_blind_mode || "none")
            }
            root.draft = JSON.parse(JSON.stringify(root.loaded))
            root.saveState = "idle"
        }
        function onAccessibilitySaved() {
            root.loaded = JSON.parse(JSON.stringify(root.draft))
            root.saveState = "saved"
            settingsService.applyToEngine(root.draft)
        }
        function onSettingsError() { root.saveState = "error" }
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 16
        spacing: 10

        Text { text: "Accessibility Settings"; color: Theme.onSurface; font.pixelSize: 36; font.weight: Font.ExtraBold }
        Text { text: "Customize readability, contrast, and assistive behavior"; color: Theme.onSurfaceVariant; font.pixelSize: 14 }

        GridLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            columns: 12
            columnSpacing: 12

            Column {
                Layout.columnSpan: 7
                spacing: 10

                Rectangle {
                    width: parent.width
                    radius: 12
                    color: Theme.surfaceContainerLow
                    border.color: Theme.panelBorder
                    Column {
                        anchors.fill: parent
                        anchors.margins: 10
                        spacing: 8
                        Text { text: "Visual Enhancements"; color: Theme.onSurface; font.pixelSize: 15; font.weight: Font.Bold }
                        ToggleRow { width: parent.width; iconName: "text_fields"; title: "Dyslexia Font"; description: "Use OpenDyslexic globally"; checked: Boolean(root.draft.dyslexia_font); onToggled: v => root.draft.dyslexia_font = v }
                        ToggleRow { width: parent.width; iconName: "contrast"; title: "High Contrast"; description: "Increase global contrast"; checked: Boolean(root.draft.high_contrast); onToggled: v => root.draft.high_contrast = v }
                        Row {
                            spacing: 8
                            Text { text: "Color Blind Mode"; color: Theme.onSurface; font.pixelSize: 13; font.weight: Font.DemiBold }
                            ComboBox {
                                model: ["none", "protanopia", "deuteranopia", "tritanopia"]
                                currentIndex: Math.max(0, model.indexOf(String(root.draft.color_blind_mode || "none")))
                                onActivated: root.draft.color_blind_mode = currentText
                            }
                        }
                    }
                }

                Rectangle {
                    width: parent.width
                    radius: 12
                    color: Theme.surfaceContainerLow
                    border.color: Theme.panelBorder
                    Column {
                        anchors.fill: parent
                        anchors.margins: 10
                        spacing: 8
                        Text { text: "Cognitive & Reading"; color: Theme.onSurface; font.pixelSize: 15; font.weight: Font.Bold }
                        ToggleRow { width: parent.width; iconName: "subject"; title: "Simplified Language"; description: "Shorten and simplify labels"; checked: Boolean(root.draft.simplified_language); onToggled: v => root.draft.simplified_language = v }
                        ToggleRow { width: parent.width; iconName: "record_voice_over"; title: "Text-to-Speech"; description: "Enable reading support"; checked: Boolean(root.draft.tts_enabled); onToggled: v => root.draft.tts_enabled = v }
                    }
                }

                Rectangle {
                    width: parent.width
                    radius: 12
                    color: Theme.surfaceContainerLow
                    border.color: Theme.panelBorder
                    Column {
                        anchors.fill: parent
                        anchors.margins: 10
                        spacing: 8
                        Text { text: "Text Size"; color: Theme.onSurface; font.pixelSize: 15; font.weight: Font.Bold }
                        FontSizeSlider {
                            width: parent.width
                            value: Number(root.draft.font_size || 16)
                            onValueChangedByUser: function(v) { root.draft.font_size = v }
                        }
                    }
                }
            }

            Column {
                Layout.columnSpan: 5
                spacing: 10

                LivePreviewCard {
                    width: parent.width
                    height: 240
                    dyslexiaFont: Boolean(root.draft.dyslexia_font)
                    highContrast: Boolean(root.draft.high_contrast)
                    simplified: Boolean(root.draft.simplified_language)
                    colorBlindMode: String(root.draft.color_blind_mode || "none")
                    avatarUrl: appState ? appState.currentUserAvatarUrl : ""
                }

                Row {
                    spacing: 8
                    Button { text: "Discard"; enabled: root.hasChanges; onClicked: root.discardSettings() }
                    Button { text: "Apply Changes"; enabled: root.hasChanges && root.saveState !== "saving"; onClicked: root.applySettings() }
                }

                Text {
                    text: root.saveState === "saving" ? "Saving..." : (root.saveState === "saved" ? "Saved" : (root.saveState === "error" ? "Save failed" : (root.hasChanges ? "Unsaved changes" : "No changes")))
                    color: root.saveState === "error" ? Theme.error : Theme.onSurfaceVariant
                    font.pixelSize: 12
                }

                Rectangle {
                    width: parent.width
                    height: 78
                    radius: 12
                    color: Theme.tertiaryContainer
                    Text {
                        anchors.fill: parent
                        anchors.margins: 10
                        text: "Pro Tip: Alt+Z toggles TTS quickly."
                        wrapMode: Text.WordWrap
                        color: Theme.tertiary
                        font.pixelSize: 12
                    }
                }
            }
        }
    }
}
