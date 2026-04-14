import QtQuick

Rectangle {
    id: root
    property var category: ({})
    property bool active: false

    radius: 12
    color: Theme.surfaceContainerLow
    border.width: active ? 2 : 1
    border.color: active ? Theme.primary : Theme.panelBorder

    Column {
        anchors.fill: parent
        anchors.margins: 10
        spacing: 4
        Text { text: category.icon || "help"; color: Theme.onSurfaceVariant; font.family: "Material Symbols Outlined"; font.pixelSize: 18 }
        Text { text: category.title || "Category"; color: Theme.onSurface; font.pixelSize: 13; font.weight: Font.DemiBold }
        Text { text: category.description || ""; color: Theme.onSurfaceVariant; font.pixelSize: 11; wrapMode: Text.WordWrap }
        Text { text: String(category.count || 0) + " articles"; color: Theme.onSurfaceVariant; font.pixelSize: 10 }
    }
}
