import './ChannelList.css';
import React, { useEffect, useState } from "react";
import Icon from "./Icon";

function isDirectChannel(channel) {
	return String(channel?.kind || "").toLowerCase() === "dm" || String(channel?.id || "").startsWith("dm:") || String(channel?.name || "").startsWith("@");
}

function formatWorkspaceRole(member) {
	const rawRole = String(member?.role || member?.workspace_role || member?.member_role || "member").trim().toLowerCase();
	if (!rawRole) {
		return "Member";
	}
	return rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
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
	onEditChannel,
	joinedChannelIds,
	starredChannelIds,
	onToggleChannelStar,
	workspaceMembers,
	canManageMembers,
	canRemoveMembers,
	onInviteMember,
	onRemoveMember,
	variant = "default"
}) {
	const [groupContextMenu, setGroupContextMenu] = useState(null);

	useEffect(() => {
		if (!groupContextMenu) {
			return undefined;
		}

		function closeMenu() {
			setGroupContextMenu(null);
		}

		function onKeyDown(event) {
			if (event.key === "Escape") {
				setGroupContextMenu(null);
			}
		}

		window.addEventListener("click", closeMenu);
		window.addEventListener("scroll", closeMenu, true);
		window.addEventListener("resize", closeMenu);
		window.addEventListener("keydown", onKeyDown);

		return () => {
			window.removeEventListener("click", closeMenu);
			window.removeEventListener("scroll", closeMenu, true);
			window.removeEventListener("resize", closeMenu);
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [groupContextMenu]);

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
		const starredSet = new Set(Array.isArray(starredChannelIds) ? starredChannelIds.map((id) => String(id)) : []);
		const joinedGroups = groupChannels.filter((channel) => joinedSet.has(String(channel.id)));
		const starredGroups = joinedGroups.filter((channel) => starredSet.has(String(channel.id)));
		const regularJoinedGroups = joinedGroups.filter((channel) => !starredSet.has(String(channel.id)));
		const discoverableGroups = groupChannels.filter((channel) => !joinedSet.has(String(channel.id)));
		const canCreateChannels = typeof onCreateChannel === "function";
		const canJoinGroups = typeof onJoinChannel === "function";
		const canLeaveGroups = typeof onLeaveChannel === "function";
		const ownerCanManageChannels = Boolean(canManageMembers);
		const contextChannel = groupChannels.find((channel) => String(channel.id) === String(groupContextMenu?.channelId || "")) || null;
		const contextIsStarred = Boolean(contextChannel && starredSet.has(String(contextChannel.id)));

		function handleGroupContextMenu(event, channel) {
			event.preventDefault();
			event.stopPropagation();
			setGroupContextMenu({
				x: event.clientX,
				y: event.clientY,
				channelId: String(channel?.id || ""),
			});
		}

		function handleContextAction(action) {
			if (!contextChannel) {
				setGroupContextMenu(null);
				return;
			}

			const channelId = contextChannel.id;
			if (action === "star") {
				onToggleChannelStar?.(channelId);
			}
			if (action === "rename" && ownerCanManageChannels) {
				onEditChannel?.(channelId);
			}
			if (action === "delete") {
				onLeaveChannel?.(channelId);
			}
			setGroupContextMenu(null);
		}

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
				<div className="channel-view-intro">
					<p className="channel-view-title">Workspace Channels</p>
					<p className="channel-view-meta">{joinedGroups.length} joined • {groupChannels.length} groups</p>
				</div>
				{starredGroups.length > 0 ? (
					<>
						<div className="chat-section-header">
							<p className="section-title chat-section-title">Starred</p>
						</div>
						{starredGroups.slice(0, 6).map((channel) => {
							const unread = Number(channelUnread?.[channel.id] || 0);
							const isActive = activeChannelId === channel.id;
							return (
								<div key={`starred-${channel.id}`} className={`channel-item team-channel-item ${isActive ? "active" : ""}`} onContextMenu={(event) => handleGroupContextMenu(event, channel)}>
									<button type="button" className="flex-1 min-w-0 text-left flex items-center gap-2" onClick={() => onChannelChange(channel.id)}>
										<span className="channel-dot" aria-hidden="true">
											<Icon name="tag" size={12} />
										</span>
										<span className="channel-name">{String(channel.name || "").replace(/^#/, "")}</span>
									</button>
									<div className="flex items-center gap-1">
										{unread > 0 ? <span className="channel-unread">{unread}</span> : null}
										{typeof onToggleChannelStar === "function" ? (
											<button
												type="button"
												onClick={() => onToggleChannelStar(channel.id)}
												className="chat-section-action"
												aria-label={`Unstar ${channel.name}`}
											>
												<Icon name="star" size={12} />
											</button>
										) : null}
										{ownerCanManageChannels && typeof onEditChannel === "function" ? (
											<button
												type="button"
												onClick={() => onEditChannel(channel.id)}
												className="chat-section-action"
												aria-label={`Edit ${channel.name}`}
											>
												<Icon name="edit" size={12} />
											</button>
										) : null}
									</div>
								</div>
							);
						})}
						<div className="chat-section-header section-spacer">
							<p className="section-title chat-section-title">Groups</p>
							{canCreateChannels ? (
								<button className="chat-section-action" type="button" aria-label="Add channel" onClick={handleCreateChannel}>
									<Icon name="add" size={12} />
								</button>
							) : null}
						</div>
					</>
				) : (
				<div className="chat-section-header">
					<p className="section-title chat-section-title">Groups</p>
					{canCreateChannels ? (
						<button className="chat-section-action" type="button" aria-label="Add channel" onClick={handleCreateChannel}>
							<Icon name="add" size={12} />
						</button>
					) : null}
				</div>
				)}

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

				{regularJoinedGroups.slice(0, 6).map((channel, index) => {
					const unread = Number(channelUnread?.[channel.id] || 0);
					const isActive = activeChannelId === channel.id;
					const isStarred = starredSet.has(String(channel.id));
					return (
						<div
							key={channel.id}
							className={`channel-item team-channel-item ${isActive ? "active" : ""} ${index > 0 ? "team-channel-item-muted" : ""}`}
							onContextMenu={(event) => handleGroupContextMenu(event, channel)}
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
								{typeof onToggleChannelStar === "function" ? (
									<button
										type="button"
										onClick={() => onToggleChannelStar(channel.id)}
										className="chat-section-action"
										aria-label={isStarred ? `Unstar ${channel.name}` : `Star ${channel.name}`}
									>
										<Icon name={isStarred ? "star" : "star_outline"} size={12} />
									</button>
								) : null}
								{ownerCanManageChannels && typeof onEditChannel === "function" ? (
									<button
										type="button"
										onClick={() => onEditChannel(channel.id)}
										className="chat-section-action"
										aria-label={`Edit ${channel.name}`}
									>
										<Icon name="edit" size={12} />
									</button>
								) : null}
								{canLeaveGroups ? (
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
					<div key={channel.id} className="channel-item team-channel-item team-channel-item-muted" onContextMenu={(event) => handleGroupContextMenu(event, channel)}>
						<button type="button" className="flex-1 min-w-0 text-left flex items-center gap-2" onClick={() => onChannelChange(channel.id)}>
							<span className="channel-dot" aria-hidden="true">
								<Icon name="group" size={12} />
							</span>
							<span className="channel-name">{String(channel.name || "").replace(/^#/, "")}</span>
						</button>
						{canJoinGroups ? (
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
							const memberRole = formatWorkspaceRole(member);
							const isOnline = Boolean(member?.is_online);
							const removable = canRemoveMembers && memberRole.toLowerCase() !== "owner";
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

				{groupContextMenu && contextChannel ? (
					<div
						className="group-context-menu"
						style={{ left: `${groupContextMenu.x}px`, top: `${groupContextMenu.y}px` }}
						onClick={(event) => event.stopPropagation()}
					>
						<button type="button" className="group-context-item" onClick={() => handleContextAction("star")}>
							<Icon name={contextIsStarred ? "star" : "star_outline"} size={14} />
							<span>{contextIsStarred ? "Unstar group" : "Star group"}</span>
						</button>
						{ownerCanManageChannels ? (
							<button type="button" className="group-context-item" onClick={() => handleContextAction("rename")}>
								<Icon name="edit" size={14} />
								<span>Rename group</span>
							</button>
						) : null}
						<button type="button" className="group-context-item danger" onClick={() => handleContextAction("delete")}>
							<Icon name={ownerCanManageChannels ? "delete" : "logout"} size={14} />
							<span>{ownerCanManageChannels ? "Delete group" : "Leave group"}</span>
						</button>
					</div>
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
