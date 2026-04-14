import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../../settings"

Item {
    id: root
    property var appState
    property var authService
    property var settingsService
    property var storageService

    property string activeSection: "profile"
    property var profileData: ({})

    signal signedOut()

    readonly property var navItems: [
        { key: "profile", icon: "person", title: "Profile" },
        { key: "appearance", icon: "palette", title: "Appearance" },
        { key: "notifications", icon: "notifications", title: "Notifications" },
        { key: "shortcuts", icon: "keyboard", title: "Shortcuts" },
        { key: "about", icon: "info", title: "About" }
    ]

    Component.onCompleted: {
        if (settingsService && appState) settingsService.loadProfile(appState.currentUserId)
    }

    Connections {
        target: settingsService
        function onProfileLoaded(profile) { root.profileData = profile }
    }

    Rectangle {
        anchors.fill: parent
        radius: 16
        color: Theme.surfaceContainerLowest
        border.color: Theme.panelBorder

        Row {
            anchors.fill: parent

            Rectangle {
                width: 224
                color: Theme.surfaceContainerLow
                border.color: Theme.panelBorder

                Column {
                    anchors.fill: parent
                    anchors.margins: 10
                    spacing: 8

                    Text {
                        text: "SETTINGS"
                        color: Theme.onSurfaceVariant
                        font.pixelSize: 10
                        font.weight: Font.Bold
                    }

                    Repeater {
                        model: root.navItems
                        delegate: Rectangle {
                            width: parent.width
                            height: 42
                            radius: 10
                            color: root.activeSection === modelData.key ? Theme.accentSoft : "transparent"
                            border.color: root.activeSection === modelData.key ? Theme.primary : "transparent"

                            Row {
                                anchors.fill: parent
                                anchors.margins: 8
                                spacing: 8
                                Text {
                                    text: modelData.icon
                                    color: root.activeSection === modelData.key ? Theme.primary : Theme.onSurfaceVariant
                                    font.family: "Material Symbols Outlined"
                                    font.pixelSize: 18
                                }
                                Text {
                                    text: modelData.title
                                    color: root.activeSection === modelData.key ? Theme.primary : Theme.onSurface
                                    font.pixelSize: 13
                                    font.weight: Font.DemiBold
                                }
                            }

                            TapHandler { onTapped: root.activeSection = modelData.key }
                        }
                    }

                    Item { height: 1; width: 1 }

                    Button {
                        anchors.bottom: parent.bottom
                        text: "Sign out"
                        onClicked: {
                            if (authService) {
                                if (authService.signOut) authService.signOut()
                                else if (authService.logout) authService.logout()
                            }
                            root.signedOut()
                        }
                        contentItem: Row {
                            spacing: 6
                            Text { text: "logout"; color: Theme.onSurfaceVariant; font.family: "Material Symbols Outlined" }
                            Text { text: "Sign out"; color: Theme.onSurface; font.pixelSize: 13 }
                        }
                    }
                }
            }

            ScrollView {
                width: parent.width - 224
                height: parent.height
                clip: true

                Loader {
                    width: parent.width
                    sourceComponent: {
                        if (root.activeSection === "profile") return profileComp
                        if (root.activeSection === "appearance") return appearanceComp
                        if (root.activeSection === "notifications") return notificationsComp
                        if (root.activeSection === "shortcuts") return shortcutsComp
                        return aboutComp
                    }
                }
            }
        }
    }

    Component {
        id: profileComp
        ProfileSection {
            width: parent ? parent.width : 800
            appState: root.appState
            settingsService: root.settingsService
            storageService: root.storageService
            profile: root.profileData
            onProfileSaved: function(data) {
                root.profileData = data
                if (appState) appState.updateCurrentUser(data)
            }
        }
    }

    Component {
        id: appearanceComp
        AppearanceSection {
            width: parent ? parent.width : 800
            settingsService: root.settingsService
        }
    }

    Component {
        id: notificationsComp
        NotificationsSection {
            width: parent ? parent.width : 800
            settingsService: root.settingsService
            appState: root.appState
        }
    }

    Component {
        id: shortcutsComp
        ShortcutsSection { width: parent ? parent.width : 800 }
    }

    Component {
        id: aboutComp
        AboutSection { width: parent ? parent.width : 800 }
    }
}
