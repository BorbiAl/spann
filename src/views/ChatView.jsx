import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon";
import Message from "../components/Message";
import { apiRequestFormData, getAuthState } from "../data/constants";
import { CHANNELS, INCOMING_AUTHORS, INCOMING_MESSAGE_BANK, incrementReaction } from "../data/constants";
import { useMutation } from "@tanstack/react-query";
import { summarizeApi } from "../api/summarize";
import { useUserSettingsStore } from "../store/userSettings";

export default function ChatView({
	activeChannel,
	activeChannelId,
	channelMood,
	messages,
	accessibilityPrefs,
	preferredLocale,
	onSendMessage,
	onReactMessage,
	translateEnabled,
	setTranslateEnabled,
	showNudge,
	setShowNudge,
	onStartCall,
	currentUserName,
	workspaceMembers,
	onOpenChannelSettings,
	onOpenSupport,
	hasGroupChannels,
	onCreateGroup,
	canManageMembers,
	onInviteMember,
}) {
	const [inputValue, setInputValue] = useState("");
	const [isSending, setIsSending] = useState(false);
	const textareaRef = useRef(null);
	const [liveFeedEnabled, setLiveFeedEnabled] = useState(false);
	const [activeTypist, setActiveTypist] = useState("");
	const [isUserTyping, setIsUserTyping] = useState(false);
	const [localMessagesByChannel, setLocalMessagesByChannel] = useState({});
	const [liveMyReactionsByMessage, setLiveMyReactionsByMessage] = useState({});
	const [isAtBottom, setIsAtBottom] = useState(true);
	const [isDictating, setIsDictating] = useState(false);
	const [dictationHint, setDictationHint] = useState("");
	const [speechDebug, setSpeechDebug] = useState({
		status: "idle",
		locale: "",
		lastError: "",
		lastInterim: "",
		lastFinal: "",
		resultCount: 0,
		inputLevel: 0,
		updatedAt: "",
	});
	const viewportRef = useRef(null);
	const recognitionRef = useRef(null);
	const mediaRecorderRef = useRef(null);
	const mediaRecorderStreamRef = useRef(null);
	const mediaRecorderChunksRef = useRef([]);
	const mediaRecorderTimeoutRef = useRef(null);
	const audioContextRef = useRef(null);
	const analyserRef = useRef(null);
	const mediaSourceRef = useRef(null);
	const levelAnimationFrameRef = useRef(null);
	const dictationHintTimeoutRef = useRef(null);
	const dictationStopRequestedRef = useRef(false);
	const pendingVoiceTranscriptRef = useRef("");
	const latestVoiceTranscriptRef = useRef("");
	const hasVoiceTranscriptRef = useRef(false);
	const typingTimeoutRef = useRef(null);
	const userTypingTimeoutRef = useRef(null);
	const lastMessageCountRef = useRef(0);
	const lastSpokenIdRef = useRef("");
	const channelKey = String(activeChannel || "#general");
	const { settings: userSettings } = useUserSettingsStore();
	// tts_auto_play from user settings overrides/complements the accessibility pref
	const ttsEnabled = Boolean(accessibilityPrefs?.tts) || Boolean(userSettings.tts_auto_play);
	// Thread summarization
	const [summaryOpen, setSummaryOpen] = useState(false);
	const [summary, setSummary] = useState(null);
	const summarizeMutation = useMutation({
		mutationFn: () => summarizeApi.summarize(activeChannelId),
		onSuccess: (data) => { setSummary(data); setSummaryOpen(true); },
	});
	const simplifiedMode = Boolean(accessibilityPrefs?.simplified);
	const hasSpeechRecognition =
		typeof window !== "undefined" &&
		Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
	const hasMediaRecorder = typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined";
	const isElectronRuntime =
		typeof navigator !== "undefined" &&
		String(navigator.userAgent || "").toLowerCase().includes("electron");
	const browserLocale = typeof navigator !== "undefined" ? navigator.language : "";
	const rawRecognitionLocale = String(preferredLocale || accessibilityPrefs?.locale || browserLocale || "en-US").trim() || "en-US";
	const recognitionLocale = useMemo(() => {
		try {
			const normalized = Intl.getCanonicalLocales(rawRecognitionLocale);
			return normalized?.[0] || "en-US";
		} catch {
			return "en-US";
		}
	}, [rawRecognitionLocale]);
	const speechDebugEnabled = useMemo(() => {
		if (typeof window === "undefined") {
			return false;
		}

		try {
			const params = new URLSearchParams(window.location.search || "");
			if (params.has("speechDebug")) {
				return true;
			}
			return window.localStorage?.getItem("speechDebug") === "1";
		} catch {
			return false;
		}
	}, []);

	const sentimentScore = Number(channelMood || CHANNELS.find((channel) => channel.name === activeChannel)?.mood || 65);
	const sentimentLabel = sentimentScore > 70 ? "Collaborative" : sentimentScore > 45 ? "Neutral" : "Critical";
	const activeMembers = Array.isArray(workspaceMembers) ? workspaceMembers.filter((member) => Boolean(member?.is_online)) : [];
	const shownMembers = activeMembers.slice(0, 2);
	const extraMembers = Math.max(0, activeMembers.length - shownMembers.length);

	const displayMessages = useMemo(() => {
		const channelMessages = Array.isArray(messages) ? messages : [];
		const liveMessages = localMessagesByChannel[channelKey] || [];
		return [...channelMessages, ...liveMessages].slice(-80);
	}, [messages, localMessagesByChannel, channelKey]);

	useEffect(() => {
		setActiveTypist("");
		setIsUserTyping(false);
		setInputValue("");
		setSummaryOpen(false);
		setSummary(null);
	}, [activeChannel]);

	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport) {
			return undefined;
		}

		function onScroll() {
			const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
			setIsAtBottom(remaining < 84);
		}

		onScroll();
		viewport.addEventListener("scroll", onScroll);

		return () => {
			viewport.removeEventListener("scroll", onScroll);
		};
	}, []);

	useEffect(() => {
		if (!isAtBottom && displayMessages.length >= lastMessageCountRef.current) {
			lastMessageCountRef.current = displayMessages.length;
			return;
		}

		const viewport = viewportRef.current;
		if (!viewport) {
			lastMessageCountRef.current = displayMessages.length;
			return;
		}

		viewport.scrollTo({
			top: viewport.scrollHeight,
			behavior: "smooth"
		});
		lastMessageCountRef.current = displayMessages.length;
	}, [displayMessages.length, isAtBottom]);

	useEffect(() => {
		if (!liveFeedEnabled) {
			return undefined;
		}

		const interval = window.setInterval(() => {
			const bank = INCOMING_MESSAGE_BANK[channelKey] || INCOMING_MESSAGE_BANK["#general"] || [];
			if (!bank.length) {
				return;
			}

			const author = INCOMING_AUTHORS[Math.floor(Math.random() * INCOMING_AUTHORS.length)];
			const text = bank[Math.floor(Math.random() * bank.length)];
			setActiveTypist(author.user);

			if (typingTimeoutRef.current) {
				window.clearTimeout(typingTimeoutRef.current);
			}

			typingTimeoutRef.current = window.setTimeout(() => {
				setLocalMessagesByChannel((current) => {
					const nextChannel = [
						...(current[channelKey] || []),
						{
							id: `live-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
							user: author.user,
							initials: author.initials,
							color: author.color,
							time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
							text,
							reactions: ["👍 1"],
							translated: false
						}
					].slice(-40);

					return {
						...current,
						[channelKey]: nextChannel
					};
				});
				setActiveTypist("");
			}, 1400 + Math.floor(Math.random() * 900));
		}, 17000 + Math.floor(Math.random() * 6000));

		return () => {
			window.clearInterval(interval);
			if (typingTimeoutRef.current) {
				window.clearTimeout(typingTimeoutRef.current);
			}
			setActiveTypist("");
		};
	}, [channelKey, liveFeedEnabled]);

	useEffect(() => {
		return () => {
			if (userTypingTimeoutRef.current) {
				window.clearTimeout(userTypingTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		return () => {
			if (dictationHintTimeoutRef.current) {
				window.clearTimeout(dictationHintTimeoutRef.current);
			}
			if (mediaRecorderTimeoutRef.current) {
				window.clearTimeout(mediaRecorderTimeoutRef.current);
			}
			if (levelAnimationFrameRef.current) {
				window.cancelAnimationFrame(levelAnimationFrameRef.current);
				levelAnimationFrameRef.current = null;
			}
			if (typeof window !== "undefined" && window.speechSynthesis) {
				window.speechSynthesis.cancel();
			}
			if (recognitionRef.current) {
				recognitionRef.current.onresult = null;
				recognitionRef.current.onerror = null;
				recognitionRef.current.onend = null;
				recognitionRef.current.abort();
			}
			if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
				mediaRecorderRef.current.stop();
			}
			if (mediaRecorderStreamRef.current) {
				mediaRecorderStreamRef.current.getTracks().forEach((track) => track.stop());
				mediaRecorderStreamRef.current = null;
			}
			if (mediaSourceRef.current) {
				mediaSourceRef.current.disconnect();
				mediaSourceRef.current = null;
			}
			if (analyserRef.current) {
				analyserRef.current.disconnect();
				analyserRef.current = null;
			}
			if (audioContextRef.current) {
				audioContextRef.current.close().catch(() => undefined);
				audioContextRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		if (!ttsEnabled || typeof window === "undefined" || !window.speechSynthesis || displayMessages.length === 0) {
			return;
		}

		const latestMessage = displayMessages[displayMessages.length - 1];
		const latestId = String(latestMessage?.id || "");
		if (!latestId || latestId === lastSpokenIdRef.current) {
			return;
		}

		if (String(latestMessage?.user || "").trim().toLowerCase() === "you") {
			lastSpokenIdRef.current = latestId;
			return;
		}

		const speechText = `${latestMessage.user} says ${latestMessage.text}`;
		const utterance = new SpeechSynthesisUtterance(speechText);
		utterance.rate = 1;
		utterance.pitch = 1;
		window.speechSynthesis.cancel();
		window.speechSynthesis.speak(utterance);
		lastSpokenIdRef.current = latestId;
	}, [displayMessages, ttsEnabled]);

	function wrapSelection(marker) {
		const el = textareaRef.current;
		if (!el) return;
		const { selectionStart: start, selectionEnd: end, value } = el;
		const selected = value.slice(start, end);
		const wrapped = selected ? `${marker}${selected}${marker}` : `${marker}${marker}`;
		const next = value.slice(0, start) + wrapped + value.slice(end);
		setInputValue(next);
		// Restore cursor: after closing marker when text was selected, between markers when empty
		requestAnimationFrame(() => {
			const cursor = selected ? start + wrapped.length : start + marker.length;
			el.setSelectionRange(cursor, cursor);
			el.focus();
		});
	}

	function handleInputKeyDown(e) {
		const ctrl = e.ctrlKey || e.metaKey;

		// Send on Enter (no shift)
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
			return;
		}

		// Escape → clear input
		if (e.key === "Escape") {
			setInputValue("");
			return;
		}

		// ↑ on empty input → restore last message from current user
		if (e.key === "ArrowUp" && !e.shiftKey && !ctrl && !inputValue) {
			const mine = [...displayMessages].reverse().find(
				(m) => m.user === currentUserName || m.user === "You"
			);
			if (mine) {
				e.preventDefault();
				setInputValue(mine.text);
				requestAnimationFrame(() => {
					const el = textareaRef.current;
					if (el) el.setSelectionRange(mine.text.length, mine.text.length);
				});
			}
			return;
		}

		// Ctrl+B → **bold**
		if (ctrl && e.key === "b") { e.preventDefault(); wrapSelection("**"); return; }
		// Ctrl+I → *italic*
		if (ctrl && e.key === "i") { e.preventDefault(); wrapSelection("*"); return; }
		// Ctrl+Shift+X → ~~strikethrough~~
		if (ctrl && e.shiftKey && e.key === "X") { e.preventDefault(); wrapSelection("~~"); return; }
	}

	function handleInputChange(event) {
		const nextValue = event.target.value;
		setInputValue(nextValue);

		const hasText = Boolean(String(nextValue).trim());
		setIsUserTyping(hasText);

		if (userTypingTimeoutRef.current) {
			window.clearTimeout(userTypingTimeoutRef.current);
		}

		if (hasText) {
			userTypingTimeoutRef.current = window.setTimeout(() => {
				setIsUserTyping(false);
			}, 1400);
		}
	}

	async function sendMessage(overrideText) {
		const text = String(overrideText ?? inputValue).trim();
		if (!text || isSending) {
			return;
		}

		const shouldTranslate = translateEnabled;

		setIsSending(true);
		try {
			await onSendMessage(activeChannel, text, shouldTranslate, {});
		} finally {
			setIsUserTyping(false);
			setIsSending(false);
			setInputValue("");
			pendingVoiceTranscriptRef.current = "";
			latestVoiceTranscriptRef.current = "";
			hasVoiceTranscriptRef.current = false;
		}
	}

	function jumpToLatest() {
		const viewport = viewportRef.current;
		if (!viewport) {
			return;
		}

		viewport.scrollTo({
			top: viewport.scrollHeight,
			behavior: "smooth"
		});
		setIsAtBottom(true);
	}

	function handleReaction(messageId, emoji) {
		const messageKey = String(messageId);
		const emojiKey = String(emoji);
		if (Array.isArray(liveMyReactionsByMessage?.[messageKey]) && liveMyReactionsByMessage[messageKey].includes(emojiKey)) {
			return;
		}

		if (String(messageId).startsWith("live-")) {
			setLocalMessagesByChannel((current) => {
				const updated = (current[channelKey] || []).map((message) => {
					if (String(message.id) !== String(messageId)) {
						return message;
					}

					return {
						...message,
						reactions: incrementReaction(message.reactions || [], emoji)
					};
				});

				return {
					...current,
					[channelKey]: updated
				};
			});
			setLiveMyReactionsByMessage((current) => ({
				...current,
				[messageKey]: [...(current[messageKey] || []), emojiKey]
			}));
			return;
		}

		setLiveMyReactionsByMessage((current) => ({
			...current,
			[messageKey]: [...(current[messageKey] || []), emojiKey]
		}));

		onReactMessage(activeChannel, messageId, emoji);
	}

	// Removed toggleVoiceRoom as it is handled by CallView now

	function setTransientDictationHint(text, ms = 2400) {
		setDictationHint(text);
		if (dictationHintTimeoutRef.current) {
			window.clearTimeout(dictationHintTimeoutRef.current);
		}
		dictationHintTimeoutRef.current = window.setTimeout(() => {
			setDictationHint("");
			dictationHintTimeoutRef.current = null;
		}, ms);
	}

	function updateSpeechDebug(patch) {
		if (!speechDebugEnabled) {
			return;
		}

		setSpeechDebug((current) => ({
			...current,
			...patch,
			updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
		}));
	}

	function clearMediaRecorderTimeout() {
		if (mediaRecorderTimeoutRef.current) {
			window.clearTimeout(mediaRecorderTimeoutRef.current);
			mediaRecorderTimeoutRef.current = null;
		}
	}

	function stopMediaRecorderStream() {
		if (mediaRecorderStreamRef.current) {
			mediaRecorderStreamRef.current.getTracks().forEach((track) => track.stop());
			mediaRecorderStreamRef.current = null;
		}
		if (levelAnimationFrameRef.current) {
			window.cancelAnimationFrame(levelAnimationFrameRef.current);
			levelAnimationFrameRef.current = null;
		}
		if (mediaSourceRef.current) {
			mediaSourceRef.current.disconnect();
			mediaSourceRef.current = null;
		}
		if (analyserRef.current) {
			analyserRef.current.disconnect();
			analyserRef.current = null;
		}
		if (audioContextRef.current) {
			audioContextRef.current.close().catch(() => undefined);
			audioContextRef.current = null;
		}
	}

	function startAudioLevelMonitor(stream) {
		if (typeof window === "undefined") {
			return;
		}

		const AudioContextClass = window.AudioContext || window.webkitAudioContext;
		if (!AudioContextClass) {
			return;
		}

		try {
			audioContextRef.current = new AudioContextClass();
			mediaSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
			analyserRef.current = audioContextRef.current.createAnalyser();
			analyserRef.current.fftSize = 512;
			mediaSourceRef.current.connect(analyserRef.current);

			const bufferLength = analyserRef.current.frequencyBinCount;
			const dataArray = new Uint8Array(bufferLength);
			const SILENCE_THRESHOLD = 8;
			const SILENCE_GRACE_MS = 1500;
			const SILENCE_STOP_MS = 2000;
			const monitorStartTime = Date.now();
			let lastSoundAt = Date.now();

			const tick = () => {
				if (!analyserRef.current) {
					return;
				}

				analyserRef.current.getByteTimeDomainData(dataArray);
				let sum = 0;
				for (let i = 0; i < dataArray.length; i += 1) {
					const normalized = (dataArray[i] - 128) / 128;
					sum += normalized * normalized;
				}
				const rms = Math.sqrt(sum / dataArray.length);
				const level = Math.max(0, Math.min(100, Math.round(rms * 240)));
				updateSpeechDebug({ inputLevel: level });

				if (level > SILENCE_THRESHOLD) {
					lastSoundAt = Date.now();
				}

				const elapsed = Date.now() - monitorStartTime;
				if (
					elapsed > SILENCE_GRACE_MS &&
					Date.now() - lastSoundAt > SILENCE_STOP_MS &&
					mediaRecorderRef.current &&
					mediaRecorderRef.current.state !== "inactive"
				) {
					mediaRecorderRef.current.stop();
					setTransientDictationHint("Silence detected — processing audio...", 2000);
					updateSpeechDebug({ status: "silence-stop" });
					return;
				}

				levelAnimationFrameRef.current = window.requestAnimationFrame(tick);
			};

			levelAnimationFrameRef.current = window.requestAnimationFrame(tick);
		} catch {
			updateSpeechDebug({ inputLevel: 0 });
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
			}
		});
	}

	async function transcribeRecordedAudio(audioBlob) {
		const locale = String(recognitionLocale || "en-US");
		const extension = String(audioBlob?.type || "").includes("ogg") ? "ogg" : "webm";
		const formData = new FormData();
		formData.append("audio", audioBlob, `dictation.${extension}`);
		formData.append("locale", locale);

		updateSpeechDebug({ status: "uploading", locale });

		const hasToken = Boolean(getAuthState()?.accessToken);

		const payload = await apiRequestFormData("/speech-to-text", {
			method: "POST",
			body: formData,
			allowAuthFailOpen: true,
			...(hasToken ? {} : { auth: false }),
		});

		const text = String(payload?.data?.text || payload?.text || "").trim();
		if (!text) {
			throw new Error("empty-transcript");
		}

		setInputValue(text);
		setIsUserTyping(true);
		hasVoiceTranscriptRef.current = true;
		setTransientDictationHint("Voice captured. Review/edit text, then press Send.", 2200);
		updateSpeechDebug({ status: "captured", lastFinal: text, resultCount: 1 });
	}

	async function startMediaRecorderDictation() {
		if (!hasMediaRecorder) {
			setTransientDictationHint("Audio recording is unavailable in this runtime.", 2600);
			updateSpeechDebug({ status: "unsupported", lastError: "media-recorder-unavailable" });
			return;
		}

		if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
			dictationStopRequestedRef.current = true;
			mediaRecorderRef.current.stop();
			setIsDictating(false);
			updateSpeechDebug({ status: "stop-requested" });
			return;
		}

		let stream;
		try {
			stream = await requestMicrophoneStream();
		} catch (error) {
			setTransientDictationHint("Microphone access is blocked. Allow permission and try again.", 3000);
			updateSpeechDebug({ status: "permission-error", lastError: String(error?.name || "permission-failed") });
			setIsDictating(false);
			return;
		}

		const preferredMimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
		const mimeType = preferredMimeTypes.find((candidate) => {
			return typeof window.MediaRecorder?.isTypeSupported === "function" && window.MediaRecorder.isTypeSupported(candidate);
		});

		let recorder;
		try {
			recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
		} catch (error) {
			stopMediaRecorderStream();
			setTransientDictationHint("Could not start recorder. Check your microphone and try again.", 2800);
			updateSpeechDebug({ status: "start-error", lastError: String(error?.name || "recorder-start-failed") });
			return;
		}

		mediaRecorderStreamRef.current = stream;
		mediaRecorderRef.current = recorder;
		mediaRecorderChunksRef.current = [];
		dictationStopRequestedRef.current = false;
		hasVoiceTranscriptRef.current = false;
		startAudioLevelMonitor(stream);

		recorder.ondataavailable = (event) => {
			if (event.data && event.data.size > 0) {
				mediaRecorderChunksRef.current.push(event.data);
			}
		};

		recorder.onerror = (event) => {
			setTransientDictationHint("Recording failed. Please try again.", 2400);
			updateSpeechDebug({ status: "error", lastError: String(event?.error?.name || "recorder-error") });
			setIsDictating(false);
			clearMediaRecorderTimeout();
			stopMediaRecorderStream();
		};

		recorder.onstart = () => {
			setIsDictating(true);
			setIsUserTyping(true);
			setTransientDictationHint("Listening... speak now. Tap mic again to stop.", 2500);
			updateSpeechDebug({ status: "recording", locale: recognitionLocale, lastError: "" });
		};

		recorder.onstop = async () => {
			setIsDictating(false);
			clearMediaRecorderTimeout();
			stopMediaRecorderStream();

			const chunks = mediaRecorderChunksRef.current || [];
			mediaRecorderChunksRef.current = [];

			if (!chunks.length) {
				setTransientDictationHint("No audio captured. Try again and speak for 2-3 seconds.", 2400);
				updateSpeechDebug({ status: "ended-no-final", lastError: "no-audio-chunks", resultCount: 0 });
				return;
			}

			const recordedType = mimeType || "audio/webm";
			const audioBlob = new Blob(chunks, { type: recordedType });
			if (audioBlob.size < 200) {
				setTransientDictationHint("Captured audio was too short. Try again and speak longer.", 2400);
				updateSpeechDebug({ status: "ended-no-final", lastError: "audio-too-short", resultCount: 0 });
				return;
			}

			try {
				await transcribeRecordedAudio(audioBlob);
			} catch (error) {
				const statusCode = Number(error?.response?.status || 0);
				const apiCode = String(error?.response?.data?.error?.code || error?.response?.data?.detail?.error_code || "");
				const details = [statusCode ? `status ${statusCode}` : "", apiCode].filter(Boolean).join(" | ");
				setTransientDictationHint("Could not transcribe audio right now. Please try again.", 2800);
				updateSpeechDebug({ status: "error", lastError: details || String(error?.message || "stt-request-failed") });
			}
		};

		recorder.start();
		updateSpeechDebug({ status: "starting", locale: recognitionLocale });
		mediaRecorderTimeoutRef.current = window.setTimeout(() => {
			if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
				mediaRecorderRef.current.stop();
			}
		}, 12000);
	}

	async function toggleDictation() {
		updateSpeechDebug({ status: "start-requested", locale: recognitionLocale, lastError: "" });
		if (isElectronRuntime || !hasSpeechRecognition) {
			await startMediaRecorderDictation();
			return;
		}

		if (isDictating && recognitionRef.current) {
			dictationStopRequestedRef.current = true;
			recognitionRef.current.stop();
			setIsDictating(false);
			updateSpeechDebug({ status: "stop-requested" });
			return;
		}

		let permissionStream;
		try {
			permissionStream = await requestMicrophoneStream();
			updateSpeechDebug({ status: "permission-ok" });
		} catch (error) {
			const denied = String(error?.name || "").toLowerCase().includes("notallowed");
			setTransientDictationHint(
				denied
					? "Microphone access is blocked. Allow microphone permission and try again."
					: "Microphone is unavailable. Check your device/audio settings and try again.",
				3000
			);
			updateSpeechDebug({ status: "permission-error", lastError: String(error?.name || "permission-failed") });
			setIsDictating(false);
			return;
		} finally {
			if (permissionStream) {
				permissionStream.getTracks().forEach((track) => track.stop());
			}
		}

		const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
		const recognition = new SpeechRecognition();
		recognition.lang = recognitionLocale;
		recognition.interimResults = true;
		recognition.continuous = true;
		recognition.maxAlternatives = 1;
		dictationStopRequestedRef.current = false;
		hasVoiceTranscriptRef.current = false;
		pendingVoiceTranscriptRef.current = "";
		latestVoiceTranscriptRef.current = "";

		recognition.onresult = (event) => {
			const transcript = Array.from(event.results)
				.map((result) => result[0]?.transcript || "")
				.join(" ")
				.trim();
			const finalTranscript = Array.from(event.results)
				.filter((result) => result.isFinal)
				.map((result) => result[0]?.transcript || "")
				.join(" ")
				.trim();
			if (transcript) {
				setInputValue(transcript);
				setIsUserTyping(true);
				latestVoiceTranscriptRef.current = transcript;
				updateSpeechDebug({
					status: "hearing",
					resultCount: Number(event?.results?.length || 0),
					lastInterim: transcript,
				});
			}
			if (finalTranscript) {
				pendingVoiceTranscriptRef.current = finalTranscript;
				updateSpeechDebug({ status: "final-received", lastFinal: finalTranscript });
			}
		};

		recognition.onstart = () => {
			setTransientDictationHint("Listening... speak your message.", 1600);
			updateSpeechDebug({ status: "listening", locale: recognitionLocale });
		};

		recognition.onerror = (event) => {
			const errorCode = String(event?.error || "").toLowerCase();
			if (errorCode === "aborted" && dictationStopRequestedRef.current) {
				updateSpeechDebug({ status: "aborted-by-stop", lastError: "" });
				return;
			}

			const runningInElectron =
				typeof navigator !== "undefined" &&
				String(navigator.userAgent || "").toLowerCase().includes("electron");

			const hintByError = {
				"not-allowed": "Microphone access was denied. Allow access and try again.",
				"service-not-allowed": "Speech recognition service is blocked in this environment.",
				"no-speech": "No speech detected. Speak clearly after tapping the mic.",
				"audio-capture": "No working microphone was found. Check your input device.",
				"language-not-supported": `Language ${recognitionLocale} is not supported for dictation.`,
				network: runningInElectron
					? "Speech recognition network service is unreachable in this runtime. Try the web app in Chrome, or use backend STT fallback."
					: "Speech recognition network service is unreachable. Check internet/VPN/firewall, then try again.",
			};

			setTransientDictationHint(hintByError[errorCode] || "Could not capture voice right now. Please try again.", 2800);
			updateSpeechDebug({ status: "error", lastError: errorCode || "unknown" });
			setIsDictating(false);

			if (errorCode === "network" && hasMediaRecorder) {
				startMediaRecorderDictation().catch(() => undefined);
			}
		};

		recognition.onend = () => {
			setIsDictating(false);
			if (dictationStopRequestedRef.current) {
				dictationStopRequestedRef.current = false;
				if (latestVoiceTranscriptRef.current || pendingVoiceTranscriptRef.current) {
					setTransientDictationHint("Dictation stopped.", 1000);
				}
				updateSpeechDebug({ status: "stopped" });
				return;
			}

			const finalVoiceText = String(pendingVoiceTranscriptRef.current || latestVoiceTranscriptRef.current || "").trim();
			if (!finalVoiceText) {
				setTransientDictationHint("No speech captured. Try again and speak for 1-2 seconds.", 2200);
				updateSpeechDebug({ status: "ended-no-final" });
				return;
			}
			setInputValue(finalVoiceText);
			hasVoiceTranscriptRef.current = true;
			setTransientDictationHint("Voice captured. Review/edit text, then press Send.", 2200);
			updateSpeechDebug({ status: "captured", lastFinal: finalVoiceText });
		};

		recognitionRef.current = recognition;
		setIsDictating(true);
		setIsUserTyping(true);
		try {
			recognition.start();
			updateSpeechDebug({ status: "starting" });
		} catch (error) {
			setIsDictating(false);
			setTransientDictationHint("Could not start dictation. Try clicking the mic again.", 2500);
			updateSpeechDebug({ status: "start-error", lastError: String(error?.name || "start-failed") });
		}
	}

	const nudgeText = simplifiedMode
		? "Tip: Keep the message short and clear for your team."
		: "Try rephrasing for better clarity. Your last message has a formal tone that might be perceived as rigid in this context.";

	const inputPlaceholder = simplifiedMode
		? `Type a clear message in ${String(activeChannel || "#product-strategy").replace(/^#/, "")}`
		: `Type a message to #${String(activeChannel || "product-strategy").replace(/^#/, "")}`;
	const typingLabel = activeTypist || (isUserTyping ? "You" : "");

	if (!hasGroupChannels) {
		return (
			<div className="flex-1 min-h-0 h-full flex items-center justify-center bg-surface px-8">
				<div className="max-w-md rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 text-center shadow-sm">
					<h2 className="text-xl font-bold text-on-surface">No group yet</h2>
					<p className="mt-2 text-sm text-on-surface-variant">Create your first group channel to start team collaboration.</p>
					<button
						type="button"
						onClick={onCreateGroup}
						className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:brightness-95"
					>
						<span className="material-symbols-outlined text-[18px]">group_add</span>
						<span>Create Group</span>
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 min-h-0 h-full flex flex-col min-w-0 bg-surface">
			{/* Top App Bar */}
			<header className="h-[60px] flex items-center justify-between px-6 bg-surface sticky top-0 z-10 border-b border-outline-variant/20">
				<div className="flex items-center gap-3">
					<span className="text-primary text-[20px] font-medium">#</span>
					<h2 className="font-bold text-on-surface text-[18px] tracking-tight">{String(activeChannel || "product-strategy").replace(/^#/, "")}</h2>
					<span className="material-symbols-outlined text-on-surface-variant opacity-50 text-[18px] cursor-pointer" data-icon="star">
						star
					</span>
				</div>
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => setLiveFeedEnabled((current) => !current)}
						className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
							liveFeedEnabled ? "border-primary/30 text-primary bg-primary/10" : "border-outline-variant/50 text-on-surface-variant bg-surface-container-low"
						}`}
					>
						{liveFeedEnabled ? "Simulated feed on" : "Simulated feed off"}
					</button>
					<button
						type="button"
						disabled={!activeChannelId || summarizeMutation.isPending}
						onClick={() => {
							if (summaryOpen) { setSummaryOpen(false); return; }
							summarizeMutation.mutate();
						}}
						className={`text-[12px] font-semibold px-3 py-1.5 rounded-md border transition-colors inline-flex items-center gap-1.5 ${summaryOpen ? "border-primary/30 text-primary bg-primary/10" : "border-outline-variant/50 text-on-surface-variant bg-surface-container-low hover:border-primary/30 hover:text-primary"} disabled:opacity-40`}
						aria-label="Summarize thread"
					>
						{summarizeMutation.isPending ? (
							<span className="flex gap-0.5 items-center"><span className="w-1 h-1 rounded-full bg-current animate-pulse" /><span className="w-1 h-1 rounded-full bg-current animate-pulse delay-75" /><span className="w-1 h-1 rounded-full bg-current animate-pulse delay-150" /></span>
						) : (
							<span className="material-symbols-outlined text-[16px]">auto_awesome</span>
						)}
						<span>{summaryOpen ? "Hide summary" : "Summarize"}</span>
					</button>
					<button
						type="button"
						onClick={onStartCall}
						className="text-[12px] font-semibold px-3 py-1.5 rounded-md border transition-colors inline-flex items-center gap-1.5 border-primary/20 text-on-primary bg-primary hover:brightness-95"
						aria-label="Start call"
					>
						<span className="material-symbols-outlined text-[16px]">call</span>
						<span>Start Call</span>
					</button>
					{canManageMembers ? (
						<button
							type="button"
							onClick={onInviteMember}
							className="text-[12px] font-semibold px-3 py-1.5 rounded-md border transition-colors inline-flex items-center gap-1.5 border-primary/20 text-primary bg-surface"
							aria-label="Invite member"
						>
							<span className="material-symbols-outlined text-[16px]">person_add</span>
							<span>Invite</span>
						</button>
					) : null}
					<div className="flex -space-x-2">
						{shownMembers.map((member) => {
							const label = String(member?.display_name || member?.email || "Member");
							const initials = label
								.split(/\s+/)
								.filter(Boolean)
								.slice(0, 2)
								.map((word) => word[0])
								.join("")
								.toUpperCase() || "ME";
							if (member?.avatar_url) {
								return (
									<img
										key={String(member?.user_id || label)}
										className="w-8 h-8 rounded-full border-2 border-surface object-cover"
										src={member.avatar_url}
										alt={`${label} avatar`}
									/>
								);
							}
							return (
								<div key={String(member?.user_id || label)} className="w-8 h-8 rounded-full border-2 border-surface bg-surface-container-high text-on-surface text-[10px] flex items-center justify-center font-bold">
									{initials}
								</div>
							);
						})}
						{extraMembers > 0 ? (
							<div className="w-8 h-8 rounded-full border-2 border-surface bg-surface-container-high text-on-surface text-[11px] flex items-center justify-center font-bold">
								+{extraMembers}
							</div>
						) : null}
					</div>
					<button
						type="button"
						onClick={onOpenSupport}
						className="material-symbols-outlined text-on-surface-variant opacity-80 text-[22px] cursor-pointer hover:text-on-surface transition-colors"
						data-icon="help"
						aria-label="Open support"
					>
						help
					</button>
					<button
						type="button"
						onClick={onOpenChannelSettings}
						className="material-symbols-outlined text-on-surface-variant opacity-80 text-[22px] cursor-pointer hover:text-on-surface transition-colors"
						data-icon="settings"
						aria-label="Open chat settings"
					>
						settings
					</button>
				</div>
			</header>

			{/* Message Area */}
			<div ref={viewportRef} className="flex-1 min-h-0 overflow-y-auto px-10 pt-8 pb-4 flex flex-col gap-6 scroll-smooth custom-scrollbar">
				{/* Thread Summary Panel */}
				{summaryOpen && summary && (
					<div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 mb-2 flex flex-col gap-3">
						<div className="flex items-center justify-between">
							<span className="text-[13px] font-semibold text-primary flex items-center gap-1.5">
								<span className="material-symbols-outlined text-[16px]">auto_awesome</span>
								Thread summary
								{summary.cached ? <span className="text-[10px] font-normal opacity-60 ml-1">(cached)</span> : null}
							</span>
							<button type="button" onClick={() => setSummaryOpen(false)} className="text-on-surface-variant opacity-50 hover:opacity-100 transition-opacity" aria-label="Dismiss summary">
								<span className="material-symbols-outlined text-[18px]">close</span>
							</button>
						</div>
						{summary.bullets.length > 0 && (
							<ul className="flex flex-col gap-1">
								{summary.bullets.map((b, i) => (
									<li key={i} className="text-[13px] text-on-surface flex gap-2"><span className="text-primary mt-0.5">•</span><span>{b}</span></li>
								))}
							</ul>
						)}
						{summary.decisions.length > 0 && (
							<div>
								<p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Decisions</p>
								<ul className="flex flex-col gap-1">
									{summary.decisions.map((d, i) => (
										<li key={i} className="text-[13px] text-on-surface flex gap-2"><span className="text-amber-500 mt-0.5">◆</span><span>{d}</span></li>
									))}
								</ul>
							</div>
						)}
						{summary.action_items.length > 0 && (
							<div>
								<p className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Action items</p>
								<ul className="flex flex-col gap-1">
									{summary.action_items.map((a, i) => (
										<li key={i} className="text-[13px] text-on-surface flex gap-2"><span className="text-emerald-500 mt-0.5">✓</span><span>{a}</span></li>
									))}
								</ul>
							</div>
						)}
						<p className="text-[11px] text-on-surface-variant opacity-60">Based on last {summary.message_count} messages</p>
					</div>
				)}
				{/* Date Divider */}
				<div className="relative flex justify-center items-center mt-2 mb-4">
					<div className="absolute inset-0 flex items-center">
						<div className="w-full border-t border-black/5" />
					</div>
					<span className="relative px-4 bg-surface text-[11px] font-bold text-on-surface-variant opacity-80 tracking-widest uppercase">
						TODAY
					</span>
				</div>

				{displayMessages.map((message, index) => (
					<Message
						key={message.id}
						message={message}
						index={index}
						onReaction={handleReaction}
					/>
				))}

				{showNudge ? (
					<div className="bg-primary/10 px-4 py-3 flex items-start gap-4 rounded-[8px] w-full max-w-[85%] self-start border-l-4 border-l-primary">
						<span className="material-symbols-outlined text-primary text-[20px] mt-0.5" data-icon="info">
							info
						</span>
						<div className="flex flex-1 justify-between items-center pr-2">
							<p className="text-[13px] text-on-surface font-medium leading-relaxed">
								{nudgeText}
							</p>
							<button
								className="text-[12px] font-bold uppercase tracking-widest text-primary hover:underline"
								onClick={() => setShowNudge(false)}
							>
								DISMISS
							</button>
						</div>
					</div>
				) : null}

				{typingLabel ? (
					<div className="flex items-center gap-2 px-14 opacity-50 mb-2">
						<div className="flex gap-1" aria-hidden="true">
							<span className="w-1 h-1 rounded-full bg-on-surface animate-pulse" />
							<span className="w-1 h-1 rounded-full bg-on-surface animate-pulse delay-75" />
							<span className="w-1 h-1 rounded-full bg-on-surface animate-pulse delay-150" />
						</div>
						<span className="text-[12px] italic text-on-surface">{typingLabel} is typing...</span>
					</div>
				) : null}

				{!isAtBottom ? (
					<button
						type="button"
						onClick={jumpToLatest}
						className="sticky bottom-2 self-center bg-primary text-on-primary text-[12px] font-semibold px-4 py-1.5 rounded-full shadow-md hover:brightness-95 transition-colors"
					>
						Jump to latest
					</button>
				) : null}
			</div>

			{/* Message Input Area */}
			<footer className="px-10 pb-8 bg-surface shrink-0">
				<div className="w-full space-y-3">
					{/* Sentiment Bar */}
					<div className="flex items-center gap-4 px-2 w-full max-w-full">
						<span className="text-[10px] font-bold text-on-surface opacity-70 uppercase tracking-widest whitespace-nowrap">
							TONE SENTIMENT
						</span>
						<div className="flex-1 h-[6px] bg-surface-container-high rounded-full overflow-hidden flex">
							<div
								className="h-full bg-primary transition-all duration-500 rounded-full"
								style={{ width: `${Math.max(6, Math.min(95, sentimentScore))}%` }}
							/>
						</div>
						<span className="text-[12px] font-bold text-primary">{sentimentLabel}</span>
					</div>

					{/* Input Box */}
					<div className="bg-surface rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-outline-variant/50 p-3 focus-within:ring-2 focus-within:ring-primary/20 transition-all flex flex-col">
						<textarea
							ref={textareaRef}
							value={inputValue}
							onChange={handleInputChange}
							className="w-full border-none focus:outline-none focus:ring-0 text-[14px] text-on-surface px-1 bg-transparent resize-none placeholder:text-on-surface-variant placeholder:opacity-70"
							placeholder={inputPlaceholder}
							rows={1}
							onKeyDown={handleInputKeyDown}
						/>
						<div className="flex items-center justify-between mt-6">
							<div className="flex items-center gap-3 pl-1">
								<span className="material-symbols-outlined text-[24px] text-on-surface-variant opacity-80 hover:text-on-surface cursor-pointer" data-icon="add_circle">add_circle</span>
								<button
									type="button"
									onClick={toggleDictation}
									className={`material-symbols-outlined text-[24px] ${isDictating ? "text-primary" : "text-on-surface-variant opacity-80 hover:text-on-surface"} cursor-pointer`}
									aria-label={isDictating ? "Stop dictation" : "Start dictation"}
								>
									{isDictating ? "mic" : "mic_none"}
								</button>
								<span className="material-symbols-outlined text-[24px] text-on-surface-variant opacity-80 hover:text-on-surface cursor-pointer" data-icon="sentiment_satisfied">sentiment_satisfied</span>
								<span className="material-symbols-outlined text-[24px] text-on-surface-variant opacity-80 hover:text-on-surface cursor-pointer" data-icon="alternate_email">alternate_email</span>
								
								<div className="flex items-center gap-3 ml-2 border-l border-outline-variant/50 pl-5">
									<span className="material-symbols-outlined text-[20px] text-on-surface-variant opacity-80" data-icon="translate">translate</span>
									<span className="text-[12px] font-semibold text-on-surface-variant opacity-90 uppercase tracking-widest tracking-tighter">TRANSLATE</span>
									
									<button
										type="button"
										className={`w-[32px] h-[18px] rounded-full relative cursor-pointer border ${translateEnabled ? 'bg-green-500 border-green-500' : 'bg-surface-container-high border-outline-variant'}`}
										onClick={() => setTranslateEnabled((current) => !current)}
										aria-pressed={translateEnabled}
									>
										<div className={`absolute top-[1px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all duration-200 ${translateEnabled ? "right-[1px]" : "left-[1px]"}`} />
									</button>
								</div>
							</div>

							<button
								className={`bg-primary text-on-primary pl-4 pr-3 py-[6px] rounded-[16px] text-[14px] font-semibold flex items-center justify-center gap-1.5 hover:brightness-95 transition-all cursor-pointer shadow-sm ${isSending ? "opacity-75 cursor-wait" : "active:scale-95"}`}
								onClick={() => sendMessage()}
								disabled={isSending}
								aria-label={isSending ? "Sending message..." : "Send message"}
								type="button"
							>
								<span>{isSending ? "Sending..." : "Send"}</span>
								{isSending ? <span className="material-symbols-outlined text-[16px] animate-spin" data-icon="sync">sync</span> : <span className="material-symbols-outlined text-[16px]" data-icon="send">send</span>}
							</button>
						</div>
						{dictationHint ? <p className="mt-2 px-1 text-[11px] text-on-surface-variant">{dictationHint}</p> : null}
						{speechDebugEnabled ? (
							<div className="mt-2 rounded-md border border-outline-variant/50 bg-surface-container-low px-2.5 py-2 text-[11px] text-on-surface-variant leading-relaxed">
								<div className="font-semibold uppercase tracking-wide text-[10px] text-primary">Speech Debug</div>
								<div>Status: {speechDebug.status || "idle"}</div>
								<div>Locale: {speechDebug.locale || recognitionLocale}</div>
								<div>Result count: {speechDebug.resultCount}</div>
								<div>Input level: {speechDebug.inputLevel}</div>
								<div>Last error: {speechDebug.lastError || "none"}</div>
								<div>Last final: {speechDebug.lastFinal || "(empty)"}</div>
								<div>Last interim: {speechDebug.lastInterim || "(empty)"}</div>
								<div>Updated: {speechDebug.updatedAt || "-"}</div>
							</div>
						) : null}
					</div>
				</div>
			</footer>
		</div>
	);
}
