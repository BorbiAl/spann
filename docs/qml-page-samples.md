# QML Page Samples (All App Pages)

This file collects representative QML snippets from all pages in `src/ui/qml/pages/app`.

## ChatPage.qml

```qml
Item {
    id: root
    property var appState
    property var messageService
    property var supabaseRealtime
    property string activeChannelId: appState ? String(appState.activeChannelId || "") : ""
    property var messages: []
    property var presenceUsers: []

    function refreshChannelData() {
        if (!activeChannelId || !messageService) return
        messageService.loadChannelMessages(activeChannelId)
    }

    function updateMessageRealtimeSubscription() {
        if (!supabaseRealtime) return
        if (!root.activeChannelId || root.activeChannelId.length === 0) return
        var filter = "channel_id=eq." + root.activeChannelId
        supabaseRealtime.subscribeTable("messages", "INSERT", "public", filter)
        supabaseRealtime.subscribeTable("messages", "UPDATE", "public", filter)
    }

    Connections {
        target: messageService
        function onChannelMessagesLoaded(channelId, items) {
            if (String(channelId) !== String(root.activeChannelId)) return
            root.messages = items
        }
    }
}
```

## MeshPage.qml

```qml
Item {
    id: root
    property var appState
    property var meshService
    property var meshNodes: []

    function reload() {
        if (!meshService || !appState) return
        meshService.loadNodes(appState.workspaceId)
    }

    Component.onCompleted: reload()

    Connections {
        target: meshService
        function onNodesLoaded(nodes) {
            root.meshNodes = nodes
        }
    }
}
```

## CarbonPage.qml

```qml
Item {
    id: root
    property var appState
    property var carbonService
    property real todayKg: 0
    property var badges: []

    function reloadAll() {
        if (!carbonService || !appState) return
        carbonService.loadDailyFootprint(appState.currentUserId)
        carbonService.loadBadges(appState.currentUserId)
        carbonService.loadLeaderboard(appState.workspaceId)
    }

    Component.onCompleted: reloadAll()

    Connections {
        target: carbonService
        function onDailyFootprintLoaded(today, yesterday) {
            root.todayKg = today
        }
        function onBadgesLoaded(items) { root.badges = items }
    }
}
```

## PulsePage.qml

```qml
Item {
    id: root
    property var appState
    property var pulseService
    property var supabaseRealtime
    property var channelEnergy: []

    function refreshAll() {
        if (!pulseService || !appState) return
        pulseService.loadChannelEnergy(appState.workspaceId)
        pulseService.loadSevenDayTrend(appState.workspaceId)
    }

    Component.onCompleted: {
        refreshAll()
        if (supabaseRealtime && appState) {
            supabaseRealtime.subscribeTable("pulse_snapshots", "INSERT", "public", "workspace_id=eq." + appState.workspaceId)
        }
    }

    Connections {
        target: pulseService
        function onChannelEnergyLoaded(rows) {
            root.channelEnergy = rows
        }
    }
}
```

## AccessibilityPage.qml

```qml
Item {
    id: root
    property var settingsService
    property var appState
    property var loaded: ({})
    property var draft: ({})

    function loadSettings() {
        if (!settingsService || !appState) return
        settingsService.loadUserSettings(appState.currentUserId)
    }

    function applySettings() {
        if (!settingsService || !appState) return
        settingsService.saveAccessibility(appState.currentUserId, draft)
    }

    Component.onCompleted: loadSettings()

    Connections {
        target: settingsService
        function onUserSettingsLoaded(settings) {
            root.loaded = settings
            root.draft = JSON.parse(JSON.stringify(settings))
        }
    }
}
```

## TranslatorPage.qml

```qml
Item {
    id: root
    property var translationService
    property int sourceIndex: 0
    property int targetIndex: 3
    property string inputText: "Break a leg!"

    readonly property var cultures: [
        { label: "American", locale: "en-US", code: "EN-US" },
        { label: "Japanese", locale: "ja-JP", code: "JA-JP" },
        { label: "German", locale: "de-DE", code: "DE-DE" }
    ]

    function translateNow() {
        if (!translationService) return
        translationService.translate({
            phrase: inputText,
            source_locale: cultures[sourceIndex].locale,
            target_locale: cultures[targetIndex].locale,
            source_culture: cultures[sourceIndex].label,
            target_culture: cultures[targetIndex].label,
            workplace_tone: "neutral"
        })
    }
}
```

## SettingsPage.qml

```qml
Item {
    id: root
    property var appState
    property var authService
    property var settingsService
    property string activeSection: "profile"

    Component.onCompleted: {
        if (settingsService && appState) settingsService.loadProfile(appState.currentUserId)
    }

    Button {
        text: "Sign out"
        onClicked: {
            if (authService) {
                if (authService.signOut) authService.signOut()
                else if (authService.logout) authService.logout()
            }
        }
    }
}
```

## CallPage.qml

```qml
Item {
    id: root
    property var appState
    property var supabaseRealtime
    property var participants: []

    function initialsFromName(name) {
        var n = String(name || "").trim()
        if (n.length === 0) return "--"
        var parts = n.split(/\s+/)
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
        return (parts[0][0] + parts[1][0]).toUpperCase()
    }

    Connections {
        target: supabaseRealtime
        function onPresenceUpdated(topic, state) {
            var users = []
            for (var k in state) {
                if (state.hasOwnProperty(k)) {
                    var metas = state[k].metas || []
                    if (metas.length > 0) users.push(metas[0])
                }
            }
            root.participants = users
        }
    }
}
```

## SupportPage.qml

```qml
Item {
    id: root
    property string searchQuery: ""
    property string activeCategory: ""

    readonly property var categories: [
        { id: "chat", title: "Chat" },
        { id: "mesh", title: "Mesh" },
        { id: "carbon", title: "Carbon" }
    ]

    function visibleGuides() {
        var out = []
        for (var i = 0; i < guides.length; ++i) {
            var g = guides[i]
            var matchCategory = !activeCategory || g.category === activeCategory
            var query = searchQuery.toLowerCase()
            var matchQuery = !query || g.title.toLowerCase().indexOf(query) >= 0
            if (matchCategory && matchQuery) out.push(g)
        }
        return out
    }
}
```
