import QtQuick
import QtQuick.Controls
import "../chat"

Item {
    id: root
    property var messageItems: []
    property string currentUserId: ""

    signal reactRequested(string messageId, string emoji)
    signal editRequested(string messageId)
    signal deleteRequested(string messageId)

    function scrollToBottom() {
        if (listView.count > 0) {
            listView.positionViewAtEnd()
        }
    }

    ListView {
        id: listView
        anchors.fill: parent
        spacing: 8
        clip: true
        model: root.messageItems
        delegate: Item {
            width: listView.width
            height: bubble.implicitHeight

            MessageBubble {
                id: bubble
                width: parent.width
                messageData: modelData
                currentUserId: root.currentUserId
                onReactRequested: root.reactRequested(messageId, emoji)
                onEditRequested: root.editRequested(messageId)
                onDeleteRequested: root.deleteRequested(messageId)
            }
        }
    }
}
