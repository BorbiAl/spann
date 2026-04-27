import React, { useState } from "react";
import { parseReactionValue } from "../data/constants";
import { understandApi } from "../api/understand";
import { useUnderstandStore } from "../store/understand";
import { useUserSettingsStore } from "../store/userSettings";

export default function Message({
	message,
	onReaction,
	onReference,
	onEdit,
	onDelete,
	currentUserName,
	currentUserId,
}) {
	const reactions = Array.isArray(message.reactions) ? message.reactions : [];

	const isSelf =
		String(message.user || "").trim().toLowerCase() === "you" ||
		(currentUserId && String(message.userId || "") === String(currentUserId)) ||
		(currentUserName && String(message.user || "") === String(currentUserName));

	const { settings } = useUserSettingsStore();
	const {
		simplifiedCache,
		understandCache,
		speakingMessageId,
		setSimplified,
		setUnderstand,
		setSpeaking,
	} = useUnderstandStore();

	const [isLoadingSimplify, setIsLoadingSimplify] = useState(false);
	const [isLoadingExplain, setIsLoadingExplain] = useState(false);
	const [showSimplified, setShowSimplified] = useState(false);
	const [showExplain, setShowExplain] = useState(false);
	const [simplifyError, setSimplifyError] = useState(false);
	const [explainError, setExplainError] = useState(false);

	const cacheKey = String(message.id);
	const simplifiedText = simplifiedCache[cacheKey];
	const understandResult = understandCache[cacheKey];
	const isSpeaking = speakingMessageId === cacheKey;

	async function handleSimplify() {
		if (simplifiedText) {
			setShowSimplified((v) => !v);
			return;
		}
		setSimplifyError(false);
		setIsLoadingSimplify(true);
		try {
			const result = await understandApi.understand({
				message_text: message.text,
				user_preferences: {
					reading_level: settings.reading_level ?? "standard",
					language: settings.preferred_language ?? "en",
				},
			});
			setSimplified(cacheKey, result.simplified);
			setUnderstand(cacheKey, result);
			setShowSimplified(true);
		} catch {
			setSimplifyError(true);
		} finally {
			setIsLoadingSimplify(false);
		}
	}

	async function handleExplain() {
		if (understandResult) {
			setShowExplain((v) => !v);
			return;
		}
		setExplainError(false);
		setIsLoadingExplain(true);
		try {
			const result = await understandApi.understand({
				message_text: message.text,
				user_preferences: {
					reading_level: settings.reading_level ?? "standard",
					language: settings.preferred_language ?? "en",
				},
			});
			setUnderstand(cacheKey, result);
			setSimplified(cacheKey, result.simplified);
			setShowExplain(true);
		} catch {
			setExplainError(true);
		} finally {
			setIsLoadingExplain(false);
		}
	}

	function handleListen() {
		if (typeof window === "undefined" || !window.speechSynthesis) return;

		if (isSpeaking) {
			window.speechSynthesis.cancel();
			setSpeaking(null);
			return;
		}

		window.speechSynthesis.cancel();
		const textToRead =
			showSimplified && simplifiedText ? simplifiedText : message.text;
		const utterance = new SpeechSynthesisUtterance(textToRead);
		utterance.onend = () => setSpeaking(null);
		utterance.onerror = () => setSpeaking(null);
		window.speechSynthesis.speak(utterance);
		setSpeaking(cacheKey);
	}

	const displayText =
		showSimplified && simplifiedText ? simplifiedText : message.text;

	return (
		<div
			className={`group flex gap-4 ${isSelf ? "flex-row-reverse" : "w-full max-w-[85%]"}`}
		>
			{/* Avatar */}
			{message.avatarUrl ? (
				<img
					className="w-[38px] h-[38px] rounded-full object-cover self-start flex-shrink-0"
					src={message.avatarUrl}
					alt={`${message.user} avatar`}
				/>
			) : (
				<div
					className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-white font-bold text-[13px] self-start flex-shrink-0"
					style={{ background: message.color || "#0f67b7" }}
				>
					{message.initials || "ME"}
				</div>
			)}

			<div className={`flex flex-col min-w-0 ${isSelf ? "items-end" : "items-start w-full"}`}>
				{/* Name + time */}
				<div className="flex items-baseline gap-2 mb-1.5">
					{isSelf ? (
						<>
							<span className="text-[10px] text-[#1D1D1F] opacity-50 uppercase tracking-wide">
								{message.time || "10:45 AM"}
							</span>
							<span className="font-bold text-[14px] text-[#1D1D1F]">You</span>
						</>
					) : (
						<>
							<span className="font-bold text-[15px] tracking-tight text-[#1D1D1F]">
								{message.user}
							</span>
							<span className="text-[10px] text-[#1D1D1F] opacity-50 uppercase tracking-wide">
								{message.time || "10:42 AM"}
							</span>
						</>
					)}
				</div>

				{/* Bubble */}
				<div
					className={
						isSelf
							? "bg-[#0f67b7] text-white p-[14px] rounded-[8px] rounded-tr-sm max-w-[90%] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
							: "text-[#1D1D1F] px-1 py-1 w-full"
					}
					onDoubleClick={() => onReaction?.(message.id, "👍")}
				>
					<p className="text-[14px] leading-[1.45]">{displayText}</p>

					{message.translatedText ? (
						<div
							className={`mt-2 pt-2 border-t ${isSelf ? "border-white/30" : "border-black/10"}`}
						>
							<p
								className={`text-[12px] italic ${isSelf ? "text-white/90" : "text-[#425466]"}`}
							>
								English: {message.translatedText}
							</p>
						</div>
					) : null}
				</div>

				{/* Action bar — visible on hover (keyboard-focusable) */}
				<div
					className={`flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 ${isSelf ? "justify-end" : "justify-start"}`}
					role="toolbar"
					aria-label="Message actions"
				>
					<button
						type="button"
						onClick={handleSimplify}
						disabled={isLoadingSimplify}
						className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400 ${
							simplifyError
								? "border-red-200 text-red-500 bg-white hover:bg-red-50"
								: showSimplified
								? "bg-blue-50 border-blue-300 text-blue-700"
								: "border-black/15 text-[#555] bg-white hover:bg-black/5"
						} disabled:opacity-40`}
						aria-pressed={showSimplified}
						title="Show plain-language version"
					>
						{isLoadingSimplify ? (
							<span className="inline-flex items-center gap-1">
								<span className="w-10 h-1.5 rounded bg-current opacity-20 animate-pulse" />
								<span className="sr-only">Thinking…</span>
							</span>
						) : simplifyError ? (
							"Retry"
						) : showSimplified ? (
							"Original"
						) : (
							"Simplify"
						)}
					</button>

					<button
						type="button"
						onClick={handleExplain}
						disabled={isLoadingExplain}
						className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400 ${
							explainError
								? "border-red-200 text-red-500 bg-white hover:bg-red-50"
								: showExplain
								? "bg-blue-50 border-blue-300 text-blue-700"
								: "border-black/15 text-[#555] bg-white hover:bg-black/5"
						} disabled:opacity-40`}
						aria-pressed={showExplain}
						title="Explain idioms and context"
					>
						{isLoadingExplain ? (
							<span className="inline-flex items-center gap-1">
								<span className="w-10 h-1.5 rounded bg-current opacity-20 animate-pulse" />
								<span className="sr-only">Thinking…</span>
							</span>
						) : explainError ? (
							"Retry"
						) : (
							"Explain"
						)}
					</button>

					<button
						type="button"
						onClick={handleListen}
						className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400 ${
							isSpeaking
								? "bg-blue-50 border-blue-300 text-blue-700"
								: "border-black/15 text-[#555] bg-white hover:bg-black/5"
						}`}
						aria-pressed={isSpeaking}
						title={isSpeaking ? "Stop reading" : "Read aloud (TTS)"}
					>
						{isSpeaking ? "Stop" : "Listen"}
					</button>

					{!isSelf ? (
						<button
							type="button"
							onClick={() => onReference?.(message)}
							className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-black/15 text-[#555] bg-white hover:bg-black/5 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
							title="Reply to this message"
						>
							Reply
						</button>
					) : (
						<>
							<button
								type="button"
								onClick={() => onEdit?.(message)}
								className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-black/15 text-[#555] bg-white hover:bg-black/5 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
								title="Edit message"
							>
								Edit
							</button>
							<button
								type="button"
								onClick={() => onDelete?.(message)}
								className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-red-200 text-red-500 bg-white hover:bg-red-50 transition-colors focus:outline-none focus:ring-1 focus:ring-red-300"
								title="Unsend message"
							>
								Unsend
							</button>
						</>
					)}
				</div>

				{/* Explain loading shimmer */}
				{isLoadingExplain ? (
					<div className="mt-2 rounded-xl border border-black/10 bg-[#F9F9FB] p-3 w-full max-w-xl shadow-sm">
						<div className="h-2.5 w-24 rounded bg-black/8 animate-pulse mb-3" />
						<div className="space-y-2">
							<div className="h-2 w-full rounded bg-black/6 animate-pulse" />
							<div className="h-2 w-4/5 rounded bg-black/6 animate-pulse" />
						</div>
					</div>
				) : null}

				{/* Explain error */}
				{explainError && !isLoadingExplain ? (
					<div className="mt-2 rounded-xl border border-red-100 bg-red-50 p-3 w-full max-w-xl">
						<p className="text-[12px] text-red-500">Couldn&apos;t process — try again</p>
					</div>
				) : null}

				{/* Explain panel */}
				{showExplain && understandResult ? (
					<div className="mt-2 rounded-xl border border-black/10 bg-[#F9F9FB] p-3 w-full max-w-xl shadow-sm transition-all">
						<div className="flex items-center justify-between mb-2">
							<p className="font-semibold text-[#1D1D1F] text-[12px] uppercase tracking-wide">
								Explanation
							</p>
							<button
								type="button"
								onClick={() => setShowExplain(false)}
								className="text-[#8E8E93] hover:text-[#1D1D1F] text-[18px] leading-none transition-colors"
								aria-label="Close explanation"
							>
								×
							</button>
						</div>

						{understandResult.tone_hint ? (
							<p className="text-[11px] text-[#8E8E93] mb-2">
								Tone:{" "}
								<span className="font-semibold text-[#1D1D1F]">
									{understandResult.tone_hint}
								</span>
							</p>
						) : null}

						<p className="text-[13px] text-[#3A3A3C] leading-relaxed mb-3">
							{understandResult.explanation}
						</p>

						{understandResult.idioms?.length > 0 ? (
							<div>
								<p className="text-[10px] font-bold uppercase tracking-widest text-[#8E8E93] mb-2">
									Idioms &amp; Phrases
								</p>
								<div className="space-y-2">
									{understandResult.idioms.map((idiom, i) => (
										<div
											key={i}
											className="rounded-lg bg-white border border-black/8 px-3 py-2"
										>
											<p className="text-[12px] font-semibold text-[#0f67b7]">
												&ldquo;{idiom.phrase}&rdquo;
											</p>
											<p className="text-[11px] text-[#3A3A3C] mt-0.5">
												{idiom.meaning}
											</p>
											<p className="text-[11px] text-[#8E8E93] italic mt-0.5">
												≈ {idiom.localized_equivalent}
											</p>
										</div>
									))}
								</div>
							</div>
						) : null}
					</div>
				) : null}

				{/* Reactions */}
				{reactions.length > 0 ? (
					<div
						className={`flex flex-wrap gap-1 mt-1.5 ${isSelf ? "justify-end" : "justify-start pl-1"}`}
					>
						{reactions.map((reaction) => {
							const asText =
								typeof reaction === "string"
									? reaction
									: `${reaction.emoji || ""} ${Number(reaction.count) || 0}`.trim();
							const parsed = parseReactionValue(asText);
							return (
								<button
									key={asText}
									type="button"
									className="bg-[#E5E5EA] border border-black/5 rounded-[4px] px-1.5 py-0.5 flex items-center gap-1.5 hover:bg-black/10 transition-colors"
									onClick={() => onReaction?.(message.id, parsed.emoji)}
									aria-label={`${parsed.emoji} ${parsed.count} reactions`}
								>
									<span className="text-[11px] leading-none">{parsed.emoji}</span>
									<span className="text-[11px] font-bold text-[#1D1D1F] opacity-70 leading-none">
										{parsed.count}
									</span>
								</button>
							);
						})}
					</div>
				) : null}
			</div>
		</div>
	);
}
