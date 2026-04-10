import React from "react";

export default function CarbonView({
	leaderboard = [],
	currentUserId,
	onLogAction,
	isSubmitting,
	errorText
}) {
	// Fallback leaderboard data if empty
	const topUsers = leaderboard.length > 0 ? leaderboard : [
		{ id: "1", name: "Marcus Chen", score: 980, avg: "0.8kg", avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDbToWXTJtpLAu6OLo0gisg1VaLHAUN7GmHCRxb5HD9d_2Wkbo_5TubIliJIL6KlckguOalSFV3RMhcrFMbmPggGIZ8pgT7Rnyfupr24h6XXJVwDTgHXWEmO94QVGkAmkpmWZkxZsipH4M1BhtSTPj_Ng0jdXA_Lj7fqCJvPMaxqrPMGshMqmBxCTaz2Hn9FohXrvO6rphJWCMop3T8ripQR01MWL-eC2cNRDyqhAFumZsmdjkIjgJDYp-fEPvvBYCYl0TyZY_mcbnN", isMe: false },
		{ id: "2", name: "Alex Rivera", score: 845, avg: "1.2kg", avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCjWDvIzVLkqHgTAdsOQaXIY1-WRuPFbLy3EHGzYGK4xJa8LvaH4qQY8ui7wGlU8Kw0NJox87YskH_-NrfkOvTxs3NzrE8OSqJBFtEFEqTwmgZw62DkB3lf6qWViIoZM3DAS-A0U2LCA3p3ynn1rDjB2dA4g8xL2iVESaY0MNGVkwCueiRYqGXnBYC6jg1uuD3w3q93GoCEFj2qKZTsvdrQZw2Bz5sabL9S9IyZiGgEdXmq6BDIYwkZA4jX22b1DwxFp-7bY_RErFcs", isMe: true },
		{ id: "3", name: "Jordan Smith", score: 720, avg: "1.5kg", avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDywbLAw_cvjxu2AsAQBMqu2LkM71uMpZYDw_98tytHx1rZRMGLa5xXcBwhP8jwEpDlIk66ORU2JXLmdqbcfG2K7UKltsnVKbn4WCMDHoBgr84RPtmw1aHPcUfkpJ-GyaXk1Jf0AyZZw-D1zPpyYbv7NzR809y2dE8ba2K5hZsUre1rwskG-EEqQmLVUMvisSnrnOjtqBpXNR_RQYl2YUqZAymppCC0RS9l-R1MJ5qR5D7QooYXqDywhfMW04Mpidq62fNpSICLlCFB", isMe: false },
		{ id: "4", name: "Elena Gomez", score: 610, avg: "1.9kg", avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuAmYjLYVz1qoKczOARWyQPrD2DJsfWkGHQ9wKF1PvleEsFqyFE3HUx7_H6Skd5_Uxwc7L3Tgy_VUow_r8t_aWZRdzwCFd2yT2eWE805F0d0bJQSUUO41_aPavrWtpN0t9Tl9RR7BNEGecdYP0pYDxtgfMBBGdhTxrgu_QRXImlHJgFqMmpxy4nOe7KlPUhqHOEJsZ0O44ZiKwy_xEGAroNW0Lz4rIBLg_UeaRoQq72J2yspX_PvRBEIk3lF1--H3OhrTxUIRnX3QHo3", isMe: false }
	];

	return (
		<div className="flex-1 flex flex-col h-full w-full bg-surface font-body text-on-surface antialiased selection:bg-primary-fixed relative">
			{/* TopNavBar */}
			<header className="w-full top-0 sticky bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-xl shadow-sm z-40 flex justify-between items-center px-6 h-12 font-['Segoe_UI_Variable',sans-serif] text-sm antialiased">
				<div className="flex items-center gap-8">
					<span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Spann</span>
					<div className="flex items-center bg-slate-200/30 px-3 py-1 rounded-full gap-2">
						<span className="material-symbols-outlined text-xs" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>search</span>
						<input className="bg-transparent border-none focus:ring-0 text-xs w-48 outline-none" placeholder="Search workspace..." type="text" />
					</div>
				</div>
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-6 px-4">
						<span className="text-blue-600 dark:text-blue-400 font-medium border-b-2 border-blue-600 cursor-pointer h-12 flex items-center">Insights</span>
						<span className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer h-12 flex items-center">Community</span>
						<span className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer h-12 flex items-center">Market</span>
					</div>
					<div className="flex items-center gap-2">
						<button className="p-1.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors active:scale-95 duration-150">
							<span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>settings</span>
						</button>
						<button className="p-1.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors active:scale-95 duration-150">
							<span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>help</span>
						</button>
						<button className="p-1.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors active:scale-95 duration-150">
							<span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>account_circle</span>
						</button>
					</div>
				</div>
			</header>

			<div className="p-8 pb-12 max-w-[80rem] mx-auto w-full grid grid-cols-12 gap-8">
				{/* Bento Grid Layout */}
				{/* Main Impact Ring Section */}
				<div className="col-span-12 lg:col-span-8 space-y-8">
					<section className="bg-white/60 backdrop-blur-[12px] border border-outline-variant/20 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-12 relative overflow-hidden shadow-sm">
						<div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-tertiary/10 to-transparent -mr-32 -mt-32 rounded-full blur-3xl"></div>
						
						{/* Animated Progress Ring Container */}
						<div className="relative w-64 h-64 flex items-center justify-center">
							<svg className="w-full h-full transform -rotate-90">
								<circle className="text-surface-container-high" cx="128" cy="128" fill="transparent" r="110" stroke="currentColor" strokeWidth="12"></circle>
								<circle className="text-tertiary transition-all duration-1000 ease-out" cx="128" cy="128" fill="transparent" r="110" stroke="currentColor" strokeDasharray="691" strokeDashoffset="150" strokeLinecap="round" strokeWidth="12"></circle>
							</svg>
							<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
								<span className="text-4xl font-extrabold text-on-surface tracking-tight">1.2<span className="text-lg font-medium text-on-surface-variant">kg</span></span>
								<span className="text-sm font-semibold uppercase tracking-widest text-tertiary mt-1">Low Impact</span>
								<div className="mt-4 flex items-center gap-1 bg-tertiary/10 text-tertiary px-3 py-1 rounded-full text-[10px] font-bold">
									<span className="material-symbols-outlined text-xs" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>trending_down</span>
									12% vs Yesterday
								</div>
							</div>
						</div>
						
						<div className="flex-1 space-y-6">
							<div>
								<h2 className="text-3xl font-bold tracking-tight text-on-surface">Daily Carbon Score</h2>
								<p className="text-on-surface-variant mt-2 max-w-md leading-relaxed">Your footprint today is equivalent to powering a laptop for 24 hours. Great job maintaining a low impact profile!</p>
							</div>
							
							{/* Sentiment Bar */}
							<div className="space-y-2">
								<div className="flex justify-between text-xs font-bold text-on-surface-variant uppercase tracking-wider">
									<span>Eco Focus</span>
									<span>Neutral</span>
									<span>Heavy Output</span>
								</div>
								<div className="h-3 w-full bg-surface-container-high rounded-full overflow-hidden relative">
									<div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-tertiary to-primary rounded-full shadow-lg shadow-tertiary/20"></div>
								</div>
							</div>
							
							<div className="flex gap-4">
								<button className="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3 rounded-xl font-bold text-sm shadow-xl shadow-primary/20 flex items-center gap-2 hover:opacity-90 transition-opacity">
									<span className="material-symbols-outlined text-sm" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>auto_awesome</span>
									Analyze Details
								</button>
								<button className="bg-surface-container-highest text-on-surface px-6 py-3 rounded-xl font-bold text-sm hover:bg-surface-container-high transition-colors">
									History
								</button>
							</div>
						</div>
					</section>

					{/* Badges Shelf */}
					<section className="space-y-4">
						<div className="flex justify-between items-center px-2">
							<h3 className="text-lg font-bold text-on-surface">Environmental Achievements</h3>
							<button className="text-primary text-xs font-bold flex items-center gap-1 hover:underline">View All <span className="material-symbols-outlined text-xs" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>chevron_right</span></button>
						</div>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<div className="bg-white/60 backdrop-blur-[12px] border border-outline-variant/20 p-6 rounded-3xl flex flex-col items-center text-center group hover:scale-[1.02] transition-transform shadow-sm">
								<div className="w-16 h-16 rounded-2xl bg-tertiary/10 flex items-center justify-center text-tertiary mb-4 group-hover:bg-tertiary group-hover:text-white transition-colors">
									<span className="material-symbols-outlined text-3xl" style={{fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>pedal_bike</span>
								</div>
								<p className="text-sm font-bold">Biker 100km</p>
								<p className="text-[10px] text-on-surface-variant font-medium mt-1">Unlocked May 12</p>
							</div>
							<div className="bg-white/60 backdrop-blur-[12px] border border-outline-variant/20 p-6 rounded-3xl flex flex-col items-center text-center group hover:scale-[1.02] transition-transform shadow-sm">
								<div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 mb-4 group-hover:bg-amber-600 group-hover:text-white transition-colors">
									<span className="material-symbols-outlined text-3xl" style={{fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>forest</span>
								</div>
								<p className="text-sm font-bold">Forest Guardian</p>
								<p className="text-[10px] text-on-surface-variant font-medium mt-1">Tier 3 Contributor</p>
							</div>
							<div className="bg-white/60 backdrop-blur-[12px] border border-outline-variant/20 p-6 rounded-3xl flex flex-col items-center text-center group hover:scale-[1.02] transition-transform shadow-sm">
								<div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
									<span className="material-symbols-outlined text-3xl" style={{fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>commute</span>
								</div>
								<p className="text-sm font-bold">Transit Pro</p>
								<p className="text-[10px] text-on-surface-variant font-medium mt-1">30 Day Streak</p>
							</div>
							<div className="bg-surface-container-low border border-dashed border-outline-variant rounded-3xl flex flex-col items-center justify-center text-center p-6 opacity-60">
								<div className="w-16 h-16 rounded-2xl bg-surface-variant flex items-center justify-center text-on-surface-variant mb-4">
									<span className="material-symbols-outlined text-3xl" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>lock</span>
								</div>
								<p className="text-sm font-bold">???</p>
								<p className="text-[10px] text-on-surface-variant font-medium mt-1">5 Challenges Left</p>
							</div>
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
							{topUsers.map((user, index) => (
								<div key={user.id} className={`flex items-center gap-4 p-3 rounded-2xl transition-colors cursor-pointer ${user.isMe ? 'bg-primary/5 border border-primary/10' : 'hover:bg-surface-container-low'}`}>
									<span className={`text-sm font-black w-4 ${user.isMe ? 'text-primary' : 'text-on-surface-variant'}`}>{index + 1}</span>
									<div className="relative">
										{user.avatar ? (
											<img alt="User" src={user.avatar} className="w-10 h-10 rounded-xl object-cover" />
										) : (
											<div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center">
												<span className="text-xs font-bold">{user.name.charAt(0)}</span>
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
							<p className="text-xs font-medium opacity-90">Company Goal: 10,000kg Offset</p>
							<div className="h-1.5 w-full bg-white/20 rounded-full mt-2 overflow-hidden">
								<div className="h-full bg-white w-3/4 rounded-full"></div>
							</div>
							<p className="text-[10px] font-bold mt-2">7,542kg reached (75%)</p>
						</div>
					</div>
				</aside>
			</div>

			{/* Bottom Quick-Log Buttons */}
			<div className="sticky bottom-8 w-full z-50 pointer-events-none flex justify-center pb-0 mt-auto px-8">
				<div className="bg-white/80 backdrop-blur-xl border border-slate-200/50 rounded-[40px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] p-2 flex items-center justify-between w-full max-w-[840px] overflow-hidden pointer-events-auto">
					<div className="px-6">
						<p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Quick Log Transport</p>
					</div>
					<div className="flex items-center gap-1">
						<button 
							disabled={isSubmitting}
							onClick={() => onLogAction?.({ transportType: 'walk', kgCo2: 0, note: "Logged walking commute" })}
							className="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-tertiary/10 text-tertiary hover:bg-tertiary hover:text-white transition-all active:scale-95 border-none"
						>
							<span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>directions_walk</span>
							<span className="text-[9px] font-bold mt-0.5">Walk</span>
						</button>
						<button 
							disabled={isSubmitting}
							onClick={() => onLogAction?.({ transportType: 'bike', kgCo2: 0, note: "Logged biking commute" })}
							className="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-tertiary/10 text-tertiary hover:bg-tertiary hover:text-white transition-all active:scale-95 border-none"
						>
							<span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>pedal_bike</span>
							<span className="text-[9px] font-bold mt-0.5">Bike</span>
						</button>
						<button 
							disabled={isSubmitting}
							onClick={() => onLogAction?.({ transportType: 'bus', kgCo2: 0.5, note: "Logged bus commute" })}
							className="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all active:scale-95 border-none"
						>
							<span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>directions_bus</span>
							<span className="text-[9px] font-bold mt-0.5">Bus</span>
						</button>
						<button 
							disabled={isSubmitting}
							onClick={() => onLogAction?.({ transportType: 'train', kgCo2: 0.3, note: "Logged train commute" })}
							className="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all active:scale-95 border-none"
						>
							<span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>train</span>
							<span className="text-[9px] font-bold mt-0.5">Train</span>
						</button>
						<div className="w-px h-8 bg-slate-200 mx-2"></div>
						<button className="w-14 h-14 rounded-full bg-surface-container-highest text-on-surface flex items-center justify-center hover:bg-surface-container-high transition-colors border-none">
							<span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24"}}>add</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
