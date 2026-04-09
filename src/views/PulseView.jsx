import React, { useMemo } from "react";
import Icon from "../components/Icon";
import WaveformBars from "../components/WaveformBars";

export default function PulseView({ channelEnergy, micActive, onMicToggle, onRefreshPulse, isRefreshing, errorText }) {
	const channels = useMemo(() => {
		if (Array.isArray(channelEnergy) && channelEnergy.length > 0) {
			return channelEnergy;
		}

		return [
			{ id: "general", name: "#general", energy: 78 },
			{ id: "emergencies", name: "#emergencies", energy: 64 },
			{ id: "carbon-reports", name: "#carbon-reports", energy: 58 },
			{ id: "team-pulse", name: "#team-pulse", energy: 86 }
		];
	}, [channelEnergy]);

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

				<div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
					<button className={`mic-btn ${micActive ? "active" : ""}`} onClick={onMicToggle}>
						<Icon name="mic" size={17} />
						{micActive ? "Mic Joined" : "Join with Mic"}
					</button>
					<button className="header-btn" onClick={onRefreshPulse}>
						{isRefreshing ? "Refreshing..." : "Refresh Pulse"}
					</button>
				</div>

				{errorText ? (
					<p className="caption" style={{ color: "var(--red)", marginTop: 10 }}>
						{errorText}
					</p>
				) : null}
			</section>

			<section className="card">
				<p className="title">Channel Noise Levels</p>
				<div className="energy-list">
					{channels.map((channel) => (
						<div key={channel.id || channel.name} className="energy-row">
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
