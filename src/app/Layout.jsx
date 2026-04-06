import React, { useEffect, useMemo, useState } from "react";
import ChannelList from "../components/ChannelList";
import Icon from "../components/Icon";
import ChatView from "../views/ChatView";
import MeshView from "../views/MeshView";
import CarbonView from "../views/CarbonView";
import PulseView from "../views/PulseView";
import AccessibilityView from "../views/AccessibilityView";
import TranslatorView from "../views/TranslatorView";
import { useTheme } from "./ThemeProvider";
import {
	CHANNELS,
	DEFAULT_MESSAGES_BY_CHANNEL,
	DEFAULT_UNREAD_BY_CHANNEL,
	INCOMING_AUTHORS,
	INCOMING_MESSAGE_BANK,
	NAV_ITEMS,
	apiRequest,
	incrementReaction,
	loadFromStorage
} from "../data/constants";

function SideSection({ activeView }) {
	const sectionMap = {
		mesh: ["Node Coverage", "Signal Handoffs", "Failure Timeline"],
		carbon: ["Daily Goal", "Weekly Impact", "Rewards"],
		pulse: ["Energy Feed", "Alert Thresholds", "Pulse History"],
		accessibility: ["Profiles", "Compliance", "Readability"],
		translator: ["Recent Phrases", "Cultural Notes", "Team Defaults"]
	};

	const items = sectionMap[activeView] || [];

	if (!items.length) {
		return null;
	}

	return (
		<div className="sidebar-section">
			<p className="section-title">Sections</p>
			{items.map((item, index) => (
				<button key={item} className={`section-item ${index === 0 ? "active" : ""}`}>
					<span className="channel-dot">•</span>
					<span className="section-label">{item}</span>
				</button>
			))}
		</div>
	);
}

function ContextContent({ activeView, activeChannel }) {
	const content = {
		chat: [
			{ title: "Channel SLA", text: "Median response time: 2m 16s over the past 24h." },
			{ title: "Live Participants", text: "Alex K, Maria G, Jin Park, Sara M, Tom B" },
			{ title: "Translation Coverage", text: "93% of messages auto-translated for cross-region teams." }
		],
		mesh: [
			{ title: "Failover Window", text: "Automatic switchover completed in 1.3 seconds." },
			{ title: "Coverage", text: "Mesh radius currently spans 190 meters across 2 floors." },
			{ title: "Signal Integrity", text: "Packet loss below 0.8% in current topology." }
		],
		carbon: [
			{ title: "Team Footprint", text: "Current weekly emissions trend is down 11.2%." },
			{ title: "Top Habit", text: "Remote-first meetings generated the highest savings." },
			{ title: "Recommendation", text: "Shift two commute days to transit to gain +5 points." }
		],
		pulse: [
			{ title: "Peak Window", text: "Highest collaboration intensity: 09:30-10:15." },
			{ title: "Alert Rule", text: "Escalate if emergencies channel stays above 85% for 5 mins." },
			{ title: "Sync Health", text: "Audio clipping risk remains low across all active rooms." }
		],
		accessibility: [
			{ title: "Policy Status", text: "WCAG review window closes in 6 days." },
			{ title: "User Profiles", text: "7 teammates currently use custom accessibility presets." },
			{ title: "Action", text: "High contrast mode improved message scan speed by 14%." }
		],
		translator: [
			{ title: "Top Phrase", text: `${activeChannel} updates localized 12 times today.` },
			{ title: "Cross-Culture Tip", text: "Prefer explicit requests over idioms in mission-critical chats." },
			{ title: "Quality", text: "Cultural adaptation confidence currently at 96%." }
		]
	};

	const activeContent = content[activeView] || content.chat;

	return (
		<>
			<p className="context-title">Operational Context</p>
			<div className="context-list">
				{activeContent.map((item) => (
					<div key={item.title} className="context-item">
						<strong>{item.title}</strong>
						<span>{item.text}</span>
					</div>
				))}
			</div>
		</>
	);
}

function Sidebar({ activeView, activeChannel, onChannelChange, channelUnread }) {
	return (
		<aside className="sidebar">
			<div className="workspace-head">
				<p className="workspace-title">Spann HQ</p>
				<p className="workspace-sub">Reach Anyone. Anywhere. Always.</p>
			</div>

			{activeView === "chat" ? (
				<ChannelList activeChannel={activeChannel} onChannelChange={onChannelChange} channelUnread={channelUnread} />
			) : (
				<SideSection activeView={activeView} />
			)}

			<div className="sidebar-section">
				<p className="section-title">Online</p>
				{[
					{ id: "AK", name: "Alex K", color: "#0A84FF" },
					{ id: "MG", name: "Maria G", color: "#BF5AF2" },
					{ id: "JP", name: "Jin Park", color: "#30D158" }
				].map((person) => (
					<button key={person.id} className="member-item">
						<span className="member-avatar" style={{ background: person.color }}>
							{person.id}
						</span>
						<span className="member-meta">{person.name}</span>
					</button>
				))}
			</div>
		</aside>
	);
}

function IconRail({ activeView, onChange, items }) {
	return (
		<nav className="icon-rail" aria-label="Primary navigation">
			<div className="logo-chip">SP</div>
			{items.map((item) => (
				<button
					key={item.key}
					className={`rail-item ${activeView === item.key ? "active" : ""}`}
					onClick={() => onChange(item.key)}
					aria-label={item.label}
				>
					<Icon name={item.icon} size={19} />
					<span className="rail-tooltip">{item.label}</span>
					{item.badge > 0 ? <span className="notif-badge">{item.badge}</span> : null}
				</button>
			))}
			<div className="rail-bottom">VK</div>
		</nav>
	);
}

function BottomTabBar({ activeView, onChange, items }) {
	return (
		<div className="bottom-tab-bar" role="tablist" aria-label="Mobile navigation">
			{items.map((item) => (
				<button
					key={item.key}
					className={`tab-btn ${activeView === item.key ? "active" : ""}`}
					onClick={() => onChange(item.key)}
					aria-label={item.label}
				>
					<Icon name={item.icon} size={18} />
					<span>{item.label}</span>
					{item.badge > 0 ? <span className="notif-badge">{item.badge}</span> : null}
				</button>
			))}
		</div>
	);
}

function MainPanel({
	activeView,
	activeChannel,
	contextOpen,
	setContextOpen,
	openMobileSheet,
	messages,
	onSendMessage,
	onReactMessage,
	translateEnabled,
	setTranslateEnabled,
	showNudge,
	setShowNudge
}) {
	const { theme, toggleTheme } = useTheme();

	const titleMap = {
		chat: "Team Chat",
		mesh: "Mesh Network",
		carbon: "Carbon Tracker",
		pulse: "Crowd Pulse",
		accessibility: "Accessibility Panel",
		translator: "Cultural Translator"
	};

	function renderView() {
		if (activeView === "chat") {
			return (
				<ChatView
					activeChannel={activeChannel}
					messages={messages}
					onSendMessage={onSendMessage}
					onReactMessage={onReactMessage}
					translateEnabled={translateEnabled}
					setTranslateEnabled={setTranslateEnabled}
					showNudge={showNudge}
					setShowNudge={setShowNudge}
				/>
			);
		}
		if (activeView === "mesh") {
			return <MeshView />;
		}
		if (activeView === "carbon") {
			return <CarbonView />;
		}
		if (activeView === "pulse") {
			return <PulseView />;
		}
		if (activeView === "accessibility") {
			return <AccessibilityView />;
		}
		return <TranslatorView />;
	}

	return (
		<main className="main-panel">
			<section className="main-surface">
				<header className="view-header">
					<div className="header-title">
						<h2>{titleMap[activeView]}</h2>
						<p>Reach Anyone. Anywhere. Always.</p>
					</div>
					<div className="header-actions">
						<button className="header-btn hide-desktop" onClick={openMobileSheet} aria-label="Open details panel">
							<Icon name="panel" size={18} />
						</button>
						<button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
							<Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
							<span>{theme === "dark" ? "Light" : "Dark"}</span>
						</button>
						<button
							className="header-btn"
							onClick={() => setContextOpen((current) => !current)}
							aria-label="Toggle context panel"
						>
							<Icon name="panel" size={18} />
						</button>
					</div>
				</header>

				<div className="main-content">
					<section className="view-scroll">{renderView()}</section>
					<aside className={`context-panel ${contextOpen ? "" : "collapsed"}`}>
						<ContextContent activeView={activeView} activeChannel={activeChannel} />
					</aside>
				</div>
			</section>
		</main>
	);
}

function MobileSheet({ open, onClose, activeView, activeChannel }) {
	return (
		<div className={`mobile-sheet-overlay ${open ? "open" : ""}`} onClick={onClose}>
			<section className="mobile-sheet" onClick={(event) => event.stopPropagation()}>
				<div className="sheet-handle" />
				<div className="sheet-head">
					<p className="sheet-title">Context Panel</p>
					<button className="tiny-btn" onClick={onClose} aria-label="Close sheet">
						<Icon name="close" size={14} />
					</button>
				</div>
				<ContextContent activeView={activeView} activeChannel={activeChannel} />
			</section>
		</div>
	);
}

export default function Layout() {
	const [activeView, setActiveView] = useState(() => loadFromStorage("spann-active-view", "chat"));
	const [activeChannel, setActiveChannel] = useState(() => loadFromStorage("spann-active-channel", "#general"));
	const [contextOpen, setContextOpen] = useState(true);
	const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
	const [messagesByChannel, setMessagesByChannel] = useState(() =>
		loadFromStorage("spann-messages-by-channel", DEFAULT_MESSAGES_BY_CHANNEL)
	);
	const [channelUnread, setChannelUnread] = useState(() =>
		loadFromStorage("spann-channel-unread", DEFAULT_UNREAD_BY_CHANNEL)
	);
	const [translateEnabled, setTranslateEnabled] = useState(() => loadFromStorage("spann-translate-enabled", true));
	const [showNudge, setShowNudge] = useState(() => loadFromStorage("spann-show-nudge", true));
	const [backendConnected, setBackendConnected] = useState(false);

	function applyServerState(serverState) {
		if (!serverState || typeof serverState !== "object") {
			return;
		}

		if (serverState.messagesByChannel && typeof serverState.messagesByChannel === "object") {
			setMessagesByChannel(serverState.messagesByChannel);
		}

		if (serverState.channelUnread && typeof serverState.channelUnread === "object") {
			setChannelUnread(serverState.channelUnread);
		}
	}

	useEffect(() => {
		let cancelled = false;

		async function bootstrapFromBackend() {
			try {
				const payload = await apiRequest("/chat/state");
				if (cancelled) {
					return;
				}

				applyServerState(payload.state);
				setBackendConnected(true);
			} catch (error) {
				if (!cancelled) {
					setBackendConnected(false);
				}
			}
		}

		bootstrapFromBackend();

		return () => {
			cancelled = true;
		};
	}, []);

	const navItems = useMemo(() => {
		const totalChatUnread = Object.values(channelUnread).reduce((sum, count) => sum + (Number(count) || 0), 0);
		return NAV_ITEMS.map((item) => {
			if (item.key === "chat") {
				return { ...item, badge: totalChatUnread };
			}
			return item;
		});
	}, [channelUnread]);

	useEffect(() => {
		localStorage.setItem("spann-active-view", JSON.stringify(activeView));
	}, [activeView]);

	useEffect(() => {
		localStorage.setItem("spann-active-channel", JSON.stringify(activeChannel));
	}, [activeChannel]);

	useEffect(() => {
		localStorage.setItem("spann-messages-by-channel", JSON.stringify(messagesByChannel));
	}, [messagesByChannel]);

	useEffect(() => {
		localStorage.setItem("spann-channel-unread", JSON.stringify(channelUnread));
	}, [channelUnread]);

	useEffect(() => {
		localStorage.setItem("spann-translate-enabled", JSON.stringify(translateEnabled));
	}, [translateEnabled]);

	useEffect(() => {
		localStorage.setItem("spann-show-nudge", JSON.stringify(showNudge));
	}, [showNudge]);

	useEffect(() => {
		if (activeView !== "chat") {
			return;
		}

		let cancelled = false;

		async function clearUnread() {
			if (!backendConnected) {
				setChannelUnread((current) => {
					if (!current[activeChannel]) {
						return current;
					}
					return {
						...current,
						[activeChannel]: 0
					};
				});
				return;
			}

			try {
				const payload = await apiRequest("/chat/unread/clear", {
					method: "POST",
					body: JSON.stringify({ channel: activeChannel })
				});

				if (!cancelled) {
					applyServerState(payload.state);
				}
			} catch (error) {
				if (!cancelled) {
					setBackendConnected(false);
					setChannelUnread((current) => ({
						...current,
						[activeChannel]: 0
					}));
				}
			}
		}

		clearUnread();

		return () => {
			cancelled = true;
		};
	}, [activeView, activeChannel, backendConnected]);

	useEffect(() => {
		const timer = setInterval(async () => {
			if (backendConnected) {
				try {
					const payload = await apiRequest("/chat/simulate", {
						method: "POST",
						body: JSON.stringify({
							excludeChannel: activeView === "chat" ? activeChannel : null
						})
					});

					applyServerState(payload.state);
					return;
				} catch (error) {
					setBackendConnected(false);
				}
			}

			const availableChannels = CHANNELS.map((channel) => channel.name).filter(
				(channelName) => !(activeView === "chat" && channelName === activeChannel)
			);

			if (!availableChannels.length) {
				return;
			}

			const randomChannel = availableChannels[Math.floor(Math.random() * availableChannels.length)];
			const channelBank = INCOMING_MESSAGE_BANK[randomChannel] || INCOMING_MESSAGE_BANK["#general"];
			const randomText = channelBank[Math.floor(Math.random() * channelBank.length)];
			const randomAuthor = INCOMING_AUTHORS[Math.floor(Math.random() * INCOMING_AUTHORS.length)];

			const now = new Date();
			const formatted = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

			const incomingMessage = {
				id: Date.now() + Math.floor(Math.random() * 1000),
				user: randomAuthor.user,
				initials: randomAuthor.initials,
				color: randomAuthor.color,
				time: formatted,
				text: randomText,
				reactions: ["👀 1"],
				translated: false
			};

			setMessagesByChannel((current) => ({
				...current,
				[randomChannel]: [...(current[randomChannel] || []), incomingMessage]
			}));

			setChannelUnread((current) => ({
				...current,
				[randomChannel]: (current[randomChannel] || 0) + 1
			}));
		}, 18000);

		return () => clearInterval(timer);
	}, [activeView, activeChannel, backendConnected]);

	useEffect(() => {
		setMobileSheetOpen(false);
	}, [activeView]);

	function handleChannelChange(channelName) {
		setActiveChannel(channelName);
		if (activeView !== "chat") {
			setActiveView("chat");
		}
	}

	async function handleSendMessage(channelName, text, translated) {
		if (backendConnected) {
			try {
				const payload = await apiRequest("/chat/messages", {
					method: "POST",
					body: JSON.stringify({ channel: channelName, text, translated })
				});

				applyServerState(payload.state);
				return;
			} catch (error) {
				setBackendConnected(false);
			}
		}

		const now = new Date();
		const formatted = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

		const draft = {
			id: Date.now() + Math.floor(Math.random() * 1000),
			user: "You",
			initials: "YU",
			color: "#0A84FF",
			time: formatted,
			text,
			reactions: ["✅ 1"],
			translated,
			lang: translated ? "🇪🇸" : undefined
		};

		setMessagesByChannel((current) => ({
			...current,
			[channelName]: [...(current[channelName] || []), draft]
		}));
	}

	async function handleReactMessage(channelName, messageId, emoji) {
		if (backendConnected) {
			try {
				const payload = await apiRequest("/chat/reactions", {
					method: "POST",
					body: JSON.stringify({ channel: channelName, messageId, emoji })
				});

				applyServerState(payload.state);
				return;
			} catch (error) {
				setBackendConnected(false);
			}
		}

		setMessagesByChannel((current) => ({
			...current,
			[channelName]: (current[channelName] || []).map((message) => {
				if (message.id !== messageId) {
					return message;
				}

				return {
					...message,
					reactions: incrementReaction(message.reactions || [], emoji)
				};
			})
		}));
	}

	return (
		<div className="app-shell">
			<IconRail activeView={activeView} onChange={setActiveView} items={navItems} />
			<Sidebar
				activeView={activeView}
				activeChannel={activeChannel}
				onChannelChange={handleChannelChange}
				channelUnread={channelUnread}
			/>
			<MainPanel
				activeView={activeView}
				activeChannel={activeChannel}
				contextOpen={contextOpen}
				setContextOpen={setContextOpen}
				openMobileSheet={() => setMobileSheetOpen(true)}
				messages={messagesByChannel[activeChannel] || []}
				onSendMessage={handleSendMessage}
				onReactMessage={handleReactMessage}
				translateEnabled={translateEnabled}
				setTranslateEnabled={setTranslateEnabled}
				showNudge={showNudge}
				setShowNudge={setShowNudge}
			/>
			<BottomTabBar activeView={activeView} onChange={setActiveView} items={navItems} />
			<MobileSheet
				open={mobileSheetOpen}
				onClose={() => setMobileSheetOpen(false)}
				activeView={activeView}
				activeChannel={activeChannel}
			/>
		</div>
	);
}
