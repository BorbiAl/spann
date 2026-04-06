import React, { useEffect, useState } from "react";
import Icon from "../components/Icon";
import WaveformBars from "../components/WaveformBars";

export default function PulseView() {
	const [channels, setChannels] = useState([
		{ name: "#general", energy: 78 },
		{ name: "#emergencies", energy: 64 },
		{ name: "#carbon-reports", energy: 58 },
		{ name: "#team-pulse", energy: 86 }
	]);
	const [micActive, setMicActive] = useState(false);

	useEffect(() => {
		const timer = setInterval(() => {
			setChannels((current) =>
				current.map((channel) => {
					const swing = Math.round((Math.random() - 0.5) * 12);
					return {
						...channel,
						energy: Math.max(30, Math.min(96, channel.energy + swing))
					};
				})
			);
		}, 1800);

		return () => clearInterval(timer);
	}, []);

	const average = Math.round(channels.reduce((sum, channel) => sum + channel.energy, 0) / channels.length);
	const label = average > 72 ? "High Energy 🔥" : average > 55 ? "Steady Flow ⚡" : "Low Energy 🧊";

	return (
		<div className="view-transition">
			<section className="card">
				<p className="display" style={{ marginBottom: 2 }}>
					{label}
				</p>
				<p className="caption">Live sentiment waveform sampled from active channels.</p>

				<div className="wave-holder" style={{ marginTop: 14 }}>
					<WaveformBars level={average} />
				</div>

				<button className={`mic-btn ${micActive ? "active" : ""}`} onClick={() => setMicActive((current) => !current)}>
					<Icon name="mic" size={17} />
					{micActive ? "Mic Joined" : "Join with Mic"}
				</button>
			</section>

			<section className="card">
				<p className="title">Channel Noise Levels</p>
				<div className="energy-list">
					{channels.map((channel) => (
						<div key={channel.name} className="energy-row">
							<div className="energy-top">
								<span>{channel.name}</span>
								<span>{channel.energy}%</span>
							</div>
							<div className="energy-track">
								<div className="energy-fill" style={{ width: `${channel.energy}%` }} />
							</div>
						</div>
					))}
				</div>
			</section>
		</div>
	);
}
