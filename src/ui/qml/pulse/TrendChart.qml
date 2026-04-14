import QtQuick

Item {
    id: root
    property var points: [45, 52, 50, 63, 71, 66, 74]

    Canvas {
        id: trendCanvas
        anchors.fill: parent
        onPaint: {
            var ctx = getContext("2d")
            ctx.reset()
            var padding = 18
            var w = width - padding * 2
            var h = height - padding * 2
            var stepX = w / 6

            ctx.strokeStyle = "rgba(148,163,184,0.2)"
            ctx.lineWidth = 1
            for (var i = 0; i < 4; ++i) {
                var gy = padding + (h / 3) * i
                ctx.beginPath()
                ctx.moveTo(padding, gy)
                ctx.lineTo(width - padding, gy)
                ctx.stroke()
            }

            ctx.strokeStyle = Theme.primary
            ctx.lineWidth = 2
            ctx.beginPath()
            for (i = 0; i < 7; ++i) {
                var val = Number(root.points[i] || 0)
                var x = padding + stepX * i
                var y = padding + h - (h * val / 100.0)
                if (i === 0) ctx.moveTo(x, y)
                else ctx.lineTo(x, y)
            }
            ctx.stroke()
        }
    }

    Row {
        anchors.bottom: parent.bottom
        anchors.horizontalCenter: parent.horizontalCenter
        spacing: (parent.width - 120) / 6
        Repeater {
            model: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
            delegate: Text {
                text: modelData
                color: Theme.onSurfaceVariant
                font.pixelSize: 10
                font.weight: Font.DemiBold
            }
        }
    }
}
