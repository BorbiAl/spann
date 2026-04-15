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

function isDirectChannel(channel) {
	return String(channel?.kind || "").toLowerCase() === "dm" || String(channel?.id || "").startsWith("dm:") || String(channel?.name || "").startsWith("@");
}

export default function ChannelList({
	channels,
	activeChannelId,
	onChannelChange,
	channelUnread,
	onCreateChannel,
	onStartDirectMessage,
	onJoinChannel,
	onLeaveChannel,
	joinedChannelIds,
	variant = "default"
}) {
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
		const groupChannels = channels.filter((channel) => !isDirectChannel(channel));
		const dmChannels = channels.filter((channel) => isDirectChannel(channel));
		const joinedSet = new Set(Array.isArray(joinedChannelIds) ? joinedChannelIds.map((id) => String(id)) : []);
		const joinedGroups = groupChannels.filter((channel) => joinedSet.has(String(channel.id)));
		const discoverableGroups = groupChannels.filter((channel) => !joinedSet.has(String(channel.id)));
		const favoriteChannels = joinedGroups.slice(0, 6);

		function handleCreateChannel() {
			if (typeof onCreateChannel === "function") {
				onCreateChannel();
			}
		}

		function handleStartDirectMessage() {
			if (typeof onStartDirectMessage === "function") {
				onStartDirectMessage();
			}
		}

		return (
			<div className="sidebar-section teams-channel-list">
				<div className="chat-section-header">
					<p className="section-title chat-section-title">Groups</p>
					<button className="chat-section-action" type="button" aria-label="Add channel" onClick={handleCreateChannel}>
						<Icon name="add" size={12} />
					</button>
				</div>

				{favoriteChannels.map((channel, index) => {
					const unread = Number(channelUnread?.[channel.id] || 0);
					const isActive = activeChannelId === channel.id;
					return (
						<div
							key={channel.id}
							className={`channel-item team-channel-item ${isActive ? "active" : ""} ${index > 0 ? "team-channel-item-muted" : ""}`}
						>
							<button type="button" className="flex-1 min-w-0 text-left flex items-center gap-2" onClick={() => onChannelChange(channel.id)}>
								<span className="channel-dot" aria-hidden="true">
									<Icon name="tag" size={12} />
								</span>
								<span className="channel-name">{String(channel.name || "").replace(/^#/, "")}</span>
							</button>
							<div className="flex items-center gap-1">
								{isActive ? (
									<span className="team-presence-dot" aria-hidden="true" />
								) : unread > 0 ? (
									<span className="channel-unread">{unread}</span>
								) : null}
								{typeof onLeaveChannel === "function" ? (
									<button
										type="button"
										onClick={() => onLeaveChannel(channel.id)}
										className="chat-section-action"
										aria-label={`Leave ${channel.name}`}
									>
										<Icon name="remove" size={12} />
									</button>
								) : null}
							</div>
						</div>
					);
				})}

				{discoverableGroups.length > 0 ? (
					<div className="chat-section-header section-spacer">
						<p className="section-title chat-section-title">Join Groups</p>
					</div>
				) : null}

				{discoverableGroups.map((channel) => (
					<div key={channel.id} className="channel-item team-channel-item team-channel-item-muted">
						<button type="button" className="flex-1 min-w-0 text-left flex items-center gap-2" onClick={() => onChannelChange(channel.id)}>
							<span className="channel-dot" aria-hidden="true">
								<Icon name="group" size={12} />
							</span>
							<span className="channel-name">{String(channel.name || "").replace(/^#/, "")}</span>
						</button>
						{typeof onJoinChannel === "function" ? (
							<button
								type="button"
								onClick={() => onJoinChannel(channel.id)}
								className="chat-section-action"
								aria-label={`Join ${channel.name}`}
							>
								<Icon name="add" size={12} />
							</button>
						) : null}
					</div>
				))}

				<div className="chat-section-header section-spacer">
					<p className="section-title chat-section-title">Direct Messages</p>
					<button className="chat-section-action" type="button" aria-label="Start direct message" onClick={handleStartDirectMessage}>
						<Icon name="add" size={12} />
					</button>
				</div>

				{[...dmChannels, ...DIRECT_MESSAGES.filter((seed) => !dmChannels.some((channel) => String(channel.name || "").toLowerCase() === `@${String(seed.name || "").toLowerCase()}`))].map((entry) => {
					const dmId = String(entry?.id || "").startsWith("dm:") ? entry.id : `dm:${String(entry.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
					const displayName = String(entry?.name || "Direct message").replace(/^@/, "");
					const isActive = String(activeChannelId) === String(dmId);
					const isExistingDm = dmChannels.some((channel) => String(channel.id) === String(dmId));
					return (
						<button
							key={dmId}
							className={`member-item dm-item ${isActive ? "active" : ""}`}
							onClick={() => {
								if (isExistingDm) {
									onChannelChange(dmId);
									return;
								}
								if (typeof onStartDirectMessage === "function") {
									onStartDirectMessage({ ...entry, id: dmId, name: displayName });
								}
							}}
						>
							{entry?.avatar ? (
								<img className="dm-avatar-image" src={entry.avatar} alt={`${displayName} avatar`} />
							) : (
								<span className="member-avatar" style={{ background: entry?.color || "#6bb4ff", color: "#0f172a" }}>
									{displayName.slice(0, 2).toUpperCase()}
								</span>
							)}
							<span className="member-meta">{displayName}</span>
						</button>
					);
				})}
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
