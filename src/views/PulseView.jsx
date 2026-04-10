import './PulseView.css';
import React, { useMemo } from "react";
import Icon from "../components/Icon";
import WaveformBars from "../components/WaveformBars";

export default function PulseView({ channelEnergy, micActive, onMicToggle, onRefreshPulse, isRefreshing, errorText }) {
	const channels = useMemo(() => {
		if (Array.isArray(channelEnergy) && channelEnergy.length > 0) {
			return channelEnergy.map(c => ({ ...c, label: c.energy > 80 ? "Positive" : c.energy > 50 ? "Neutral" : "Alert" }));
		}

		return [
			{ id: "design-critique", name: "#design-critique", energy: 92, label: "Positive" },
			{ id: "engineering", name: "#engineering", energy: 78, label: "Positive" },
			{ id: "urgent-fixes", name: "#urgent-fixes", energy: 54, label: "Neutral" },
			{ id: "social-lounge", name: "#social-lounge", energy: 96, label: "Positive" }
		];
	}, [channelEnergy]);

	return (
		<div className="h-full overflow-y-auto bg-surface p-8 w-full view-transition">
			<div className="flex flex-col relative overflow-hidden bg-background min-h-full font-body text-on-surface rounded-2xl border border-outline-variant/10 shadow-sm">
				<style>{`
					.waveform-bar {
						width: 4px;
						border-radius: 2px;
						transition: height 0.3s ease;
					}
				`}</style>
				
				{/* TopAppBar */}
				<header className="w-full top-0 sticky bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-xl z-40 flex justify-between items-center px-8 h-16 border-b border-outline-variant/10 font-['Segoe_UI_Variable',sans-serif] antialiased">
					<div className="flex items-center gap-6">
						<h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">Pulse Dashboard</h1>
						<div className="hidden md:flex bg-surface-container-low rounded-full px-4 py-1.5 items-center gap-2 border border-outline-variant/10">
							<span className="material-symbols-outlined text-on-surface-variant text-sm">search</span>
							<input className="bg-transparent border-none text-sm focus:ring-0 p-0 w-48 text-on-surface focus:outline-none" placeholder="Search analytics..." type="text" />
						</div>
					</div>
					<div className="flex items-center gap-4">
						<button className="p-2 text-on-surface-variant hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors rounded-full active:scale-95 duration-150"><span className="material-symbols-outlined text-[20px]">settings</span></button>
						<button className="p-2 text-on-surface-variant hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors rounded-full active:scale-95 duration-150"><span className="material-symbols-outlined text-[20px]">help</span></button>
						<div className="h-6 w-[1px] bg-outline-variant/30 mx-1"></div>
						<button onClick={onMicToggle} className={`bg-gradient-to-r ${micActive ? "from-error to-error" : "from-primary to-primary-container"} shadow-sm text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 active:scale-95 duration-150`}>
							<span className="material-symbols-outlined text-[18px]">mic</span> {micActive ? "Mic Joined" : "Join via Mic"}
						</button>
					</div>
				</header>

				{/* Analytics Content */}
				<div className="p-8 space-y-8 flex-1">
					{/* Bento Hero Section */}
					<div className="grid grid-cols-12 gap-6">
						{/* Main Waveform Card */}
						<div className="col-span-12 lg:col-span-8 bg-surface-container-low rounded-xl p-8 relative overflow-hidden flex flex-col justify-between h-[400px] border border-outline-variant/5">
							<div className="relative z-10">
								<div className="flex justify-between items-start">
									<div>
										<span className="text-[10px] font-bold text-primary tracking-widest uppercase mb-1 block">Live Activity</span>
										<h2 className="text-3xl font-extrabold tracking-tight">Team Pulse Wave</h2>
									</div>
									<button onClick={onRefreshPulse} disabled={isRefreshing} className="flex items-center gap-2 bg-surface-container-lowest px-3 py-1.5 rounded-full shadow-sm hover:opacity-80 transition-opacity">
										<div className={`w-2 h-2 rounded-full bg-tertiary ${isRefreshing ? "animate-spin" : "animate-pulse"}`}></div>
										<span className="text-xs font-medium">{isRefreshing ? "Refreshing..." : "94 Active Now"}</span>
									</button>
								</div>
								{errorText ? (
									<p className="text-xs text-error mt-2">{errorText}</p>
								) : null}
							</div>

							{/* Waveform Visualization */}
							<div className="flex items-end justify-between h-48 gap-1 mb-8 opacity-80">
								{/* Simulated Waveform Bars */}
								{[12, 24, 16, 32, 20, 40, 28, 44, 16, 36, 48, 22, 30, 40, 24, 38, 20, 34, 44, 26, 40, 12, 32, 24, 48, 16, 36, 28, 44, 20].map((h, i) => (
									<div key={i} className={`waveform-bar ${i % 3 === 0 ? "bg-primary-fixed-dim" : i % 2 === 0 ? "bg-primary-container" : "bg-primary"}`} style={{ height: `${h * 2}px` }}></div>
								))}
							</div>

							<div className="flex justify-between items-center z-10">
								<div className="flex -space-x-2">
									<img className="w-8 h-8 rounded-full border-2 border-surface-container-low" alt="Worker 1" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD4k8NyFhNItsgE0bjWdnDTElT3CneLBFs1Ei6tpRszMl2HC3p9gwiW1hs5GgfE9jKJfyJuwlYX58nSwrKg5sX-2MVwczAE_ZetpU3zbhFC9Q4X5PY2W-AMP9i3v_PGtk5h61yNu4rP4qKx9ZqDKeIRqAtnmVAfg-mgvJILC4X63Xn4kwToUmEV2Yh6HMSqA4L6P1SrNYY6Ymp8m65HUdTqBofw4QDmRIfi1mY5kZJdcuXjZZSx51YbmBA65XhVB-g0S6rSrz2xQRzI" />
									<img className="w-8 h-8 rounded-full border-2 border-surface-container-low" alt="Worker 2" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBHgfsCvFEZlhqk7pIhy40453-Ox8dDLwcNsUWPnGLrpq34-cVkfigzL7vCrB8lqHBHCp3pEipDHSwzeK6oqiI4s_qy41_X3e6ge5VmioXouxzc-AdNz9lZxayc2S4VQkAODW27_6xzzidylM55sf__el8x4_VoyN0zmFqnzYR6fW0wvkIrKQAMHli8LxnaJfNBNfN2xh8NvktD_qGP1gHtojVKvBCnNHD0NV5-3jUmwutleZqNsPyjPTNClPP7QFvUq-XjDjASuGjj" />
									<img className="w-8 h-8 rounded-full border-2 border-surface-container-low" alt="Worker 3" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAGvMeWLqU2cTSpt-iibjHvdfSFooWuJOZdZ9eLSEYDEDx3_JfXOP10G0BnvH8WWcEs-XHyO2j5PBqlM4iBkCxD_MeKKdS2PUwOaZh00SCLu1wKt9bCy-LKfCGB2n9ciNErZ5z0rtey3ztPIdpOrmLDEHVTiUp4ZTL5s7uhyd9E8Ae6Uf2FO0DXjDSPx5FCFun5SRiP1mN27lpBaA0AzdnijFPtSXcIv7qdvKxLzlW-6GBRMXczn7oVn4EHpbxYRjQQXrHnw16zs5wc" />
									<div className="w-8 h-8 rounded-full border-2 border-surface-container-low bg-primary text-white flex items-center justify-center text-[10px] font-bold shadow-sm">+82</div>
								</div>
								<p className="text-sm text-on-surface-variant max-w-xs text-right">Activity is peaking in <b>#engineering</b> and <b>#product-sync</b>. Overall engagement is up 12%.</p>
							</div>
						</div>

						{/* Team Energy Score Card */}
						<div className="col-span-12 lg:col-span-4 bg-gradient-to-br from-primary to-primary-container rounded-xl p-8 text-on-primary shadow-lg flex flex-col justify-between h-[400px]">
							<div>
								<span className="text-[10px] font-bold text-primary-fixed tracking-widest uppercase mb-1 block">Velocity Metric</span>
								<h2 className="text-2xl font-bold tracking-tight">Team Energy</h2>
							</div>
							<div className="flex flex-col items-center">
								<div className="text-[100px] font-black leading-none tracking-tighter">88</div>
								<div className="text-xl font-medium text-primary-fixed/80">Vibrant</div>
							</div>
							<div className="space-y-4">
								<div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
									<div className="h-full bg-white w-[88%]"></div>
								</div>
								<div className="flex justify-between text-xs font-semibold opacity-90">
									<span>Muted</span>
									<span>Optimal</span>
									<span>Exhausted</span>
								</div>
							</div>
						</div>
					</div>

					{/* Lower Section: Sentiment & Trends */}
					<div className="grid grid-cols-12 gap-6">
						{/* Channel Sentiment List */}
						<div className="col-span-12 md:col-span-5 bg-surface-container-low rounded-xl p-6 border border-outline-variant/5">
							<div className="flex justify-between items-center mb-6">
								<h3 className="font-bold tracking-tight">Channel Sentiment</h3>
								<button className="p-1 rounded-md hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors">
									<span className="material-symbols-outlined text-on-surface-variant text-[20px]">filter_list</span>
								</button>
							</div>
							<div className="space-y-6">
								{channels.map((channel) => (
									<div key={channel.id || channel.name} className="space-y-2">
										<div className="flex justify-between text-sm">
											<span className="font-semibold">{channel.name || "-"}</span>
											<span className="text-on-surface-variant font-medium">{channel.energy}% {channel.label || "Positive"}</span>
										</div>
										<div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
											<div className="h-full bg-gradient-to-r from-tertiary-container to-secondary-container transition-all duration-500" style={{ width: `${channel.energy}%` }}></div>
										</div>
									</div>
								))}
							</div>
						</div>

						{/* 7-Day Trend Chart */}
						<div className="col-span-12 md:col-span-7 bg-surface-container-low rounded-xl p-6 flex flex-col border border-outline-variant/5">
							<div className="flex justify-between items-center mb-8">
								<div>
									<h3 className="font-bold tracking-tight">7-Day Sentiment Trend</h3>
									<p className="text-xs text-on-surface-variant">Overall happiness and collaboration health</p>
								</div>
								<div className="flex gap-2">
									<span className="text-xs font-bold text-primary bg-primary-fixed px-2 py-1 rounded-md line-clamp-1">+4.2%</span>
								</div>
							</div>
							<div className="flex-1 flex items-end justify-between px-4 pb-4 border-b border-outline-variant/20 relative h-48">
								{/* Simulated Trend Line Logic */}
								<div className="absolute inset-0 flex items-center justify-center">
									<div className="absolute bottom-[40%] left-[5%] w-[15%] border-t-2 border-primary rotate-[15deg]"></div>
									<div className="absolute bottom-[45%] left-[20%] w-[15%] border-t-2 border-primary -rotate-[20deg]"></div>
									<div className="absolute bottom-[35%] left-[35%] w-[15%] border-t-2 border-primary rotate-[30deg]"></div>
									<div className="absolute bottom-[55%] left-[50%] w-[15%] border-t-2 border-primary rotate-[10deg]"></div>
									<div className="absolute bottom-[60%] left-[65%] w-[15%] border-t-2 border-primary -rotate-[40deg]"></div>
									<div className="absolute bottom-[30%] left-[80%] w-[15%] border-t-2 border-primary rotate-[45deg]"></div>
								</div>
								{/* Day Labels */}
								{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(day => (
									<span key={day} className="text-[10px] font-bold text-on-surface-variant">{day}</span>
								))}
							</div>
							<div className="mt-6 flex gap-8">
								<div className="flex items-center gap-2">
									<div className="w-2 h-2 rounded-full bg-primary"></div>
									<span className="text-xs font-semibold">Peak Energy</span>
								</div>
								<div className="flex items-center gap-2 opacity-40">
									<div className="w-2 h-2 rounded-full bg-outline"></div>
									<span className="text-xs font-semibold">Baseline</span>
								</div>
							</div>
						</div>
					</div>

					{/* Focus Insight Bar */}
					<div className="bg-secondary-container/10 rounded-xl p-4 flex items-center gap-4 border border-secondary-container/20">
						<div className="p-2 bg-secondary-container rounded-lg shadow-sm">
							<span className="material-symbols-outlined text-white text-[20px]">lightbulb</span>
						</div>
						<div>
							<h4 className="text-sm font-bold flex gap-2 items-center">
								Insight: Deep Focus Period Detected
							</h4>
							<p className="text-xs text-on-surface-variant mt-0.5">
								The engineering team has been in "Concentration Mode" for 3 hours. Slack activity is low, but repository commits are up 40%.
							</p>
						</div>
						<button className="ml-auto text-xs font-bold text-secondary-container hover:underline underline-offset-4 px-4 transition-all">Acknowledge</button>
					</div>
				</div>
				
				{/* FAB */}
				<button onClick={onRefreshPulse} className="absolute bottom-8 right-8 w-14 h-14 bg-gradient-to-br from-primary to-primary-container rounded-full shadow-2xl flex items-center justify-center text-white hover:opacity-90 active:scale-95 transition-all z-50">
					<span className="material-symbols-outlined text-2xl">{isRefreshing ? "refresh" : "add"}</span>
				</button>

			</div>
		</div>
	);
}
