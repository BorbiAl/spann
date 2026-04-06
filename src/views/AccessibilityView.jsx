import React, { useState } from "react";
import Badge from "../components/Badge";
import SegmentedControl from "../components/SegmentedControl";
import ToggleRow from "../components/ToggleRow";

export default function AccessibilityView() {
	const [dyslexia, setDyslexia] = useState(false);
	const [highContrast, setHighContrast] = useState(false);
	const [simplified, setSimplified] = useState(false);
	const [tts, setTts] = useState(false);
	const [fontSize, setFontSize] = useState(15);
	const [colorBlind, setColorBlind] = useState("Normal");

	const previewText = simplified
		? "Meeting starts at 11. Share key findings clearly and briefly."
		: "Reminder: accessibility audit call at 11. Bring your findings and highlight blockers, improvements, and next actions.";

	const colorBlindFilters = {
		Normal: "none",
		Deuter: "saturate(0.9) hue-rotate(-14deg)",
		Protan: "saturate(0.85) hue-rotate(18deg)",
		Tritan: "saturate(0.85) hue-rotate(58deg)"
	};

	return (
		<div className="view-transition">
			<section className="card">
				<p className="title">Accessibility Controls</p>

				<div className="settings-group" style={{ marginTop: 12 }}>
					<p className="group-head">Reading</p>
					<ToggleRow
						label="Dyslexia Font"
						note="Use a simplified monospace profile"
						value={dyslexia}
						onChange={setDyslexia}
					/>
					<ToggleRow
						label="High Contrast"
						note="Stronger text and control contrast"
						value={highContrast}
						onChange={setHighContrast}
					/>
					<ToggleRow
						label="Simplified Language"
						note="Reduce complexity in phrasing"
						value={simplified}
						onChange={setSimplified}
					/>
				</div>

				<div className="settings-group" style={{ marginTop: 12 }}>
					<p className="group-head">Audio</p>
					<ToggleRow label="Text to Speech" note="Read selected messages aloud" value={tts} onChange={setTts} />
				</div>

				<div className="settings-group" style={{ marginTop: 12, paddingBottom: 12 }}>
					<p className="group-head">Vision</p>
					<div style={{ padding: "10px 12px 0" }}>
						<SegmentedControl
							options={["Normal", "Deuter", "Protan", "Tritan"]}
							value={colorBlind}
							onChange={setColorBlind}
						/>
					</div>
				</div>

				<div className="slider-row">
					<label>
						<span>Font Size</span>
						<span>{fontSize}px</span>
					</label>
					<input
						type="range"
						min="13"
						max="22"
						value={fontSize}
						onChange={(event) => setFontSize(Number(event.target.value))}
					/>
				</div>

				<div
					className="preview-card"
					style={{
						filter: colorBlindFilters[colorBlind],
						background: highContrast ? "var(--bg2)" : "color-mix(in srgb, var(--bg2) 86%, transparent)",
						boxShadow: highContrast ? "0 0 0 2px var(--accent)" : "none"
					}}
				>
					<p className="preview-title">Live Preview</p>
					<p
						style={{
							fontFamily: dyslexia ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "Outfit, sans-serif",
							letterSpacing: dyslexia ? "0.7px" : "-0.3px",
							fontSize: `${fontSize}px`,
							lineHeight: 1.55,
							fontWeight: highContrast ? 600 : 400,
							color: highContrast ? "var(--text)" : "var(--text-secondary)"
						}}
					>
						{previewText}
					</p>
					{tts ? <Badge tone="accent">Text-to-speech ready</Badge> : null}
				</div>
			</section>
		</div>
	);
}
