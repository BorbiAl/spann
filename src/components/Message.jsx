import React from "react";
import { parseReactionValue } from "../data/constants";

export default function Message({ message, index, onReaction }) {
	const reactions = Array.isArray(message.reactions) ? message.reactions : [];

	return (
		<article className="message-item" style={{ animationDelay: `${index * 70}ms` }}>
			<div className="avatar" style={{ background: message.color }}>
				{message.initials}
			</div>
			<div className="message-main">
				{message.translated ? (
					<div className="translation-label">{message.lang || "🌐"} Translated from Spanish</div>
				) : null}
				<div className="message-meta">
					<span className="message-user">{message.user}</span>
					<span className="message-time">{message.time}</span>
				</div>
				<p className="message-text">{message.text}</p>
				<div className="reaction-row">
					{reactions.map((reaction) => {
						const asText =
							typeof reaction === "string"
								? reaction
								: `${reaction.emoji || ""} ${Number(reaction.count) || 0}`.trim();
						const parsed = parseReactionValue(asText);
						return (
							<button
								key={typeof reaction === "string" ? reaction : `${reaction.emoji}-${reaction.count}`}
								className="reaction-pill"
								onClick={() => onReaction(message.id, parsed.emoji)}
								aria-label={`React with ${parsed.emoji}`}
							>
								{asText}
							</button>
						);
					})}
				</div>
			</div>
		</article>
	);
}
