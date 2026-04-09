import React, { useState } from "react";
import Badge from "../components/Badge";
import ProgressRing from "../components/ProgressRing";

export default function CarbonView({ leaderboard, currentUserId, onLogAction, isSubmitting, errorText }) {
	const [todayLog, setTodayLog] = useState(["08:15 — Remote standup logged", "09:05 — Bike commute captured"]);

	const badgeItems = ["🌿 Zero Emission Commute", "🏅 Green Week Streak", "🔋 Battery Saver", "🛰 Mesh Optimizer"];

	const actions = [
		{ emoji: "🚗", label: "Car", transportType: "car", kgCo2: 3.8, note: "Car trip logged" },
		{ emoji: "🚌", label: "Bus", transportType: "bus", kgCo2: 1.5, note: "Bus commute logged" },
		{ emoji: "🚲", label: "Bike", transportType: "bike", kgCo2: 0.0, note: "Bike route logged" },
		{ emoji: "🏠", label: "Remote", transportType: "remote", kgCo2: 0.0, note: "Remote work session logged" }
	];

	const orderedLeaderboard = Array.isArray(leaderboard) ? leaderboard : [];
	const selfEntry = orderedLeaderboard.find((entry) => String(entry.user_id) === String(currentUserId));
	const totalScore = Number(selfEntry?.total_score || 0);
	const score = Math.max(0, Math.min(100, 50 + totalScore));

	async function logAction(action) {
		await onLogAction(action);
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
				{errorText ? (
					<p className="caption" style={{ color: "var(--red)", marginBottom: 10 }}>
						{errorText}
					</p>
				) : null}
				<div className="leaderboard">
					{orderedLeaderboard.map((entry, index) => (
						<div key={entry.user_id || index} className="leader-row">
							<span className="rank">{index + 1}</span>
							<div className="avatar" style={{ width: 32, height: 32, minWidth: 32, background: entry.color }}>
								{String(entry.display_name || "Member")
									.split(" ")
									.map((part) => part[0])
									.join("")}
							</div>
							<p className="leader-name">{entry.display_name || "Team Member"}</p>
							<p className="leader-score">{Number(entry.total_kg_co2 || 0).toFixed(2)} kg CO2</p>
							<span style={{ color: "var(--accent)", fontWeight: 700 }}>{entry.total_score || 0}</span>
						</div>
					))}
					{orderedLeaderboard.length === 0 ? <p className="caption">No carbon entries yet.</p> : null}
				</div>
			</section>

			<section className="card">
				<p className="title">Quick Log</p>
				<div className="quick-log-grid">
					{actions.map((action) => (
						<button
							key={action.label}
							className="log-btn"
							onClick={() => logAction(action)}
							disabled={isSubmitting}
						>
							<span style={{ fontSize: 24 }}>{action.emoji}</span>
							<span>{isSubmitting ? "Saving..." : action.label}</span>
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
