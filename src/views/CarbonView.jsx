import React, { useMemo, useState } from "react";

export default function CarbonView({
	leaderboard = [],
	currentUserId,
	onLogAction,
	isSubmitting,
	errorText,
	onOpenSettings,
	onOpenSupport
}) {
	const [customLogBusy, setCustomLogBusy] = useState(false);

	function toUserInitial(nameValue) {
		const safeName = String(nameValue || "").trim();
		return safeName ? safeName.charAt(0).toUpperCase() : "?";
	}

	function formatAvg(kgValue) {
		const numeric = Number(kgValue);
		if (!Number.isFinite(numeric)) {
			return "0.0kg";
		}
		return `${numeric.toFixed(1)}kg`;
	}

	const quickLogActions = [
		{ key: "remote", label: "Home Office", icon: "home_work", kgCo2: 0, note: "Logged home office day", tone: "tertiary" },
		{ key: "walk", label: "Walk", icon: "directions_walk", kgCo2: 0, note: "Logged walking commute", tone: "tertiary" },
		{ key: "bike", label: "Bike", icon: "pedal_bike", kgCo2: 0, note: "Logged biking commute", tone: "tertiary" },
		{ key: "bus", label: "Bus", icon: "directions_bus", kgCo2: 0.5, note: "Logged bus commute", tone: "primary" },
		{ key: "train", label: "Train", icon: "train", kgCo2: 0.3, note: "Logged train commute", tone: "primary" },
		{ key: "car", label: "Car", icon: "directions_car", kgCo2: 2.8, note: "Logged car commute", tone: "primary" }
	];

	const normalizedLeaderboard = useMemo(() => {
		if (!Array.isArray(leaderboard)) {
			return [];
		}

		return leaderboard.map((entry) => {
			const id = String(entry?.id || entry?.user_id || "");
			const name = String(entry?.name || entry?.display_name || "Member");
			const score = Number(entry?.score ?? entry?.total_score ?? 0);
			const avg = String(entry?.avg || formatAvg(entry?.total_kg_co2));
			const avatar = typeof entry?.avatar === "string" ? entry.avatar : "";
			const isMe = entry?.isMe != null ? Boolean(entry.isMe) : (id && String(currentUserId || "") === id);

			return {
				id: id || `member-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
				name,
				score: Number.isFinite(score) ? score : 0,
				avg,
				avatar,
				isMe
			};
		});
	}, [leaderboard, currentUserId]);

	const totalTeamKg = useMemo(
		() => normalizedLeaderboard.reduce((sum, item) => sum + Number(item?.avg?.replace("kg", "") || 0), 0),
		[normalizedLeaderboard]
	);
	const currentUserEntry = useMemo(
		() => normalizedLeaderboard.find((entry) => entry.isMe) || normalizedLeaderboard[0] || null,
		[normalizedLeaderboard]
	);
	const currentUserAvgKg = useMemo(() => {
		if (!currentUserEntry) {
			return 0;
		}
		const parsed = Number(String(currentUserEntry.avg || "0").replace("kg", ""));
		return Number.isFinite(parsed) ? parsed : 0;
	}, [currentUserEntry]);
	const carbonScorePercent = useMemo(() => {
		const score = Number(currentUserEntry?.score || 0);
		if (!Number.isFinite(score)) {
			return 0;
		}
		return Math.max(0, Math.min(100, Math.round(score)));
	}, [currentUserEntry]);
	const impactLabel = currentUserAvgKg <= 1 ? "Very Low Impact" : currentUserAvgKg <= 2 ? "Low Impact" : currentUserAvgKg <= 4 ? "Moderate Impact" : "High Impact";
	const ringCircumference = 691;
	const ringOffset = ringCircumference - (ringCircumference * carbonScorePercent) / 100;

	async function handleCustomLog() {
		if (customLogBusy || isSubmitting) {
			return;
		}

		const modeInput = window.prompt("Commute type: home office, bike, bus, train, or car", "home office");
		const mode = String(modeInput || "").trim().toLowerCase();
		if (!mode) {
			return;
		}

		const normalizedMode = mode === "home office" ? "remote" : mode;
		const allowed = new Set(["remote", "bike", "walk", "bus", "train", "car"]);
		if (!allowed.has(normalizedMode)) {
			window.alert("Invalid commute type. Use home office, bike, bus, train, walk, or car.");
			return;
		}

		let km = 0;
		if (normalizedMode !== "remote") {
			const kmInput = window.prompt("Distance in km (one-way)", "8");
			const parsed = Number(kmInput || 0);
			if (!Number.isFinite(parsed) || parsed <= 0) {
				window.alert("Enter a valid distance in km.");
				return;
			}
			km = parsed;
		}

		const location = window.prompt("Location (city or district)", "");
		const factors = { remote: 0, walk: 0, bike: 0, bus: 0.105, train: 0.041, car: 0.192 };
		const estimatedKg = Math.max(0, Number((km * 2 * (factors[normalizedMode] || 0)).toFixed(2)));

		setCustomLogBusy(true);
		try {
			await onLogAction?.({
				transportType: normalizedMode,
				kgCo2: estimatedKg,
				note: `Logged ${mode}${location ? ` for ${location}` : ""}.`
			});
		} finally {
			setCustomLogBusy(false);
		}
	}

	return (
		<div className="flex-1 flex flex-col w-full bg-surface font-body text-on-surface antialiased selection:bg-primary-fixed relative">
			{errorText ? (
				<div className="mx-auto mt-4 w-full max-w-[80rem] px-8">
					<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
						{errorText}
					</div>
				</div>
			) : null}

			{/* TopNavBar */}
			<header className="w-full top-0 sticky bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-xl shadow-sm z-40 flex justify-between items-center px-5 sm:px-6 h-12 font-['Segoe_UI_Variable',sans-serif] text-sm antialiased">
				<div className="flex items-center gap-8">
					<span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Spann</span>
					<div className="flex items-center bg-slate-200/30 px-3 py-1 rounded-full gap-2">
						<span className="material-symbols-outlined text-xs" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>search</span>
						<input className="bg-transparent border-none focus:ring-0 text-xs w-48 outline-none" placeholder="Search workspace..." type="text" />
					</div>
				</div>
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-6 px-4">
						<span className="text-blue-600 dark:text-blue-400 font-medium border-b-2 border-blue-600 h-12 flex items-center">Insights</span>
					</div>
					<div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
						<button
							type="button"
							onClick={onOpenSettings}
							className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-semibold hover:bg-slate-200/70 dark:hover:bg-slate-700/70"
						>
							<span className="material-symbols-outlined text-[16px]" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>settings</span>
							<span>Settings</span>
						</button>
						<button
							type="button"
							onClick={onOpenSupport}
							className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-semibold hover:bg-slate-200/70 dark:hover:bg-slate-700/70"
						>
							<span className="material-symbols-outlined text-[16px]" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>help</span>
							<span>Support</span>
						</button>
					</div>
				</div>
			</header>

			<div className="p-6 pb-10 max-w-[80rem] mx-auto w-full grid grid-cols-12 gap-6">
				{/* Bento Grid Layout */}
				{/* Main Impact Ring Section */}
				<div className="col-span-12 lg:col-span-8 space-y-8">
					<section className="bg-white/60 backdrop-blur-[12px] border border-outline-variant/20 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-12 relative overflow-hidden shadow-sm">
						<div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-tertiary/10 to-transparent -mr-32 -mt-32 rounded-full blur-3xl"></div>
						
						{/* Animated Progress Ring Container */}
						<div className="relative w-64 h-64 flex items-center justify-center">
							<svg className="w-full h-full transform -rotate-90">
								<circle className="text-surface-container-high" cx="128" cy="128" fill="transparent" r="110" stroke="currentColor" strokeWidth="12"></circle>
								<circle className="text-tertiary transition-all duration-1000 ease-out" cx="128" cy="128" fill="transparent" r="110" stroke="currentColor" strokeDasharray={ringCircumference} strokeDashoffset={ringOffset} strokeLinecap="round" strokeWidth="12"></circle>
							</svg>
							<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
								<span className="text-4xl font-extrabold text-on-surface tracking-tight">{currentUserAvgKg.toFixed(1)}<span className="text-lg font-medium text-on-surface-variant">kg</span></span>
								<span className="text-sm font-semibold uppercase tracking-widest text-tertiary mt-1">{impactLabel}</span>
								<div className="mt-4 flex items-center gap-1 bg-tertiary/10 text-tertiary px-3 py-1 rounded-full text-[10px] font-bold">
									<span className="material-symbols-outlined text-xs" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>trending_down</span>
									Score {carbonScorePercent}/100
								</div>
							</div>
						</div>
						
						<div className="flex-1 space-y-6">
							<div>
								<h2 className="text-3xl font-bold tracking-tight text-on-surface">Daily Carbon Score</h2>
								<p className="text-on-surface-variant mt-2 max-w-md leading-relaxed">Daily carbon insights are based on the latest logs from your workspace and update as new entries are added.</p>
							</div>
							
							{/* Sentiment Bar */}
							<div className="space-y-2">
								<div className="flex justify-between text-xs font-bold text-on-surface-variant uppercase tracking-wider">
									<span>Eco Focus</span>
									<span>Neutral</span>
									<span>Heavy Output</span>
								</div>
								<div className="h-3 w-full bg-surface-container-high rounded-full overflow-hidden relative">
									<div className="absolute inset-y-0 left-0 bg-gradient-to-r from-tertiary to-primary rounded-full shadow-lg shadow-tertiary/20" style={{ width: `${Math.max(8, carbonScorePercent)}%` }}></div>
								</div>
							</div>
							
							<div className="flex flex-wrap gap-2">
								<span className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-bold">
									<span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>insights</span>
									Live insights
								</span>
								<span className="inline-flex items-center gap-2 rounded-full bg-surface-container-high text-on-surface px-3 py-1.5 text-xs font-bold">
									<span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>history</span>
									History soon
								</span>
							</div>
						</div>
					</section>

					{/* Badges Shelf */}
					<section className="space-y-4">
						<div className="flex justify-between items-center px-2">
							<h3 className="text-lg font-bold text-on-surface">Carbon Inputs</h3>
							<button type="button" onClick={handleCustomLog} disabled={customLogBusy || isSubmitting} className="text-primary text-xs font-bold flex items-center gap-1 opacity-90 hover:opacity-100 disabled:opacity-50">
								Log with location
							</button>
						</div>
						<div className="rounded-3xl border border-outline-variant/20 bg-white/60 p-5 text-sm text-on-surface-variant">
							Choose Home Office, Bike, Bus, Train, Walk, or Car. The custom logger asks for location and distance to estimate CO2.
						</div>
					</section>
				</div>

				{/* Right Column: Leaderboard */}
				<aside className="col-span-12 lg:col-span-4 space-y-6">
					<div className="bg-white/60 backdrop-blur-[12px] border border-outline-variant/20 rounded-3xl p-6 flex flex-col h-full shadow-sm">
						<div className="flex items-center justify-between mb-6">
							<h3 className="text-lg font-bold text-on-surface">Team Leaderboard</h3>
							<span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded">Weekly</span>
						</div>
						
						<div className="space-y-4 flex-1">
							{normalizedLeaderboard.length === 0 ? (
								<div className="rounded-2xl border border-dashed border-outline-variant/40 px-4 py-6 text-center text-sm text-on-surface-variant">
									No carbon logs yet for this workspace.
								</div>
							) : null}
							{normalizedLeaderboard.map((user, index) => (
								<div key={user.id} className={`flex items-center gap-4 p-3 rounded-2xl transition-colors cursor-pointer ${user.isMe ? 'bg-primary/5 border border-primary/10' : 'hover:bg-surface-container-low'}`}>
									<span className={`text-sm font-black w-4 ${user.isMe ? 'text-primary' : 'text-on-surface-variant'}`}>{index + 1}</span>
									<div className="relative">
										{user.avatar ? (
											<img alt="User" src={user.avatar} className="w-10 h-10 rounded-xl object-cover" />
										) : (
											<div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center">
												<span className="text-xs font-bold">{toUserInitial(user.name)}</span>
											</div>
										)}
										{index === 0 && (
											<div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-white flex items-center justify-center">
												<span className="material-symbols-outlined text-[8px] text-white" style={{fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>workspace_premium</span>
											</div>
										)}
									</div>
									<div className="flex-1">
										<p className="text-sm font-bold">{user.name}</p>
										<p className="text-[10px] text-on-surface-variant">{user.avg} avg</p>
									</div>
									<div className="text-right">
										<p className={`text-xs font-black ${index === 0 ? 'text-tertiary' : user.isMe ? 'text-primary' : 'text-on-surface'}`}>{user.score} pts</p>
									</div>
								</div>
							))}
						</div>
						
						<div className="mt-8 p-4 bg-tertiary text-white rounded-2xl text-center">
							<p className="text-xs font-medium opacity-90">Workspace Carbon Snapshot</p>
							<p className="text-[11px] font-bold mt-2">
								{normalizedLeaderboard.length} member{normalizedLeaderboard.length !== 1 ? "s" : ""} tracked
							</p>
							<p className="text-[10px] font-medium mt-1">Approx total daily average: {Number.isFinite(totalTeamKg) ? totalTeamKg.toFixed(1) : "0.0"}kg</p>
						</div>
					</div>
				</aside>
			</div>

			{/* Bottom Quick-Log Buttons */}
			<div className="sticky bottom-4 sm:bottom-8 w-full z-50 pointer-events-none flex justify-center pb-0 mt-auto px-3 sm:px-6">
				<div className="bg-white/85 backdrop-blur-xl border border-slate-200/50 rounded-[24px] sm:rounded-[32px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] p-2 sm:p-2.5 flex items-center justify-between w-full max-w-[860px] overflow-x-auto pointer-events-auto gap-3">
					<div className="px-6">
						<p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Quick Log Transport</p>
					</div>
					<div className="flex items-center gap-2 pr-1 min-w-max">
						{quickLogActions.map((action) => (
							<button
								key={action.key}
								disabled={isSubmitting}
								onClick={() => onLogAction?.({ transportType: action.key, kgCo2: action.kgCo2, note: action.note })}
								className={`flex flex-col items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-transparent transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
									action.tone === "tertiary"
										? "bg-tertiary/10 text-tertiary hover:bg-tertiary hover:text-white"
										: "bg-primary/10 text-primary hover:bg-primary hover:text-white"
								}`}
								aria-label={`Quick log ${action.label.toLowerCase()} commute`}
							>
								<span className="material-symbols-outlined text-[18px]" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>{action.icon}</span>
								<span className="text-[10px] sm:text-[11px] font-bold mt-0.5">{action.label}</span>
							</button>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
