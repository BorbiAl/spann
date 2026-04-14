import QtQuick

Item {
    id: root
    property var values: []
    property color c0: Theme.primaryContainer
    property color c1: Theme.primary
    property color c2: Theme.primary

    Row {
        anchors.fill: parent
        anchors.margins: 10
        spacing: 4
        Repeater {
            model: 30
            delegate: Rectangle {
                width: (root.width - 29 * 4) / 30
                anchors.bottom: parent.bottom
                height: Math.max(12, Number(root.values[index] || 20))
                radius: 4
                color: index % 3 === 0 ? root.c0 : (index % 3 === 1 ? root.c1 : root.c2)
            }
        }
    }
}
