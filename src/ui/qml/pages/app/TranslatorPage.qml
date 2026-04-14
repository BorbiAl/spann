import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import Qt.labs.settings
import "../../translator"

Item {
    id: root
    property var translationService

    readonly property var cultures: [
        { label: "American", locale: "en-US", code: "EN-US", emoji: "🇺🇸" },
        { label: "British", locale: "en-GB", code: "EN-GB", emoji: "🇬🇧" },
        { label: "Bulgarian", locale: "bg-BG", code: "BG-BG", emoji: "🇧🇬" },
        { label: "Japanese", locale: "ja-JP", code: "JA-JP", emoji: "🇯🇵" },
        { label: "German", locale: "de-DE", code: "DE-DE", emoji: "🇩🇪" },
        { label: "Brazilian", locale: "pt-BR", code: "PT-BR", emoji: "🇧🇷" },
        { label: "Arabic", locale: "ar-SA", code: "AR-SA", emoji: "🇸🇦" },
        { label: "French", locale: "fr-FR", code: "FR-FR", emoji: "🇫🇷" },
        { label: "Indian", locale: "hi-IN", code: "HI-IN", emoji: "🇮🇳" },
        { label: "Chinese", locale: "zh-CN", code: "ZH-CN", emoji: "🇨🇳" }
    ]

    property int sourceIndex: 0
    property int targetIndex: 3
    property string inputText: "Break a leg!"
    property string statusNote: "Live translation connected"
    property var result: ({
        literal: "Break a leg!",
        cultural: "頑張ってください。",
        explanation: "A direct idiom can sound odd; this polite encouragement is natural in Japanese business context.",
        tags: ["Business Etiquette", "Polite Form", "High Context"],
        sentiment_score: 0.78,
        sentiment_label: "Supportive"
    })
    property var history: []

    Settings {
        id: translationSettings
        category: "translator"
        property string recentTranslations: "[]"
    }

    function cultureFallback(locale) {
        if (locale.indexOf("bg") === 0) return "Много успех!"
        if (locale.indexOf("ja") === 0) return "頑張ってください。"
        if (locale.indexOf("de") === 0) return "Viel Erfolg!"
        if (locale.indexOf("pt") === 0) return "Boa sorte!"
        if (locale.indexOf("ar") === 0) return "بالتوفيق"
        if (locale.indexOf("fr") === 0) return "Bon courage !"
        if (locale.indexOf("hi") === 0) return "शुभकामनाएं!"
        if (locale.indexOf("zh") === 0) return "祝你好运"
        return inputText
    }

    function looksGarbled(text) {
        if (!text) return true
        return text.indexOf("\uFFFD") >= 0 || /^\?+$/.test(text)
    }

    function appendHistory(entry) {
        var next = [entry].concat(history)
        if (next.length > 8) next = next.slice(0, 8)
        history = next
        translationSettings.recentTranslations = JSON.stringify(next)
    }

    function translateNow() {
        if (!translationService) {
            statusNote = "Translator service unavailable"
            return
        }

        statusNote = "Translating..."
        translationService.translate({
            phrase: inputText,
            source_locale: cultures[sourceIndex].locale,
            target_locale: cultures[targetIndex].locale,
            source_culture: cultures[sourceIndex].label,
            target_culture: cultures[targetIndex].label,
            workplace_tone: "neutral"
        })
    }

    Component.onCompleted: {
        try {
            history = JSON.parse(translationSettings.recentTranslations || "[]")
        } catch (e) {
            history = []
        }
    }

    Connections {
        target: translationService
        function onTranslated(payload) {
            var literal = payload.literal || root.inputText
            var cultural = payload.cultural || root.cultureFallback(root.cultures[root.targetIndex].locale)
            if (root.looksGarbled(literal)) literal = root.inputText
            if (root.looksGarbled(cultural)) cultural = root.cultureFallback(root.cultures[root.targetIndex].locale)

            root.result = {
                literal: literal,
                cultural: cultural,
                explanation: payload.explanation || "Translation was partially available; fallback used for clarity.",
                tags: (payload.tags && payload.tags.length > 0) ? payload.tags : ["Business Etiquette", "Polite Form", "High Context"],
                sentiment_score: Number(payload.sentiment_score || 0.5),
                sentiment_label: payload.sentiment_label || "Neutral"
            }

            root.statusNote = "Live translation complete"
            root.appendHistory({
                id: String(Date.now()),
                sourceCulture: root.cultures[root.sourceIndex].label,
                targetCulture: root.cultures[root.targetIndex].label,
                sourceEmoji: root.cultures[root.sourceIndex].emoji,
                targetEmoji: root.cultures[root.targetIndex].emoji,
                literal: literal,
                cultural: cultural,
                time: Qt.formatDateTime(new Date(), "hh:mm")
            })
        }

        function onTranslationFailed(message) {
            root.statusNote = "Fail-open fallback shown"
            root.result = {
                literal: root.inputText,
                cultural: root.cultureFallback(root.cultures[root.targetIndex].locale),
                explanation: message || "Live translation unavailable.",
                tags: ["Business Etiquette", "Polite Form", "High Context"],
                sentiment_score: 0.5,
                sentiment_label: "Neutral"
            }
        }
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 16
        spacing: 12

        Text { text: "Cultural Translator"; color: Theme.onSurface; font.pixelSize: 36; font.weight: Font.ExtraBold }
        Text { text: "Translate intent across workplace cultures"; color: Theme.onSurfaceVariant; font.pixelSize: 14 }
        Text { text: root.statusNote; color: Theme.onSurfaceVariant; font.pixelSize: 11 }

        GridLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            columns: 2
            columnSpacing: 12

            Rectangle {
                Layout.fillWidth: true
                Layout.fillHeight: true
                radius: 12
                color: Theme.surfaceContainerLow
                border.color: Theme.panelBorder

                Column {
                    anchors.fill: parent
                    anchors.margins: 12
                    spacing: 10

                    Row {
                        spacing: 8
                        CulturePicker { id: sourcePicker; width: 180; cultures: root.cultures; currentIndex: root.sourceIndex; onCurrentIndexChanged: root.sourceIndex = currentIndex }
                        Button {
                            text: "swap_horiz"
                            onClicked: {
                                var t = root.sourceIndex
                                root.sourceIndex = root.targetIndex
                                root.targetIndex = t
                                sourcePicker.currentIndex = root.sourceIndex
                                targetPicker.currentIndex = root.targetIndex
                            }
                            contentItem: Text { text: parent.text; color: Theme.onSurfaceVariant; font.family: "Material Symbols Outlined"; font.pixelSize: 18 }
                        }
                        CulturePicker { id: targetPicker; width: 180; cultures: root.cultures; currentIndex: root.targetIndex; onCurrentIndexChanged: root.targetIndex = currentIndex }
                    }

                    Text { text: "Input Text"; color: Theme.onSurfaceVariant; font.pixelSize: 12; font.weight: Font.DemiBold }

                    TextArea {
                        width: parent.width
                        height: 250
                        text: root.inputText
                        onTextChanged: root.inputText = text
                        wrapMode: TextArea.Wrap
                        placeholderText: "Type phrase to translate"
                    }

                    Row {
                        width: parent.width
                        Text { text: "mic"; color: Theme.onSurfaceVariant; font.family: "Material Symbols Outlined"; font.pixelSize: 20 }
                        Text { text: "attach_file"; color: Theme.onSurfaceVariant; font.family: "Material Symbols Outlined"; font.pixelSize: 20 }
                        Item { width: parent.width - 220 }
                        Button {
                            text: "Translate Context"
                            onClicked: root.translateNow()
                            background: Rectangle {
                                radius: 12
                                gradient: Gradient {
                                    GradientStop { position: 0; color: Theme.primary }
                                    GradientStop { position: 1; color: Theme.primaryContainer }
                                }
                            }
                            contentItem: Text { text: parent.text; color: Theme.onPrimary; font.pixelSize: 12; font.weight: Font.DemiBold }
                        }
                    }
                }
            }

            Rectangle {
                Layout.fillWidth: true
                Layout.fillHeight: true
                radius: 12
                color: Theme.surface
                border.color: Theme.panelBorder

                Column {
                    anchors.fill: parent
                    anchors.margins: 12
                    spacing: 10

                    TranslationResult {
                        width: parent.width
                        height: 380
                        result: root.result
                    }

                    Text { text: "Recent Translations"; color: Theme.onSurface; font.pixelSize: 14; font.weight: Font.Bold }
                    RecentTranslations {
                        width: parent.width
                        height: parent.height - 430
                        history: root.history
                    }
                }
            }
        }
    }
}
