import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import Qt.labs.settings
import "../../chat"

Item {
    id: root
    property var appState
    property var messageService
    property var channelService
    property var pulseService
    property var notificationService
    property var supabaseRealtime

    property string activeChannelId: appState ? String(appState.activeChannelId || "") : ""
    property string activeChannelName: ""
    property real sentimentScore: 0
    property bool loadingMessages: false
    property string errorText: ""
    property var messages: []
    property var presenceUsers: []
    property string activeTypistName: ""
    property bool liveFeedEnabled: true
    property string _messageRealtimeFilter: ""
    property string _lastOutgoingPayload: ""
    property var _offlineQueue: []

    signal openSettings(string section)
    signal openSupport()
    signal openCall()

    Settings {
        id: chatSettings
        category: "chat"
        property string offlineMessageQueue: "[]"
    }

    function refreshChannelData() {
        if (!activeChannelId || !messageService) return
        loadingMessages = true
        errorText = ""
        messageService.loadChannelMessages(activeChannelId)
        if (pulseService) pulseService.loadLatestChannelSentiment(activeChannelId)
    }

    function updateMessageRealtimeSubscription() {
        if (!supabaseRealtime) return
        if (root._messageRealtimeFilter.length > 0) {
            supabaseRealtime.unsubscribeChannel("realtime:public:messages")
            root._messageRealtimeFilter = ""
        }
        if (!root.activeChannelId || root.activeChannelId.length === 0) return

        root._messageRealtimeFilter = "channel_id=eq." + root.activeChannelId
        supabaseRealtime.subscribeTable("messages", "INSERT", "public", root._messageRealtimeFilter)
        supabaseRealtime.subscribeTable("messages", "UPDATE", "public", root._messageRealtimeFilter)
    }

    function persistOfflineQueue() {
        chatSettings.offlineMessageQueue = JSON.stringify(root._offlineQueue)
    }

    function enqueueOfflineMessage(payload) {
        root._offlineQueue.push(payload)
        persistOfflineQueue()
    }

    function flushOfflineQueue() {
        if (!messageService || !supabaseRealtime || !supabaseRealtime.connected) return
        if (root._offlineQueue.length === 0) return

        var pending = root._offlineQueue.slice(0)
        root._offlineQueue = []
        persistOfflineQueue()
        for (var i = 0; i < pending.length; ++i) {
            messageService.sendMessage(pending[i])
        }
    }

    function sendOrQueue(payload) {
        root._lastOutgoingPayload = JSON.stringify(payload)
        if (supabaseRealtime && !supabaseRealtime.connected) {
            enqueueOfflineMessage(payload)
            return
        }
        messageService.sendMessage(payload)
    }

    function applyPresence(presenceState) {
        var users = []
        for (var key in presenceState) {
            if (presenceState.hasOwnProperty(key)) {
                var metas = presenceState[key].metas || []
                if (metas.length > 0) users.push(metas[0])
            }
        }
        presenceUsers = users
    }

    Component.onCompleted: {
        try {
            root._offlineQueue = JSON.parse(chatSettings.offlineMessageQueue || "[]")
        } catch (e) {
            root._offlineQueue = []
        }

        if (channelService && activeChannelId) {
            activeChannelName = channelService.channelNameById(activeChannelId)
        }
        refreshChannelData()
        updateMessageRealtimeSubscription()
        if (supabaseRealtime && appState) {
            var topic = "presence:" + appState.workspaceId
            supabaseRealtime.subscribeChannel(topic)
            supabaseRealtime.trackPresence(topic, {
                user_id: appState.currentUserId,
                name: appState.currentUserName,
                avatar_url: appState.currentUserAvatarUrl,
                typing: false
            })
            flushOfflineQueue()
        }
    }

    Component.onDestruction: {
        if (supabaseRealtime && appState) {
            var topic = "presence:" + appState.workspaceId
            supabaseRealtime.untrackPresence(topic)
            supabaseRealtime.unsubscribeChannel(topic)
            supabaseRealtime.unsubscribeChannel("realtime:public:messages")
        }
    }

    onActiveChannelIdChanged: {
        if (channelService && activeChannelId) {
            activeChannelName = channelService.channelNameById(activeChannelId)
        }
        refreshChannelData()
        updateMessageRealtimeSubscription()
    }

    Connections {
        target: messageService
        function onChannelMessagesLoaded(channelId, items) {
            if (String(channelId) !== String(root.activeChannelId)) return
            root.loadingMessages = false
            root.messages = items
            messageList.scrollToBottom()
        }
        function onMessageSendFailed(errorMessage) {
            root.errorText = errorMessage
            if (root._lastOutgoingPayload.length > 0) {
                try {
                    root.enqueueOfflineMessage(JSON.parse(root._lastOutgoingPayload))
                } catch (e) {
                }
            }
        }
    }

    Connections {
        target: pulseService
        function onChannelSentimentLoaded(channelId, score) {
            if (String(channelId) !== String(root.activeChannelId)) return
            root.sentimentScore = score
        }
    }

    Connections {
        target: supabaseRealtime
        function onPostgresChangeReceived(topic, payload) {
            if (topic.indexOf("messages") !== -1) {
                root.refreshChannelData()
            }
        }
        function onPresenceUpdated(topic, state) {
            if (!appState || topic !== "presence:" + appState.workspaceId) return
            root.applyPresence(state)
        }
        function onEventReceived(topic, eventName, payload) {
            if (!appState || topic !== "presence:" + appState.workspaceId) return
            if (eventName === "presence_state" || eventName === "presence_diff") {
                var typist = ""
                for (var k in payload) {
                    if (!payload.hasOwnProperty(k)) continue
                    var metas = payload[k].metas || []
                    if (metas.length > 0 && metas[0].typing && metas[0].user_id !== appState.currentUserId) {
                        typist = metas[0].name || "Someone"
                        break
                    }
                }
                root.activeTypistName = typist
            }
        }
        function onConnectionStateChanged(state) {
            reconnectNote.visible = state === "reconnecting"
            if (state === "connected") {
                root.refreshChannelData()
                root.flushOfflineQueue()
            }
        }
    }

    Timer {
        id: fakeTypingTimer
        interval: 17000 + Math.floor(Math.random() * 6001)
        repeat: true
        running: root.liveFeedEnabled
        onTriggered: {
            var names = []
            for (var i = 0; i < root.presenceUsers.length; ++i) {
                var user = root.presenceUsers[i]
                var userId = String(user.user_id || "")
                if (!appState || userId !== String(appState.currentUserId || "")) {
                    if (user.name && String(user.name).length > 0) names.push(String(user.name))
                }
            }
            root.activeTypistName = names.length > 0 ? names[Math.floor(Math.random() * names.length)] : "Someone"
            clearTypingTimer.start()
            fakeTypingTimer.interval = 17000 + Math.floor(Math.random() * 6001)
        }
    }

    Timer {
        id: clearTypingTimer
        interval: 2100
        repeat: false
        onTriggered: root.activeTypistName = ""
    }

    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 60
            color: Theme.surface
            border.color: Theme.panelBorder

            RowLayout {
                anchors.fill: parent
                anchors.margins: 12

                Text {
                    text: "#" + root.activeChannelName
                    color: Theme.onSurface
                    font.pixelSize: 20
                    font.weight: Font.Bold
                }

                Text {
                    text: "star"
                    color: Theme.onSurfaceVariant
                    font.family: "Material Symbols Outlined"
                    font.pixelSize: 20
                }

                Item { Layout.fillWidth: true }

                Row {
                    spacing: 8
                    Text { text: "Live feed"; color: Theme.onSurfaceVariant; font.pixelSize: 12 }
                    Switch {
                        checked: root.liveFeedEnabled
                        onToggled: root.liveFeedEnabled = checked
                    }
                }

                Button {
                    text: "Start Call"
                    onClicked: root.openCall()
                    background: Rectangle { radius: 12; color: Theme.primary }
                    contentItem: Text {
                        text: parent.text
                        color: Theme.onPrimary
                        font.pixelSize: 12
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                    }
                }

                Repeater {
                    model: Math.min(2, root.presenceUsers.length)
                    delegate: Rectangle {
                        width: 26
                        height: 26
                        radius: 13
                        color: Theme.surfaceContainer
                        clip: true
                        Image {
                            anchors.fill: parent
                            source: modelData.avatar_url && modelData.avatar_url.length > 0
                                ? modelData.avatar_url
                                : ("https://api.dicebear.com/8.x/personas/svg?seed=" + modelData.user_id)
                            fillMode: Image.PreserveAspectCrop
                        }
                    }
                }

                Rectangle {
                    visible: root.presenceUsers.length > 2
                    width: 30
                    height: 26
                    radius: 13
                    color: Theme.surfaceContainer
                    Text {
                        anchors.centerIn: parent
                        text: "+" + (root.presenceUsers.length - 2)
                        color: Theme.onSurfaceVariant
                        font.pixelSize: 11
                    }
                }

                Button {
                    text: "help"
                    onClicked: root.openSupport()
                    background: Rectangle { color: "transparent" }
                    contentItem: Text {
                        text: parent.text
                        color: Theme.onSurfaceVariant
                        font.family: "Material Symbols Outlined"
                        font.pixelSize: 20
                    }
                }

                Button {
                    text: "settings"
                    onClicked: root.openSettings("profile")
                    background: Rectangle { color: "transparent" }
                    contentItem: Text {
                        text: parent.text
                        color: Theme.onSurfaceVariant
                        font.family: "Material Symbols Outlined"
                        font.pixelSize: 20
                    }
                }
            }
        }

        Rectangle {
            id: reconnectNote
            Layout.fillWidth: true
            Layout.preferredHeight: visible ? 24 : 0
            visible: false
            color: Theme.surfaceContainerHigh
            Text {
                anchors.centerIn: parent
                text: "Reconnecting..."
                color: Theme.onSurfaceVariant
                font.pixelSize: 11
            }
        }

        Item {
            Layout.fillWidth: true
            Layout.fillHeight: true

            Column {
                anchors.fill: parent
                anchors.leftMargin: 40
                anchors.rightMargin: 40
                anchors.topMargin: 24
                anchors.bottomMargin: 8
                spacing: 8

                Rectangle {
                    width: parent.width
                    height: 24
                    color: "transparent"
                    Row {
                        anchors.centerIn: parent
                        spacing: 8
                        Rectangle { width: 120; height: 1; color: Theme.panelBorder }
                        Text {
                            text: "TODAY"
                            color: Theme.onSurfaceVariant
                            font.pixelSize: 10
                            font.weight: Font.Bold
                        }
                        Rectangle { width: 120; height: 1; color: Theme.panelBorder }
                    }
                }

                MessageList {
                    id: messageList
                    width: parent.width
                    height: parent.height - 170
                    messageItems: root.messages
                    currentUserId: appState ? appState.currentUserId : ""
                    onReactRequested: (messageId, emoji) => messageService.reactToMessage(messageId, emoji)
                    onDeleteRequested: (messageId) => messageService.deleteMessage(messageId)
                }

                CoachingNudge {
                    visible: notificationService && notificationService.hasActiveNudge
                    width: parent.width
                    nudgeText: notificationService ? notificationService.activeNudgeText : ""
                    onDismissed: {
                        if (notificationService) notificationService.dismissActiveNudge()
                    }
                }

                TypingIndicator {
                    width: parent.width
                    activeName: root.activeTypistName
                }

                Button {
                    anchors.horizontalCenter: parent.horizontalCenter
                    visible: messageList.visibleArea.yPosition < 0.9
                    text: "Jump to latest"
                    onClicked: messageList.scrollToBottom()
                    background: Rectangle { radius: 16; color: Theme.primary }
                    contentItem: Text {
                        text: parent.text
                        color: Theme.onPrimary
                        font.pixelSize: 12
                    }
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.preferredHeight: 130
            color: "transparent"

            Column {
                anchors.fill: parent
                anchors.leftMargin: 24
                anchors.rightMargin: 24
                spacing: 8

                SentimentBar {
                    width: parent.width
                    score: root.sentimentScore
                }

                MessageInput {
                    width: parent.width
                    translateEnabled: appState ? Boolean(appState.translateEnabled) : false
                    sending: loadingMessages
                    onTypingChanged: function(active) {
                        if (supabaseRealtime && appState) {
                            supabaseRealtime.trackPresence("presence:" + appState.workspaceId, {
                                user_id: appState.currentUserId,
                                name: appState.currentUserName,
                                avatar_url: appState.currentUserAvatarUrl,
                                typing: active
                            })
                        }
                    }
                    onSendRequested: function(text, translate) {
                        if (!appState || !messageService) return
                        root.sendOrQueue({
                            channel_id: root.activeChannelId,
                            user_id: appState.currentUserId,
                            workspace_id: appState.workspaceId,
                            text: text,
                            translate: translate
                        })
                    }
                }
            }
        }
    }
}
