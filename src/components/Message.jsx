import React from "react";
import { parseReactionValue } from "../data/constants";
import { understandApi } from "../api/understand";
import { useUnderstandStore, understandKey } from "../store/understand";
import { useUserSettingsStore } from "../store/userSettings";

const AVATAR_BY_USER = {
	"Sarah Chen": "https://lh3.googleusercontent.com/aida-public/AB6AXuCeX83POcK2ErUQRuh8dLEiZzV2zBzREt2WJ06F2PjbO7eT9obL2mn3MNVweL9NJEUSctvCB5_9w0xkWD_IjeNDBZsWh3LjbBhrt5CYyK1dYy2hEAPPPu5YO0w7obgjjPhyx8BZ7NyWuK6w1nDnSwpycWhj2ty3n9ITfSGoUHDuTTMjz1OsJKRDF5ZSeA7KY-2LUIVsTIt4NQqD5L9Wpnf4Q1SwIbL-SOHN96csvROrp6AlL7dLgcs3fPi2Z2cOT9pZuZv1OgfJZx1U",
	You: "https://lh3.googleusercontent.com/aida-public/AB6AXuC-W7Lq62hLSa66mScaPRkNxYrXux1-O_BA0LtVUf4MmdzQhKGN0aBfyCraiHW8pFClCoGBAMJzXf14usRgIjOWJVYAw-nBaU6fv4N_fLXAWQcAszlAj8QsBhIceVTVEmBpu9QlcKEP8us2FejQWs9ngkLQFZy7WQJSRD76xnkchS0A1TSm-9ehgXQya-1V5o3K-rTgvtJTRD5Zn_gDzVnznPCtQyBIezxrDrwPZJH3DS7e9kSEgD8WruyKAUboW42bHLviBNRqgcQm"
};

const CATEGORY_STYLES = {
	idiom:        "bg-violet-100 text-violet-700",
	phrasal_verb: "bg-sky-100 text-sky-700",
	metaphor:     "bg-amber-100 text-amber-700",
	slang:        "bg-rose-100 text-rose-700",
	jargon:       "bg-emerald-100 text-emerald-700",
};

// ─── Explain Modal ───────────────────────────────────────────────────────────

function ExplainModal({ data, onClose }) {
	return createPortal(
		<div
			className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
			style={{
				background: "rgba(0,0,0,0.24)",
				backdropFilter: "blur(8px)",
				WebkitBackdropFilter: "blur(8px)",
				animation: "backdropIn 180ms ease-out both",
			}}
			onClick={onClose}
		>
			<div
				className="w-full max-w-sm bg-white overflow-hidden"
				style={{
					borderRadius: "18px",
					boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 40px rgba(0,0,0,0.14), 0 0 0 0.5px rgba(0,0,0,0.06)",
					animation: "explainIn 240ms cubic-bezier(0.22,1,0.36,1) both",
				}}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center gap-2.5 px-5 pt-5 pb-3">
					<span className="text-[13px] font-semibold text-[#1D1D1F] tracking-tight flex-1">Message breakdown</span>
					{data.tone_hint ? (
						<span className="text-[10px] font-medium text-[#6e6e73] bg-[#F5F5F7] rounded-full px-2.5 py-[3px] tracking-wide">
							{data.tone_hint}
						</span>
					) : null}
					<button
						type="button"
						onClick={onClose}
						className="w-[26px] h-[26px] rounded-full bg-[#F5F5F7] flex items-center justify-center text-[#6e6e73] hover:bg-[#E8E8ED] active:scale-95 transition-[background-color,transform] duration-[120ms]"
						aria-label="Close"
					>
						<svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
							<path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
						</svg>
					</button>
				</div>

				{/* Explanation */}
				{data.explanation ? (
					<div className="px-5 pb-4">
						<p className="text-[13px] text-[#3a3a3c] leading-[1.55]">{data.explanation}</p>
					</div>
				) : null}

				{/* Idioms */}
				{data.idioms && data.idioms.length > 0 ? (
					<div className="border-t border-[#F2F2F7] px-5 pt-3.5 pb-5">
						<p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8e8e93] mb-3">Phrases &amp; Idioms</p>
						<div className="flex flex-col">
							{data.idioms.map((idiom, i) => (
								<div
									key={i}
									className={`flex flex-col gap-1 py-2.5 ${i < data.idioms.length - 1 ? "border-b border-[#F2F2F7]" : ""}`}
								>
									<div className="flex items-center gap-2 flex-wrap">
										<span className="text-[12px] font-semibold text-[#1D1D1F]">"{idiom.phrase}"</span>
										{idiom.category ? (
											<span className={`text-[9px] font-bold px-1.5 py-[2px] rounded-full uppercase tracking-[0.06em] ${CATEGORY_STYLES[idiom.category] || CATEGORY_STYLES.idiom}`}>
												{idiom.category.replace("_", " ")}
											</span>
										) : null}
									</div>
									<span className="text-[12px] text-[#6e6e73] leading-[1.45]">{idiom.meaning}</span>
									{idiom.localized_equivalent && idiom.localized_equivalent !== idiom.phrase ? (
										<span className="text-[11px] text-[#0f67b7] flex items-center gap-1.5 mt-0.5">
											<span className="opacity-40 text-[10px]">→</span>
											<span className="font-medium">{idiom.localized_equivalent}</span>
										</span>
									) : null}
								</div>
							))}
						</div>
					</div>
				) : (
					<div className="pb-4" />
				)}
			</div>
		</div>,
		document.body
	);
}

// ─── Message component ───────────────────────────────────────────────────────

function Message({ message, index, onReaction }) {
	const reactions = Array.isArray(message.reactions) ? message.reactions : [];
	const isSelf = String(message.user || "").trim().toLowerCase() === "you";
	const avatarUrl = AVATAR_BY_USER[message.user] || null;
	const messageId = String(message.id);

	// Granular user settings selectors — avoids re-render when unrelated settings change
	const readingLevel = useUserSettingsStore(s => s.settings?.reading_level || "general");
	const preferredLanguage = useUserSettingsStore(s => s.settings?.preferred_language || "en");
	const autoSimplify = useUserSettingsStore(s => Boolean(s.settings?.auto_simplify));

	// Compound cache key — invalidates automatically when reading level or language changes
	const cacheKey = useMemo(
		() => understandKey(messageId, readingLevel, preferredLanguage),
		[messageId, readingLevel, preferredLanguage],
	);

	// Granular store selectors — each Message only re-renders for its own cache slot
	const simplifiedText = useUnderstandStore(s => s.simplifiedCache[cacheKey]);
	const understoodResult = useUnderstandStore(s => s.understandCache[cacheKey]);
	const isExplainOpen = useUnderstandStore(s => s.explainMessageId === messageId);
	const isSpeaking = useUnderstandStore(s => s.speakingMessageId === messageId);
	const setSimplified = useUnderstandStore(s => s.setSimplified);
	const setUnderstand = useUnderstandStore(s => s.setUnderstand);
	const openExplain = useUnderstandStore(s => s.openExplain);
	const closeExplain = useUnderstandStore(s => s.closeExplain);
	const setSpeaking = useUnderstandStore(s => s.setSpeaking);

	// Local UI state
	// Default to simplified view when auto_simplify is on (for non-self messages)
	const [showSimplified, setShowSimplified] = useState(
		!isSelf && autoSimplify,
	);
	const [pendingAction, setPendingAction] = useState(null);
	// Prevent the auto-simplify effect from firing more than once per message mount
	const hasAutoFetchedRef = useRef(false);
	// Stable ref so setTimeout callbacks always call the latest mutate function
	const mutateRef = useRef(null);

	// Build understand API params from user settings
	const understandParams = useCallback(
		() => ({
			message_text: message.text,
			user_preferences: {
				reading_level: readingLevel === "simple" ? "simple" : "general",
				language: preferredLanguage,
			},
		}),
		[message.text, readingLevel, preferredLanguage],
	);

	// Understand mutation
	const understandMutation = useMutation({
		mutationFn: () => understandApi.understand(understandParams()),
		onSuccess: (result) => {
			setUnderstand(cacheKey, result);
			setSimplified(cacheKey, result.simplified);
			if (pendingAction === "simplify") {
				setShowSimplified(true);
			} else if (pendingAction === "explain") {
				openExplain(messageId);
			}
			setPendingAction(null);
		},
		onError: () => setPendingAction(null),
	});

	const isLoading = understandMutation.isPending;
	// Keep ref current so staggered timeouts always call the latest mutate
	mutateRef.current = understandMutation.mutate;

	// Auto-simplify: staggered fetch — index * 80ms (max 1.2s) to avoid thundering herd
	useEffect(() => {
		if (isSelf || !autoSimplify || hasAutoFetchedRef.current) return;
		if (simplifiedText) {
			setShowSimplified(true);
			return;
		}
		hasAutoFetchedRef.current = true;
		const delay = Math.min(index * 80, 1200);
		const timer = setTimeout(() => {
			setPendingAction("simplify");
			mutateRef.current?.();
		}, delay);
		return () => clearTimeout(timer);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoSimplify]);

	const handleSimplify = useCallback(() => {
		if (showSimplified) {
			setShowSimplified(false);
			return;
		}
		if (simplifiedText) {
			setShowSimplified(true);
			return;
		}
		setPendingAction("simplify");
		understandMutation.mutate();
	}, [showSimplified, simplifiedText, understandMutation]);

	const handleExplain = useCallback(() => {
		if (understoodResult) {
			openExplain(messageId);
			return;
		}
		setPendingAction("explain");
		understandMutation.mutate();
	}, [understoodResult, messageId, openExplain, understandMutation]);

	const handleListen = useCallback(() => {
		if (!window.speechSynthesis) return;
		if (isSpeaking) {
			window.speechSynthesis.cancel();
			setSpeaking(null);
			return;
		}
		window.speechSynthesis.cancel();
		const text = showSimplified && simplifiedText ? simplifiedText : message.text;
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.onend = () => setSpeaking(null);
		utterance.onerror = () => setSpeaking(null);
		window.speechSynthesis.speak(utterance);
		setSpeaking(messageId);
	}, [isSpeaking, messageId, showSimplified, simplifiedText, message.text, setSpeaking]);

	const displayText = showSimplified && simplifiedText ? simplifiedText : message.text;

	return (
		<>
			<div
				className={`group flex gap-4 ${isSelf ? "flex-row-reverse" : "w-full max-w-[85%]"}`}
				style={{ animation: "messageAppear 200ms cubic-bezier(0.22,1,0.36,1) both" }}
			>
				{/* Avatar */}
				{avatarUrl ? (
					<img
						className="w-[36px] h-[36px] rounded-full object-cover self-start flex-shrink-0"
						style={{ boxShadow: "0 0 0 2px white, 0 0 0 3px rgba(0,0,0,0.06)" }}
						src={avatarUrl}
						alt={`${message.user} avatar`}
					/>
				) : (
					<div
						className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-white font-bold text-[13px] self-start flex-shrink-0"
						style={{ background: message.color, boxShadow: "0 0 0 2px white, 0 0 0 3px rgba(0,0,0,0.06)" }}
					>
						{message.initials}
					</div>
				)}

				<div className={`flex flex-col ${isSelf ? "items-end" : "items-start w-full"}`}>
					{/* Name + time */}
					<div className="flex items-baseline gap-2 mb-1">
						{isSelf ? (
							<>
								<span className="text-[10px] text-[#1D1D1F] opacity-40 uppercase tracking-wide">{message.time || "10:45 AM"}</span>
								<span className="font-semibold text-[13px] text-[#1D1D1F]">You</span>
							</>
						) : (
							<>
								<span className="font-semibold text-[14px] tracking-tight text-[#1D1D1F]">{message.user}</span>
								<span className="text-[10px] text-[#1D1D1F] opacity-40 uppercase tracking-wide">{message.time || "10:42 AM"}</span>
							</>
						)}
					</div>

					{/* Message bubble wrapper — relative for action toolbar */}
					<div className="relative w-full">
						{/* Understand action toolbar (non-self messages only) */}
						{!isSelf && (
							<div
								className="absolute -top-8 left-0 z-20 pointer-events-none group-hover:pointer-events-auto"
								style={{
									opacity: 0,
									transform: "translateY(4px)",
									transition: "opacity 160ms ease-out, transform 160ms ease-out",
								}}
								ref={(el) => {
									if (el) {
										// Drive enter/exit via the parent group hover using CSS variables
										el.closest(".group")?.addEventListener("mouseenter", () => {
											el.style.opacity = "1";
											el.style.transform = "translateY(0)";
										}, { passive: true });
										el.closest(".group")?.addEventListener("mouseleave", () => {
											el.style.opacity = "0";
											el.style.transform = "translateY(4px)";
										}, { passive: true });
									}
								}}
								aria-label="Message actions"
							>
								<div
									className="flex items-center rounded-full px-0.5 py-0.5 gap-px"
									style={{
										background: "rgba(255,255,255,0.96)",
										border: "1px solid rgba(0,0,0,0.06)",
										boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.04)",
										backdropFilter: "blur(12px)",
									}}
								>
									{/* Simplify */}
									<button
										type="button"
										onClick={handleSimplify}
										disabled={isLoading && pendingAction === "simplify"}
										className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-[background-color,color] duration-[120ms] active:scale-[0.93] ${
											showSimplified
												? "text-[#0f67b7] bg-[#0f67b7]/10"
												: "text-[#3a3a3c] hover:bg-[#F5F5F7]"
										}`}
										title={showSimplified ? "Show original" : "Simplify"}
									>
										{isLoading && pendingAction === "simplify" ? (
											<LoadingDots />
										) : (
											<>
												<svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
													<path d="M2 3h8M2 6h5M2 9h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
												</svg>
												<span>{showSimplified ? "Original" : "Simplify"}</span>
											</>
										)}
									</button>

									<div className="w-px h-3 bg-black/[0.07] mx-0.5" />

									{/* Explain */}
									<button
										type="button"
										onClick={handleExplain}
										disabled={isLoading && pendingAction === "explain"}
										className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-[#3a3a3c] hover:bg-[#F5F5F7] transition-[background-color] duration-[120ms] active:scale-[0.93]"
										title="Explain"
									>
										{isLoading && pendingAction === "explain" ? (
											<LoadingDots />
										) : (
											<>
												<svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
													<circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4" />
													<path d="M6 5.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
													<circle cx="6" cy="3.8" r="0.7" fill="currentColor" />
												</svg>
												<span>Explain</span>
											</>
										)}
									</button>

									<div className="w-px h-3 bg-black/[0.07] mx-0.5" />

									{/* Listen */}
									<button
										type="button"
										onClick={handleListen}
										className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-[background-color,color] duration-[120ms] active:scale-[0.93] ${
											isSpeaking
												? "text-[#0f67b7] bg-[#0f67b7]/10"
												: "text-[#3a3a3c] hover:bg-[#F5F5F7]"
										}`}
										title={isSpeaking ? "Stop" : "Listen"}
									>
										{isSpeaking ? (
											<>
												<svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
													<rect x="2.5" y="2.5" width="2.5" height="7" rx="1" fill="currentColor" />
													<rect x="7" y="2.5" width="2.5" height="7" rx="1" fill="currentColor" />
												</svg>
												<span>Stop</span>
											</>
										) : (
											<>
												<svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
													<path d="M6 2a3 3 0 0 1 3 3v1a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="1.4" />
													<path d="M2.5 6.5A3.5 3.5 0 0 0 6 10a3.5 3.5 0 0 0 3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
													<path d="M6 10v1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
												</svg>
												<span>Listen</span>
											</>
										)}
									</button>
								</div>
							</div>
						)}

						{/* Bubble */}
						<div
							className={
								isSelf
									? "bg-[#0f67b7] text-white p-[13px_15px] rounded-[10px] rounded-tr-[4px] max-w-[90%] flex-shrink"
									: "text-[#1D1D1F] px-1 py-1 w-full rounded-[6px] hover:bg-black/[0.018] transition-colors duration-[140ms]"
							}
							style={isSelf ? { boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(15,103,183,0.14)" } : undefined}
							onDoubleClick={() => onReaction(message.id, "👍")}
						>
							<p className="text-[14px] leading-[1.5]">{displayText}</p>

							{/* Simplified badge */}
							{showSimplified && !isSelf && (
								<p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-[#0f67b7] opacity-60">
									Simplified
								</p>
							)}

							{message.translatedText ? (
								<div className={`mt-2 pt-2 border-t ${isSelf ? "border-white/20" : "border-black/[0.06]"}`}>
									<p className={`text-[12px] italic ${isSelf ? "text-white/80" : "text-[#425466]"}`}>
										English: {message.translatedText}
									</p>
								</div>
							) : null}

							{!isSelf && (
								<div
									className="absolute -bottom-4 right-0 flex gap-1 bg-white rounded-full p-1 border border-black/[0.07]"
									style={{
										opacity: 0,
										transform: "translateY(3px)",
										transition: "opacity 140ms ease-out, transform 140ms ease-out",
										boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
									}}
									ref={(el) => {
										if (el) {
											el.closest(".group")?.addEventListener("mouseenter", () => {
												el.style.opacity = "1";
												el.style.transform = "translateY(0)";
											}, { passive: true });
											el.closest(".group")?.addEventListener("mouseleave", () => {
												el.style.opacity = "0";
												el.style.transform = "translateY(3px)";
											}, { passive: true });
										}
									}}
								>
									<span className="cursor-pointer hover:scale-[1.2] active:scale-[0.9] transition-transform duration-[120ms] text-sm" onClick={() => onReaction(message.id, "👍")} title="Like">👍</span>
									<span className="cursor-pointer hover:scale-[1.2] active:scale-[0.9] transition-transform duration-[120ms] text-sm" onClick={() => onReaction(message.id, "🔥")} title="Fire">🔥</span>
								</div>
							)}
						</div>
					</div>

                                <div className={`flex gap-1 mt-1 ${isSelf ? "justify-end" : "justify-start pl-1"}`}>
                                        {reactions.length > 0 &&
                                                reactions.map((reaction) => {
                                                        const asText = typeof reaction === "string" ? reaction : `${reaction.emoji || ""} ${Number(reaction.count) || 0}`.trim();
                                                        const parsed = parseReactionValue(asText);
                                                        return (
                                                                <div
                                                                        key={typeof reaction === "string" ? reaction : `${reaction.emoji}-${reaction.count}`}
                                                                        className="bg-[#E5E5EA] border border-black/5 rounded-[4px] px-1.5 py-0.5 flex items-center gap-1.5 cursor-pointer hover:bg-black/10"
                                                                        onClick={() => onReaction(message.id, parsed.emoji)}
                                                                        aria-label={`React with ${parsed.emoji}`}
                                                                >
                                                                        <span className="text-[11px] leading-none">{parsed.emoji}</span>
                                                                        <span className="text-[11px] font-bold text-[#1D1D1F] opacity-70 leading-none">{parsed.count}</span>
                                                                </div>
                                                        );
                                                })}

                                        {isSelf && (
                                                <div className="bg-[#E5E5EA] rounded-[4px] px-1.5 py-0.5 flex items-center gap-1 cursor-pointer hover:bg-black/10 transition-colors">
                                                        <span className="text-[10px] leading-none">?</span>
                                                        <span className="text-[10px] font-bold text-[#1D1D1F] opacity-70 leading-none">2</span>
                                                </div>
                                        )}
                                </div>
                        </div>
                </div>
        );
}
