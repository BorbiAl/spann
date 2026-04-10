import React, { useState } from "react";
import Icon from "../components/Icon";
import ProgressRing from "../components/ProgressRing";

export default function CarbonView({ leaderboard, currentUserId, onLogAction, isSubmitting, errorText }) {
	const [todayLog, setTodayLog] = useState(["08:15 - Remote standup logged"]);

	const actions = [
		{ icon: "walk", label: "Walk", transportType: "walk", kgCo2: 0, note: "Walking commute logged" },
		{ icon: "bike", label: "Bike", transportType: "bike", kgCo2: 0, note: "Bike commute logged" },
		{ icon: "bus", label: "Bus", transportType: "bus", kgCo2: 1.5, note: "Bus commute logged" },
		{ icon: "train", label: "Train", transportType: "train", kgCo2: 1.0, note: "Train commute logged" }
	];

	const achievements = [
		{ id: "bike", icon: "bike", title: "Biker 100km", sub: "Unlocked May 12", locked: false },
		{ id: "forest", icon: "forest", title: "Forest Guardian", sub: "Tier 3 Contributor", locked: false },
		{ id: "transit", icon: "bus", title: "Transit Pro", sub: "30 Day Streak", locked: false },
		{ id: "locked", icon: "lock", title: "???", sub: "5 Challenges Left", locked: true }
	];

	const orderedLeaderboard = Array.isArray(leaderboard) ? leaderboard : [];
	const fallbackLeaderboard = [
		{ user_id: "m1", display_name: "Marcus Chen", total_score: 980, total_kg_co2: 0.8 },
		{ user_id: String(currentUserId || "me"), display_name: "Alex Rivera", total_score: 845, total_kg_co2: 1.2 },
		{ user_id: "m3", display_name: "Jordan Smith", total_score: 720, total_kg_co2: 1.5 },
		{ user_id: "m4", display_name: "Elena Gomez", total_score: 610, total_kg_co2: 1.9 }
	];
	const leaderboardRows = (orderedLeaderboard.length ? orderedLeaderboard : fallbackLeaderboard).slice(0, 4);
	const selfEntry = leaderboardRows.find((entry) => String(entry.user_id) === String(currentUserId)) || leaderboardRows[1] || leaderboardRows[0];
	const todayKg = Math.max(0, Number(selfEntry?.total_kg_co2 || 1.2));
	const ringScore = Math.max(0, Math.min(100, 84 - todayKg * 10));
	const reachedKg = leaderboardRows.reduce((sum, entry) => sum + Number(entry?.total_kg_co2 || 0), 0) * 1000;
	const goalKg = 10000;
	const goalProgress = Math.max(0, Math.min(100, (reachedKg / goalKg) * 100));

	const avatarByName = {
		"Marcus Chen": "https://lh3.googleusercontent.com/aida-public/AB6AXuDbToWXTJtpLAu6OLo0gisg1VaLHAUN7GmHCRxb5HD9d_2Wkbo_5TubIliJIL6KlckguOalSFV3RMhcrFMbmPggGIZ8pgT7Rnyfupr24h6XXJVwDTgHXWEmO94QVGkAmkpmWZkxZsipH4M1BhtSTPj_Ng0jdXA_Lj7fqCJvPMaxqrPMGshMqmBxCTaz2Hn9FohXrvO6rphJWCMop3T8ripQR01MWL-eC2cNRDyqhAFumZsmdjkIjgJDYp-fEPvvBYCYl0TyZY_mcbnN",
		"Alex Rivera": "https://lh3.googleusercontent.com/aida-public/AB6AXuCjWDvIzVLkqHgTAdsOQaXIY1-WRuPFbLy3EHGzYGK4xJa8LvaH4qQY8ui7wGlU8Kw0NJox87YskH_-NrfkOvTxs3NzrE8OSqJBFtEFEqTwmgZw62DkB3lf6qWViIoZM3DAS-A0U2LCA3p3ynn1rDjB2dA4g8xL2iVESaY0MNGVkwCueiRYqGXnBYC6jg1uuD3w3q93GoCEFj2qKZTsvdrQZw2Bz5sabL9S9IyZiGgEdXmq6BDIYwkZA4jX22b1DwxFp-7bY_RErFcs",
		"Jordan Smith": "https://lh3.googleusercontent.com/aida-public/AB6AXuDywbLAw_cvjxu2AsAQBMqu2LkM71uMpZYDw_98tytHx1rZRMGLa5xXcBwhP8jwEpDlIk66ORU2JXLmdqbcfG2K7UKltsnVKbn4WCMDHoBgr84RPtmw1aHPcUfkpJ-GyaXk1Jf0AyZZw-D1zPpyYbv7NzR809y2dE8ba2K5hZsUre1rwskG-EEqQmLVUMvisSnrnOjtqBpXNR_RQYl2YUqZAymppCC0RS9l-R1MJ5qR5D7QooYXqDywhfMW04Mpidq62fNpSICLlCFB",
		"Elena Gomez": "https://lh3.googleusercontent.com/aida-public/AB6AXuAmYjLYVz1qoKczOARWyQPrD2DJsfWkGHQ9wKF1PvleEsFqyFE3HUx7_H6Skd5_Uxwc7L3Tgy_VUow_r8t_aWZRdzwCFd2yT2eWE805F0d0bJQSUUO41_aPavrWtpN0t9Tl9RR7BNEGecdYP0pYDxtgfMBBGdhTxrgu_QRXImlHJgFqMmpxy4nOe7KlPUhqHOEJsZ0O44ZiKwy_xEGAroNW0Lz4rIBLg_UeaRoQq72J2yspX_PvRBEIk3lF1--H3OhrTxUIRnX3QHo3"
	};

	async function logAction(action) {
		if (typeof onLogAction === "function") {
			await onLogAction(action);
		}
		const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		setTodayLog((current) => [`${stamp} - ${action.note}`, ...current].slice(0, 3));
	}

	return (
		<div className="carbon-v2-page view-transition">
			<div className="carbon-v2-grid">
				<section className="carbon-v2-main">
					<div className="carbon-v2-hero-card">
						<div className="carbon-v2-ring-wrap" aria-label="Daily carbon ring">
							<ProgressRing value={ringScore} max={100} size={220} />
							<div className="carbon-v2-ring-copy">
								<p>
									<strong>{todayKg.toFixed(1)}</strong>
									<span>kg</span>
								</p>
								<em>LOW IMPACT</em>
								<small>
									<Icon name="wave" size={12} /> 12% vs Yesterday
								</small>
							</div>
						</div>

						<div className="carbon-v2-hero-copy">
							<h2>Daily Carbon Score</h2>
							<p>Your footprint today is equivalent to powering a laptop for 24 hours. Great job maintaining a low impact profile!</p>

							<div className="carbon-v2-meter-labels">
								<span>Eco Focus</span>
								<span>Neutral</span>
								<span>Heavy Output</span>
							</div>
							<div className="carbon-v2-meter-track" aria-hidden="true">
								<span style={{ width: `${Math.max(22, Math.min(84, ringScore))}%` }} />
							</div>

							<div className="carbon-v2-hero-actions">
								<button type="button" className="carbon-v2-btn primary">
									<Icon name="star" size={14} />
									Analyze Details
								</button>
								<button type="button" className="carbon-v2-btn secondary">History</button>
							</div>
						</div>
					</div>

					<div className="carbon-v2-achievements">
						<div className="carbon-v2-head-row">
							<h3>Environmental Achievements</h3>
							<button type="button">View All</button>
						</div>
						<div className="carbon-v2-achievement-grid">
							{achievements.map((item) => (
								<article key={item.id} className={`carbon-v2-achievement ${item.locked ? "locked" : ""}`}>
									<div className="carbon-v2-achievement-icon">
										<Icon name={item.icon} size={24} />
									</div>
									<h4>{item.title}</h4>
									<p>{item.sub}</p>
								</article>
							))}
						</div>
					</div>
				</section>

				<aside className="carbon-v2-leaderboard">
					<div className="carbon-v2-head-row">
						<h3>Team Leaderboard</h3>
						<span>Weekly</span>
					</div>
					{errorText ? <p className="carbon-v2-error">{errorText}</p> : null}
					<div className="carbon-v2-leader-list">
						{leaderboardRows.map((entry, index) => {
							const name = entry.display_name || "Team Member";
							const avatar = avatarByName[name] || null;
							const initials = name
								.split(" ")
								.map((part) => part[0])
								.join("")
								.slice(0, 2)
								.toUpperCase();
							const isSelf = String(entry.user_id) === String(currentUserId);

							return (
								<div key={entry.user_id || `${name}-${index}`} className={`carbon-v2-leader-item ${isSelf ? "active" : ""}`}>
									<strong>{index + 1}</strong>
									<div className="carbon-v2-avatar">{avatar ? <img src={avatar} alt={`${name} avatar`} /> : initials}</div>
									<div className="carbon-v2-leader-meta">
										<p>{name}{isSelf ? " (You)" : ""}</p>
										<small>{Number(entry.total_kg_co2 || 0).toFixed(1)}kg CO2 avg</small>
									</div>
									<div className="carbon-v2-points">{Number(entry.total_score || 0)} pts</div>
								</div>
							);
						})}
					</div>

					<div className="carbon-v2-goal">
						<p>Company Goal: {goalKg.toLocaleString()}kg Offset</p>
						<div className="carbon-v2-goal-track"><span style={{ width: `${goalProgress}%` }} /></div>
						<small>{Math.round(reachedKg).toLocaleString()}kg reached ({Math.round(goalProgress)}%)</small>
					</div>
				</aside>
			</div>

			<footer className="carbon-v2-dock">
				<p>Quick Log Transport</p>
				<div className="carbon-v2-dock-actions">
					{actions.map((action) => (
						<button
							key={action.label}
							type="button"
							disabled={isSubmitting}
							title={action.label}
							onClick={() => logAction(action)}
							className="carbon-v2-dock-btn"
						>
							<Icon name={action.icon} size={17} />
							<span>{action.label}</span>
						</button>
					))}
					<button type="button" className="carbon-v2-dock-btn add" title="More actions">
						<Icon name="add" size={18} />
					</button>
				</div>
				<div className="carbon-v2-dock-log" aria-live="polite">{todayLog[0]}</div>
			</footer>
		</div>
	);
}
