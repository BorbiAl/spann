import QtQuick
import QtQuick.Controls

Rectangle {
    id: root
    property bool open: false
    signal closed()

    visible: open
    color: "#88000000"

    Rectangle {
        width: 520
        height: 420
        anchors.centerIn: parent
        radius: 16
        color: Theme.surfaceContainerLowest
        border.color: Theme.panelBorder

        property bool submitting: false
        property bool submitted: false

        Timer {
            id: submitTimer
            interval: 1000
            onTriggered: {
                parent.submitting = false
                parent.submitted = true
            }
        }

        Column {
            anchors.fill: parent
            anchors.margins: 12
            spacing: 8

            Row {
                Text { text: "Contact Support"; color: Theme.onSurface; font.pixelSize: 18; font.weight: Font.Bold }
                Item { width: parent.width - 140 }
                Button { text: "close"; onClicked: { root.open = false; root.closed() }; contentItem: Text { text: parent.text; font.family: "Material Symbols Outlined" } }
            }

            TextField { id: subject; placeholderText: "Subject"; enabled: !parent.submitting && !parent.submitted }
            ComboBox { id: priority; model: ["Low", "Medium", "High", "Urgent"]; enabled: !parent.submitting && !parent.submitted }
            TextArea { id: description; height: 200; placeholderText: "Describe your issue"; enabled: !parent.submitting && !parent.submitted }

            Row {
                spacing: 8
                Button { text: "Cancel"; onClicked: { root.open = false; root.closed() } }
                Button {
                    text: parent.parent.submitting ? "Submitting..." : (parent.parent.submitted ? "Submitted" : "Submit")
                    enabled: !parent.parent.submitting && !parent.parent.submitted
                    onClicked: {
                        parent.parent.submitting = true
                        submitTimer.start()
                    }
                }
            }
        }
    }
}
