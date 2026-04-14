import QtQuick
import QtQuick.Controls

ComboBox {
    id: root
    property var cultures: []
    property string selectedCode: ""

    model: cultures
    textRole: "label"

    delegate: ItemDelegate {
        width: parent.width
        contentItem: Row {
            spacing: 8
            Text { text: modelData.code; color: Theme.onSurfaceVariant; font.pixelSize: 11; font.weight: Font.Bold }
            Text { text: modelData.label; color: Theme.onSurface; font.pixelSize: 12 }
        }
    }

    contentItem: Row {
        spacing: 8
        Text {
            text: {
                var c = root.currentIndex >= 0 ? root.model[root.currentIndex] : null
                return c ? c.code : ""
            }
            color: Theme.onSurfaceVariant
            font.pixelSize: 11
            font.weight: Font.Bold
        }
        Text {
            text: {
                var c = root.currentIndex >= 0 ? root.model[root.currentIndex] : null
                return c ? c.label : ""
            }
            color: Theme.onSurface
            font.pixelSize: 12
        }
        Text {
            text: "expand_more"
            color: Theme.onSurfaceVariant
            font.family: "Material Symbols Outlined"
            font.pixelSize: 16
        }
    }

    onCurrentIndexChanged: {
        var c = root.currentIndex >= 0 ? root.model[root.currentIndex] : null
        root.selectedCode = c ? c.locale : ""
    }
}
