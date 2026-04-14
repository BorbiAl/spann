import QtQuick

Rectangle {
    id: root
    property bool dyslexiaFont: false
    property bool highContrast: false
    property bool simplified: false
    property string colorBlindMode: "none"
    property string avatarUrl: ""

    radius: 16
    color: Theme.surfaceContainerLow
    border.color: Theme.panelBorder

    layer.enabled: true
    layer.effect: ShaderEffect {
        property variant src: root
        property int mode: root.colorBlindMode === "protanopia" ? 1 : (root.colorBlindMode === "deuteranopia" ? 2 : (root.colorBlindMode === "tritanopia" ? 3 : 0))
        fragmentShader: "
            varying highp vec2 qt_TexCoord0;
            uniform sampler2D src;
            uniform lowp int mode;

            lowp vec3 applyProtanopia(lowp vec3 c) {
                return vec3(
                    dot(c, vec3(0.567, 0.433, 0.000)),
                    dot(c, vec3(0.558, 0.442, 0.000)),
                    dot(c, vec3(0.000, 0.242, 0.758))
                );
            }

            lowp vec3 applyDeuteranopia(lowp vec3 c) {
                return vec3(
                    dot(c, vec3(0.625, 0.375, 0.000)),
                    dot(c, vec3(0.700, 0.300, 0.000)),
                    dot(c, vec3(0.000, 0.300, 0.700))
                );
            }

            lowp vec3 applyTritanopia(lowp vec3 c) {
                return vec3(
                    dot(c, vec3(0.950, 0.050, 0.000)),
                    dot(c, vec3(0.000, 0.433, 0.567)),
                    dot(c, vec3(0.000, 0.475, 0.525))
                );
            }

            void main() {
                lowp vec4 px = texture2D(src, qt_TexCoord0);
                lowp vec3 c = px.rgb;
                if (mode == 1) {
                    c = applyProtanopia(c);
                } else if (mode == 2) {
                    c = applyDeuteranopia(c);
                } else if (mode == 3) {
                    c = applyTritanopia(c);
                }
                gl_FragColor = vec4(c, px.a);
            }
        "
    }

    Column {
        anchors.fill: parent
        anchors.margins: 12
        spacing: 10

        Rectangle {
            width: parent.width
            height: 46
            radius: 12
            gradient: Gradient {
                GradientStop { position: 0; color: Theme.primary }
                GradientStop { position: 1; color: Theme.primaryContainer }
            }
            Text {
                anchors.centerIn: parent
                text: "Live Preview"
                color: Theme.onPrimary
                font.pixelSize: 14
                font.weight: Font.DemiBold
            }
        }

        Row {
            spacing: 8
            Rectangle {
                width: 40
                height: 40
                radius: 20
                clip: true
                color: Theme.surfaceContainer
                Image {
                    anchors.fill: parent
                    source: avatarUrl && avatarUrl.length > 0 ? avatarUrl : "https://api.dicebear.com/8.x/personas/svg?seed=preview"
                    fillMode: Image.PreserveAspectCrop
                }
            }

            Text {
                width: parent.width - 60
                text: simplified ? "Team update ready. New action list is short and clear." : "Team update posted in #engineering. Please review details before standup."
                wrapMode: Text.WordWrap
                color: root.highContrast ? "#ffffff" : Theme.onSurface
                font.family: root.dyslexiaFont ? "OpenDyslexic" : "Segoe UI"
                font.pixelSize: 13
            }
        }
    }
}
