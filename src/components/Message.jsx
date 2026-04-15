import React from "react";
import { parseReactionValue } from "../data/constants";

const AVATAR_BY_USER = {
        "Sarah Chen": "https://lh3.googleusercontent.com/aida-public/AB6AXuCeX83POcK2ErUQRuh8dLEiZzV2zBzREt2WJ06F2PjbO7eT9obL2mn3MNVweL9NJEUSctvCB5_9w0xkWD_IjeNDBZsWh3LjbBhrt5CYyK1dYy2hEAPPPu5YO0w7obgjjPhyx8BZ7NyWuK6w1nDnSwpycWhj2ty3n9ITfSGoUHDuTTMjz1OsJKRDF5ZSeA7KY-2LUIVsTIt4NQqD5L9Wpnf4Q1SwIbL-SOHN96csvROrp6AlL7dLgcs3fPi2Z2cOT9pZuZv1OgfJZx1U",
        You: "https://lh3.googleusercontent.com/aida-public/AB6AXuC-W7Lq62hLSa66mScaPRkNxYrXux1-O_BA0LtVUf4MmdzQhKGN0aBfyCraiHW8pFClCoGBAMJzXf14usRgIjOWJVYAw-nBaU6fv4N_fLXAWQcAszlAj8QsBhIceVTVEmBpu9QlcKEP8us2FejQWs9ngkLQFZy7WQJSRD76xnkchS0A1TSm-9ehgXQya-1V5o3K-rTgvtJTRD5Zn_gDzVnznPCtQyBIezxrDrwPZJH3DS7e9kSEgD8WruyKAUboW42bHLviBNRqgcQm"
};

export default function Message({ message, index, onReaction, onReference, onEdit, onDelete, currentUserName, currentUserId }) {
        const reactions = Array.isArray(message.reactions) ? message.reactions : [];
        const normalizedUser = String(message.user || "").trim().toLowerCase();
        const normalizedCurrentUser = String(currentUserName || "").trim().toLowerCase();
        const isSelf =
                normalizedUser === "you" ||
                (currentUserId && String(message?.userId || "") === String(currentUserId)) ||
                (normalizedCurrentUser && normalizedUser === normalizedCurrentUser);
        const avatarUrl = AVATAR_BY_USER[message.user] || null;
        const canEdit = Boolean(onEdit && message?.id);
        const canDelete = Boolean(onDelete && message?.id);
        const rawSentimentScore = Number(message?.sentimentScore);
        const hasSentimentScore = Number.isFinite(rawSentimentScore);
        const sentimentScore = hasSentimentScore ? Math.max(0, Math.min(100, Math.round(rawSentimentScore))) : null;
        const sentimentLabel = !hasSentimentScore
                ? ""
                : sentimentScore >= 70
                        ? "Collaborative"
                        : sentimentScore >= 45
                                ? "Neutral"
                                : "Critical";

        return (
                <div className={`group flex gap-4 ${isSelf ? "flex-row-reverse" : "w-full max-w-[85%]"}`}>
                        {avatarUrl ? (
                                <img className="w-[38px] h-[38px] rounded-full object-cover self-start" src={avatarUrl} alt={`${message.user} avatar`} />
                        ) : (
                                <div
                                        className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-white font-bold text-[13px] self-start"
                                        style={{ background: message.color }}
                                >
                                        {message.initials}
                                </div>
                        )}
                        <div className={`flex flex-col ${isSelf ? "items-end" : "items-start w-full"}`}>
                                <div className={`flex items-baseline gap-2 mb-1.5 ${isSelf ? "" : ""}`}>
                                        {isSelf ? (
                                                <>
                                                        <span className="text-[10px] text-[#1D1D1F] opacity-50 uppercase tracking-wide">{message.time || '10:45 AM'}</span>
                                                        <span className="font-bold text-[14px] text-[#1D1D1F]">You</span>
                                                </>
                                        ) : (
                                                <>
                                                        <span className="font-bold text-[15px] tracking-tight text-[#1D1D1F]">{message.user}</span>
                                                        <span className="text-[10px] text-[#1D1D1F] opacity-50 uppercase tracking-wide">{message.time || '10:42 AM'}</span>
                                                </>
                                        )}
                                </div>
                                <div
                                        className={
                                                isSelf
                                                        ? "bg-[#0f67b7] text-white p-[14px] rounded-[8px] rounded-tr-sm max-w-[90%] shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex-shrink"
                                                        : "text-[#1D1D1F] px-1 py-1 w-full"
                                        }
                                                onDoubleClick={() => onReaction(message.id, "👍")}
                                >
                                        <p className="text-[14px] leading-[1.45]">{message.text}</p>
                                                {hasSentimentScore ? (
                                                                <p className={`mt-2 text-[11px] font-semibold ${isSelf ? "text-white/90" : "text-[#425466]"}`}>
                                                                                Tone: {sentimentLabel} ({sentimentScore}%)
                                                                </p>
                                                ) : null}
                                                {message.translatedText ? (
                                                                <div className={`mt-2 pt-2 border-t ${isSelf ? "border-white/30" : "border-black/10"}`}>
                                                                        <p className={`text-[12px] italic ${isSelf ? "text-white/90" : "text-[#425466]"}`}>
                                                                                English: {message.translatedText}
                                                                        </p>
                                                                </div>
                                                ) : null}
                                        {!isSelf && (
                                                <div className="absolute -bottom-4 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-sm rounded-full p-1 border border-black/10">
                                                                <span className="cursor-pointer hover:scale-125 transition-transform text-sm" onClick={() => onReaction(message.id, "👍")} title="Like">👍</span>
                                                                <span className="cursor-pointer hover:scale-125 transition-transform text-sm" onClick={() => onReaction(message.id, "🔥")} title="Fire">🔥</span>
                                                </div>
                                        )}
                                </div>

                                <div className={`flex flex-wrap gap-2 mt-2 ${isSelf ? "justify-end" : "justify-start"}`}>
                                        <button
                                                type="button"
                                                className="inline-flex items-center rounded-full border border-[#cdd5df] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#344054] hover:bg-[#f8fafc]"
                                                onClick={() => onReference?.(message)}
                                        >
                                                Reply
                                        </button>
                                        {canEdit ? (
                                                <>
                                                        <button
                                                                type="button"
                                                                className="inline-flex items-center rounded-full border border-[#b2ddff] bg-[#eff8ff] px-2.5 py-1 text-[11px] font-semibold text-[#175cd3] hover:bg-[#d1e9ff]"
                                                                onClick={() => onEdit?.(message)}
                                                        >
                                                                Edit
                                                        </button>
                                                </>
                                        ) : null}
                                        {canDelete ? (
                                                <>
                                                        <button
                                                                type="button"
                                                                className="inline-flex items-center rounded-full border border-[#fecdca] bg-[#fef3f2] px-2.5 py-1 text-[11px] font-semibold text-[#b42318] hover:bg-[#fee4e2]"
                                                                onClick={() => onDelete?.(message)}
                                                        >
                                                                Unsend
                                                        </button>
                                                </>
                                        ) : null}
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
