import './ChatView.css';
import React, { useEffect, useState } from "react";
import Icon from "../components/Icon";
import Message from "../components/Message";
import { CHANNELS } from "../data/constants";

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
	onSendMessage,
	onReactMessage,
	translateEnabled,
	setTranslateEnabled,
	showNudge,
	setShowNudge
}) {
	const [inputValue, setInputValue] = useState("");

	const sentimentScore = Number(channelMood || CHANNELS.find((channel) => channel.name === activeChannel)?.mood || 65);
	const sentimentLabel = sentimentScore > 70 ? "Collaborative" : sentimentScore > 45 ? "Neutral" : "Critical";
	const trimmedMessages = Array.isArray(messages) ? messages.slice(-12) : [];

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
		<div className="chat-page view-transition">
			<header className="chat-room-header">
				<div className="chat-room-title">
					<span className="chat-room-hash" aria-hidden="true">
						<Icon name="tag" size={18} />
					</span>
					<h3>{String(activeChannel || "#general").replace(/^#/, "")}</h3>
					<button className="chat-room-star" type="button" aria-label="Star channel">
						<Icon name="star" size={14} />
					</button>
				</div>
				<div className="chat-room-actions">
					<div className="chat-room-presence" aria-hidden="true">
						{PRESENCE_MEMBERS.slice(0, 2).map((member, index) => (
							<span key={member.id} className={`presence-avatar ${index === 0 ? "a" : "b"}`} title={member.name}>
								{member.avatar ? (
									<img className="presence-avatar-image" src={member.avatar} alt={`${member.name} avatar`} />
								) : (
									<span className="presence-avatar-initials">{member.initials || member.name.slice(0, 2).toUpperCase()}</span>
								)}
							</span>
						))}
						<span className="presence-count">+12</span>
					</div>
					<button className="chat-room-btn chat-help-btn" type="button" aria-label="Help">
						<Icon name="help" size={16} />
					</button>
				</div>
			</header>

			<div className="chat-thread-scroll">
				<div className="chat-day-divider">
					<span>TODAY</span>
				</div>

				<div className="chat-thread-list">
					{trimmedMessages.map((message, index) => (
						<Message
							key={message.id}
							message={message}
							index={index}
							onReaction={(messageId, emoji) => onReactMessage(activeChannel, messageId, emoji)}
						/>
					))}
				</div>

				{showNudge ? (
					<div className="chat-coach-card">
						<div className="chat-coach-icon">
							<Icon name="info" size={14} />
						</div>
						<p>Try rephrasing for better clarity. Your last message has a formal tone that might be perceived as rigid in this context.</p>
						<button className="chat-coach-dismiss" onClick={() => setShowNudge(false)} aria-label="Dismiss tip" type="button">
							Dismiss
						</button>
					</div>
				) : null}

				<div className="chat-typing-note" aria-live="polite">
					<span className="typing-dots" aria-hidden="true">
						<span />
						<span />
						<span />
					</span>
					<span>Alex is typing...</span>
				</div>
			</div>

			<footer className="chat-composer-dock">
				<div className="chat-sentiment-row">
					<span>Tone Sentiment</span>
					<div className="chat-sentiment-track">
						<div className="chat-sentiment-fill" style={{ width: `${sentimentScore}%` }} />
					</div>
					<span>{sentimentLabel}</span>
				</div>

				<div className="chat-composer-box">
					<textarea
						value={inputValue}
						onChange={(event) => setInputValue(event.target.value)}
						className="chat-composer-input"
						placeholder={`Type a message to #${String(activeChannel || "general").replace(/^#/, "")}`}
						rows={1}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.shiftKey) {
								event.preventDefault();
								sendMessage();
							}
						}}
					/>

					<div className="chat-composer-tools">
						<div className="chat-tool-group">
							<button className="chat-tool-btn" type="button" aria-label="Add">
								<Icon name="plusCircle" size={16} />
							</button>
							<button className="chat-tool-btn" type="button" aria-label="Add emoji">
								<Icon name="emoji" size={15} />
							</button>
							<button className="chat-tool-btn" type="button" aria-label="Mention">
								<Icon name="mention" size={16} />
							</button>
							<div className="chat-tools-divider" aria-hidden="true" />

							<button
								type="button"
								className="chat-tool-translate"
								onClick={() => setTranslateEnabled((current) => !current)}
								aria-pressed={translateEnabled}
							>
								<Icon name="translate" size={13} />
								<span>Translate</span>
								<span className={`translate-switch ${translateEnabled ? "on" : "off"}`} aria-hidden="true">
									<span />
								</span>
							</button>
						</div>

						<button className="chat-send-btn" onClick={sendMessage} aria-label="Send message" type="button">
							Send
							<Icon name="send" size={14} />
						</button>
					</div>
				</div>
			</footer>
		</div>
	);
}
