import React, { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon";
import Message from "../components/Message";
import { CHANNELS, INCOMING_AUTHORS, INCOMING_MESSAGE_BANK, incrementReaction } from "../data/constants";

const PRESENCE_MEMBERS = [
	{
		id: "sarah",
		name: "Sarah Chen",
		avatar:
			"https://lh3.googleusercontent.com/aida-public/AB6AXuCeX83POcK2ErUQRuh8dLEiZzV2zBzREt2WJ06F2PjbO7eT9obL2mn3MNVweL9NJEUSctvCB5_9w0xkWD_IjeNDBZsWh3LjbBhrt5CYyK1dYy2hEAPPPu5YO0w7obgjjPhyx8BZ7NyWuK6w1nDnSwpycWhj2ty3n9ITfSGoUHDuTTMjz1OsJKRDF5ZSeA7KY-2LUIVsTIt4NQqD5L9Wpnf4Q1SwIbL-SOHN96csvROrp6AlL7dLgcs3fPi2Z2cOT9pZuZv1OgfJZx1U"
	},
	{
		id: "marcus",
		name: "Marcus Kane",
		initials: "MK"
	}
];

export default function ChatView({
	activeChannel,
	channelMood,
	messages,
	accessibilityPrefs,
	onSendMessage,
	onReactMessage,
	translateEnabled,
	setTranslateEnabled,
	showNudge,
	setShowNudge
}) {
	const [inputValue, setInputValue] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [liveFeedEnabled, setLiveFeedEnabled] = useState(true);
	const [activeTypist, setActiveTypist] = useState("Alex");
	const [localMessagesByChannel, setLocalMessagesByChannel] = useState({});
	const [isAtBottom, setIsAtBottom] = useState(true);
	const [voiceConnected, setVoiceConnected] = useState(false);
	const [voiceMuted, setVoiceMuted] = useState(false);
	const [voiceDeafened, setVoiceDeafened] = useState(false);
	const [isDictating, setIsDictating] = useState(false);
	const [dictationHint, setDictationHint] = useState("");
	const viewportRef = useRef(null);
	const recognitionRef = useRef(null);
	const typingTimeoutRef = useRef(null);
	const lastMessageCountRef = useRef(0);
	const lastSpokenIdRef = useRef("");
	const channelKey = String(activeChannel || "#general");
	const ttsEnabled = Boolean(accessibilityPrefs?.tts);
	const simplifiedMode = Boolean(accessibilityPrefs?.simplified);
	const hasSpeechRecognition =
		typeof window !== "undefined" &&
		Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

	const sentimentScore = Number(channelMood || CHANNELS.find((channel) => channel.name === activeChannel)?.mood || 65);
	const sentimentLabel = sentimentScore > 70 ? "Collaborative" : sentimentScore > 45 ? "Neutral" : "Critical";

	const channelMessages = Array.isArray(messages) ? messages : [];
	const liveMessages = localMessagesByChannel[channelKey] || [];
	const displayMessages = useMemo(() => {
		return [...channelMessages, ...liveMessages].slice(-80);
	}, [channelMessages, liveMessages]);

	useEffect(() => {
		setInputValue("");
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
			setActiveTypist(author.user.split(" ")[0]);

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
				setActiveTypist("Alex");
			}, 1400 + Math.floor(Math.random() * 900));
		}, 17000 + Math.floor(Math.random() * 6000));

		return () => {
			window.clearInterval(interval);
			if (typingTimeoutRef.current) {
				window.clearTimeout(typingTimeoutRef.current);
			}
		};
	}, [channelKey, liveFeedEnabled]);

	useEffect(() => {
		return () => {
			if (typeof window !== "undefined" && window.speechSynthesis) {
				window.speechSynthesis.cancel();
			}
			if (recognitionRef.current) {
				recognitionRef.current.onresult = null;
				recognitionRef.current.onerror = null;
				recognitionRef.current.onend = null;
				recognitionRef.current.stop();
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

	async function sendMessage() {
		const text = inputValue.trim();
		if (!text || isSending) {
			return;
		}

		setIsSending(true);
		try {
			await onSendMessage(activeChannel, text, translateEnabled);
		} finally {
			setIsSending(false);
			setInputValue("");
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
			return;
		}

		onReactMessage(activeChannel, messageId, emoji);
	}

	function toggleVoiceRoom() {
		setVoiceConnected((current) => {
			const next = !current;
			if (!next) {
				setVoiceMuted(false);
				setVoiceDeafened(false);
			}
			return next;
		});
	}

	function toggleDictation() {
		if (!hasSpeechRecognition) {
			setDictationHint("Dictation is unavailable in this browser. You can still type or send voice notes.");
			window.setTimeout(() => setDictationHint(""), 2400);
			return;
		}

		if (isDictating && recognitionRef.current) {
			recognitionRef.current.stop();
			setIsDictating(false);
			return;
		}

		const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
		const recognition = new SpeechRecognition();
		recognition.lang = "en-US";
		recognition.interimResults = true;
		recognition.continuous = false;

		recognition.onresult = (event) => {
			const transcript = Array.from(event.results)
				.map((result) => result[0]?.transcript || "")
				.join(" ")
				.trim();
			if (transcript) {
				setInputValue(transcript);
			}
		};

		recognition.onerror = () => {
			setDictationHint("Could not capture voice right now. Please try again.");
			setIsDictating(false);
			window.setTimeout(() => setDictationHint(""), 2400);
		};

		recognition.onend = () => {
			setIsDictating(false);
		};

		recognitionRef.current = recognition;
		setIsDictating(true);
		setDictationHint("Listening… speak your message.");
		recognition.start();
	}

	const nudgeText = simplifiedMode
		? "Tip: Keep the message short and clear for your team."
		: "Try rephrasing for better clarity. Your last message has a formal tone that might be perceived as rigid in this context.";

	const inputPlaceholder = simplifiedMode
		? `Type a clear message in ${String(activeChannel || "#product-strategy").replace(/^#/, "")}`
		: `Type a message to #${String(activeChannel || "product-strategy").replace(/^#/, "")}`;

	return (
		<div className="flex-1 min-h-0 h-full flex flex-col min-w-0 bg-white">
			{/* Top App Bar */}
			<header className="h-[60px] flex items-center justify-between px-6 bg-white sticky top-0 z-10 border-b border-black/5">
				<div className="flex items-center gap-3">
					<span className="text-[#0b4b8a] text-[20px] font-medium">#</span>
					<h2 className="font-bold text-[#1D1D1F] text-[18px] tracking-tight">{String(activeChannel || "product-strategy").replace(/^#/, "")}</h2>
					<span className="material-symbols-outlined text-[#1D1D1F] opacity-40 text-[18px] cursor-pointer" data-icon="star">
						star
					</span>
				</div>
				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={() => setLiveFeedEnabled((current) => !current)}
						className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
							liveFeedEnabled ? "border-[#0f67b7]/30 text-[#0f67b7] bg-[#e9f3ff]" : "border-black/10 text-[#596272] bg-[#f3f4f6]"
						}`}
					>
						{liveFeedEnabled ? "Live feed on" : "Live feed off"}
					</button>
					<button
						type="button"
						onClick={toggleVoiceRoom}
						className={`text-[12px] font-semibold px-3 py-1.5 rounded-md border transition-colors inline-flex items-center gap-1.5 ${
							voiceConnected ? "border-[#0f67b7]/30 text-[#0f67b7] bg-[#e9f3ff]" : "border-black/10 text-white bg-[#0f67b7]"
						}`}
						aria-label={voiceConnected ? "End call" : "Start call"}
					>
						<span className="material-symbols-outlined text-[16px]">{voiceConnected ? "call_end" : "call"}</span>
						<span>{voiceConnected ? "End Call" : "Start Call"}</span>
					</button>
					<div className="flex -space-x-2">
						{PRESENCE_MEMBERS.slice(0, 2).map((member, index) => (
							<React.Fragment key={member.id}>
								{member.avatar ? (
									<img
										className="w-8 h-8 rounded-full border-2 border-white object-cover"
										src={member.avatar}
										alt={`${member.name} avatar`}
									/>
								) : (
									<div className="w-8 h-8 rounded-full border-2 border-white bg-[#E5E5EA] text-[#1D1D1F] text-[10px] flex items-center justify-center font-bold">
										{member.initials || member.name.slice(0, 2).toUpperCase()}
									</div>
								)}
							</React.Fragment>
						))}
						<div className="w-8 h-8 rounded-full border-2 border-white bg-[#E5E5EA] text-[#1D1D1F] text-[11px] flex items-center justify-center font-bold">
							+12
						</div>
					</div>
					<span className="material-symbols-outlined text-[#1D1D1F] opacity-60 text-[22px] cursor-pointer hover:opacity-100 transition-colors" data-icon="help">
						help
					</span>
					<span className="material-symbols-outlined text-[#1D1D1F] opacity-60 text-[22px] cursor-pointer hover:opacity-100 transition-colors" data-icon="settings">
						settings
					</span>
				</div>
			</header>

			{/* Message Area */}
			<div ref={viewportRef} className="flex-1 min-h-0 overflow-y-auto px-10 pt-8 pb-4 flex flex-col gap-6 scroll-smooth custom-scrollbar">
				{/* Date Divider */}
				<div className="relative flex justify-center items-center mt-2 mb-4">
					<div className="absolute inset-0 flex items-center">
						<div className="w-full border-t border-black/5" />
					</div>
					<span className="relative px-4 bg-white text-[11px] font-bold text-[#1D1D1F] opacity-60 tracking-widest uppercase">
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
					<div className="bg-[#E1F0FF] px-4 py-3 flex items-start gap-4 rounded-[8px] w-full max-w-[85%] self-start border-l-4 border-l-[#0f67b7]">
						<span className="material-symbols-outlined text-[#0f67b7] text-[20px] mt-0.5" data-icon="info">
							info
						</span>
						<div className="flex flex-1 justify-between items-center pr-2">
							<p className="text-[13px] text-[#003B73] font-medium leading-relaxed">
								{nudgeText}
							</p>
							<button
								className="text-[12px] font-bold uppercase tracking-widest text-[#0b4b8a] hover:underline"
								onClick={() => setShowNudge(false)}
							>
								DISMISS
							</button>
						</div>
					</div>
				) : null}

				<div className="flex items-center gap-2 px-14 opacity-50 mb-2">
					<div className="flex gap-1" aria-hidden="true">
						<span className="w-1 h-1 rounded-full bg-[#1D1D1F] animate-pulse" />
						<span className="w-1 h-1 rounded-full bg-[#1D1D1F] animate-pulse delay-75" />
						<span className="w-1 h-1 rounded-full bg-[#1D1D1F] animate-pulse delay-150" />
					</div>
					<span className="text-[12px] italic text-[#1D1D1F]">{activeTypist} is typing...</span>
				</div>

				{!isAtBottom ? (
					<button
						type="button"
						onClick={jumpToLatest}
						className="sticky bottom-2 self-center bg-[#0f67b7] text-white text-[12px] font-semibold px-4 py-1.5 rounded-full shadow-md hover:bg-[#0b4b8a] transition-colors"
					>
						Jump to latest
					</button>
				) : null}
			</div>

			{/* Message Input Area */}
			<footer className="px-10 pb-8 bg-white shrink-0">
				<div className="w-full space-y-3">
					{voiceConnected ? (
						<div className="flex items-center justify-between gap-3 bg-[#f5f8fc] border border-[#e3e8ef] rounded-[10px] px-3 py-2">
							<div className="flex items-center gap-2">
								<span className="material-symbols-outlined text-[#0f67b7] text-[18px]">headset_mic</span>
								<span className="text-[12px] font-semibold text-[#27415f]">Voice room active</span>
							</div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => setVoiceMuted((current) => !current)}
									className={`text-[11px] font-semibold px-2 py-1 rounded-md border ${voiceMuted ? "bg-[#ffecec] text-[#bf2d2d] border-[#f5c2c2]" : "bg-white text-[#415063] border-[#dce3ec]"}`}
								>
									{voiceMuted ? "Unmute" : "Mute"}
								</button>
								<button
									type="button"
									onClick={() => setVoiceDeafened((current) => !current)}
									className={`text-[11px] font-semibold px-2 py-1 rounded-md border ${voiceDeafened ? "bg-[#fff6e6] text-[#9f5e00] border-[#f4dfb1]" : "bg-white text-[#415063] border-[#dce3ec]"}`}
								>
									{voiceDeafened ? "Undeafen" : "Deafen"}
								</button>
							</div>
						</div>
					) : null}

					{/* Sentiment Bar */}
					<div className="flex items-center gap-4 px-2 w-full max-w-full">
						<span className="text-[10px] font-bold text-[#1D1D1F] opacity-70 uppercase tracking-widest whitespace-nowrap">
							TONE SENTIMENT
						</span>
						<div className="flex-1 h-[6px] bg-[#E5E5EA] rounded-full overflow-hidden flex">
							<div
								className="h-full bg-[#0f67b7] transition-all duration-500 rounded-full"
								style={{ width: `${Math.max(6, Math.min(95, sentimentScore))}%` }}
							/>
						</div>
						<span className="text-[12px] font-bold text-[#0f67b7]">{sentimentLabel}</span>
					</div>

					{/* Input Box */}
					<div className="bg-white rounded-[12px] shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#E5E5EA] p-3 focus-within:ring-2 focus-within:ring-[#0f67b7]/20 transition-all flex flex-col">
						<textarea
							value={inputValue}
							onChange={(event) => setInputValue(event.target.value)}
							className="w-full border-none focus:outline-none focus:ring-0 text-[14px] text-[#1D1D1F] px-1 bg-transparent resize-none placeholder:text-[#1D1D1F] placeholder:opacity-50"
							placeholder={inputPlaceholder}
							rows={1}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									sendMessage();
								}
							}}
						/>
						<div className="flex items-center justify-between mt-6">
							<div className="flex items-center gap-3 pl-1">
								<span className="material-symbols-outlined text-[24px] text-[#1D1D1F] opacity-70 hover:opacity-100 cursor-pointer" data-icon="add_circle">add_circle</span>
								<button
									type="button"
									onClick={toggleDictation}
									className={`material-symbols-outlined text-[24px] ${isDictating ? "text-[#0f67b7]" : "text-[#1D1D1F] opacity-70 hover:opacity-100"} cursor-pointer`}
									aria-label={isDictating ? "Stop dictation" : "Start dictation"}
								>
									{isDictating ? "mic" : "mic_none"}
								</button>
								<span className="material-symbols-outlined text-[24px] text-[#1D1D1F] opacity-70 hover:opacity-100 cursor-pointer" data-icon="sentiment_satisfied">sentiment_satisfied</span>
								<span className="material-symbols-outlined text-[24px] text-[#1D1D1F] opacity-70 hover:opacity-100 cursor-pointer" data-icon="alternate_email">alternate_email</span>
								
								<div className="flex items-center gap-3 ml-2 border-l border-black/10 pl-5">
									<span className="material-symbols-outlined text-[20px] text-[#1D1D1F] opacity-70" data-icon="translate">translate</span>
									<span className="text-[12px] font-semibold text-[#1D1D1F] opacity-80 uppercase tracking-widest tracking-tighter">TRANSLATE</span>
									
									<button
										type="button"
										className={`w-[32px] h-[18px] rounded-full relative cursor-pointer border ${translateEnabled ? 'bg-[#34C759] border-[#34C759]' : 'bg-[#E5E5EA] border-[#D1D1D6]'}`}
										onClick={() => setTranslateEnabled((current) => !current)}
										aria-pressed={translateEnabled}
									>
										<div className={`absolute top-[1px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all duration-200 ${translateEnabled ? "right-[1px]" : "left-[1px]"}`} />
									</button>
								</div>
							</div>

							<button
								className={`bg-[#0f67b7] text-white pl-4 pr-3 py-[6px] rounded-[16px] text-[14px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[#0b4b8a] transition-all cursor-pointer shadow-sm ${isSending ? "opacity-75 cursor-wait" : "active:scale-95"}`}
								onClick={sendMessage}
								disabled={isSending}
								aria-label={isSending ? "Sending message..." : "Send message"}
								type="button"
							>
								<span>{isSending ? "Sending..." : "Send"}</span>
								{isSending ? <span className="material-symbols-outlined text-[16px] animate-spin" data-icon="sync">sync</span> : <span className="material-symbols-outlined text-[16px]" data-icon="send">send</span>}
							</button>
						</div>
						{dictationHint ? <p className="mt-2 px-1 text-[11px] text-[#5d6a7a]">{dictationHint}</p> : null}
					</div>
				</div>
			</footer>
		</div>
	);
}
