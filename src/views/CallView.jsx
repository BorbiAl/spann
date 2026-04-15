import React, { useState, useEffect } from "react";

export default function CallView({ activeChannel, participants = [], onEndCall }) {
	const [micActive, setMicActive] = useState(true);
	const [videoActive, setVideoActive] = useState(false);
	const [deafened, setDeafened] = useState(false);
	const [callDuration, setCallDuration] = useState(0);
	const [statusNote, setStatusNote] = useState("");
	const [showOptions, setShowOptions] = useState(false);

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

	const normalizedParticipants = Array.isArray(participants)
		? participants.map((member, index) => {
			const label = String(member?.display_name || member?.email || `Member ${index + 1}`);
			const initials = label
				.split(/\s+/)
				.filter(Boolean)
				.slice(0, 2)
				.map((word) => word[0])
				.join("")
				.toUpperCase() || "ME";
			return {
				id: String(member?.user_id || member?.id || `${label}-${index}`),
				label,
				avatarUrl: String(member?.avatar_url || "").trim(),
				online: Boolean(member?.is_online),
				isMe: Boolean(member?.is_me),
				initials,
			};
		})
		: [];

	const callTiles = normalizedParticipants.length
		? normalizedParticipants
		: [{ id: "you", label: "You", avatarUrl: "", online: true, isMe: true, initials: "YO" }];

	const shownParticipants = normalizedParticipants.filter((member) => member.online).slice(0, 4);
	const extraParticipants = Math.max(0, normalizedParticipants.filter((member) => member.online).length - shownParticipants.length);

	function showTemporaryNote(message) {
		setStatusNote(String(message || ""));
		setTimeout(() => setStatusNote(""), 2200);
	}

	async function handleInviteParticipant() {
		const channelLabel = String(activeChannel || "general").replace(/^#/, "");
		const inviteLink = `${window.location.origin}${window.location.pathname}?channel=${encodeURIComponent(channelLabel)}`;
		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(inviteLink);
				showTemporaryNote("Invite link copied to clipboard.");
				return;
			}
		} catch {
			// Fall back to prompt when clipboard access is blocked.
		}

		window.prompt("Copy this invite link", inviteLink);
		showTemporaryNote("Invite link ready.");
	}

	function handleMoreOptions() {
		setShowOptions((current) => !current);
	}

	return (
		<div className="h-full overflow-y-auto bg-surface p-6 w-full view-transition flex items-center justify-center">
			<div className="flex flex-col relative overflow-hidden bg-background/90 backdrop-blur-[12px] border border-outline-variant/20 shadow-sm w-full max-w-4xl min-h-[620px] font-body text-on-surface rounded-3xl">
				<div className="discord-call-atmosphere" aria-hidden="true" />
				{statusNote ? (
					<div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 rounded-full bg-inverse-surface/90 px-3 py-1 text-xs text-inverse-on-surface">
						{statusNote}
					</div>
				) : null}
				{showOptions ? (
					<div className="absolute top-16 right-8 z-30 min-w-[220px] rounded-xl border border-outline-variant/20 bg-surface/95 p-2 shadow-xl">
						<button type="button" onClick={() => { setMicActive((current) => !current); setShowOptions(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-container-high">
							{micActive ? "Mute microphone" : "Unmute microphone"}
						</button>
						<button type="button" onClick={() => { setVideoActive((current) => !current); setShowOptions(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-container-high">
							{videoActive ? "Turn camera off" : "Turn camera on"}
						</button>
						<button type="button" onClick={() => { setDeafened((current) => !current); setShowOptions(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-container-high">
							{deafened ? "Undeafen" : "Deafen"}
						</button>
						<button type="button" onClick={() => { setShowOptions(false); onEndCall?.(); }} className="w-full rounded-lg px-3 py-2 text-left text-sm text-error hover:bg-error-container">
							Leave call
						</button>
					</div>
				) : null}
				
				{/* Call Header */}
				<header className="min-h-[88px] flex items-center justify-between px-7 py-3 border-b border-outline-variant/20 bg-surface/70 gap-4">
					<div className="flex items-center gap-3.5">
						<div className="discord-call-badge-wrap">
							<span className="discord-call-ring ring-a" aria-hidden="true" />
							<span className="discord-call-ring ring-b" aria-hidden="true" />
							<div className="discord-call-badge flex h-12 w-12 items-center justify-center bg-primary/10 text-primary rounded-2xl">
								<span className="material-symbols-outlined text-[24px]">Record_Voice_Over</span>
							</div>
						</div>
						<div>
							<h2 className="font-bold text-on-surface text-[20px] tracking-tight">
								{String(activeChannel || "General").replace(/^#/, "")} Voice Room
							</h2>
							<div className="flex items-center gap-2 mt-0.5">
								<span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
								<span className="text-[13px] font-medium text-on-surface-variant">
									{formatDuration(callDuration)} • Connected
								</span>
								<div className="discord-voice-bars" aria-hidden="true">
									<span />
									<span />
									<span />
								</div>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-3">
						<div className="flex -space-x-2.5 mr-2">
							{shownParticipants.map((member, index) => {
								const label = String(member?.label || "Member");
								const initials = String(member?.initials || "ME");
								const zClass = index === 0 ? "z-30" : index === 1 ? "z-20" : "z-10";
								if (member?.avatarUrl) {
									return (
										<img
											key={String(member?.user_id || label)}
											className={`w-10 h-10 rounded-full border-2 border-surface object-cover ${zClass}`}
											src={member.avatarUrl}
											alt={`${label} avatar`}
										/>
									);
								}
								return (
									<div key={String(member?.id || label)} className={`w-10 h-10 rounded-full border-2 border-surface bg-surface-container-high flex items-center justify-center text-primary font-bold ${zClass}`}>
										{initials}
									</div>
								);
							})}
							{extraParticipants > 0 ? (
								<div className="w-10 h-10 rounded-full border-2 border-surface bg-surface-container-high flex items-center justify-center text-on-surface-variant font-bold text-xs">+{extraParticipants}</div>
							) : null}
						</div>
						<button onClick={handleInviteParticipant} className="p-2 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-colors" type="button" aria-label="Invite participant">
							<span className="material-symbols-outlined text-[20px]">person_add</span>
						</button>
						<button onClick={handleMoreOptions} className="p-2 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-colors" type="button" aria-label="Call options">
							<span className="material-symbols-outlined text-[20px]">more_vert</span>
						</button>
					</div>
				</header>

				{/* Main Call Area */}
				<div className="flex-1 flex flex-col p-6 bg-surface-container-low relative">
					<div className="mb-4 flex items-center justify-between">
						<h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide">Participants</h3>
						<p className="text-xs text-on-surface-variant">{callTiles.length} participant{callTiles.length === 1 ? "" : "s"}</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 content-start">
						{callTiles.map((member) => (
							<div key={member.id} className="rounded-2xl border border-outline-variant/20 bg-surface p-4 flex items-center gap-4 relative overflow-hidden min-h-[92px]">
								<div className="relative">
									{member.avatarUrl ? (
										<img src={member.avatarUrl} alt={`${member.label} avatar`} className="w-14 h-14 rounded-xl object-cover" />
									) : (
										<div className="w-14 h-14 rounded-xl bg-surface-container-high flex items-center justify-center text-sm font-bold text-primary">
											{member.initials}
										</div>
									)}
									<span className={`absolute -right-1 -bottom-1 w-4 h-4 rounded-full border-2 border-surface ${member.online ? "bg-green-500" : "bg-surface-container-highest"}`} />
								</div>
								<div className="min-w-0 flex-1">
									<p className="text-sm font-semibold text-on-surface truncate">{member.isMe ? "You" : member.label}</p>
									<p className="text-xs text-on-surface-variant">{member.online ? "Connected" : "Offline"}</p>
								</div>
								{member.online ? (
									<div className="discord-voice-bars" aria-hidden="true">
										<span />
										<span />
										<span />
									</div>
								) : null}
								{member.isMe ? (
									<div className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
										{micActive ? "Mic on" : "Muted"}
									</div>
								) : null}
							</div>
						))}
					</div>
				</div>

				{/* Call Controls Footer */}
				<footer className="h-[94px] flex items-center justify-center gap-5 px-8 border-t border-outline-variant/20 bg-surface/80">
					<button
						onClick={() => setMicActive(!micActive)}
						className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
							micActive 
								? "bg-surface-container-high text-on-surface hover:bg-surface-container-highest" 
								: "bg-error-container text-error hover:brightness-95"
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
								? "bg-primary/10 text-primary hover:bg-primary/20" 
								: "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
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
								? "bg-tertiary-fixed text-on-tertiary-fixed-variant hover:brightness-95" 
								: "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
						}`}
						title={deafened ? "Undeafen" : "Deafen"}
					>
						<span className="material-symbols-outlined text-[24px]">
							{deafened ? "hearing_disabled" : "hearing"}
						</span>
					</button>

					<div className="w-px h-8 bg-outline-variant/60 mx-2"></div>

					<button
						onClick={onEndCall}
						className="px-8 h-14 rounded-full flex items-center justify-center gap-2 bg-error text-on-error font-bold hover:brightness-95 hover:shadow-lg transition-all font-body tracking-wide"
					>
						<span className="material-symbols-outlined text-[22px]">call_end</span>
						Leave Call
					</button>
				</footer>
			</div>
		</div>
	);
}
