import './ChannelList.css';
import React from "react";
import Icon from "./Icon";

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
	workspaceMembers,
	canManageMembers,
	canRemoveMembers,
	onInviteMember,
	onRemoveMember,
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
		const allMembers = Array.isArray(workspaceMembers) ? workspaceMembers : [];
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

				{groupChannels.length === 0 ? (
					<div className="channel-item team-channel-item-muted">
						<div className="flex-1 min-w-0 text-left flex items-center gap-2">
							<span className="channel-dot" aria-hidden="true">
								<Icon name="group" size={12} />
							</span>
							<span className="channel-name">No group yet</span>
						</div>
						<button type="button" onClick={handleCreateChannel} className="chat-section-action" aria-label="Create first group">
							<Icon name="add" size={12} />
						</button>
					</div>
				) : null}

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

				{dmChannels.map((entry) => {
					const dmId = String(entry?.id || "").startsWith("dm:") ? entry.id : `dm:${String(entry.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
					const displayName = String(entry?.name || "Direct message").replace(/^@/, "");
					const isActive = String(activeChannelId) === String(dmId);
					return (
						<button
							key={dmId}
							className={`member-item dm-item ${isActive ? "active" : ""}`}
							onClick={() => {
								onChannelChange(dmId);
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

				{dmChannels.length === 0 ? (
					<p className="caption" style={{ padding: "0 8px 8px" }}>
						No direct messages yet.
					</p>
				) : null}

				{allMembers.length > 0 ? (
					<>
						<div className="chat-section-header section-spacer">
							<p className="section-title chat-section-title">Members</p>
							{canManageMembers ? (
								<button className="chat-section-action" type="button" aria-label="Invite member" onClick={() => onInviteMember?.()}>
									<Icon name="add" size={12} />
								</button>
							) : null}
						</div>
						{allMembers.slice(0, 6).map((member) => {
							const memberLabel = String(member?.display_name || member?.email || "Member");
							const memberRole = String(member?.role || "member");
							const isOnline = Boolean(member?.is_online);
							const removable = canRemoveMembers && memberRole !== "owner";
							return (
								<div key={String(member?.user_id || memberLabel)} className="channel-item team-channel-item team-channel-item-muted">
									<div className="flex-1 min-w-0 text-left flex items-center gap-2">
										<span className="channel-dot" aria-hidden="true">
											<Icon name={isOnline ? "circle" : "remove"} size={10} />
										</span>
										<span className="channel-name">{memberLabel}</span>
									</div>
									<div className="flex items-center gap-1">
										<span className="caption" style={{ padding: 0 }}>{memberRole}</span>
										{removable ? (
											<button type="button" className="chat-section-action" aria-label={`Remove ${memberLabel}`} onClick={() => onRemoveMember?.(member)}>
												<Icon name="remove" size={12} />
											</button>
										) : null}
									</div>
								</div>
							);
						})}
					</>
				) : null}
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
