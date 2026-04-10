import './Layout.css';
import React, { useEffect, useMemo, useRef, useState } from "react";
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
	NAV_ITEMS,
	apiRequest,
	getAuthState,
	incrementReaction,
	loadFromStorage,
	normalizeApiError,
	pushAppNotice
} from "../data/constants";

function withHash(channelName) {
	const value = String(channelName || "").trim();
	if (!value) {
		return "#channel";
	}
	return value.startsWith("#") ? value : `#${value}`;
}

function toFallbackChannels() {
	return CHANNELS.map((channel) => ({
		id: channel.name,
		name: withHash(channel.name),
		mood: channel.mood
	}));
}

function toFallbackMessages() {
	const mapped = {};
	Object.keys(DEFAULT_MESSAGES_BY_CHANNEL).forEach((channelName) => {
		mapped[channelName] = DEFAULT_MESSAGES_BY_CHANNEL[channelName].map((message) => ({ ...message }));
	});
	return mapped;
}

function toFallbackUnread() {
	const unread = {};
	Object.keys(DEFAULT_UNREAD_BY_CHANNEL).forEach((channelName) => {
		unread[channelName] = Number(DEFAULT_UNREAD_BY_CHANNEL[channelName] || 0);
	});
	return unread;
}

function toFallbackMoodByChannel() {
	const moodMap = {};
	CHANNELS.forEach((channel) => {
		moodMap[channel.name] = Number(channel.mood || 65);
	});
	return moodMap;
}

function normalizePulseScore(scoreValue) {
	const raw = Number(scoreValue || 0);
	if (!Number.isFinite(raw)) {
		return 60;
	}
	if (raw <= 1) {
		return Math.max(0, Math.min(100, Math.round(raw * 100)));
	}
	return Math.max(0, Math.min(100, Math.round(raw)));
}

function formatMessageTime(timestamp) {
	const date = timestamp ? new Date(timestamp) : new Date();
	if (Number.isNaN(date.getTime())) {
		return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
	}
	return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function toUiMessage(apiMessage) {
	const reactions = Array.isArray(apiMessage?.reactions)
		? apiMessage.reactions.map((reaction) => `${reaction.emoji || ""} ${Number(reaction.count) || 0}`.trim())
		: [];

	return {
		id: String(apiMessage?.id || Date.now()),
		user: String(apiMessage?.user?.name || "Member"),
		initials: String(apiMessage?.user?.initials || "US"),
		color: String(apiMessage?.user?.color || "#0A84FF"),
		time: formatMessageTime(apiMessage?.created_at),
		text: String(apiMessage?.text_translated || apiMessage?.text || ""),
		reactions,
		translated: Boolean(apiMessage?.text_translated),
		lang: apiMessage?.source_locale ? `🌐 ${apiMessage.source_locale}` : undefined
	};
}

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

function Sidebar({ activeView, activeChannelId, channels, onChannelChange, channelUnread, navItems, onViewChange, isChatLayout }) {
	if (isChatLayout) {
		return (
			<aside className="sidebar chat-sidebar">
				<div className="chat-sidebar-head">
					<p className="chat-sidebar-title">Teams</p>
					<label className="chat-jump">
						<Icon name="search" size={14} />
						<input type="text" value="" placeholder="Jump to..." readOnly aria-label="Jump to" />
					</label>
				</div>

				<ChannelList
					channels={channels}
					activeChannelId={activeChannelId}
					onChannelChange={onChannelChange}
					channelUnread={channelUnread}
					variant="teams"
				/>
			</aside>
		);
	}

	return (
		<aside className="sidebar">
			<div className="workspace-head">
				<p className="workspace-title">Spann HQ</p>
				<p className="workspace-sub">Reach Anyone. Anywhere. Always.</p>
			</div>

			<div className="sidebar-section">
				<p className="section-title">Workspace</p>
				<div className="sidebar-nav">
					{navItems.map((item) => (
						<button
							key={item.key}
							className={`sidebar-nav-item ${activeView === item.key ? "active" : ""}`}
							onClick={() => onViewChange(item.key)}
						>
							<Icon name={item.icon} size={16} />
							<span>{item.label}</span>
							{item.badge > 0 ? <span className="channel-unread">{item.badge}</span> : null}
						</button>
					))}
				</div>
			</div>

			{activeView === "chat" ? (
				<ChannelList
					channels={channels}
					activeChannelId={activeChannelId}
					onChannelChange={onChannelChange}
					channelUnread={channelUnread}
				/>
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

function ChatNavRail({ activeView, onChange, items }) {
	const railLabels = {
		chat: "Chat",
		mesh: "Network",
		carbon: "Carbon",
		pulse: "Analytics",
		accessibility: "Accessibility",
		translator: "Translate"
	};

	const railIcons = {
		chat: "chat",
		mesh: "lan",
		carbon: "eco",
		pulse: "insert_chart",
		accessibility: "accessibility_new",
		translator: "translate"
	};

	return (
		<aside className="chat-nav-rail" aria-label="Workspace navigation">
			<div className="chat-nav-brand">
				<div className="chat-nav-brand-logo">S</div>
				<div>
					<p className="chat-nav-brand-title">Workspace</p>
					<p className="chat-nav-brand-sub">Premium Connectivity</p>
				</div>
			</div>

			<nav className="chat-nav-list" aria-label="Primary navigation">
				{items.map((item) => (
					<button
						key={item.key}
						className={`chat-nav-item ${activeView === item.key ? "active" : ""}`}
						onClick={() => onChange(item.key)}
					>
						<Icon name={railIcons[item.key] || item.icon} size={16} />
						<span>{railLabels[item.key] || item.label}</span>
					</button>
				))}
			</nav>

			<div className="chat-nav-foot">
				<button className="chat-nav-item muted" type="button">
					<Icon name="settings" size={16} />
					<span>Settings</span>
				</button>
				<button className="chat-nav-item muted" type="button">
					<Icon name="contact_support" size={16} />
					<span>Support</span>
				</button>
				<div className="chat-nav-user">
					<img
						className="chat-nav-user-avatar"
						src="https://lh3.googleusercontent.com/aida-public/AB6AXuBB87Yxv06GHwMcjD11mHkEaMwMQt3vaTkpqpUWgZvcNvPE0eOoc4OVF6PQIfl-gj8UPDfdg1VtV2ZEjlZJCJmRw7vDzxFmy1HNAPVkT5ZWXDb4WpZOZOB3zCKpx7wIOvGNx7TMVCCVO1hJO0Sfl9l1jZP7eGDHAQZ1SsX2IQST7lmvJ69IF3Afq0BSXSchgYdwirZ46jJyX3sNw0uVgrcWHFMu_K0KKjn3GLSDByFh7e149m_C-Wme1UacI-3uZXNuYyP3Nm0Egofr"
						alt="Alex River avatar"
					/>
					<div>
						<p className="chat-nav-user-name">Alex River</p>
						<p className="chat-nav-user-status">Online</p>
					</div>
				</div>
			</div>
		</aside>
	);
}

function ChatUtilityRail() {
	const tools = [
		{ key: "threads", icon: "forum", label: "Threads" },
		{ key: "mentions", icon: "person_search", label: "Mentions" },
		{ key: "files", icon: "folder_open", label: "Files" }
	];

	return (
		<aside className="chat-utility-rail" aria-label="Chat utility tools">
			{tools.map((tool) => (
				<button key={tool.key} className="chat-utility-btn" type="button" aria-label={tool.label}>
					<Icon name={tool.icon} size={18} />
				</button>
			))}
			<div className="chat-utility-end">
				<button className="chat-utility-btn muted" type="button" aria-label="Collapse panel">
					<Icon name="keyboard_double_arrow_right" size={18} />
				</button>
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

function WorkspaceHeaderBar({ activeView, onToggleContext, onLogout }) {
	const { theme, toggleTheme } = useTheme();
	const titleMap = {
		chat: "Team Chat",
		mesh: "Mesh Network",
		carbon: "Carbon Tracker",
		pulse: "Crowd Pulse",
		accessibility: "Accessibility Panel",
		translator: "Cultural Translator"
	};

	return (
		<section className="workspace-headerbar glass">
			<div className="workspace-header-title">
				<h2>{titleMap[activeView] || "Workspace"}</h2>
				<p>Premium connectivity workspace</p>
			</div>
			<div className="workspace-header-search" aria-hidden="true">
				<Icon name="search" size={14} />
				<span>Search workspace...</span>
			</div>
			<div className="workspace-header-actions">
				<button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
					<Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
					<span>{theme === "dark" ? "Light" : "Dark"}</span>
				</button>
				<button className="header-btn" onClick={onToggleContext} aria-label="Toggle context panel">
					<Icon name="panel" size={18} />
				</button>
				<button className="header-btn" onClick={onLogout} aria-label="Logout">
					<Icon name="logout" size={18} />
				</button>
			</div>
		</section>
	);
}

function MainPanel({
	activeView,
	activeChannel,
	channelMood,
	messages,
	onSendMessage,
	onReactMessage,
	translateEnabled,
	setTranslateEnabled,
	showNudge,
	setShowNudge,
	pulseChannels,
	onRefreshPulse,
	pulseLoading,
	pulseError,
	micActive,
	onToggleMic,
	carbonLeaderboard,
	onLogCarbon,
	carbonSaving,
	carbonError,
	currentUserId,
	meshNodes,
	onRefreshMesh,
	onRegisterMesh,
	onRevokeMesh,
	meshBusy,
	meshError,
	accessibilityPrefs,
	onChangeAccessibility,
	accessibilitySaveState
}) {
	function renderView() {
		if (activeView === "chat") {
			return (
				<ChatView
					activeChannel={activeChannel}
					channelMood={channelMood}
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
			return (
				<MeshView
					meshNodes={meshNodes}
					onRefreshNodes={onRefreshMesh}
					onRegisterNode={onRegisterMesh}
					onRevokeNode={onRevokeMesh}
					isBusy={meshBusy}
					errorText={meshError}
				/>
			);
		}
		if (activeView === "carbon") {
			return (
				<CarbonView
					leaderboard={carbonLeaderboard}
					currentUserId={currentUserId}
					onLogAction={onLogCarbon}
					isSubmitting={carbonSaving}
					errorText={carbonError}
				/>
			);
		}
		if (activeView === "pulse") {
			return (
				<PulseView
					channelEnergy={pulseChannels}
					micActive={micActive}
					onMicToggle={onToggleMic}
					onRefreshPulse={onRefreshPulse}
					isRefreshing={pulseLoading}
					errorText={pulseError}
				/>
			);
		}
		if (activeView === "accessibility") {
			return (
				<AccessibilityView
					preferences={accessibilityPrefs}
					onChangePreference={onChangeAccessibility}
					saveState={accessibilitySaveState}
				/>
			);
		}
		return <TranslatorView />;
	}

	return (
		<main className="main-panel">
			<section className="main-surface">
				<div className="main-stage">
					<section className="view-scroll">{renderView()}</section>
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

export default function Layout({ authState, onLogout, onSessionExpired }) {
	const { setForcedTheme } = useTheme();
	const fallbackChannels = useMemo(() => toFallbackChannels(), []);
	const [activeView, setActiveView] = useState(() => loadFromStorage("spann-active-view", "chat"));
	const [channels, setChannels] = useState(fallbackChannels);
	const [activeChannelId, setActiveChannelId] = useState(() => loadFromStorage("spann-active-channel", fallbackChannels[0]?.id || ""));
	const [contextOpen, setContextOpen] = useState(false);
	const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
	const [messagesByChannel, setMessagesByChannel] = useState(() => loadFromStorage("spann-messages-by-channel", toFallbackMessages()));
	const [channelUnread, setChannelUnread] = useState(() => loadFromStorage("spann-channel-unread", toFallbackUnread()));
	const [translateEnabled, setTranslateEnabled] = useState(() => loadFromStorage("spann-translate-enabled", true));
	const [showNudge, setShowNudge] = useState(() => loadFromStorage("spann-show-nudge", true));
	const [channelMoodById, setChannelMoodById] = useState(() => toFallbackMoodByChannel());
	const [pulseChannels, setPulseChannels] = useState(() =>
		fallbackChannels.map((channel) => ({ id: channel.id, name: channel.name, energy: Number(channel.mood || 60) }))
	);
	const [pulseLoading, setPulseLoading] = useState(false);
	const [pulseError, setPulseError] = useState("");
	const [carbonLeaderboard, setCarbonLeaderboard] = useState([]);
	const [carbonSaving, setCarbonSaving] = useState(false);
	const [carbonError, setCarbonError] = useState("");
	const [meshNodes, setMeshNodes] = useState([]);
	const [meshBusy, setMeshBusy] = useState(false);
	const [meshError, setMeshError] = useState("");
	const [accessibilitySaveState, setAccessibilitySaveState] = useState("idle");
	const [accessibilityPrefs, setAccessibilityPrefs] = useState(() =>
		loadFromStorage("spann-accessibility-preferences", {
			dyslexia: false,
			highContrast: false,
			simplified: false,
			tts: false,
			fontSize: 15,
			colorBlind: "Normal",
			micJoined: false
		})
	);
	const [backendConnected, setBackendConnected] = useState(false);
	const prefsLoadedRef = useRef(false);

	const liveAuth = authState || getAuthState();
	const workspaceId = String(liveAuth?.workspaceId || "").trim();
	const currentUserId = String(liveAuth?.userId || liveAuth?.user?.id || "").trim();

	const activeChannel = useMemo(() => {
		const found = channels.find((channel) => String(channel.id) === String(activeChannelId));
		return found ? found.name : channels[0]?.name || "#general";
	}, [channels, activeChannelId]);

	const activeMood = Number(channelMoodById[activeChannelId] || 65);
	const currentMessages = messagesByChannel[activeChannelId] || [];
	const micActive = Boolean(accessibilityPrefs.micJoined);

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
		localStorage.setItem("spann-active-channel", JSON.stringify(activeChannelId));
	}, [activeChannelId]);

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
		setForcedTheme(activeView === "chat" || activeView === "carbon" || activeView === "mesh" ? "light" : null);

		return () => {
			setForcedTheme(null);
		};
	}, [activeView, setForcedTheme]);

	useEffect(() => {
		localStorage.setItem("spann-accessibility-preferences", JSON.stringify(accessibilityPrefs));
	}, [accessibilityPrefs]);

	async function loadChannelMessages(channelId) {
		if (!channelId) {
			return;
		}

		try {
			const payload = await apiRequest(`/channels/${encodeURIComponent(channelId)}/messages?limit=100`);
			const apiMessages = Array.isArray(payload?.data?.messages) ? payload.data.messages : [];
			const mappedMessages = apiMessages.map(toUiMessage);
			setMessagesByChannel((current) => ({
				...current,
				[channelId]: mappedMessages
			}));
			setChannelUnread((current) => ({
				...current,
				[channelId]: 0
			}));
		} catch (error) {
			const normalized = normalizeApiError(error, "Unable to load messages");
			if (normalized.status === 401 && onSessionExpired) {
				onSessionExpired();
			}
		}
	}

	async function refreshPulseData(channelRows) {
		if (!Array.isArray(channelRows) || channelRows.length === 0) {
			return false;
		}

		setPulseLoading(true);
		setPulseError("");
		try {
			const snapshots = await Promise.all(
				channelRows.map(async (channel) => {
					try {
						const payload = await apiRequest(`/pulse/${encodeURIComponent(channel.id)}`);
						const snapshot = payload?.data || {};
						return {
							id: channel.id,
							name: channel.name,
							energy: normalizePulseScore(snapshot.score)
						};
					} catch (error) {
						return {
							id: channel.id,
							name: channel.name,
							energy: Number(channelMoodById[channel.id] || 60)
						};
					}
				})
			);

			setPulseChannels(snapshots);
			const moodMap = {};
			snapshots.forEach((snapshot) => {
				moodMap[snapshot.id] = snapshot.energy;
			});
			setChannelMoodById((current) => ({ ...current, ...moodMap }));
			return true;
		} catch (error) {
			setPulseError("Pulse snapshots are currently unavailable.");
			return false;
		} finally {
			setPulseLoading(false);
		}
	}

	async function refreshCarbonLeaderboard() {
		if (!workspaceId) {
			return;
		}

		try {
			setCarbonError("");
			const payload = await apiRequest(`/carbon/leaderboard?workspace_id=${encodeURIComponent(workspaceId)}`);
			const rows = Array.isArray(payload?.data) ? payload.data : [];
			setCarbonLeaderboard(rows);
		} catch (error) {
			const normalized = normalizeApiError(error, "Unable to load carbon leaderboard");
			if (normalized.status === 401 && onSessionExpired) {
				onSessionExpired();
				return;
			}
			setCarbonError(normalized.message);
		}
	}

	async function refreshMeshNodes() {
		setMeshBusy(true);
		setMeshError("");
		try {
			const payload = await apiRequest("/mesh/nodes");
			setMeshNodes(Array.isArray(payload?.data) ? payload.data : []);
			return true;
		} catch (error) {
			const normalized = normalizeApiError(error, "Unable to load mesh nodes");
			setMeshError(normalized.message);
			return false;
		} finally {
			setMeshBusy(false);
		}
	}

	async function loadPreferences() {
		try {
			const payload = await apiRequest("/users/me/preferences", {
				method: "PATCH",
				body: JSON.stringify({})
			});
			const data = payload?.data || {};
			const loaded = data.accessibility_settings && typeof data.accessibility_settings === "object" ? data.accessibility_settings : {};
			setAccessibilityPrefs((current) => ({
				...current,
				...loaded,
				fontSize: Number(loaded.fontSize || current.fontSize || 15),
				colorBlind: loaded.colorBlind || current.colorBlind || "Normal"
			}));
			prefsLoadedRef.current = true;
		} catch (error) {
			prefsLoadedRef.current = true;
		}
	}

	useEffect(() => {
		if (!workspaceId) {
			setBackendConnected(false);
			if (onSessionExpired) {
				onSessionExpired();
			}
			return;
		}

		let cancelled = false;

		async function bootstrapFromBackend() {
			try {
				const payload = await apiRequest(`/channels?workspace_id=${encodeURIComponent(workspaceId)}`);
				if (cancelled) {
					return;
				}

				const fetchedChannels = Array.isArray(payload?.data) ? payload.data : [];
				const mappedChannels =
					fetchedChannels.length > 0
						? fetchedChannels.map((row) => ({
								id: String(row.id),
								name: withHash(row.name),
								mood: 60
						  }))
						: fallbackChannels;

				setChannels(mappedChannels);
				setBackendConnected(true);

				const nextChannelId = mappedChannels.some((channel) => String(channel.id) === String(activeChannelId))
					? activeChannelId
					: mappedChannels[0]?.id || "";
				setActiveChannelId(nextChannelId);
				await Promise.all([
					loadChannelMessages(nextChannelId),
					refreshPulseData(mappedChannels),
					refreshCarbonLeaderboard(),
					refreshMeshNodes(),
					loadPreferences()
				]);
			} catch (error) {
				if (cancelled) {
					return;
				}
				const normalized = normalizeApiError(error, "Unable to connect backend");
				setBackendConnected(false);
				if (normalized.status === 401 && onSessionExpired) {
					onSessionExpired();
				}
			}
		}

		bootstrapFromBackend();

		return () => {
			cancelled = true;
		};
	}, [workspaceId]);

	useEffect(() => {
		if (activeView !== "chat" || !activeChannelId || !backendConnected) {
			return;
		}
		loadChannelMessages(activeChannelId);
	}, [activeView, activeChannelId, backendConnected]);

	useEffect(() => {
		if (!prefsLoadedRef.current || !backendConnected) {
			return;
		}

		const timer = setTimeout(async () => {
			setAccessibilitySaveState("saving");
			try {
				await apiRequest("/users/me/preferences", {
					method: "PATCH",
					body: JSON.stringify({
						coaching_enabled: true,
						accessibility_settings: accessibilityPrefs
					})
				});
				setAccessibilitySaveState("saved");
			} catch (error) {
				setAccessibilitySaveState("error");
			}
		}, 450);

		return () => clearTimeout(timer);
	}, [accessibilityPrefs, backendConnected]);

	useEffect(() => {
		setMobileSheetOpen(false);
	}, [activeView]);

	function handleChannelChange(channelId) {
		setActiveChannelId(channelId);
		if (activeView !== "chat") {
			setActiveView("chat");
		}
	}

	async function handleSendMessage(channelId, text, translated) {
		if (!channelId) {
			return;
		}

		let usedLocalFallback = false;

		if (backendConnected) {
			try {
				const payload = await apiRequest("/messages", {
					method: "POST",
					body: JSON.stringify({
						channel_id: channelId,
						text,
						source_locale: translated ? "en-US" : null
					})
				});

				const apiMessage = payload?.data;
				if (apiMessage) {
					setMessagesByChannel((current) => ({
						...current,
						[channelId]: [...(current[channelId] || []), toUiMessage(apiMessage)]
					}));
					pushAppNotice("Message sent.", "success");
				}
				return;
			} catch (error) {
				const normalized = normalizeApiError(error, "Unable to send message");
				usedLocalFallback = true;
				if (normalized.status === 401 && onSessionExpired) {
					onSessionExpired();
					return;
				}
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
			lang: translated ? "🌐 en-US" : undefined
		};

		setMessagesByChannel((current) => ({
			...current,
			[channelId]: [...(current[channelId] || []), draft]
		}));
		pushAppNotice(usedLocalFallback ? "Message saved locally." : "Message sent.", usedLocalFallback ? "info" : "success");
	}

	async function handleReactMessage(channelId, messageId, emoji) {
		if (!channelId || !messageId || !emoji) {
			return;
		}

		let usedLocalFallback = false;

		if (backendConnected) {
			try {
				const payload = await apiRequest(`/messages/${encodeURIComponent(messageId)}/reactions`, {
					method: "POST",
					body: JSON.stringify({ emoji })
				});

				const reactions = Array.isArray(payload?.data) ? payload.data : [];
				setMessagesByChannel((current) => ({
					...current,
					[channelId]: (current[channelId] || []).map((message) => {
						if (String(message.id) !== String(messageId)) {
							return message;
						}
						return {
							...message,
							reactions: reactions.map((reaction) => `${reaction.emoji} ${reaction.count}`)
						};
					})
				}));
				pushAppNotice("Reaction added.", "success");
				return;
			} catch (error) {
				const normalized = normalizeApiError(error, "Unable to update reaction");
				usedLocalFallback = true;
				if (normalized.status === 401 && onSessionExpired) {
					onSessionExpired();
					return;
				}
			}
		}

		setMessagesByChannel((current) => ({
			...current,
			[channelId]: (current[channelId] || []).map((message) => {
				if (String(message.id) !== String(messageId)) {
					return message;
				}
				return {
					...message,
					reactions: incrementReaction(message.reactions || [], emoji)
				};
			})
		}));
		pushAppNotice(usedLocalFallback ? "Reaction saved locally." : "Reaction added.", usedLocalFallback ? "info" : "success");
	}

	async function handleLogCarbon(action) {
		if (!workspaceId) {
			return;
		}

		setCarbonSaving(true);
		setCarbonError("");
		try {
			await apiRequest("/carbon/log", {
				method: "POST",
				body: JSON.stringify({
					workspace_id: workspaceId,
					transport_type: action.transportType,
					kg_co2: action.kgCo2
				})
			});
			await refreshCarbonLeaderboard();
			pushAppNotice(action?.note || "Carbon log saved.", "success");
		} catch (error) {
			const normalized = normalizeApiError(error, "Unable to save carbon log");
			setCarbonError(normalized.message);
			pushAppNotice(normalized.message || "Unable to save carbon log.", "error");
		} finally {
			setCarbonSaving(false);
		}
	}

	async function handleRegisterMeshNode() {
		setMeshBusy(true);
		setMeshError("");
		try {
			const suffix = String(Date.now()).slice(-4);
			await apiRequest("/mesh/register", {
				method: "POST",
				body: JSON.stringify({ node_name: `web-${suffix}` })
			});
			await refreshMeshNodes();
			pushAppNotice("Mesh node registered.", "success");
		} catch (error) {
			const normalized = normalizeApiError(error, "Unable to register mesh node");
			setMeshError(normalized.message);
			pushAppNotice(normalized.message || "Unable to register mesh node.", "error");
		} finally {
			setMeshBusy(false);
		}
	}

	async function handleRevokeMeshNode(nodeId) {
		if (!nodeId) {
			return;
		}
		setMeshBusy(true);
		setMeshError("");
		try {
			await apiRequest(`/mesh/nodes/${encodeURIComponent(nodeId)}/revoke`, {
				method: "POST"
			});
			await refreshMeshNodes();
			pushAppNotice("Mesh node revoked.", "success");
		} catch (error) {
			const normalized = normalizeApiError(error, "Unable to revoke mesh node");
			setMeshError(normalized.message);
			pushAppNotice(normalized.message || "Unable to revoke mesh node.", "error");
		} finally {
			setMeshBusy(false);
		}
	}

	function handleAccessibilityPreferenceChange(key, value) {
		setAccessibilityPrefs((current) => ({
			...current,
			[key]: value
		}));
	}

	function handleToggleMic() {
		const next = !micActive;
		handleAccessibilityPreferenceChange("micJoined", next);
		pushAppNotice(next ? "Microphone joined." : "Microphone muted.", "info");
	}

	async function handleRefreshPulseAction() {
		const success = await refreshPulseData(channels);
		pushAppNotice(success ? "Pulse refreshed." : "Pulse refresh unavailable.", success ? "success" : "error");
	}

	async function handleRefreshMeshAction() {
		const success = await refreshMeshNodes();
		pushAppNotice(success ? "Nodes refreshed." : "Unable to refresh nodes.", success ? "success" : "error");
	}

	function handleContextAction() {
		if (typeof window !== "undefined" && window.matchMedia("(max-width: 1140px)").matches) {
			setMobileSheetOpen(true);
			return;
		}

		setContextOpen((current) => !current);
	}

	return (
		<div className={`app-shell ${activeView === "chat" ? "chat-workspace" : ""}`}>
			<div className="workspace-stack">
				{activeView !== "chat" ? <WorkspaceHeaderBar activeView={activeView} onToggleContext={handleContextAction} onLogout={onLogout} /> : null}
				<div className={`workspace-body ${contextOpen ? "context-open" : "context-closed"} ${activeView === "chat" ? "chat-layout" : ""}`}>
					{activeView === "chat" ? (
						<>
							<ChatNavRail activeView={activeView} onChange={setActiveView} items={navItems} />
							<Sidebar
								activeView={activeView}
								activeChannelId={activeChannelId}
								channels={channels}
								onChannelChange={handleChannelChange}
								channelUnread={channelUnread}
								navItems={navItems}
								onViewChange={setActiveView}
								isChatLayout={true}
							/>
							<MainPanel
								activeView={activeView}
								activeChannel={activeChannel}
								channelMood={activeMood}
								messages={currentMessages}
								onSendMessage={(channelLabel, text, translated) => {
									const channel = channels.find((item) => item.name === channelLabel) || channels.find((item) => item.id === activeChannelId);
									handleSendMessage(channel?.id || activeChannelId, text, translated);
								}}
								onReactMessage={(channelLabel, messageId, emoji) => {
									const channel = channels.find((item) => item.name === channelLabel) || channels.find((item) => item.id === activeChannelId);
									handleReactMessage(channel?.id || activeChannelId, messageId, emoji);
								}}
								translateEnabled={translateEnabled}
								setTranslateEnabled={setTranslateEnabled}
								showNudge={showNudge}
								setShowNudge={setShowNudge}
								pulseChannels={pulseChannels}
								onRefreshPulse={handleRefreshPulseAction}
								pulseLoading={pulseLoading}
								pulseError={pulseError}
								micActive={micActive}
								onToggleMic={handleToggleMic}
								carbonLeaderboard={carbonLeaderboard}
								onLogCarbon={handleLogCarbon}
								carbonSaving={carbonSaving}
								carbonError={carbonError}
								currentUserId={currentUserId}
								meshNodes={meshNodes}
								onRefreshMesh={handleRefreshMeshAction}
								onRegisterMesh={handleRegisterMeshNode}
								onRevokeMesh={handleRevokeMeshNode}
								meshBusy={meshBusy}
								meshError={meshError}
								accessibilityPrefs={accessibilityPrefs}
								onChangeAccessibility={handleAccessibilityPreferenceChange}
								accessibilitySaveState={accessibilitySaveState}
							/>
							<ChatUtilityRail />
						</>
					) : (
						<>
							<Sidebar
								activeView={activeView}
								activeChannelId={activeChannelId}
								channels={channels}
								onChannelChange={handleChannelChange}
								channelUnread={channelUnread}
								navItems={navItems}
								onViewChange={setActiveView}
								isChatLayout={false}
							/>
							<MainPanel
								activeView={activeView}
								activeChannel={activeChannel}
								channelMood={activeMood}
								messages={currentMessages}
								onSendMessage={(channelLabel, text, translated) => {
									const channel = channels.find((item) => item.name === channelLabel) || channels.find((item) => item.id === activeChannelId);
									handleSendMessage(channel?.id || activeChannelId, text, translated);
								}}
								onReactMessage={(channelLabel, messageId, emoji) => {
									const channel = channels.find((item) => item.name === channelLabel) || channels.find((item) => item.id === activeChannelId);
									handleReactMessage(channel?.id || activeChannelId, messageId, emoji);
								}}
								translateEnabled={translateEnabled}
								setTranslateEnabled={setTranslateEnabled}
								showNudge={showNudge}
								setShowNudge={setShowNudge}
								pulseChannels={pulseChannels}
								onRefreshPulse={handleRefreshPulseAction}
								pulseLoading={pulseLoading}
								pulseError={pulseError}
								micActive={micActive}
								onToggleMic={handleToggleMic}
								carbonLeaderboard={carbonLeaderboard}
								onLogCarbon={handleLogCarbon}
								carbonSaving={carbonSaving}
								carbonError={carbonError}
								currentUserId={currentUserId}
								meshNodes={meshNodes}
								onRefreshMesh={handleRefreshMeshAction}
								onRegisterMesh={handleRegisterMeshNode}
								onRevokeMesh={handleRevokeMeshNode}
								meshBusy={meshBusy}
								meshError={meshError}
								accessibilityPrefs={accessibilityPrefs}
								onChangeAccessibility={handleAccessibilityPreferenceChange}
								accessibilitySaveState={accessibilitySaveState}
							/>
							<aside className={`context-panel workspace-context-rail ${contextOpen ? "" : "collapsed"}`}>
								<ContextContent activeView={activeView} activeChannel={activeChannel} />
							</aside>
						</>
					)}
				</div>
			</div>
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
