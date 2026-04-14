import QtQuick
import QtQuick.Controls

Row {
    id: root
    property bool dirty: false
    signal saveClicked()
    signal discardClicked()

    spacing: 8

    Button {
        text: "Discard"
        enabled: root.dirty
        onClicked: root.discardClicked()
    }

    Button {
        text: "Save changes"
        enabled: root.dirty
        onClicked: root.saveClicked()
        background: Rectangle { radius: 10; color: parent.enabled ? Theme.primary : Theme.surfaceContainerHigh }
        contentItem: Text {
            text: parent.text
            color: Theme.onPrimary
            font.pixelSize: 12
            font.weight: Font.DemiBold
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
        }
    }
}
