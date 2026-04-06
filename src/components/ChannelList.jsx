import React from "react";
import { CHANNELS } from "../data/constants";

export default function ChannelList({ activeChannel, onChannelChange, channelUnread }) {
	return (
		<div className="sidebar-section">
			<p className="section-title">Channels</p>
			{CHANNELS.map((channel) => (
				<button
					key={channel.name}
					className={`channel-item ${activeChannel === channel.name ? "active" : ""}`}
					onClick={() => onChannelChange(channel.name)}
				>
					<span className="channel-dot">#</span>
					<span className="channel-name">{channel.name}</span>
					{(channelUnread[channel.name] ?? channel.unread) > 0 ? (
						<span className="channel-unread">{channelUnread[channel.name] ?? channel.unread}</span>
					) : null}
				</button>
			))}
		</div>
	);
}
