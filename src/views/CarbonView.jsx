import React, { useState } from "react";
import Badge from "../components/Badge";
import ProgressRing from "../components/ProgressRing";
import { LEADERBOARD } from "../data/constants";

export default function CarbonView() {
	const [score, setScore] = useState(72);
	const [todayLog, setTodayLog] = useState(["08:15 — Remote standup logged", "09:05 — Bike commute captured"]);

	const badgeItems = ["🌿 Zero Emission Commute", "🏅 Green Week Streak", "🔋 Battery Saver", "🛰 Mesh Optimizer"];

	const actions = [
		{ emoji: "🚗", label: "Car", delta: -5, note: "Car trip logged" },
		{ emoji: "🚌", label: "Bus", delta: 1, note: "Bus commute logged" },
		{ emoji: "🚲", label: "Bike", delta: 4, note: "Bike route logged" },
		{ emoji: "🏠", label: "Remote", delta: 5, note: "Remote work session logged" }
	];

	function logAction(action) {
		setScore((current) => Math.max(0, Math.min(100, current + action.delta)));
		const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		setTodayLog((current) => [`${stamp} — ${action.note}`, ...current].slice(0, 5));
	}

	const delta = score - 69.9;
	const deltaTone = delta >= 0 ? "green" : "red";

	return (
		<div className="view-transition">
			<section className="card">
				<div className="ring-layout">
					<ProgressRing value={score} max={100} size={168} />
					<div className="ring-copy">
						<p className="title" style={{ marginBottom: 6 }}>
							Today's Carbon Score
						</p>
						<p className="ring-value">{score.toFixed(0)} / 100</p>
						<Badge tone={deltaTone}>{`${delta >= 0 ? "+" : ""}${delta.toFixed(1)} vs yesterday`}</Badge>
						<p className="caption" style={{ marginTop: 10 }}>
							Lower-emission habits improve this score in real time.
						</p>
					</div>
				</div>
			</section>

			<section className="card">
				<p className="title">Badges Earned</p>
				<div className="badge-shelf">
					{badgeItems.map((item) => (
						<Badge key={item} tone="accent">
							{item}
						</Badge>
					))}
				</div>
			</section>

			<section className="card">
				<p className="title">Leaderboard</p>
				<div className="leaderboard">
					{LEADERBOARD.map((entry) => (
						<div key={entry.rank} className="leader-row">
							<span className="rank">{entry.rank}</span>
							<div className="avatar" style={{ width: 32, height: 32, minWidth: 32, background: entry.color }}>
								{entry.name
									.split(" ")
									.map((part) => part[0])
									.join("")}
							</div>
							<p className="leader-name">{entry.name}</p>
							<p className="leader-score">{entry.score}</p>
							<span style={{ color: entry.color, fontWeight: 700 }}>{entry.trend}</span>
						</div>
					))}
				</div>
			</section>

			<section className="card">
				<p className="title">Quick Log</p>
				<div className="quick-log-grid">
					{actions.map((action) => (
						<button key={action.label} className="log-btn" onClick={() => logAction(action)}>
							<span style={{ fontSize: 24 }}>{action.emoji}</span>
							<span>{action.label}</span>
						</button>
					))}
				</div>
				<div className="log-list">
					{todayLog.map((item) => (
						<p key={item}>{item}</p>
					))}
				</div>
			</section>
		</div>
	);
}
