import './ChannelList.css';
import React from "react";
import Icon from "./Icon";

const DIRECT_MESSAGES = [
	{
		id: "SC",
		name: "Sarah Chen",
		avatar:
			"https://lh3.googleusercontent.com/aida-public/AB6AXuAMmwKvAIFVC1YNqsjNngqLpJf50pSHL5jjdG0Mxz_WzwwDgVrMp7kaL4l0sIbzP5WmFxt-itTBGGbDECAoe30sAskyf0GOnG6GKtCT7TIRPaNzaQANRVmyUfyZ9UxtQ87INP2ffSNnmRnmEvtwjMGZMdIUZbZ22K80jIdbIJXFiaLk2Xe9tZ8wDTbRudfMVtwi2iYr4aIaPNuWE6--h17Y48ORHwgH9kIix2D8-fRH0V-23dv3ezmDxOGw_KPWKHTaTUrRYk3de3MC"
	},
	{ id: "MK", name: "Marcus Kane", color: "#6bb4ff" }
];

export default function ChannelList({ channels, activeChannelId, onChannelChange, channelUnread, onCreateChannel, onStartDirectMessage, variant = "default" }) {
	if (!channels || !channels.length) {
		return (
			<div className="sidebar-section">
				<p className="section-title">Channels</p>
				<p className="caption" style={{ padding: "0 8px 8px" }}>
					No channels available.
				</p>
			</div>
		);
	}

	if (variant === "teams") {
		const favoriteChannels = channels.slice(0, 2);

		function handleCreateChannel() {
			if (typeof onCreateChannel === "function") {
				onCreateChannel();
			}
		}

		function handleStartDirectMessage() {
			if (typeof onStartDirectMessage === "function") {
				onStartDirectMessage(DIRECT_MESSAGES[0]);
			}
		}

		return (
			<div className="sidebar-section teams-channel-list">
				<div className="chat-section-header">
					<p className="section-title chat-section-title">Favorites</p>
					<button className="chat-section-action" type="button" aria-label="Add channel" onClick={handleCreateChannel}>
						<Icon name="add" size={12} />
					</button>
				</div>

				{favoriteChannels.map((channel, index) => {
					const unread = Number(channelUnread?.[channel.id] || 0);
					const isActive = activeChannelId === channel.id;
					return (
						<button
							key={channel.id}
							className={`channel-item team-channel-item ${isActive ? "active" : ""} ${index > 0 ? "team-channel-item-muted" : ""}`}
							onClick={() => onChannelChange(channel.id)}
						>
							<span className="channel-dot" aria-hidden="true">
								<Icon name="tag" size={12} />
							</span>
							<span className="channel-name">{String(channel.name || "").replace(/^#/, "")}</span>
							{isActive ? (
								<span className="team-presence-dot" aria-hidden="true" />
							) : unread > 0 ? (
								<span className="channel-unread">{unread}</span>
							) : null}
						</button>
					);
				})}

				<div className="chat-section-header section-spacer">
					<p className="section-title chat-section-title">Direct Messages</p>
					<button className="chat-section-action" type="button" aria-label="Start direct message" onClick={handleStartDirectMessage}>
						<Icon name="add" size={12} />
					</button>
				</div>

				{DIRECT_MESSAGES.map((person) => (
					<button key={person.id} className="member-item dm-item">
						{person.avatar ? (
							<img className="dm-avatar-image" src={person.avatar} alt={`${person.name} avatar`} />
						) : (
							<span className="member-avatar" style={{ background: person.color, color: "#0f172a" }}>
								{person.id}
							</span>
						)}
						<span className="member-meta">{person.name}</span>
					</button>
				))}
			</div>
		);
	}

	return (
		<div className="sidebar-section">
			<p className="section-title">Channels</p>
			{channels.map((channel) => (
				<button
					key={channel.id}
					className={`channel-item ${activeChannelId === channel.id ? "active" : ""}`}
					onClick={() => onChannelChange(channel.id)}
				>
					<span className="channel-dot">#</span>
					<span className="channel-name">{channel.name}</span>
					{Number(channelUnread?.[channel.id] || 0) > 0 ? (
						<span className="channel-unread">{channelUnread[channel.id]}</span>
					) : null}
				</button>
			))}
		</div>
	);
}
