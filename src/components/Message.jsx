import React from "react";
import { parseReactionValue } from "../data/constants";

export default function Message({ message, index, onReaction }) {
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
					{message.reactions.map((reaction) => {
						const parsed = parseReactionValue(reaction);
						return (
							<button
								key={reaction}
								className="reaction-pill"
								onClick={() => onReaction(message.id, parsed.emoji)}
								aria-label={`React with ${parsed.emoji}`}
							>
								{reaction}
							</button>
						);
					})}
				</div>
			</div>
		</article>
	);
}
