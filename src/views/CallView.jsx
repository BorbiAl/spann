import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiRequestFormData, getAuthState } from "../data/constants";

export default function CallView({ activeChannel, participants = [], onEndCall }) {
	const [micActive, setMicActive] = useState(true);
	const [videoActive, setVideoActive] = useState(false);
	const [deafened, setDeafened] = useState(false);
	const [callDuration, setCallDuration] = useState(0);
	const [micLevel, setMicLevel] = useState(0);
	const [statusNote, setStatusNote] = useState("");
	const [showOptions, setShowOptions] = useState(false);
	const [captionsEnabled, setCaptionsEnabled] = useState(false);
	const [captionStatus, setCaptionStatus] = useState("idle");
	const [captionError, setCaptionError] = useState("");
	const [interimCaption, setInterimCaption] = useState("");
	const [captions, setCaptions] = useState([]);

	const recognitionRef = useRef(null);
	const mediaRecorderRef = useRef(null);
	const mediaStreamRef = useRef(null);
	const micMonitorStreamRef = useRef(null);
	const micAnalyserRef = useRef(null);
	const micAudioContextRef = useRef(null);
	const micSourceRef = useRef(null);
	const micFrameRef = useRef(null);
	const captionQueueRef = useRef([]);
	const isTranscribingRef = useRef(false);
	const captionsEnabledRef = useRef(false);

	const hasSpeechRecognition =
		typeof window !== "undefined" &&
		Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
	const hasMediaRecorder = typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined";
	const preferRecorderCaptions =
		typeof navigator !== "undefined" && String(navigator.userAgent || "").toLowerCase().includes("electron");
	const captionLocale = useMemo(() => {
		const raw = typeof navigator !== "undefined" ? navigator.language : "en-US";
		try {
			const normalized = Intl.getCanonicalLocales(raw);
			return normalized?.[0] || "en-US";
		} catch {
			return "en-US";
		}
	}, []);

	useEffect(() => {
		const timer = setInterval(() => {
			setCallDuration((prev) => prev + 1);
		}, 1000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		captionsEnabledRef.current = captionsEnabled;
	}, [captionsEnabled]);

	useEffect(() => {
		return () => {
			if (recognitionRef.current) {
				recognitionRef.current.onresult = null;
				recognitionRef.current.onerror = null;
				recognitionRef.current.onend = null;
				try {
					recognitionRef.current.stop();
				} catch {
					// no-op
				}
				recognitionRef.current = null;
			}

			if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
				try {
					mediaRecorderRef.current.stop();
				} catch {
					// no-op
				}
			}
			mediaRecorderRef.current = null;

			if (mediaStreamRef.current) {
				mediaStreamRef.current.getTracks().forEach((track) => track.stop());
				mediaStreamRef.current = null;
			}

			if (micFrameRef.current) {
				cancelAnimationFrame(micFrameRef.current);
				micFrameRef.current = null;
			}

			if (micSourceRef.current) {
				try {
					micSourceRef.current.disconnect();
				} catch {
					// no-op
				}
				micSourceRef.current = null;
			}

			if (micAnalyserRef.current) {
				try {
					micAnalyserRef.current.disconnect();
				} catch {
					// no-op
				}
				micAnalyserRef.current = null;
			}

			if (micMonitorStreamRef.current) {
				micMonitorStreamRef.current.getTracks().forEach((track) => track.stop());
				micMonitorStreamRef.current = null;
			}

			if (micAudioContextRef.current) {
				try {
					micAudioContextRef.current.close();
				} catch {
					// no-op
				}
				micAudioContextRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		if (!micActive) {
			setMicLevel(0);
			if (micMonitorStreamRef.current) {
				micMonitorStreamRef.current.getTracks().forEach((track) => {
					track.enabled = false;
				});
			}
			return;
		}

		async function startMicMonitoring() {
			if (typeof window === "undefined" || typeof navigator === "undefined") {
				return;
			}

			if (!navigator.mediaDevices?.getUserMedia) {
				return;
			}

			if (!micMonitorStreamRef.current) {
				const stream = await requestMicrophoneStream();
				micMonitorStreamRef.current = stream;
			}

			micMonitorStreamRef.current.getTracks().forEach((track) => {
				track.enabled = true;
			});

			if (micAnalyserRef.current) {
				return;
			}

			const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
			if (!AudioContextImpl) {
				return;
			}

			const audioContext = new AudioContextImpl();
			const analyser = audioContext.createAnalyser();
			analyser.fftSize = 1024;
			analyser.smoothingTimeConstant = 0.8;

			const source = audioContext.createMediaStreamSource(micMonitorStreamRef.current);
			source.connect(analyser);

			micAudioContextRef.current = audioContext;
			micAnalyserRef.current = analyser;
			micSourceRef.current = source;

			const sampleBuffer = new Uint8Array(analyser.fftSize);

			const tick = () => {
				if (!micAnalyserRef.current || !micActive) {
					setMicLevel(0);
					micFrameRef.current = null;
					return;
				}

				micAnalyserRef.current.getByteTimeDomainData(sampleBuffer);
				let sumSquares = 0;
				for (let i = 0; i < sampleBuffer.length; i += 1) {
					const normalized = (sampleBuffer[i] - 128) / 128;
					sumSquares += normalized * normalized;
				}
				const rms = Math.sqrt(sumSquares / sampleBuffer.length);
				const nextLevel = Math.max(0, Math.min(100, Math.round(rms * 180)));
				setMicLevel(nextLevel);
				micFrameRef.current = requestAnimationFrame(tick);
			};

			micFrameRef.current = requestAnimationFrame(tick);
		}

		startMicMonitoring().catch(() => {
			setMicLevel(0);
		});
	}, [micActive]);

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

	function appendCaption(text, speaker = "You") {
		const clean = String(text || "").trim();
		if (!clean) {
			return;
		}
		setCaptions((current) => {
			const next = [
				...current,
				{
					id: `cap-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
					speaker,
					text: clean,
					time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
				},
			];
			return next.slice(-32);
		});
	}

	function clearCaptionResources() {
		if (recognitionRef.current) {
			recognitionRef.current.onresult = null;
			recognitionRef.current.onerror = null;
			recognitionRef.current.onend = null;
			try {
				recognitionRef.current.stop();
			} catch {
				// no-op
			}
			recognitionRef.current = null;
		}

		if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
			try {
				mediaRecorderRef.current.stop();
			} catch {
				// no-op
			}
		}
		mediaRecorderRef.current = null;

		if (mediaStreamRef.current) {
			mediaStreamRef.current.getTracks().forEach((track) => track.stop());
			mediaStreamRef.current = null;
		}
	}

	function stopCaptionCapture() {
		setCaptionsEnabled(false);
		setCaptionStatus("idle");
		setInterimCaption("");
		clearCaptionResources();
	}

	async function transcribeChunk(blob) {
		if (!blob || blob.size < 256) {
			return;
		}

		const formData = new FormData();
		const extension = String(blob.type || "").includes("ogg") ? "ogg" : "webm";
		formData.append("audio", blob, `caption.${extension}`);
		formData.append("locale", captionLocale);

		const hasToken = Boolean(getAuthState()?.accessToken);
		const payload = await apiRequestFormData("/speech-to-text", {
			method: "POST",
			body: formData,
			allowAuthFailOpen: true,
			...(hasToken ? {} : { auth: false }),
		});

		const text = String(payload?.data?.text || payload?.text || "").trim();
		if (text) {
			appendCaption(text, "You");
		}
	}

	async function processCaptionQueue() {
		if (isTranscribingRef.current) {
			return;
		}
		isTranscribingRef.current = true;
		try {
			while (captionQueueRef.current.length > 0 && captionsEnabledRef.current) {
				const blob = captionQueueRef.current.shift();
				try {
					await transcribeChunk(blob);
				} catch (error) {
					const message = String(error?.message || "").toLowerCase();
					if (message.includes("failed to fetch") || message.includes("network") || message.includes("aborted")) {
						setCaptionError("Network error while uploading audio for captions. Check API/backend connectivity.");
					} else {
						setCaptionError("Live caption transcription is temporarily unavailable.");
					}
				}
			}
		} finally {
			isTranscribingRef.current = false;
		}
	}

	async function requestMicrophoneStream() {
		if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
			throw new Error("getUserMedia unavailable");
		}

		return navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
			},
		});
	}

	async function startBrowserSpeechCaptions() {
		const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
		const recognition = new SpeechRecognition();
		recognition.lang = captionLocale;
		recognition.interimResults = true;
		recognition.continuous = true;
		recognition.maxAlternatives = 1;

		recognition.onresult = (event) => {
			let nextInterim = "";
			for (let i = event.resultIndex; i < event.results.length; i += 1) {
				const result = event.results[i];
				const transcript = String(result?.[0]?.transcript || "").trim();
				if (!transcript) {
					continue;
				}
				if (result.isFinal) {
					appendCaption(transcript, "You");
				} else {
					nextInterim = transcript;
				}
			}
			setInterimCaption(nextInterim);
		};

		recognition.onerror = (event) => {
			const code = String(event?.error || "").toLowerCase();
			if ((code === "network" || code === "service-not-allowed") && hasMediaRecorder) {
				setCaptionError("");
				setCaptionStatus("starting");
				startRecorderFallbackCaptions()
					.then(() => {
						showTemporaryNote("Captions switched to backend transcription.");
					})
					.catch(() => {
						setCaptionError("Caption service error.");
						setCaptionStatus("error");
					});
				return;
			}

			setCaptionError(code ? `Caption error: ${code}` : "Caption service error.");
			setCaptionStatus("error");
		};

		recognition.onend = () => {
			if (captionsEnabledRef.current) {
				try {
					recognition.start();
					setCaptionStatus("listening");
				} catch {
					setCaptionStatus("error");
				}
			}
		};

		recognitionRef.current = recognition;
		recognition.start();
		setCaptionStatus("listening");
	}

	async function startRecorderFallbackCaptions() {
		const stream = await requestMicrophoneStream();
		const preferredMimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
		const mimeType = preferredMimeTypes.find((candidate) => {
			return typeof window.MediaRecorder?.isTypeSupported === "function" && window.MediaRecorder.isTypeSupported(candidate);
		});

		const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
		mediaStreamRef.current = stream;
		mediaRecorderRef.current = recorder;

		recorder.ondataavailable = (event) => {
			if (event.data && event.data.size > 0) {
				captionQueueRef.current.push(event.data);
				processCaptionQueue().catch(() => undefined);
			}
		};

		recorder.onerror = () => {
			setCaptionError("Audio recording failed for captions.");
			setCaptionStatus("error");
		};

		recorder.start(2500);
		setCaptionStatus("listening");
	}

	async function handleToggleCaptions() {
		if (captionsEnabled) {
			stopCaptionCapture();
			showTemporaryNote("Live captions turned off.");
			return;
		}

		setCaptionError("");
		setInterimCaption("");
		setCaptionsEnabled(true);
		setCaptionStatus("starting");

		try {
			if (preferRecorderCaptions && hasMediaRecorder) {
				await startRecorderFallbackCaptions();
				showTemporaryNote("Live captions enabled (backend transcription).");
				return;
			}

			if (hasSpeechRecognition) {
				await startBrowserSpeechCaptions();
				showTemporaryNote("Live captions enabled.");
				return;
			}

			if (hasMediaRecorder) {
				await startRecorderFallbackCaptions();
				showTemporaryNote("Live captions enabled (backend transcription).");
				return;
			}

			setCaptionStatus("error");
			setCaptionError("This runtime does not support live speech capture.");
			setCaptionsEnabled(false);
		} catch {
			setCaptionStatus("error");
			setCaptionError("Could not start live captions. Check microphone permissions.");
			setCaptionsEnabled(false);
			clearCaptionResources();
		}
	}

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
		<div className="h-full overflow-y-auto bg-surface p-8 w-full view-transition flex items-center justify-center">
			<div className="flex flex-col relative overflow-hidden bg-background/80 backdrop-blur-[12px] border border-outline-variant/20 shadow-sm w-full max-w-4xl min-h-[600px] font-body text-on-surface rounded-3xl">
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
				<header className="h-[80px] flex items-center justify-between px-8 border-b border-outline-variant/20 bg-surface/60">
					<div className="flex items-center gap-4">
						<div className="flex h-12 w-12 items-center justify-center bg-primary/10 text-primary rounded-2xl">
							<span className="material-symbols-outlined text-[24px]">Record_Voice_Over</span>
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
							</div>
						</div>
					</div>
					<div className="flex items-center gap-4">
						<div className="flex -space-x-3 mr-4">
							{shownParticipants.map((member, index) => {
								const label = String(member?.display_name || member?.email || "Member");
								const initials = label
									.split(/\s+/)
									.filter(Boolean)
									.slice(0, 2)
									.map((word) => word[0])
									.join("")
									.toUpperCase() || "ME";
								const zClass = index === 0 ? "z-30" : index === 1 ? "z-20" : "z-10";
								if (member?.avatar_url) {
									return (
										<img
											key={String(member?.user_id || label)}
											className={`w-10 h-10 rounded-full border-2 border-surface object-cover ${zClass}`}
											src={member.avatar_url}
											alt={`${label} avatar`}
										/>
									);
								}
								return (
									<div key={String(member?.user_id || label)} className={`w-10 h-10 rounded-full border-2 border-surface bg-surface-container-high flex items-center justify-center text-primary font-bold ${zClass}`}>
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
						<h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wide">In This Call</h3>
						<p className="text-xs text-on-surface-variant">{callTiles.length} participant{callTiles.length === 1 ? "" : "s"}</p>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
						{callTiles.map((member) => (
							<div key={member.id} className="rounded-2xl border border-outline-variant/20 bg-surface p-4 flex items-center gap-4 relative overflow-hidden">
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
								{member.isMe ? (
									<div className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
										{micActive ? "Mic on" : "Muted"}
									</div>
								) : null}
							</div>
						))}
					</div>
					<section className="mt-5 rounded-2xl border border-outline-variant/25 bg-surface px-4 py-3">
						<div className="flex items-center justify-between gap-3 mb-2">
							<div className="flex items-center gap-2">
								<span className="material-symbols-outlined text-[18px] text-primary">closed_caption</span>
								<p className="text-sm font-semibold text-on-surface">Live Captions</p>
							</div>
							<span className={`text-[11px] font-semibold uppercase tracking-wide ${captionStatus === "listening" ? "text-primary" : "text-on-surface-variant"}`}>
								{captionStatus === "listening" ? "Listening" : captionStatus === "starting" ? "Starting" : captionStatus === "error" ? "Error" : "Idle"}
							</span>
						</div>
						<div className="max-h-36 overflow-y-auto pr-1 space-y-1.5">
							{captions.length === 0 ? (
								<p className="text-xs text-on-surface-variant">Turn on captions to transcribe speech during this call.</p>
							) : (
								captions.map((line) => (
									<div key={line.id} className="text-xs text-on-surface leading-relaxed">
										<span className="font-semibold text-primary">{line.speaker}</span>
										<span className="text-on-surface-variant"> [{line.time}]</span>
										<span>{` ${line.text}`}</span>
									</div>
								))
							)}
							{interimCaption ? <p className="text-xs italic text-on-surface-variant">You: {interimCaption}</p> : null}
						</div>
						{captionError ? <p className="mt-2 text-[11px] text-error">{captionError}</p> : null}
					</section>
				</div>

				{/* Call Controls Footer */}
				<footer className="h-[90px] flex items-center justify-center gap-6 px-8 border-t border-outline-variant/20 bg-surface/70">
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

					<button
						onClick={handleToggleCaptions}
						className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
							captionsEnabled
								? "bg-primary/10 text-primary hover:bg-primary/20"
								: "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
						}`}
						title={captionsEnabled ? "Turn Off Captions" : "Turn On Captions"}
					>
						<span className="material-symbols-outlined text-[24px]">closed_caption</span>
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
