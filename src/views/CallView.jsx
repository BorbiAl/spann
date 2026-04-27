import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiRequestFormData, getAuthState } from "../data/constants";

const STUN_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function buildWsUrl(room) {
	const base =
		(typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
		"http://localhost:8000";
	return base.replace(/^http/, "ws") + "/ws/" + encodeURIComponent(room);
}

export default function CallView({ activeChannel, participants = [], onEndCall }) {
	// ── Core call state ───────────────────────────────────────────────────────
	const [micActive, setMicActive] = useState(true);
	const [videoActive, setVideoActive] = useState(false);
	const [deafened, setDeafened] = useState(false);
	const [callDuration, setCallDuration] = useState(0);
	const [micLevel, setMicLevel] = useState(0);
	const [statusNote, setStatusNote] = useState("");
	const [remoteConnected, setRemoteConnected] = useState(false);
	const [remoteHasVideo, setRemoteHasVideo] = useState(false);
	const [sharingScreen, setSharingScreen] = useState(false);

	// ── Captions state ────────────────────────────────────────────────────────
	const [captionsEnabled, setCaptionsEnabled] = useState(false);
	const [captionStatus, setCaptionStatus] = useState("idle");
	const [captionError, setCaptionError] = useState("");
	const [interimCaption, setInterimCaption] = useState("");
	const [captions, setCaptions] = useState([]);

	// ── Caption / mic monitoring refs ─────────────────────────────────────────
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

	// ── WebRTC refs ───────────────────────────────────────────────────────────
	const localVideoRef = useRef(null);
	const remoteVideoRef = useRef(null);
	const pcRef = useRef(null);
	const wsRef = useRef(null);
	const localStreamRef = useRef(null);
	const screenTrackRef = useRef(null);
	const videoBeforeShareRef = useRef(false);

	const hasSpeechRecognition =
		typeof window !== "undefined" &&
		Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
	const hasMediaRecorder =
		typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined";
	const preferRecorderCaptions =
		typeof navigator !== "undefined" &&
		String(navigator.userAgent || "").toLowerCase().includes("electron");
	const captionLocale = useMemo(() => {
		const raw = typeof navigator !== "undefined" ? navigator.language : "en-US";
		try {
			return Intl.getCanonicalLocales(raw)?.[0] || "en-US";
		} catch {
			return "en-US";
		}
	}, []);

	// ── Timers / sync effects ─────────────────────────────────────────────────
	useEffect(() => {
		const t = setInterval(() => setCallDuration((s) => s + 1), 1000);
		return () => clearInterval(t);
	}, []);

	useEffect(() => { captionsEnabledRef.current = captionsEnabled; }, [captionsEnabled]);

	useEffect(() => {
		if (remoteVideoRef.current) remoteVideoRef.current.muted = deafened;
	}, [deafened]);

	// ── WebRTC ────────────────────────────────────────────────────────────────
	useEffect(() => {
		const room = String(activeChannel || "general")
			.replace(/^#/, "")
			.toLowerCase()
			.replace(/[^a-z0-9_-]/g, "-");

		let destroyed = false;
		let pc = null;
		let ws = null;

		async function init() {
			// Audio-only on start — camera is opt-in
			let stream;
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
					video: false,
				});
			} catch {
				return;
			}
			if (destroyed) { stream.getTracks().forEach((t) => t.stop()); return; }

			localStreamRef.current = stream;
			if (localVideoRef.current) localVideoRef.current.srcObject = stream;

			pc = new RTCPeerConnection(STUN_CONFIG);
			pcRef.current = pc;
			stream.getTracks().forEach((t) => pc.addTrack(t, stream));

			pc.ontrack = (e) => {
				if (destroyed) return;
				if (remoteVideoRef.current && e.streams[0]) {
					remoteVideoRef.current.srcObject = e.streams[0];
				}
				setRemoteConnected(true);
				if (e.track.kind === "video") setRemoteHasVideo(true);
			};

			pc.onicecandidate = (e) => {
				if (e.candidate && ws?.readyState === WebSocket.OPEN) {
					ws.send(JSON.stringify({ type: "ice", candidate: e.candidate }));
				}
			};

			pc.onconnectionstatechange = () => {
				if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
					if (!destroyed) { setRemoteConnected(false); setRemoteHasVideo(false); }
				}
			};

			pc.onnegotiationneeded = async () => {
				try {
					if (ws?.readyState !== WebSocket.OPEN) return;
					const offer = await pc.createOffer();
					await pc.setLocalDescription(offer);
					ws.send(JSON.stringify({ type: "offer", offer }));
					console.log("[webrtc] Renegotiation offer sent");
				} catch (err) {
					console.warn("[webrtc] Renegotiation failed:", err);
				}
			};

			ws = new WebSocket(buildWsUrl(room));
			wsRef.current = ws;

			ws.onopen = () => { if (!destroyed) ws.send(JSON.stringify({ type: "join" })); };

			ws.onmessage = async ({ data }) => {
				if (destroyed) return;
				let msg;
				try { msg = JSON.parse(data); } catch { return; }

				if (msg.type === "join") {
					const offer = await pc.createOffer();
					await pc.setLocalDescription(offer);
					ws.send(JSON.stringify({ type: "offer", offer }));
				} else if (msg.type === "offer") {
					await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
					const answer = await pc.createAnswer();
					await pc.setLocalDescription(answer);
					ws.send(JSON.stringify({ type: "answer", answer }));
				} else if (msg.type === "answer") {
					await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
				} else if (msg.type === "ice" && msg.candidate) {
					try { await pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch { /* stale */ }
				}
			};

			ws.onclose = () => {
				if (!destroyed) { setRemoteConnected(false); setRemoteHasVideo(false); }
			};
		}

		init().catch(() => {});

		return () => {
			destroyed = true;
			ws?.close();
			pc?.close();
			screenTrackRef.current?.stop();
			screenTrackRef.current = null;
			if (localStreamRef.current) {
				localStreamRef.current.getTracks().forEach((t) => t.stop());
				localStreamRef.current = null;
			}
			pcRef.current = null;
			wsRef.current = null;
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// ── Caption / misc cleanup ────────────────────────────────────────────────
	useEffect(() => {
		return () => {
			if (recognitionRef.current) {
				recognitionRef.current.onresult = null;
				recognitionRef.current.onerror = null;
				recognitionRef.current.onend = null;
				try { recognitionRef.current.stop(); } catch { /* already stopped */ }
				recognitionRef.current = null;
			}
			if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
				try { mediaRecorderRef.current.stop(); } catch { /* already stopped */ }
			}
			mediaRecorderRef.current = null;
			if (mediaStreamRef.current) {
				mediaStreamRef.current.getTracks().forEach((t) => t.stop());
				mediaStreamRef.current = null;
			}
			if (micFrameRef.current) { cancelAnimationFrame(micFrameRef.current); micFrameRef.current = null; }
			try { micSourceRef.current?.disconnect(); } catch { /* already disconnected */ }
			micSourceRef.current = null;
			try { micAnalyserRef.current?.disconnect(); } catch { /* already disconnected */ }
			micAnalyserRef.current = null;
			if (micMonitorStreamRef.current) {
				micMonitorStreamRef.current.getTracks().forEach((t) => t.stop());
				micMonitorStreamRef.current = null;
			}
			try { micAudioContextRef.current?.close(); } catch { /* already closed */ }
			micAudioContextRef.current = null;
		};
	}, []);

	// ── Mic level monitoring ──────────────────────────────────────────────────
	useEffect(() => {
		if (!micActive) { setMicLevel(0); return; }

		async function startMicMonitoring() {
			if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
			let stream = localStreamRef.current;
			if (!stream) {
				if (!micMonitorStreamRef.current) {
					micMonitorStreamRef.current = await requestMicrophoneStream();
				}
				stream = micMonitorStreamRef.current;
			}
			stream.getAudioTracks().forEach((t) => { t.enabled = true; });
			if (micAnalyserRef.current) return;
			const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
			if (!AudioContextImpl) return;
			const ctx = new AudioContextImpl();
			const analyser = ctx.createAnalyser();
			analyser.fftSize = 1024;
			analyser.smoothingTimeConstant = 0.8;
			const source = ctx.createMediaStreamSource(stream);
			source.connect(analyser);
			micAudioContextRef.current = ctx;
			micAnalyserRef.current = analyser;
			micSourceRef.current = source;
			const buf = new Uint8Array(analyser.fftSize);
			const tick = () => {
				if (!micAnalyserRef.current || !micActive) { setMicLevel(0); micFrameRef.current = null; return; }
				micAnalyserRef.current.getByteTimeDomainData(buf);
				let sum = 0;
				for (let i = 0; i < buf.length; i++) { const n = (buf[i] - 128) / 128; sum += n * n; }
				setMicLevel(Math.max(0, Math.min(100, Math.round(Math.sqrt(sum / buf.length) * 180))));
				micFrameRef.current = requestAnimationFrame(tick);
			};
			micFrameRef.current = requestAnimationFrame(tick);
		}

		startMicMonitoring().catch(() => setMicLevel(0));
	}, [micActive]);

	// ── Helpers ───────────────────────────────────────────────────────────────
	const formatDuration = (s) =>
		`${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

	function showTemporaryNote(msg) {
		setStatusNote(String(msg || ""));
		setTimeout(() => setStatusNote(""), 2200);
	}

	// ── Controls ──────────────────────────────────────────────────────────────
	function handleToggleMic() {
		const next = !micActive;
		setMicActive(next);
		localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = next; });
	}

	async function handleToggleVideo() {
		if (sharingScreen) return;

		if (videoActive) {
			localStreamRef.current?.getVideoTracks().forEach((t) => {
				t.stop();
				localStreamRef.current.removeTrack(t);
			});
			const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
			if (sender) await sender.replaceTrack(null);
			if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
			setVideoActive(false);
			console.log("[camera] Off");
		} else {
			try {
				const cam = await navigator.mediaDevices.getUserMedia({ video: true });
				const camTrack = cam.getVideoTracks()[0];
				await _replaceVideoTrack(camTrack);
				setVideoActive(true);
				console.log("[camera] On:", camTrack.label);
			} catch (err) {
				console.warn("[camera] Denied or unavailable:", err);
			}
		}
	}

	async function _replaceVideoTrack(newTrack) {
		const stream = localStreamRef.current;
		if (stream) {
			stream.getVideoTracks().forEach((t) => { t.stop(); stream.removeTrack(t); });
			stream.addTrack(newTrack);
		}
		const pc = pcRef.current;
		if (pc) {
			const sender = pc.getSenders().find((s) => s.track?.kind === "video");
			if (sender) {
				await sender.replaceTrack(newTrack);
				console.log("[video] Track replaced:", newTrack.label);
			} else {
				pc.addTrack(newTrack, stream);
				console.log("[video] Track added:", newTrack.label);
			}
		}
		if (localVideoRef.current && stream) localVideoRef.current.srcObject = stream;
	}

	async function _restoreAfterScreenShare() {
		screenTrackRef.current = null;
		setSharingScreen(false);

		if (!videoBeforeShareRef.current) {
			localStreamRef.current?.getVideoTracks().forEach((t) => {
				t.stop();
				localStreamRef.current.removeTrack(t);
			});
			const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
			if (sender) await sender.replaceTrack(null);
			if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
			setVideoActive(false);
			console.log("[screen-share] Restored to audio-only");
			return;
		}

		try {
			const cam = await navigator.mediaDevices.getUserMedia({ video: true });
			const camTrack = cam.getVideoTracks()[0];
			await _replaceVideoTrack(camTrack);
			setVideoActive(true);
			console.log("[screen-share] Camera restored");
		} catch (err) {
			console.error("[screen-share] Camera restore failed:", err);
			setVideoActive(false);
		}
	}

	async function handleScreenShare() {
		if (sharingScreen) {
			const track = screenTrackRef.current;
			if (track) { track.stop(); } else { await _restoreAfterScreenShare(); }
			return;
		}

		let screenTrack;
		try {
			const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
			screenTrack = s.getVideoTracks()[0];
		} catch (err) { console.error("[screen-share] getDisplayMedia failed:", err); return; }

		videoBeforeShareRef.current = videoActive;
		screenTrackRef.current = screenTrack;
		screenTrack.onended = () => { console.log("[screen-share] Stopped via browser"); _restoreAfterScreenShare(); };

		try {
			await _replaceVideoTrack(screenTrack);
			setSharingScreen(true);
			setVideoActive(true);
			console.log("[screen-share] Started:", screenTrack.label);
		} catch (err) {
			console.error("[screen-share] Failed:", err);
			screenTrack.stop();
			screenTrackRef.current = null;
		}
	}

	function handleLeave() {
		wsRef.current?.close();
		pcRef.current?.close();
		onEndCall?.();
	}

	// ── Caption helpers ───────────────────────────────────────────────────────
	function appendCaption(text, speaker = "You") {
		const clean = String(text || "").trim();
		if (!clean) return;
		setCaptions((cur) => [
			...cur,
			{
				id: `cap-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
				speaker,
				text: clean,
				time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
			},
		].slice(-32));
	}

	function clearCaptionResources() {
		if (recognitionRef.current) {
			recognitionRef.current.onresult = null;
			recognitionRef.current.onerror = null;
			recognitionRef.current.onend = null;
			try { recognitionRef.current.stop(); } catch { /* already stopped */ }
			recognitionRef.current = null;
		}
		if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
			try { mediaRecorderRef.current.stop(); } catch { /* already stopped */ }
		}
		mediaRecorderRef.current = null;
		if (mediaStreamRef.current) {
			mediaStreamRef.current.getTracks().forEach((t) => t.stop());
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
		if (!blob || blob.size < 256) return;
		const formData = new FormData();
		const ext = String(blob.type || "").includes("ogg") ? "ogg" : "webm";
		formData.append("audio", blob, `caption.${ext}`);
		formData.append("locale", captionLocale);
		const hasToken = Boolean(getAuthState()?.accessToken);
		const payload = await apiRequestFormData("/speech-to-text", {
			method: "POST",
			body: formData,
			allowAuthFailOpen: true,
			...(hasToken ? {} : { auth: false }),
		});
		const text = String(payload?.data?.text || payload?.text || "").trim();
		if (text) appendCaption(text, "You");
	}

	async function processCaptionQueue() {
		if (isTranscribingRef.current) return;
		isTranscribingRef.current = true;
		try {
			while (captionQueueRef.current.length > 0 && captionsEnabledRef.current) {
				const blob = captionQueueRef.current.shift();
				try {
					await transcribeChunk(blob);
				} catch (error) {
					const msg = String(error?.message || "").toLowerCase();
					setCaptionError(
						msg.includes("failed to fetch") || msg.includes("network")
							? "Network error — check connection."
							: "Transcription temporarily unavailable.",
					);
				}
			}
		} finally {
			isTranscribingRef.current = false;
		}
	}

	async function requestMicrophoneStream() {
		return navigator.mediaDevices.getUserMedia({
			audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
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
			let interim = "";
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const r = event.results[i];
				const t = String(r?.[0]?.transcript || "").trim();
				if (!t) continue;
				if (r.isFinal) { appendCaption(t, "You"); } else { interim = t; }
			}
			setInterimCaption(interim);
		};

		recognition.onerror = (event) => {
			const code = String(event?.error || "").toLowerCase();
			if ((code === "network" || code === "service-not-allowed") && hasMediaRecorder) {
				setCaptionError("");
				setCaptionStatus("starting");
				startRecorderFallbackCaptions()
					.then(() => showTemporaryNote("Captions switched to backend."))
					.catch(() => { setCaptionError("Caption error."); setCaptionStatus("error"); });
				return;
			}
			setCaptionError(code ? `Caption error: ${code}` : "Caption error.");
			setCaptionStatus("error");
		};

		recognition.onend = () => {
			if (captionsEnabledRef.current) {
				try { recognition.start(); setCaptionStatus("listening"); } catch { setCaptionStatus("error"); }
			}
		};

		recognitionRef.current = recognition;
		recognition.start();
		setCaptionStatus("listening");
	}

	async function startRecorderFallbackCaptions() {
		const stream = await requestMicrophoneStream();
		const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
		const mimeType = mimeTypes.find(
			(t) => typeof window.MediaRecorder?.isTypeSupported === "function" && window.MediaRecorder.isTypeSupported(t),
		);
		const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
		mediaStreamRef.current = stream;
		mediaRecorderRef.current = recorder;
		recorder.ondataavailable = (e) => {
			if (e.data?.size > 0) { captionQueueRef.current.push(e.data); processCaptionQueue().catch(() => {}); }
		};
		recorder.onerror = () => { setCaptionError("Audio recording failed."); setCaptionStatus("error"); };
		recorder.start(2500);
		setCaptionStatus("listening");
	}

	async function handleToggleCaptions() {
		if (captionsEnabled) { stopCaptionCapture(); return; }
		setCaptionError("");
		setInterimCaption("");
		setCaptionsEnabled(true);
		setCaptionStatus("starting");
		try {
			if (preferRecorderCaptions && hasMediaRecorder) { await startRecorderFallbackCaptions(); return; }
			if (hasSpeechRecognition) { await startBrowserSpeechCaptions(); return; }
			if (hasMediaRecorder) { await startRecorderFallbackCaptions(); return; }
			setCaptionStatus("error");
			setCaptionError("Live captions not supported in this browser.");
			setCaptionsEnabled(false);
		} catch {
			setCaptionStatus("error");
			setCaptionError("Could not start captions — check microphone permissions.");
			setCaptionsEnabled(false);
			clearCaptionResources();
		}
	}

	async function handleInviteParticipant() {
		const ch = String(activeChannel || "general").replace(/^#/, "");
		const link = `${window.location.origin}${window.location.pathname}?channel=${encodeURIComponent(ch)}`;
		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(link);
				showTemporaryNote("Invite link copied");
				return;
			}
		} catch { /* clipboard API blocked — fall through to prompt */ }
		window.prompt("Copy invite link", link);
	}

	// ── Render ────────────────────────────────────────────────────────────────
	return (
		<div className="relative h-full w-full overflow-hidden select-none" style={{ background: "#0f0f11" }}>

			{/* ── STATUS TOAST ──────────────────────────────────────────── */}
			{statusNote ? (
				<div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
					<div className="bg-black/70 backdrop-blur-sm text-white/90 text-xs font-medium px-4 py-1.5 rounded-full shadow-lg">
						{statusNote}
					</div>
				</div>
			) : null}

			{/* ── TOP BAR ───────────────────────────────────────────────── */}
			<div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 pt-4 pb-2">
				<div className="flex items-center gap-2">
					<span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${remoteConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
					<span className="text-white/60 text-[13px] font-medium tracking-tight">
						{String(activeChannel || "General").replace(/^#/, "")}
					</span>
					<span className="text-white/25 text-[13px] tabular-nums">{formatDuration(callDuration)}</span>
				</div>
				<button
					type="button"
					onClick={handleInviteParticipant}
					aria-label="Copy invite link"
					className="w-8 h-8 rounded-full flex items-center justify-center bg-white/8 text-white/50 hover:bg-white/14 hover:text-white/80 transition-all focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none"
				>
					<span className="material-symbols-outlined text-[16px]">person_add</span>
				</button>
			</div>

			{/* ── REMOTE — full canvas ───────────────────────────────────── */}
			<div className="absolute inset-0">
				{/* Remote video stream */}
				<video
					ref={remoteVideoRef}
					autoPlay
					playsInline
					className={`w-full h-full object-cover transition-opacity duration-300 ${remoteConnected && remoteHasVideo ? "opacity-100" : "opacity-0"}`}
				/>

				{/* Avatar: waiting or audio-only */}
				<div className={`absolute inset-0 flex flex-col items-center justify-center gap-5 transition-opacity duration-300 ${remoteConnected && remoteHasVideo ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
					<div className="relative flex items-center justify-center">
						{remoteConnected ? (
							<span className="absolute w-28 h-28 rounded-full bg-white/4 animate-ping" />
						) : null}
						<div className="w-20 h-20 rounded-full bg-white/8 flex items-center justify-center ring-1 ring-white/10">
							<span className="material-symbols-outlined text-white/30 text-[36px]">person</span>
						</div>
					</div>
					<div className="text-center space-y-1">
						<p className="text-white/40 text-sm font-medium">
							{remoteConnected ? "Connected — audio only" : "Waiting for others…"}
						</p>
						{!remoteConnected ? (
							<p className="text-white/20 text-xs">Open the same channel in another tab</p>
						) : null}
					</div>
				</div>
			</div>

			{/* ── SCREEN SHARE BADGE ────────────────────────────────────── */}
			{sharingScreen ? (
				<div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
					<div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm text-white/70 text-xs font-medium px-3 py-1.5 rounded-full">
						<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
						Sharing your screen
					</div>
				</div>
			) : null}

			{/* ── LOCAL PIP — bottom-right corner ───────────────────────── */}
			<div className="absolute bottom-24 right-4 z-30 w-36 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
				<div className="aspect-video relative bg-[#1a1a1e] flex items-center justify-center">
					<video
						ref={localVideoRef}
						muted
						autoPlay
						playsInline
						style={videoActive && !sharingScreen ? { transform: "scaleX(-1)" } : undefined}
						className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${videoActive ? "opacity-100" : "opacity-0"}`}
					/>

					{!videoActive ? (
						<div className="relative z-10 flex items-center justify-center">
							{micActive && micLevel > 10 ? (
								<span className="absolute w-12 h-12 rounded-full bg-white/6 animate-ping" />
							) : null}
							<div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center relative z-10">
								<span className="text-white/40 text-xs font-semibold">ME</span>
							</div>
						</div>
					) : null}

					{/* Mic status badge */}
					{!micActive ? (
						<div className="absolute top-1.5 right-1.5 z-20 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
							<span className="material-symbols-outlined text-white leading-none" style={{ fontSize: 9 }}>mic_off</span>
						</div>
					) : micLevel > 10 && videoActive ? (
						<div className="absolute top-1.5 right-1.5 z-20 w-4 h-4 rounded-full bg-emerald-500/80 flex items-center justify-center">
							<span className="material-symbols-outlined text-white leading-none" style={{ fontSize: 9 }}>graphic_eq</span>
						</div>
					) : null}
				</div>
			</div>

			{/* ── CAPTIONS OVERLAY — bottom-center above control bar ─────── */}
			{captionsEnabled ? (
				<div className="absolute bottom-24 left-4 right-44 z-20 pointer-events-none">
					<div className="bg-black/75 backdrop-blur-sm rounded-2xl px-4 py-2.5 text-center space-y-0.5">
						{captions.slice(-2).map((line) => (
							<p key={line.id} className="text-white text-[13px] leading-snug font-medium">
								{line.text}
							</p>
						))}
						{interimCaption ? (
							<p className="text-white/40 text-[13px] italic">{interimCaption}</p>
						) : captions.length === 0 ? (
							<p className="text-white/30 text-xs py-0.5">
								{captionStatus === "listening" ? "Listening…" : captionStatus === "starting" ? "Starting…" : ""}
							</p>
						) : null}
					</div>
					{captionError ? (
						<p className="text-red-400 text-xs text-center mt-1.5">{captionError}</p>
					) : null}
				</div>
			) : null}

			{/* ── CONTROL BAR — floating pill ───────────────────────────── */}
			<div
				className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-2xl ring-1 ring-white/8"
				style={{ background: "rgba(22,22,26,0.92)", backdropFilter: "blur(24px)" }}
				role="toolbar"
				aria-label="Call controls"
			>
				{/* Mute */}
				<button
					type="button"
					onClick={handleToggleMic}
					aria-label={micActive ? "Mute microphone" : "Unmute microphone"}
					aria-pressed={!micActive}
					className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-150 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none active:scale-[0.92] ${
						micActive
							? "bg-white/10 text-white/80 hover:bg-white/16 hover:scale-105"
							: "bg-red-500/85 text-white hover:bg-red-500 hover:scale-105"
					}`}
				>
					<span className="material-symbols-outlined text-[19px]">{micActive ? "mic" : "mic_off"}</span>
				</button>

				{/* Camera */}
				<button
					type="button"
					onClick={handleToggleVideo}
					disabled={sharingScreen}
					aria-label={videoActive ? "Turn camera off" : "Turn camera on"}
					aria-pressed={videoActive}
					className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-150 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none active:scale-[0.92] ${
						sharingScreen
							? "bg-white/5 text-white/20 cursor-not-allowed"
							: videoActive
								? "bg-white/18 text-white hover:bg-white/24 hover:scale-105"
								: "bg-white/10 text-white/60 hover:bg-white/16 hover:text-white/90 hover:scale-105"
					}`}
				>
					<span className="material-symbols-outlined text-[19px]">{videoActive ? "videocam" : "videocam_off"}</span>
				</button>

				{/* Screen share */}
				<button
					type="button"
					onClick={handleScreenShare}
					aria-label={sharingScreen ? "Stop sharing screen" : "Share screen"}
					aria-pressed={sharingScreen}
					className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-150 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none active:scale-[0.92] ${
						sharingScreen
							? "bg-white/18 text-white hover:bg-white/24 hover:scale-105"
							: "bg-white/10 text-white/60 hover:bg-white/16 hover:text-white/90 hover:scale-105"
					}`}
				>
					<span className="material-symbols-outlined text-[19px]">
						{sharingScreen ? "stop_screen_share" : "screen_share"}
					</span>
				</button>

				{/* Captions */}
				<button
					type="button"
					onClick={handleToggleCaptions}
					aria-label={captionsEnabled ? "Turn captions off" : "Turn captions on"}
					aria-pressed={captionsEnabled}
					className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-150 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none active:scale-[0.92] ${
						captionsEnabled
							? "bg-white/18 text-white hover:bg-white/24 hover:scale-105"
							: "bg-white/10 text-white/60 hover:bg-white/16 hover:text-white/90 hover:scale-105"
					}`}
				>
					<span className="material-symbols-outlined text-[19px]">closed_caption</span>
				</button>

				<div className="w-px h-5 bg-white/10 mx-0.5" aria-hidden />

				{/* Leave */}
				<button
					type="button"
					onClick={handleLeave}
					aria-label="Leave call"
					className="w-11 h-11 rounded-full flex items-center justify-center bg-red-500/90 text-white hover:bg-red-500 hover:scale-105 active:scale-[0.92] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-red-400/60 focus-visible:outline-none"
				>
					<span className="material-symbols-outlined text-[19px]">call_end</span>
				</button>
			</div>
		</div>
	);
}
