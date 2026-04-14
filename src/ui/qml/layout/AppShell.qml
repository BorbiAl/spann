import QtQuick
import QtQuick.Controls
import "../pages/app"

Item {
    id: root
    property var appState

    property var authService
    property var messageService
    property var channelService
    property var carbonService
    property var pulseService
    property var meshService
    property var translationService
    property var settingsService
    property var notificationService
    property var storageService
    property var supabaseRealtime

    Loader {
        id: pageLoader
        anchors.fill: parent
        sourceComponent: {
            var view = appState ? String(appState.activeView || "chat") : "chat"
            if (view === "chat") return chatComp
            if (view === "mesh") return meshComp
            if (view === "carbon") return carbonComp
            if (view === "pulse") return pulseComp
            if (view === "accessibility") return accessibilityComp
            if (view === "translator") return translatorComp
            if (view === "settings") return settingsComp
            if (view === "call") return callComp
            if (view === "support") return supportComp
            return chatComp
        }
    }

    Component {
        id: chatComp
        ChatPage {
            appState: root.appState
            messageService: root.messageService
            channelService: root.channelService
            pulseService: root.pulseService
            notificationService: root.notificationService
            supabaseRealtime: root.supabaseRealtime
            onOpenSettings: function(section) {
                if (root.appState) {
                    root.appState.settingsInitialSection = section
                    root.appState.activeView = "settings"
                }
            }
            onOpenSupport: if (root.appState) root.appState.activeView = "support"
            onOpenCall: if (root.appState) root.appState.activeView = "call"
        }
    }

    Component {
        id: meshComp
        MeshPage {
            appState: root.appState
            meshService: root.meshService
        }
    }

    Component {
        id: carbonComp
        CarbonPage {
            appState: root.appState
            carbonService: root.carbonService
            onOpenSettings: if (root.appState) root.appState.activeView = "settings"
            onOpenSupport: if (root.appState) root.appState.activeView = "support"
        }
    }

    Component {
        id: pulseComp
        PulsePage {
            appState: root.appState
            pulseService: root.pulseService
            supabaseRealtime: root.supabaseRealtime
        }
    }

    Component {
        id: accessibilityComp
        AccessibilityPage {
            appState: root.appState
            settingsService: root.settingsService
        }
    }

    Component {
        id: translatorComp
        TranslatorPage {
            translationService: root.translationService
        }
    }

    Component {
        id: settingsComp
        SettingsPage {
            appState: root.appState
            authService: root.authService
            settingsService: root.settingsService
            storageService: root.storageService
            onSignedOut: if (root.appState) root.appState.activeView = "chat"
        }
    }

    Component {
        id: callComp
        CallPage {
            appState: root.appState
            supabaseRealtime: root.supabaseRealtime
            onEndCall: if (root.appState) root.appState.activeView = "chat"
        }
    }

    Component {
        id: supportComp
        SupportPage {}
    }
}
