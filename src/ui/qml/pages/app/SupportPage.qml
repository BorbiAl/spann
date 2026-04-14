import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import "../../support"

Item {
    id: root

    property string searchQuery: ""
    property string activeCategory: ""
    property int selectedGuideIndex: 0

    readonly property var statusItems: [
        { name: "API", status: "operational" },
        { name: "Chat", status: "operational" },
        { name: "Mesh relay", status: "operational" },
        { name: "Carbon sync", status: "degraded" },
        { name: "Notifications", status: "operational" }
    ]

    readonly property var categories: [
        { id: "chat", icon: "chat", title: "Chat", description: "Messages and channels", count: 12 },
        { id: "mesh", icon: "hub", title: "Mesh", description: "Node and relay guides", count: 8 },
        { id: "carbon", icon: "eco", title: "Carbon", description: "Carbon logging", count: 10 },
        { id: "pulse", icon: "monitoring", title: "Pulse", description: "Pulse analytics", count: 9 },
        { id: "settings", icon: "settings", title: "Settings", description: "Account and app prefs", count: 11 },
        { id: "auth", icon: "lock", title: "Auth", description: "Login and sessions", count: 6 },
        { id: "translator", icon: "translate", title: "Translator", description: "Culture translation", count: 7 },
        { id: "desktop", icon: "desktop_windows", title: "Desktop", description: "Qt desktop behavior", count: 5 }
    ]

    readonly property var guides: [
        { category: "chat", title: "Send first message", views: 1421, steps: ["Open a channel", "Type message", "Press Send"] },
        { category: "mesh", title: "Register a mesh node", views: 981, steps: ["Open Mesh page", "Click Add", "Name device"] },
        { category: "carbon", title: "Quick-log commute", views: 1134, steps: ["Open Carbon", "Tap transport", "Review score"] },
        { category: "translator", title: "Translate context", views: 742, steps: ["Select cultures", "Write phrase", "Press Translate"] }
    ]

    function visibleGuides() {
        var out = []
        for (var i = 0; i < guides.length; ++i) {
            var g = guides[i]
            var matchCategory = !activeCategory || g.category === activeCategory
            var query = searchQuery.toLowerCase()
            var matchQuery = !query || g.title.toLowerCase().indexOf(query) >= 0 || g.category.toLowerCase().indexOf(query) >= 0
            if (matchCategory && matchQuery) out.push(g)
        }
        return out
    }

    ContactModal { id: contactModal; anchors.fill: parent }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 16
        spacing: 12

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 98
            radius: 16
            color: Theme.surfaceContainerLow
            border.color: Theme.panelBorder
            Column {
                anchors.fill: parent
                anchors.margins: 10
                spacing: 8
                Text { text: "How can we help?"; color: Theme.onSurface; font.pixelSize: 24; font.weight: Font.ExtraBold }
                Row {
                    spacing: 8
                    Rectangle {
                        width: 360
                        height: 34
                        radius: 17
                        color: Theme.surfaceContainerLowest
                        border.color: Theme.panelBorder
                        Row {
                            anchors.fill: parent
                            anchors.margins: 8
                            spacing: 6
                            Text { text: "search"; color: Theme.onSurfaceVariant; font.family: "Material Symbols Outlined" }
                            TextField { width: 270; text: root.searchQuery; onTextChanged: root.searchQuery = text; placeholderText: "Search help"; background: null }
                            Button { text: "close"; visible: root.searchQuery.length > 0; onClicked: root.searchQuery = ""; background: Rectangle { color: "transparent" }; contentItem: Text { text: parent.text; font.family: "Material Symbols Outlined" } }
                        }
                    }
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 48
            radius: 12
            color: Theme.surfaceContainerLow
            border.color: Theme.panelBorder
            Row {
                anchors.fill: parent
                anchors.margins: 8
                spacing: 8
                Rectangle { width: 8; height: 8; radius: 4; color: Theme.tertiary; anchors.verticalCenter: parent.verticalCenter }
                Text { text: "System status: mostly operational"; color: Theme.onSurface; font.pixelSize: 12; anchors.verticalCenter: parent.verticalCenter }
                Repeater {
                    model: root.statusItems
                    delegate: Row {
                        spacing: 4
                        Rectangle { width: 7; height: 7; radius: 3; color: modelData.status === "degraded" ? "#f59e0b" : Theme.tertiary }
                        Text { text: modelData.name; color: Theme.onSurfaceVariant; font.pixelSize: 10 }
                    }
                }
                Item { width: parent.width - 680 }
                Button { text: "Report issue ->"; onClicked: contactModal.open = true }
            }
        }

        Text { text: "Browse by topic"; color: Theme.onSurface; font.pixelSize: 16; font.weight: Font.Bold }

        Grid {
            columns: 4
            spacing: 8
            Repeater {
                model: root.categories
                delegate: CategoryCard {
                    width: 220
                    height: 116
                    category: modelData
                    active: root.activeCategory === modelData.id
                    TapHandler {
                        onTapped: {
                            root.activeCategory = root.activeCategory === modelData.id ? "" : modelData.id
                            root.selectedGuideIndex = 0
                        }
                    }
                }
            }
        }

        Text { text: "Simple guides"; color: Theme.onSurface; font.pixelSize: 16; font.weight: Font.Bold }

        RowLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 8

            Rectangle {
                Layout.preferredWidth: 420
                Layout.fillHeight: true
                radius: 12
                color: Theme.surfaceContainerLow
                border.color: Theme.panelBorder
                ScrollView {
                    anchors.fill: parent
                    anchors.margins: 8
                    Column {
                        width: parent.width
                        spacing: 6
                        Repeater {
                            model: root.visibleGuides()
                            delegate: Rectangle {
                                width: parent.width
                                height: 46
                                radius: 10
                                color: root.selectedGuideIndex === index ? Theme.accentSoft : Theme.surfaceContainerLowest
                                border.color: Theme.panelBorder
                                Row {
                                    anchors.fill: parent
                                    anchors.margins: 8
                                    Text { text: "description"; color: Theme.onSurfaceVariant; font.family: "Material Symbols Outlined" }
                                    Text { text: modelData.title + " (" + modelData.category + ")"; color: Theme.onSurface; font.pixelSize: 12 }
                                    Item { width: parent.width - 220 }
                                    Text { text: String(modelData.views); color: Theme.onSurfaceVariant; font.pixelSize: 10 }
                                }
                                TapHandler { onTapped: root.selectedGuideIndex = index }
                            }
                        }
                    }
                }
            }

            GuideDetail {
                Layout.fillWidth: true
                Layout.fillHeight: true
                guide: {
                    var arr = root.visibleGuides()
                    if (arr.length === 0) return { title: "No guides", steps: ["Try a different search term"] }
                    return arr[Math.max(0, Math.min(root.selectedGuideIndex, arr.length - 1))]
                }
            }
        }

        Text { text: "Still need help?"; color: Theme.onSurface; font.pixelSize: 16; font.weight: Font.Bold }
        Row {
            spacing: 8
            Repeater {
                model: [
                    { title: "Submit ticket", icon: "support_agent" },
                    { title: "Email", icon: "mail" },
                    { title: "Community forum", icon: "groups" }
                ]
                delegate: Rectangle {
                    width: 240
                    height: 70
                    radius: 12
                    color: Theme.surfaceContainerLow
                    border.color: Theme.panelBorder
                    Row {
                        anchors.fill: parent
                        anchors.margins: 10
                        spacing: 8
                        Text { text: modelData.icon; color: Theme.onSurfaceVariant; font.family: "Material Symbols Outlined" }
                        Text { text: modelData.title; color: Theme.onSurface; font.pixelSize: 13; font.weight: Font.DemiBold }
                    }
                    TapHandler { onTapped: contactModal.open = true }
                }
            }
        }
    }
}
