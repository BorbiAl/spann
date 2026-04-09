import React, { useEffect, useState } from "react";
import Badge from "../components/Badge";
import Icon from "../components/Icon";
import Message from "../components/Message";
import Toggle from "../components/Toggle";
import { CHANNELS } from "../data/constants";

export default function ChatView({
	activeChannel,
	channelMood,
	messages,
	onSendMessage,
	onReactMessage,
	translateEnabled,
	setTranslateEnabled,
	showNudge,
	setShowNudge
}) {
	const [inputValue, setInputValue] = useState("");

	const sentimentScore = Number(channelMood || CHANNELS.find((channel) => channel.name === activeChannel)?.mood || 65);
	const sentimentTone = sentimentScore > 70 ? "green" : sentimentScore > 45 ? "orange" : "red";
	const sentimentLabel =
		sentimentScore > 70 ? "Calm Momentum" : sentimentScore > 45 ? "Focused Tension" : "Escalation Risk";

	useEffect(() => {
		setInputValue("");
	}, [activeChannel]);

	function sendMessage() {
		const text = inputValue.trim();
		if (!text) {
			return;
		}

		onSendMessage(activeChannel, text, translateEnabled);
		setInputValue("");
	}

	return (
		<div className="view-transition">
			<section className="card">
				<div className="hero-row">
					<div>
						<p className="title" style={{ marginBottom: 4 }}>
							{activeChannel}
						</p>
						<p className="caption">Sentiment Pulse: live emotional balance across the channel</p>
					</div>
					<Badge tone={sentimentTone}>{sentimentLabel}</Badge>
				</div>
				<div className="sentiment-track">
					<div className="sentiment-knob" style={{ left: `${sentimentScore}%` }} />
				</div>
			</section>

			<section className="card">
				<p className="title">Conversation Thread</p>
				<div className="messages-list">
					{messages.map((message, index) => (
						<Message
							key={message.id}
							message={message}
							index={index}
							onReaction={(messageId, emoji) => onReactMessage(activeChannel, messageId, emoji)}
						/>
					))}
				</div>

				<div className="chat-composer">
					{showNudge ? (
						<div className="nudge">
							<span>💡 Try rephrasing this as a suggestion</span>
							<button className="tiny-btn" onClick={() => setShowNudge(false)} aria-label="Dismiss nudge">
								<Icon name="close" size={14} />
							</button>
						</div>
					) : null}

					<div className="toolbar-row">
						<div className="tool-group">
							<button
								className="tiny-btn"
								aria-label="Add emoji"
								onClick={() => setInputValue((current) => `${current}${current ? " " : ""}🙂`)}
							>
								<Icon name="emoji" size={17} />
							</button>
							<button
								className="tiny-btn"
								aria-label="Attach file"
								onClick={() =>
									setInputValue((current) => `${current}${current ? " " : ""}[attached: status-report.pdf]`)
								}
							>
								<Icon name="attach" size={17} />
							</button>
							<button
								className="tiny-btn"
								aria-label="Voice input"
								onClick={() => setInputValue((current) => `${current}${current ? " " : ""}[voice note transcribed]`)}
							>
								<Icon name="mic" size={17} />
							</button>
						</div>
						<div className="toggle-pill">
							<span>Translate</span>
							<Toggle value={translateEnabled} onChange={setTranslateEnabled} />
						</div>
					</div>

					<div className="composer-shell">
						<input
							value={inputValue}
							onChange={(event) => setInputValue(event.target.value)}
							className="composer-input"
							placeholder={`Message ${activeChannel}`}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									sendMessage();
								}
							}}
						/>
						<button className="send-btn" onClick={sendMessage} aria-label="Send message">
							<Icon name="send" size={16} />
						</button>
					</div>
				</div>
			</section>
		</div>
	);
}
