import React, { useState, useEffect } from "react";
import Icon from "../components/Icon";

export default function CallView({ activeChannel, onEndCall }) {
	const [micActive, setMicActive] = useState(true);
	const [videoActive, setVideoActive] = useState(false);
	const [deafened, setDeafened] = useState(false);
	const [callDuration, setCallDuration] = useState(0);

	useEffect(() => {
		const timer = setInterval(() => {
			setCallDuration((prev) => prev + 1);
		}, 1000);
		return () => clearInterval(timer);
	}, []);

	const formatDuration = (seconds) => {
		const m = Math.floor(seconds / 60).toString().padStart(2, "0");
		const s = (seconds % 60).toString().padStart(2, "0");
		return `${m}:${s}`;
	};

	return (
		<div className="h-full overflow-y-auto bg-surface p-8 w-full view-transition flex items-center justify-center">
			<div className="flex flex-col relative overflow-hidden bg-white/60 backdrop-blur-[12px] border border-outline-variant/20 shadow-sm w-full max-w-4xl min-h-[600px] font-body text-on-surface rounded-3xl">
				
				{/* Call Header */}
				<header className="h-[80px] flex items-center justify-between px-8 border-b border-black/5 bg-white/40">
					<div className="flex items-center gap-4">
						<div className="flex h-12 w-12 items-center justify-center bg-[#0f67b7]/10 text-[#0f67b7] rounded-2xl">
							<span className="material-symbols-outlined text-[24px]">Record_Voice_Over</span>
						</div>
						<div>
							<h2 className="font-bold text-[#1D1D1F] text-[20px] tracking-tight">
								{String(activeChannel || "General").replace(/^#/, "")} Voice Room
							</h2>
							<div className="flex items-center gap-2 mt-0.5">
								<span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
								<span className="text-[13px] font-medium text-[#596272]">
									{formatDuration(callDuration)} • Connected
								</span>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-4">
						<div className="flex -space-x-3 mr-4">
							{/* Placeholder avatars for call participants */}
							<div className="w-10 h-10 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center text-blue-700 font-bold z-30">US</div>
							<div className="w-10 h-10 rounded-full border-2 border-white bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold z-20">AK</div>
							<div className="w-10 h-10 rounded-full border-2 border-white bg-purple-100 flex items-center justify-center text-purple-700 font-bold z-10">MG</div>
							<div className="w-10 h-10 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xs">+2</div>
						</div>
						<button className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
							<span className="material-symbols-outlined text-[20px]">person_add</span>
						</button>
						<button className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
							<span className="material-symbols-outlined text-[20px]">more_vert</span>
						</button>
					</div>
				</header>

				{/* Main Call Area */}
				<div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#f8f9fa] relative">
					{/* Active Speaker */}
					<div className="relative">
						<div className={`w-32 h-32 rounded-full flex items-center justify-center text-3xl font-bold border-4 transition-all duration-300 shadow-xl ${micActive && !deafened ? 'border-[#0f67b7] bg-blue-100 text-[#0f67b7] shadow-blue-500/20' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
							US
						</div>
						{!micActive && (
							<div className="absolute bottom-0 right-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center border-[3px] border-[#f8f9fa] text-white">
								<span className="material-symbols-outlined text-[14px]">mic_off</span>
							</div>
						)}
						{micActive && !deafened && (
							<div className="absolute -inset-4 rounded-full border border-[#0f67b7]/30 animate-ping" style={{ animationDuration: '2s' }}></div>
						)}
					</div>
					<div className="mt-6 text-center">
						<h3 className="text-xl font-bold text-slate-800">You</h3>
						<p className="text-sm font-medium text-slate-500">{micActive ? 'Speaking...' : 'Muted'}</p>
					</div>
				</div>

				{/* Call Controls Footer */}
				<footer className="h-[90px] flex items-center justify-center gap-6 px-8 border-t border-black/5 bg-white/60">
					<button
						onClick={() => setMicActive(!micActive)}
						className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
							micActive 
								? "bg-slate-100 text-slate-700 hover:bg-slate-200" 
								: "bg-red-100 text-red-600 hover:bg-red-200"
						}`}
						title={micActive ? "Mute Microphone" : "Unmute Microphone"}
					>
						<span className="material-symbols-outlined text-[24px]">
							{micActive ? "mic" : "mic_off"}
						</span>
					</button>

					<button
						onClick={() => setVideoActive(!videoActive)}
						className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
							videoActive 
								? "bg-[#0f67b7]/10 text-[#0f67b7] hover:bg-[#0f67b7]/20" 
								: "bg-slate-100 text-slate-700 hover:bg-slate-200"
						}`}
						title={videoActive ? "Turn Off Camera" : "Turn On Camera"}
					>
						<span className="material-symbols-outlined text-[24px]">
							{videoActive ? "videocam" : "videocam_off"}
						</span>
					</button>

					<button
						onClick={() => setDeafened(!deafened)}
						className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
							deafened 
								? "bg-amber-100 text-amber-600 hover:bg-amber-200" 
								: "bg-slate-100 text-slate-700 hover:bg-slate-200"
						}`}
						title={deafened ? "Undeafen" : "Deafen"}
					>
						<span className="material-symbols-outlined text-[24px]">
							{deafened ? "hearing_disabled" : "hearing"}
						</span>
					</button>

					<div className="w-px h-8 bg-black/10 mx-2"></div>

					<button
						onClick={onEndCall}
						className="px-8 h-14 rounded-full flex items-center justify-center gap-2 bg-red-600 text-white font-bold hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/20 transition-all font-body tracking-wide"
					>
						<span className="material-symbols-outlined text-[22px]">call_end</span>
						Leave Call
					</button>
				</footer>
			</div>
		</div>
	);
}
