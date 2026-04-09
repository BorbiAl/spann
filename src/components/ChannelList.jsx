import React from "react";

export default function ChannelList({ channels, activeChannelId, onChannelChange, channelUnread }) {
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
