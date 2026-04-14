import QtQuick

Item {
    id: root
    property string activeName: ""
    width: parent ? parent.width : 300
    height: activeName.length > 0 ? 32 : 0
    visible: activeName.length > 0

    Row {
        anchors.verticalCenter: parent.verticalCenter
        spacing: 8

        Row {
            spacing: 4
            Repeater {
                model: 3
                delegate: Rectangle {
                    width: 6
                    height: 6
                    radius: 3
                    color: Theme.onSurfaceVariant
                    opacity: 0.4
                    SequentialAnimation on opacity {
                        loops: Animation.Infinite
                        running: root.visible
                        PauseAnimation { duration: index * 120 }
                        NumberAnimation { to: 1.0; duration: 260 }
                        NumberAnimation { to: 0.3; duration: 260 }
                    }
                }
            }
        }

        Text {
            text: root.activeName + " is typing..."
            color: Theme.onSurfaceVariant
            font.pixelSize: 12
        }
    }
}
