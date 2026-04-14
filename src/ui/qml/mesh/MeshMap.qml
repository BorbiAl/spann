import QtQuick

Item {
    id: root
    property var nodes: []

    function pointForIndex(i, count, cx, cy, r) {
        if (count <= 0) return Qt.point(cx, cy)
        var angle = (i / count) * Math.PI * 2
        return Qt.point(cx + r * Math.cos(angle), cy + r * Math.sin(angle))
    }

    Canvas {
        anchors.fill: parent
        onPaint: {
            var ctx = getContext("2d")
            ctx.reset()
            ctx.fillStyle = Theme.surfaceContainerLowest
            ctx.fillRect(0, 0, width, height)

            var cx = width * 0.5
            var cy = height * 0.5
            var radius = Math.min(width, height) * 0.32

            for (var gx = 16; gx < width; gx += 24) {
                for (var gy = 16; gy < height; gy += 24) {
                    ctx.fillStyle = "rgba(15,103,183,0.06)"
                    ctx.beginPath()
                    ctx.arc(gx, gy, 1.1, 0, Math.PI * 2)
                    ctx.fill()
                }
            }

            var count = Math.min(8, root.nodes.length)
            ctx.strokeStyle = "rgba(15,103,183,0.2)"
            ctx.lineWidth = 1.5
            for (var i = 0; i < count; ++i) {
                var p = root.pointForIndex(i, count, cx, cy, radius)
                ctx.beginPath()
                ctx.moveTo(cx, cy)
                ctx.lineTo(p.x, p.y)
                ctx.stroke()
            }

            ctx.fillStyle = "rgba(15,103,183,0.1)"
            ctx.beginPath()
            ctx.arc(cx, cy, 30, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = Theme.primary
            ctx.lineWidth = 2
            ctx.stroke()

            for (i = 0; i < count; ++i) {
                p = root.pointForIndex(i, count, cx, cy, radius)
                ctx.fillStyle = "rgba(16,185,129,0.35)"
                ctx.beginPath()
                ctx.arc(p.x, p.y, 12, 0, Math.PI * 2)
                ctx.fill()
                ctx.fillStyle = Theme.onSurfaceVariant
                ctx.font = "10px Segoe UI"
                var name = String(root.nodes[i].shortName || "Node")
                ctx.fillText(name, p.x - Math.min(22, name.length * 2), p.y + 26)
            }
        }
    }

    Timer {
        interval: 1100
        repeat: true
        running: true
        onTriggered: parent.children[0].requestPaint()
    }
}
