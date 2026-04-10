import './Message.css';
import React from "react";
import { parseReactionValue } from "../data/constants";

const AVATAR_BY_USER = {
	"Sarah Chen": "https://lh3.googleusercontent.com/aida-public/AB6AXuCeX83POcK2ErUQRuh8dLEiZzV2zBzREt2WJ06F2PjbO7eT9obL2mn3MNVweL9NJEUSctvCB5_9w0xkWD_IjeNDBZsWh3LjbBhrt5CYyK1dYy2hEAPPPu5YO0w7obgjjPhyx8BZ7NyWuK6w1nDnSwpycWhj2ty3n9ITfSGoUHDuTTMjz1OsJKRDF5ZSeA7KY-2LUIVsTIt4NQqD5L9Wpnf4Q1SwIbL-SOHN96csvROrp6AlL7dLgcs3fPi2Z2cOT9pZuZv1OgfJZx1U",
	You: "https://lh3.googleusercontent.com/aida-public/AB6AXuC-W7Lq62hLSa66mScaPRkNxYrXux1-O_BA0LtVUf4MmdzQhKGN0aBfyCraiHW8pFClCoGBAMJzXf14usRgIjOWJVYAw-nBaU6fv4N_fLXAWQcAszlAj8QsBhIceVTVEmBpu9QlcKEP8us2FejQWs9ngkLQFZy7WQJSRD76xnkchS0A1TSm-9ehgXQya-1V5o3K-rTgvtJTRD5Zn_gDzVnznPCtQyBIezxrDrwPZJH3DS7e9kSEgD8WruyKAUboW42bHLviBNRqgcQm"
};

export default function Message({ message, index, onReaction }) {
	const reactions = Array.isArray(message.reactions) ? message.reactions : [];
	const isSelf = String(message.user || "").trim().toLowerCase() === "you";
	const avatarUrl = AVATAR_BY_USER[message.user] || null;

	return (
		<article className={`chat-message-row ${isSelf ? "self" : "other"}`} style={{ animationDelay: `${index * 70}ms` }}>
			{!isSelf ? (
				avatarUrl ? (
					<img className="chat-message-avatar chat-message-avatar-image" src={avatarUrl} alt={`${message.user} avatar`} />
				) : (
					<div className="chat-message-avatar" style={{ background: message.color }}>
						{message.initials}
					</div>
				)
			) : null}

			<div className="chat-message-main">
				{!isSelf ? (
					<div className="chat-message-meta">
						<span className="chat-message-user">{message.user}</span>
						<span className="chat-message-time">{message.time}</span>
					</div>
				) : (
					<div className="chat-message-meta self">
						<span className="chat-message-time">{message.time}</span>
						<span className="chat-message-user">You</span>
					</div>
				)}

				<div className={`chat-bubble ${isSelf ? "self" : "other"}`}>
					<p className="chat-bubble-text">{message.text}</p>
				</div>

				{reactions.length > 0 ? (
					<div className="chat-reaction-row">
						{reactions.map((reaction) => {
							const asText =
								typeof reaction === "string"
									? reaction
									: `${reaction.emoji || ""} ${Number(reaction.count) || 0}`.trim();
							const parsed = parseReactionValue(asText);
							return (
								<button
									key={typeof reaction === "string" ? reaction : `${reaction.emoji}-${reaction.count}`}
									className="chat-reaction-pill"
									onClick={() => onReaction(message.id, parsed.emoji)}
									aria-label={`React with ${parsed.emoji}`}
								>
									{asText}
								</button>
							);
						})}
					</div>
				) : null}

				{isSelf ? <div className="chat-self-receipt">✅ 2</div> : null}
			</div>

			{isSelf ? (
				avatarUrl ? (
					<img className="chat-message-avatar chat-message-avatar-image self" src={avatarUrl} alt="Your avatar" />
				) : (
					<div className="chat-message-avatar self" style={{ background: message.color }}>
						{message.initials}
					</div>
				)
			) : null}
		</article>
	);
}
