import QtQuick

Item {
    id: root
    property real kgValue: 0
    property real yesterdayKg: 0
    property real maxKg: 20

    readonly property real clampedKg: Math.max(0, Math.min(maxKg, kgValue))
    readonly property real progress: clampedKg / maxKg
    readonly property real strokeDashoffset: 691 * (1 - progress)
    readonly property real delta: kgValue - yesterdayKg
    readonly property string impactLabel: kgValue < 2.0 ? "Low Impact" : (kgValue <= 5.0 ? "Medium Impact" : "High Impact")

    implicitWidth: 520
    implicitHeight: 290

    Canvas {
        id: ringCanvas
        width: 256
        height: 256
        anchors.left: parent.left
        anchors.verticalCenter: parent.verticalCenter

        onPaint: {
            var ctx = getContext("2d")
            ctx.reset()
            var cx = width / 2
            var cy = height / 2
            var r = 110

            ctx.beginPath()
            ctx.lineWidth = 12
            ctx.strokeStyle = Theme.surfaceContainerHigh
            ctx.arc(cx, cy, r, 0, Math.PI * 2)
            ctx.stroke()

            ctx.beginPath()
            ctx.lineWidth = 12
            ctx.lineCap = "round"
            ctx.strokeStyle = Theme.tertiary
            ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * root.progress))
            ctx.stroke()
        }
    }

    Column {
        anchors.centerIn: ringCanvas
        spacing: 4
        Text {
            text: Number(root.kgValue).toFixed(1) + "kg"
            color: Theme.onSurface
            font.pixelSize: 36
            font.weight: Font.ExtraBold
        }
        Text {
            text: root.impactLabel
            color: Theme.tertiary
            font.pixelSize: 12
            font.weight: Font.DemiBold
        }
        Rectangle {
            radius: 10
            color: Theme.tertiaryContainer
            implicitWidth: deltaText.implicitWidth + 14
            implicitHeight: 22
            Text {
                id: deltaText
                anchors.centerIn: parent
                text: (root.delta <= 0 ? "\u2193" : "\u2191") + Math.abs(root.delta).toFixed(1) + "kg vs Yesterday"
                color: Theme.tertiary
                font.pixelSize: 10
                font.weight: Font.Bold
            }
        }
    }

    Column {
        anchors.left: ringCanvas.right
        anchors.leftMargin: 20
        anchors.right: parent.right
        anchors.verticalCenter: parent.verticalCenter
        spacing: 10

        Text {
            text: "Daily Carbon Score"
            color: Theme.onSurface
            font.pixelSize: 30
            font.weight: Font.ExtraBold
        }

        Text {
            text: "Your footprint today is updated from live workspace logs."
            color: Theme.onSurfaceVariant
            wrapMode: Text.WordWrap
            font.pixelSize: 14
        }

        Row {
            spacing: 8
            Repeater {
                model: ["Live insights", "History soon"]
                delegate: Rectangle {
                    radius: 14
                    color: index === 0 ? Theme.accentSoft : Theme.surfaceContainerHigh
                    implicitWidth: tagText.implicitWidth + 12
                    implicitHeight: 26
                    Text {
                        id: tagText
                        anchors.centerIn: parent
                        text: modelData
                        color: index === 0 ? Theme.primary : Theme.onSurface
                        font.pixelSize: 11
                        font.weight: Font.DemiBold
                    }
                }
            }
        }
    }

    Behavior on progress { NumberAnimation { duration: 1000; easing.type: Easing.OutCubic } }
}
