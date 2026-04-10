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
		<div className="chat-page view-transition">
			{/* Shared Header Style like ChatView */}
			<header className="chat-room-header">
				<div className="chat-room-title">
					<span className="chat-room-hash" aria-hidden="true">
						<span className="material-symbols-outlined text-[18px]" style={{fontSize: "18px"}}>eco</span>
					</span>
					<h3>Carbon Footprint</h3>
					<button className="chat-room-star" type="button" aria-label="Star page">
						<span className="material-symbols-outlined text-[14px]" style={{fontSize: "14px"}}>star</span>
					</button>
				</div>
				<div className="chat-room-actions">
					<div className="chat-room-presence" aria-hidden="true">
						<span className="presence-count" style={{color: "var(--color-primary-base)"}}>Track your team's impact</span>
					</div>
					<button className="chat-room-btn chat-help-btn" type="button" aria-label="Help">
						<span className="material-symbols-outlined text-[16px]" style={{fontSize: "16px"}}>help</span>
					</button>
				</div>
			</header>

			{/* Main Scrollable Area using chat-thread-scroll layout wrapper */}
			<div className="chat-thread-scroll" style={{ backgroundColor: "var(--color-surface)", padding: "var(--spacing-6) var(--spacing-4)" }}>
				<div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row gap-8 pb-8">
					{/* Left Content Column */}
					<div className="flex-1 flex flex-col gap-8 w-full md:w-2/3">
						
						{/* Daily Impact Card */}
						<section className="bg-white dark:bg-slate-900 border border-[#e2e2e2] dark:border-slate-800 rounded-[20px] p-8 flex flex-col sm:flex-row items-center gap-8 md:gap-12 relative overflow-hidden" style={{boxShadow: "0 2px 8px rgba(0,0,0,0.04)"}}>
							<div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#a3c9ff]/20 to-transparent -mr-32 -mt-32 rounded-full blur-3xl"></div>
							
							{/* Animated Progress Ring Container */}
							<div className="relative w-[200px] h-[200px] md:w-64 md:h-64 flex items-center justify-center shrink-0">
								<svg className="w-full h-full transform -rotate-90">
									<circle className="text-[#eeeeee] dark:text-slate-800" cx="128" cy="128" fill="transparent" r="110" stroke="currentColor" strokeWidth="12" style={{transformOrigin: "center", transform: "scale(0.85)"}}></circle>
									<circle className="text-[#1160a4] transition-all duration-1000 ease-out" cx="128" cy="128" fill="transparent" r="110" stroke="currentColor" strokeDasharray="691" strokeDashoffset="150" strokeLinecap="round" strokeWidth="12" style={{transformOrigin: "center", transform: "scale(0.85)"}}></circle>
								</svg>
								<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
									<span className="text-3xl md:text-4xl font-extrabold text-[#1a1c1c] dark:text-white tracking-tight">1.2<span className="text-lg md:text-lg font-medium text-[#404752] dark:text-slate-400">kg</span></span>
									<span className="text-xs md:text-sm font-semibold uppercase tracking-widest text-[#1160a4] mt-1">Low Impact</span>
									<div className="mt-3 flex items-center justify-center gap-1 bg-[#1160a4]/10 text-[#1160a4] px-3 py-1 rounded-full text-[10px] font-bold">
										<span className="material-symbols-outlined text-[12px]" style={{fontSize: "12px"}}>trending_down</span>
										<span>12% vs Yesterday</span>
									</div>
								</div>
							</div>
							
							<div className="flex-1 flex flex-col gap-6 z-10 w-full">
								<div>
									<h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[#1a1c1c] dark:text-white">Daily Carbon Score</h2>
									<p className="text-[#404752] dark:text-slate-400 mt-2 max-w-sm leading-relaxed text-sm">Your footprint today is equivalent to powering a laptop for 24 hours. Great job maintaining a low impact profile!</p>
								</div>
								
								{/* Sentiment Bar */}
								<div className="flex flex-col gap-2">
									<div className="flex justify-between text-[11px] font-bold text-[#404752] dark:text-slate-400 uppercase tracking-widest">
										<span>Eco Focus</span>
										<span>Neutral</span>
										<span>Heavy</span>
									</div>
									<div className="h-2 w-full bg-[#eeeeee] dark:bg-slate-800 rounded-full overflow-hidden relative">
										<div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-[#1160a4] to-[#005faa] rounded-full"></div>
									</div>
								</div>
								
								<div className="flex flex-wrap gap-3">
									<button className="chat-send-btn flex items-center justify-center gap-2 px-5 py-2.5 shadow-sm text-white" style={{ backgroundColor: "#0061a3"}}>
										<span className="material-symbols-outlined text-[16px] text-white" style={{fontSize: "16px"}}>auto_awesome</span>
										Analyze Details
									</button>
									<button className="bg-[#f3f3f3] dark:bg-slate-800 text-[#1a1c1c] dark:text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#e2e2e2] dark:hover:bg-slate-700 transition-colors">
										History
									</button>
								</div>
							</div>
						</section>
						
						{/* Badges Shelf */}
						<section className="flex flex-col gap-4">
							<div className="flex justify-between items-center px-1">
								<h3 className="text-[15px] font-bold text-[#1a1c1c] dark:text-white">Environmental Achievements</h3>
								<button className="text-[#005faa] text-xs font-bold flex items-center hover:underline">
									View All <span className="material-symbols-outlined text-[14px]" style={{fontSize: "14px"}}>chevron_right</span>
								</button>
							</div>
							<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
								<div className="bg-white dark:bg-slate-900 border border-[#e2e2e2] dark:border-slate-800 p-5 rounded-[16px] flex flex-col items-center text-center hover:-translate-y-1 transition-transform cursor-pointer" style={{boxShadow: "0 2px 6px rgba(0,0,0,0.02)"}}>
									<div className="w-12 h-12 rounded-xl bg-[#1160a4]/10 flex items-center justify-center text-[#1160a4] mb-3">
										<span className="material-symbols-outlined text-[24px]" style={{fontSize: "24px"}}>pedal_bike</span>
									</div>
									<p className="text-[13px] font-bold text-[#1a1c1c] dark:text-white">Biker 100km</p>
									<p className="text-[10px] text-[#404752] dark:text-slate-400 font-medium mt-0.5">Unlocked May 12</p>
								</div>
								
								<div className="bg-white dark:bg-slate-900 border border-[#e2e2e2] dark:border-slate-800 p-5 rounded-[16px] flex flex-col items-center text-center hover:-translate-y-1 transition-transform cursor-pointer" style={{boxShadow: "0 2px 6px rgba(0,0,0,0.02)"}}>
									<div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 mb-3">
										<span className="material-symbols-outlined text-[24px]" style={{fontSize: "24px"}}>forest</span>
									</div>
									<p className="text-[13px] font-bold text-[#1a1c1c] dark:text-white">Forest Guardian</p>
									<p className="text-[10px] text-[#404752] dark:text-slate-400 font-medium mt-0.5">Tier 3 Contributor</p>
								</div>
								
								<div className="bg-white dark:bg-slate-900 border border-[#e2e2e2] dark:border-slate-800 p-5 rounded-[16px] flex flex-col items-center text-center hover:-translate-y-1 transition-transform cursor-pointer" style={{boxShadow: "0 2px 6px rgba(0,0,0,0.02)"}}>
									<div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 mb-3">
										<span className="material-symbols-outlined text-[24px]" style={{fontSize: "24px"}}>commute</span>
									</div>
									<p className="text-[13px] font-bold text-[#1a1c1c] dark:text-white">Transit Pro</p>
									<p className="text-[10px] text-[#404752] dark:text-slate-400 font-medium mt-0.5">30 Day Streak</p>
								</div>
								
								<div className="bg-[#f9f9f9] dark:bg-slate-800/50 border border-dashed border-[#c0c7d4] dark:border-slate-700 rounded-[16px] flex flex-col items-center justify-center text-center p-5 opacity-70">
									<div className="w-12 h-12 rounded-xl bg-[#e2e2e2] dark:bg-slate-700 flex items-center justify-center text-[#404752] dark:text-slate-400 mb-3">
										<span className="material-symbols-outlined text-[24px]" style={{fontSize: "24px"}}>lock</span>
									</div>
									<p className="text-[13px] font-bold text-[#1a1c1c] dark:text-white">???</p>
									<p className="text-[10px] text-[#404752] dark:text-slate-400 font-medium mt-0.5">5 Challenges Left</p>
								</div>
							</div>
						</section>
					</div>
					
					{/* Right Column: Leaderboard */}
					<aside className="w-full md:w-1/3 flex flex-col h-full shrink-0 min-w-[300px]">
						<div className="bg-white dark:bg-slate-900 border border-[#e2e2e2] dark:border-slate-800 rounded-[20px] p-6 flex flex-col h-full flex-grow" style={{boxShadow: "0 2px 8px rgba(0,0,0,0.04)"}}>
							<div className="flex items-center justify-between mb-5">
								<h3 className="text-[15px] font-bold text-[#1a1c1c] dark:text-white">Team Leaderboard</h3>
								<span className="bg-[#005faa]/10 text-[#005faa] text-[10px] font-bold px-2.5 py-1 rounded-md">Weekly</span>
							</div>
							
							<div className="flex flex-col gap-2 flex-1">
								{topUsers.map((user, index) => (
									<div key={user.id} className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors cursor-pointer ${user.isMe ? 'bg-[#005faa]/5 border border-[#005faa]/10' : 'hover:bg-[#f3f3f3] dark:hover:bg-slate-800 border border-transparent'}`}>
										<span className={`text-xs font-black w-4 text-center ${user.isMe ? 'text-[#005faa]' : 'text-[#717783] dark:text-slate-500'}`}>{index + 1}</span>
										<div className="relative">
											{user.avatar ? (
												<img alt={user.name} src={user.avatar} className="w-10 h-10 rounded-full object-cover" />
											) : (
												<div className="w-10 h-10 rounded-full bg-[#e2e2e2] dark:bg-slate-800 flex items-center justify-center">
													<span className="text-xs font-bold text-[#1a1c1c] dark:text-white">{user.name.charAt(0)}</span>
												</div>
											)}
											{index === 0 && (
												<div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
													<span className="material-symbols-outlined text-[8px] text-white" style={{fontSize: "8px", fontVariationSettings: "'FILL' 1"}}>workspace_premium</span>
												</div>
											)}
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-[13px] font-bold text-[#1a1c1c] dark:text-white truncate">{user.name} {user.isMe && '(You)'}</p>
											<p className="text-[10px] text-[#717783] dark:text-slate-500 mt-0.5">{user.avg} CO2 avg</p>
										</div>
										<div className="text-right pl-2">
											<p className={`text-[12px] font-black ${index === 0 ? 'text-[#1160a4]' : user.isMe ? 'text-[#005faa]' : 'text-[#404752] dark:text-slate-300'}`}>{user.score} pts</p>
										</div>
									</div>
								))}
							</div>
							
							<div className="mt-6 p-5 bg-[#1160a4] text-white rounded-xl text-center">
								<p className="text-[11px] font-medium opacity-90">Goal: 10,000kg Offset</p>
								<div className="h-1.5 w-full bg-white/20 rounded-full mt-2.5 overflow-hidden">
									<div className="h-full bg-white w-3/4 rounded-full"></div>
								</div>
								<p className="text-[10px] font-bold mt-2">7,542kg reached (75%)</p>
							</div>
						</div>
					</aside>
				</div>
			</div>

			{/* Docked Action Footer mimicking chat composer dock */}
			<footer className="chat-composer-dock flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-slate-900 border-t border-[#e2e2e2] dark:border-slate-800 p-4">
				
				{/* Sentinel / Info Area (matching Sentiment row width semantics) */}
				<div className="chat-sentiment-row md:w-auto w-full justify-between md:justify-start" style={{flexShrink: 0, marginRight: 'auto'}}>
					<span className="font-bold text-[11px] uppercase tracking-widest text-[#404752] dark:text-slate-400 md:ml-4">Quick Log Transport</span>
				</div>

				{/* Quick Log Action Buttons Array (matching composer box UI) */}
				<div className="chat-composer-box flex-1 min-w-[200px] max-w-full md:max-w-max bg-[#f3f3f3] dark:bg-slate-800 border-none p-1.5 justify-between">
					<div className="chat-composer-tools w-full">
						
						{/* Transport Actions */}
						<div className="chat-tool-group gap-2">
							<button 
								disabled={isSubmitting}
								onClick={() => onLogAction?.({ transportType: 'walk', kgCo2: 0, note: "Logged walking commute" })}
								className="chat-tool-translate flex items-center gap-1.5 px-3 py-1.5 min-w-max hover:bg-[#1160a4]/10 hover:text-[#1160a4] text-[#404752] transition-colors rounded-lg border-none" 
								type="button"
							>
								<span className="material-symbols-outlined text-[16px]" style={{fontSize: "16px"}}>directions_walk</span>
								<span className="text-[11px] font-bold max-md:hidden">Walk</span>
							</button>
							<button 
								disabled={isSubmitting}
								onClick={() => onLogAction?.({ transportType: 'bike', kgCo2: 0, note: "Logged biking commute" })}
								className="chat-tool-translate flex items-center gap-1.5 px-3 py-1.5 min-w-max hover:bg-[#1160a4]/10 hover:text-[#1160a4] text-[#404752] transition-colors rounded-lg border-none" 
								type="button"
							>
								<span className="material-symbols-outlined text-[16px]" style={{fontSize: "16px"}}>pedal_bike</span>
								<span className="text-[11px] font-bold max-md:hidden">Bike</span>
							</button>
							<button 
								disabled={isSubmitting}
								onClick={() => onLogAction?.({ transportType: 'bus', kgCo2: 0.5, note: "Logged bus commute" })}
								className="chat-tool-translate flex items-center gap-1.5 px-3 py-1.5 min-w-max hover:bg-[#1160a4]/10 hover:text-[#1160a4] text-[#404752] transition-colors rounded-lg border-none" 
								type="button"
							>
								<span className="material-symbols-outlined text-[16px]" style={{fontSize: "16px"}}>directions_bus</span>
								<span className="text-[11px] font-bold max-md:hidden">Bus</span>
							</button>
							<button 
								disabled={isSubmitting}
								onClick={() => onLogAction?.({ transportType: 'train', kgCo2: 0.3, note: "Logged train commute" })}
								className="chat-tool-translate flex items-center gap-1.5 px-3 py-1.5 min-w-max hover:bg-[#1160a4]/10 hover:text-[#1160a4] text-[#404752] transition-colors rounded-lg border-none" 
								type="button"
							>
								<span className="material-symbols-outlined text-[16px]" style={{fontSize: "16px"}}>train</span>
								<span className="text-[11px] font-bold max-md:hidden">Train</span>
							</button>
						</div>

						{/* Send Action */}
						<button className="chat-send-btn pl-4" type="button" style={{minWidth: '100px', backgroundColor: '#0061a3', color: '#fff'}}>
							<span className="max-md:hidden font-bold pr-1">Add Custom</span>
							<span className="material-symbols-outlined text-[16px] text-white" style={{fontSize: "16px"}}>add</span>
						</button>
					</div>
				</div>
			</footer>
		</div>
	);
}
