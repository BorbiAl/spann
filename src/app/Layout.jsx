/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import './Layout.css';
import { useEffect, useMemo, useRef, useState } from "react";
import ChannelList from "../components/ChannelList";
import Icon from "../components/Icon";
import ChatView from "../views/ChatView";
import MeshView from "../views/MeshView";
import CarbonView from "../views/CarbonView";
import PulseView from "../views/PulseView";
import AccessibilityView from "../views/AccessibilityView";
import TranslatorView from "../views/TranslatorView";
import SettingsView from "../views/SettingsView";
import CallView from "../views/CallView";
import SupportView from "../views/SupportView";
import {
	ACCESSIBILITY_PREFS_EVENT,
	ACCESSIBILITY_PREFS_KEY,
	applyAccessibilityPreferencesGlobal,
	loadAccessibilityPreferencesGlobal,
	persistAccessibilityPreferencesGlobal,
} from "./accessibility";
import { meshApi } from "../api/mesh";
import {
	apiRequest,
	fetchOrganizationMembers,
	fetchPublicRuntimeConfig,
	getAuthState,
	incrementReaction,
	inviteOrganizationMember,
	loadFromStorage,
	normalizeApiError,
	removeOrganizationMember,
	pushAppNotice
} from "../data/constants";
import {
	DEMO_CHANNELS,
	DEMO_CHANNEL_UNREAD,
	DEMO_MESSAGES_BY_CHANNEL,
} from "../lib/demoMode";
import { useUserSettingsStore } from "../store/userSettings";

function withHash(channelName) {
	const value = String(channelName || "").trim();
	if (!value) {
		return "#channel";
	}
	return value.startsWith("#") ? value : `#${value}`;
}

function toFallbackChannels() {
	return [];
}

function toFallbackMessages() {
	return {};
}

function toFallbackUnread() {
	return {};
}

function sanitizeUnreadMap(unreadMap, channelRows) {
	const next = {};
	(channelRows || []).forEach((channel) => {
		const channelId = String(channel?.id || "");
		if (!channelId) {
			return;
		}
		const value = Number(unreadMap?.[channelId] || 0);
		next[channelId] = Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
	});
	return next;
}

function toFallbackMoodByChannel() {
	return {};
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

function isUuidLike(value) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}


function detectSourceLanguage(text) {
	const value = String(text || "").trim();
	if (!value) {
		return { locale: "en-US", culture: "American", isEnglish: true };
	}

	const checks = [
		{ regex: /[\u0400-\u04FF]/, locale: "bg-BG", culture: "Bulgarian" },
		{ regex: /[\u0370-\u03FF]/, locale: "el-GR", culture: "Greek" },
		{ regex: /[\u0590-\u05FF]/, locale: "he-IL", culture: "Israeli" },
		{ regex: /[\u0600-\u06FF]/, locale: "ar-SA", culture: "Arabian" },
		{ regex: /[\u0900-\u097F]/, locale: "hi-IN", culture: "Indian" },
		{ regex: /[\u0E00-\u0E7F]/, locale: "th-TH", culture: "Thai" },
		{ regex: /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/, locale: "ko-KR", culture: "Korean" },
		{ regex: /[\u3040-\u30FF]/, locale: "ja-JP", culture: "Japanese" },
		{ regex: /[\u4E00-\u9FFF]/, locale: "zh-CN", culture: "Chinese" }
	];

	for (const check of checks) {
		if (check.regex.test(value)) {
			return { locale: check.locale, culture: check.culture, isEnglish: false };
		}
	}

	const lowered = value.toLowerCase();
	const latinRules = [
		{ locale: "es-ES", culture: "Spanish", pattern: /\b(hola|gracias|por favor|buenos|equipo|mensaje|necesito)\b/ },
		{ locale: "fr-FR", culture: "French", pattern: /\b(bonjour|merci|s'il vous plait|équipe|besoin|message)\b/ },
		{ locale: "de-DE", culture: "German", pattern: /\b(hallo|danke|bitte|team|nachricht|brauche)\b/ },
		{ locale: "it-IT", culture: "Italian", pattern: /\b(ciao|grazie|per favore|squadra|messaggio|bisogno)\b/ },
		{ locale: "pt-BR", culture: "Brazilian", pattern: /\b(olá|obrigado|por favor|equipe|mensagem|preciso)\b/ },
		{ locale: "nl-NL", culture: "Dutch", pattern: /\b(hallo|dank|alsjeblieft|team|bericht|nodig)\b/ },
		{ locale: "tr-TR", culture: "Turkish", pattern: /\b(merhaba|teşekkürler|lütfen|takım|mesaj|ihtiyacım)\b/ },
		{ locale: "pl-PL", culture: "Polish", pattern: /\b(cześć|dziękuję|proszę|zespół|wiadomość|potrzebuję)\b/ }
	];

	for (const rule of latinRules) {
		if (rule.pattern.test(lowered)) {
			return { locale: rule.locale, culture: rule.culture, isEnglish: false };
		}
	}

	const hasExtendedLatin = /[\u00C0-\u024F]/.test(value);
	if (hasExtendedLatin) {
		return { locale: "auto", culture: "Global", isEnglish: false };
	}

	return { locale: "en-US", culture: "American", isEnglish: true };
}

function isDirectChannel(channel) {
	return String(channel?.kind || "").toLowerCase() === "dm" || String(channel?.id || "").startsWith("dm:") || String(channel?.name || "").startsWith("@");
}

function formatMessageTime(timestamp) {
	const date = timestamp ? new Date(timestamp) : new Date();
	if (Number.isNaN(date.getTime())) {
		return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
	}
	return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const DEFAULT_NAV_ITEMS = [
	{ key: "chat", label: "Chat", icon: "chat", badge: 0 },
	{ key: "mesh", label: "Mesh", icon: "tower", badge: 0 },
	{ key: "carbon", label: "Carbon", icon: "leaf", badge: 0 },
	{ key: "pulse", label: "Pulse", icon: "wave", badge: 0 },
	{ key: "accessibility", label: "Access", icon: "eye", badge: 0 },
	{ key: "translator", label: "Translate", icon: "globe", badge: 0 },
	{ key: "settings", label: "Settings", icon: "settings", badge: 0 }
];

function toUiMessage(apiMessage) {
	const reactions = Array.isArray(apiMessage?.reactions)
		? apiMessage.reactions.map((reaction) => `${reaction.emoji || ""} ${Number(reaction.count) || 0}`.trim())
		: [];
	const originalText = String(apiMessage?.text || "").trim();
	const translatedText = String(apiMessage?.text_translated || "").trim();

	return {
		id: String(apiMessage?.id || Date.now()),
		user: String(apiMessage?.user?.name || "Member"),
		avatarUrl: String(apiMessage?.user?.avatar_url || apiMessage?.user?.avatar || "").trim(),
		initials: String(apiMessage?.user?.initials || "US"),
		color: String(apiMessage?.user?.color || "#0f67b7"),
		time: formatMessageTime(apiMessage?.created_at),
		text: originalText || translatedText,
		translatedText: translatedText || null,
		reactions,
		translated: Boolean(translatedText),
		lang: apiMessage?.source_locale ? `${apiMessage.source_locale} -> en-US` : undefined
	};
}

function SideSection({ activeView, onSectionAction }) {
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
				<button key={item} onClick={() => onSectionAction?.(item)} className={`section-item ${index === 0 ? "active" : ""}`}>
					<span className="channel-dot">G��</span>
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

function Sidebar({ activeView, activeChannelId, channels, onChannelChange, channelUnread, navItems, onViewChange, isChatLayout, onCreateChannel, onStartDirectMessage, onJoinChannel, onLeaveChannel, joinedChannelIds, jumpRef, collapsed, currentUserName, currentUserInitials, onSectionAction, onlineMembers, workspaceMembers, canManageMembers, canRemoveMembers, onInviteMember, onRemoveMember }) {
	const [jumpSearch, setJumpSearch] = useState("");
	const displayedMembers = Array.isArray(onlineMembers) ? onlineMembers.slice(0, 6) : [];

	if (isChatLayout) {
		if (collapsed) return null;

		const filteredChannels = jumpSearch.trim()
			? channels.filter((c) => String(c.name).toLowerCase().includes(jumpSearch.toLowerCase()))
			: channels;

		return (
			<aside className="sidebar chat-sidebar">
				<div className="chat-sidebar-head">
					<p className="chat-sidebar-title">Teams</p>
					<label className="chat-jump">
						<Icon name="search" size={14} />
						<input
							ref={jumpRef}
							type="text"
							value={jumpSearch}
							onChange={(e) => setJumpSearch(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Escape") { setJumpSearch(""); e.target.blur(); }
								if (e.key === "Enter" && filteredChannels.length > 0) {
									onChannelChange(filteredChannels[0].id);
									setJumpSearch("");
									e.target.blur();
								}
							}}
							placeholder="Jump to..."
							aria-label="Jump to channel"
						/>
					</label>
				</div>

				<ChannelList
					channels={filteredChannels}
					activeChannelId={activeChannelId}
					onChannelChange={(id) => { onChannelChange(id); setJumpSearch(""); }}
					channelUnread={channelUnread}
					onCreateChannel={onCreateChannel}
					onStartDirectMessage={onStartDirectMessage}
					onJoinChannel={onJoinChannel}
					onLeaveChannel={onLeaveChannel}
					joinedChannelIds={joinedChannelIds}
					workspaceMembers={workspaceMembers}
					canManageMembers={canManageMembers}
					canRemoveMembers={canRemoveMembers}
					onInviteMember={onInviteMember}
					onRemoveMember={onRemoveMember}
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
					onJoinChannel={onJoinChannel}
					onLeaveChannel={onLeaveChannel}
					joinedChannelIds={joinedChannelIds}
				/>
			) : (
				<SideSection activeView={activeView} onSectionAction={onSectionAction} />
			)}

			<div className="sidebar-section">
				<p className="section-title">Online</p>
				{displayedMembers.length === 0 ? (
					<button className="member-item" type="button">
						<span className="member-avatar" style={{ background: "#0f67b7" }}>
							{String(currentUserInitials || "ME").slice(0, 2).toUpperCase()}
						</span>
						<span className="member-meta">{currentUserName || "Current User"}</span>
					</button>
				) : (
					displayedMembers.map((member) => {
						const label = String(member?.display_name || member?.email || "Member");
						const initials = label
							.split(/\s+/)
							.filter(Boolean)
							.slice(0, 2)
							.map((word) => word[0])
							.join("")
							.toUpperCase() || "ME";
						const isOnline = Boolean(member?.is_online);
						return (
							<button key={String(member?.user_id || label)} className="member-item" type="button">
								<span className="member-avatar" style={{ background: isOnline ? "#0f67b7" : "#667085" }}>
									{initials}
								</span>
								<span className="member-meta">{label}</span>
							</button>
						);
					})
				)}
			</div>
		</aside>
	);
}


function ChatUtilityRail({ onToolAction, onCollapse }) {
	const tools = [
		{ key: "threads", icon: "forum", label: "Threads" },
		{ key: "mentions", icon: "person_search", label: "Mentions" },
		{ key: "files", icon: "folder_open", label: "Files" }
	];

	return (
		<aside className="chat-utility-rail" aria-label="Chat utility tools">
			{tools.map((tool) => (
				<button key={tool.key} className="chat-utility-btn" type="button" aria-label={tool.label} onClick={() => onToolAction?.(tool.key)}>
					<Icon name={tool.icon} size={18} />
				</button>
			))}
			<div className="chat-utility-end">
				<button className="chat-utility-btn muted" type="button" aria-label="Collapse panel" onClick={onCollapse}>
					<Icon name="keyboard_double_arrow_right" size={18} />
				</button>
			</div>
		</aside>
	);
}




function MainPanel({
	activeView,
	onViewChange,
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
	workspaceId,
	canEditOfficeLocation,
	meshNodes,
	onRefreshMesh,
	onRegisterMesh,
	onRevokeMesh,
	meshBusy,
	meshError,
	accessibilityPrefs,
	onChangeAccessibility,
	accessibilitySaveState,
	authState,
	onLogout,
	currentUserName,
	workspaceMembers,
	hasGroupChannels,
	onCreateGroup,
	canManageMembers,
	onInviteMember,
}) {
	function renderView() {
		if (activeView === "call") {
			return <CallView activeChannel={activeChannel} participants={workspaceMembers} onEndCall={() => onViewChange("chat")} />;
		}
		if (activeView === "chat") {
			return (
				<ChatView
					activeChannel={activeChannel}
					activeChannelId={activeChannelId}
					channelMood={channelMood}
					messages={messages}
					accessibilityPrefs={accessibilityPrefs}
					preferredLocale={authState?.user?.locale || "en-US"}
					onSendMessage={onSendMessage}
					onReactMessage={onReactMessage}
					translateEnabled={translateEnabled}
					setTranslateEnabled={setTranslateEnabled}
					showNudge={showNudge}
					currentUserName={currentUserName}
					workspaceMembers={workspaceMembers}
					hasGroupChannels={hasGroupChannels}
					onCreateGroup={onCreateGroup}
					canManageMembers={canManageMembers}
					onInviteMember={onInviteMember}
					onOpenChannelSettings={() => {
						document.dispatchEvent(new CustomEvent("spann:goto-settings", {
							detail: { section: "channels", channelName: activeChannel },
						}));
						onViewChange("settings");
					}}
					onOpenSupport={() => onViewChange("support")}
					setShowNudge={setShowNudge}
					onStartCall={() => onViewChange("call")}
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
					onOpenSettings={() => onViewChange("settings")}
					onOpenSupport={() => onViewChange("support")}
				/>
			);
		}
		if (activeView === "carbon") {
			return (
				<CarbonView
					leaderboard={carbonLeaderboard}
					currentUserId={currentUserId}
					workspaceId={workspaceId}
					canEditOfficeLocation={canEditOfficeLocation}
					onLogAction={onLogCarbon}
					isSubmitting={carbonSaving}
					errorText={carbonError}
					onOpenSettings={() => onViewChange("settings")}
					onOpenSupport={() => onViewChange("support")}
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
					onOpenSettings={() => onViewChange("settings")}
					onOpenSupport={() => onViewChange("support")}
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
		if (activeView === "settings") {
			return (
				<SettingsView
					authState={authState}
					onLogout={onLogout}
					accessibilityPrefs={accessibilityPrefs}
					onChangeAccessibility={onChangeAccessibility}
				/>
			);
		}
		if (activeView === "support") {
			return <SupportView />;
		}
		return <TranslatorView />;
	}

	return renderView();
}


function GroupCreateModal({
	open,
	busy,
	groupName,
	setGroupName,
	addAnyone,
	setAddAnyone,
	inviteEmails,
	setInviteEmails,
	onClose,
	onSubmit,
	canInvite,
}) {
	if (!open) {
		return null;
	}

	return (
		<div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px] flex items-center justify-center px-4" onClick={onClose}>
			<section className="w-full max-w-lg rounded-2xl border border-outline-variant/20 bg-surface p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
				<div className="flex items-start justify-between gap-3">
					<div>
						<h2 className="text-lg font-bold text-on-surface">Create Group</h2>
						<p className="mt-1 text-sm text-on-surface-variant">Create a new group channel for this workspace.</p>
					</div>
					<button type="button" className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container-high" onClick={onClose} aria-label="Close create group dialog">
						<span className="material-symbols-outlined text-[20px]">close</span>
					</button>
				</div>

				<div className="mt-5 space-y-4">
					<div>
						<label htmlFor="group-name" className="block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Group name</label>
						<input
							id="group-name"
							type="text"
							value={groupName}
							onChange={(event) => setGroupName(event.target.value)}
							placeholder="project-updates"
							className="mt-1 w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
							autoFocus
						/>
					</div>

					<div className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-3">
						<p className="text-sm font-semibold text-on-surface">Do you want to add anyone?</p>
						<div className="mt-3 flex items-center gap-3">
							<button
								type="button"
								onClick={() => setAddAnyone(true)}
								className={`rounded-full px-3 py-1 text-xs font-semibold border ${addAnyone ? "border-primary bg-primary/10 text-primary" : "border-outline-variant/40 text-on-surface-variant"}`}
							>
								Yes
							</button>
							<button
								type="button"
								onClick={() => setAddAnyone(false)}
								className={`rounded-full px-3 py-1 text-xs font-semibold border ${!addAnyone ? "border-primary bg-primary/10 text-primary" : "border-outline-variant/40 text-on-surface-variant"}`}
							>
								No
							</button>
						</div>

						{addAnyone ? (
							<div className="mt-3">
								<label htmlFor="invite-emails" className="block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Invite emails (comma-separated)</label>
								<textarea
									id="invite-emails"
									value={inviteEmails}
									onChange={(event) => setInviteEmails(event.target.value)}
									placeholder="alex@company.com, maria@company.com"
									rows={2}
									disabled={!canInvite}
									className="mt-1 w-full rounded-lg border border-outline-variant/40 bg-surface px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
								/>
								{!canInvite ? <p className="mt-1 text-[11px] text-on-surface-variant">Only owners/admins can invite members.</p> : null}
							</div>
						) : null}
					</div>
				</div>

				<div className="mt-6 flex items-center justify-end gap-2">
					<button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high">Cancel</button>
					<button
						type="button"
						onClick={onSubmit}
						disabled={busy || !String(groupName || "").trim()}
						className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:brightness-95 disabled:opacity-60"
					>
						{busy ? "Creating..." : "Create Group"}
					</button>
				</div>
			</section>
		</div>
	);
}

export default function Layout({ authState, onLogout, onSessionExpired, isDemo = false }) {
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
	const [joinedChannelIds, setJoinedChannelIds] = useState(() => loadFromStorage("spann-joined-channel-ids", []));
	const [myReactionsByMessage, setMyReactionsByMessage] = useState(() => loadFromStorage("spann-my-reactions", {}));
	const [channelMoodById, setChannelMoodById] = useState(() => toFallbackMoodByChannel());
	const [pulseLoading, setPulseLoading] = useState(false);
	const [pulseError, setPulseError] = useState("");
	const [carbonLeaderboard, setCarbonLeaderboard] = useState([]);
	const [carbonSaving, setCarbonSaving] = useState(false);
	const [carbonError, setCarbonError] = useState("");
	const [meshNodes, setMeshNodes] = useState([]);
	const [meshBusy, setMeshBusy] = useState(false);
	const [meshError, setMeshError] = useState("");
	const [accessibilitySaveState, setAccessibilitySaveState] = useState("idle");
	const [accessibilityPrefs, setAccessibilityPrefs] = useState(() => loadAccessibilityPreferencesGlobal());
	const [backendConnected, setBackendConnected] = useState(false);
	const [runtimeNavItems, setRuntimeNavItems] = useState(DEFAULT_NAV_ITEMS);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [workspaceMembers, setWorkspaceMembers] = useState([]);
	const [groupModalOpen, setGroupModalOpen] = useState(false);
	const [groupNameInput, setGroupNameInput] = useState("");
	const [groupAddAnyone, setGroupAddAnyone] = useState(false);
	const [groupInviteEmails, setGroupInviteEmails] = useState("");
	const [groupCreateBusy, setGroupCreateBusy] = useState(false);
	const prefsLoadedRef = useRef(false);
	const jumpInputRef = useRef(null);
	const { initialize: initUserSettings } = useUserSettingsStore();

	// Refs so the stable keydown effect can read current values without stale closures
	const activeViewRef = useRef(activeView);
	const activeChannelIdRef = useRef(activeChannelId);
	const channelsRef = useRef(channels);
	useEffect(() => { activeViewRef.current = activeView; }, [activeView]);
	useEffect(() => { activeChannelIdRef.current = activeChannelId; }, [activeChannelId]);
	useEffect(() => { channelsRef.current = channels; }, [channels]);

	const liveAuth = authState || getAuthState();
	const workspaceId = String(liveAuth?.workspaceId || "").trim();
	const currentUserId = String(liveAuth?.userId || liveAuth?.user?.id || "").trim();
	const workspaceName = String(
		liveAuth?.workspaceName ||
		liveAuth?.workspace?.name ||
		liveAuth?.user?.workspace_name ||
		""
	).trim() || (workspaceId ? `Workspace ${workspaceId.slice(0, 8)}` : "Spann Workspace");
	const workspaceSubtitle = workspaceId
		? `ID ${workspaceId.slice(0, 8)}...`
		: "Premium Connectivity";
	const userName = String(
		liveAuth?.user?.display_name ||
		liveAuth?.user?.name ||
		liveAuth?.user?.email ||
		liveAuth?.email ||
		"Member"
	).trim();
	const userRole = String(liveAuth?.user?.role || "Member").trim() || "Member";
	const userAvatar = String(liveAuth?.user?.avatar_url || liveAuth?.user?.avatar || "").trim();
function initialsFromLabel(label) {
	const raw = String(label || "").trim();
	if (!raw) {
		return "ME";
	}

	const withoutDomain = raw.includes("@") ? raw.split("@")[0] : raw;
	const tokens = withoutDomain
		.replace(/[._-]+/g, " ")
		.split(/\s+/)
		.filter(Boolean);

	if (tokens.length >= 2) {
		return `${tokens[0][0] || ""}${tokens[tokens.length - 1][0] || ""}`.toUpperCase();
	}

	const first = tokens[0] || withoutDomain;
	return first.slice(0, 2).toUpperCase();
}
	const userInitials = initialsFromLabel(userName);
		const [pulseChannels, setPulseChannels] = useState(() =>
			fallbackChannels.map((channel) => ({ id: channel.id, name: channel.name, energy: null, hasData: false }))
		);
	const onlineMembers = useMemo(
		() => (Array.isArray(workspaceMembers) ? workspaceMembers.filter((member) => Boolean(member?.is_online)) : []),
		[workspaceMembers]
	);
	const normalizedRole = String(userRole || "member").toLowerCase();
	const canManageMembers = normalizedRole === "owner" || normalizedRole === "admin";
	const canRemoveMembers = normalizedRole === "owner";

	const activeChannel = useMemo(() => {
		const found = channels.find((channel) => String(channel.id) === String(activeChannelId));
		return found ? found.name : channels[0]?.name || "No channel";
	}, [channels, activeChannelId]);

	const activeMood = Number(channelMoodById[activeChannelId] || 65);
	const currentMessages = messagesByChannel[activeChannelId] || [];
	const micActive = Boolean(accessibilityPrefs.micJoined);
	const hasGroupChannels = useMemo(
		() => channels.some((channel) => !isDirectChannel(channel)),
		[channels]
	);

	const navItems = useMemo(() => {
		const totalChatUnread = channels.reduce((sum, channel) => sum + (Number(channelUnread?.[channel.id]) || 0), 0);
		return runtimeNavItems.map((item) => {
			if (item.key === "chat") {
				return { ...item, badge: totalChatUnread };
			}
			return item;
		});
	}, [channelUnread, channels, runtimeNavItems]);

	const sidebarItems = useMemo(() => navItems.filter((item) => item.key !== "settings"), [navItems]);
	const sidebarIconByKey = {
		chat: "chat",
		mesh: "lan",
		carbon: "eco",
		pulse: "insert_chart",
		accessibility: "accessibility_new",
		translator: "translate",
		settings: "settings"
	};
	const sidebarLabelByKey = {
		mesh: "Network",
		pulse: "Analytics",
		translator: "Translate"
	};

	// ── Global keyboard shortcuts ─────────────────────────────────────────────
	useEffect(() => {
		function onKeyDown(e) {
			const ctrl = e.ctrlKey || e.metaKey;
			const shift = e.shiftKey;
			const view = activeViewRef.current;
			const chanId = activeChannelIdRef.current;
			const chans = channelsRef.current;

			// Ctrl+, → open settings (profile)
			if (ctrl && !shift && e.key === ",") {
				e.preventDefault();
				document.dispatchEvent(new CustomEvent("spann:goto-settings", { detail: { section: "profile" } }));
				setActiveView("settings");
				return;
			}

			// Ctrl+/ → open settings (shortcuts section)
			if (ctrl && !shift && e.key === "/") {
				e.preventDefault();
				document.dispatchEvent(new CustomEvent("spann:goto-settings", { detail: { section: "shortcuts" } }));
				setActiveView("settings");
				return;
			}

			// F11 → fullscreen toggle
			if (e.key === "F11") {
				e.preventDefault();
				if (!document.fullscreenElement) {
					document.documentElement.requestFullscreen?.().catch(() => {});
				} else {
					document.exitFullscreen?.().catch(() => {});
				}
				return;
			}

			// Ctrl+Shift+\ → collapse/expand chat sidebar
			if (ctrl && shift && (e.key === "\\" || e.key === "|")) {
				e.preventDefault();
				setSidebarCollapsed((c) => !c);
				return;
			}

			// Ctrl+K → focus channel jump input (chat only)
			if (ctrl && !shift && e.key === "k" && view === "chat") {
				e.preventDefault();
				jumpInputRef.current?.focus();
				return;
			}

			// Alt+↑/↓ → previous / next channel (chat only)
			if (e.altKey && !ctrl && !shift && (e.key === "ArrowUp" || e.key === "ArrowDown") && view === "chat") {
				e.preventDefault();
				const idx = chans.findIndex((c) => String(c.id) === String(chanId));
				if (idx < 0) return;
				const next = e.key === "ArrowUp"
					? Math.max(0, idx - 1)
					: Math.min(chans.length - 1, idx + 1);
				if (String(chans[next]?.id) !== String(chanId)) {
					setActiveChannelId(chans[next].id);
				}
			}
		}

		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []); // intentionally stable — reads live values via refs

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
		localStorage.setItem("spann-my-reactions", JSON.stringify(myReactionsByMessage));
	}, [myReactionsByMessage]);

	useEffect(() => {
		localStorage.setItem("spann-joined-channel-ids", JSON.stringify(joinedChannelIds));
	}, [joinedChannelIds]);

	useEffect(() => {
		setForcedTheme("light");

		return () => {
			window.removeEventListener(ACCESSIBILITY_PREFS_EVENT, syncPrefsFromStorage);
			window.removeEventListener("storage", handleStorage);
		};
	}, []);

	async function loadChannelMessages(channelId) {
		if (!channelId) {
			return;
		}

		if (!isUuidLike(channelId)) {
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
						setPulseChannels([]);
			return false;
		}

		setPulseLoading(true);
		setPulseError("");
		try {
			const snapshots = await Promise.all(
				channelRows.map(async (channel) => {
					if (!isUuidLike(channel?.id)) {
						return {
							id: channel.id,
							name: channel.name,
							energy: null,
							hasData: false
						};
					}

					try {
						const payload = await apiRequest(`/pulse/${encodeURIComponent(channel.id)}`);
						const snapshot = payload?.data || {};
						return {
							id: channel.id,
							name: channel.name,
							energy: Number.isFinite(Number(snapshot.score)) ? normalizePulseScore(snapshot.score) : null,
							hasData: Number.isFinite(Number(snapshot.score))
						};
					} catch (error) {
						return {
							id: channel.id,
							name: channel.name,
							energy: null,
							hasData: false
						};
					}
				})
			);

			setPulseChannels(snapshots);
			const moodMap = {};
			snapshots.forEach((snapshot) => {
				if (Number.isFinite(Number(snapshot.energy))) {
					moodMap[snapshot.id] = Number(snapshot.energy);
				}
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

	async function refreshWorkspaceMembers() {
		if (!workspaceId) {
			setWorkspaceMembers([]);
			return;
		}

		try {
			const members = await fetchOrganizationMembers({ workspaceId });
			setWorkspaceMembers(Array.isArray(members) ? members : []);
		} catch (error) {
			const normalized = normalizeApiError(error, "Unable to load workspace members");
			if (normalized.status === 401 && onSessionExpired) {
				onSessionExpired();
			}
		}
	}

	async function refreshMeshNodes() {
		setMeshBusy(true);
		setMeshError("");
		try {
			const nodes = await meshApi.listNodes();
			setMeshNodes(Array.isArray(nodes) ? nodes : []);
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
			const payload = await apiRequest("/users/me/preferences");
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
		let cancelled = false;

		async function loadRuntimeConfig() {
			try {
				const payload = await fetchPublicRuntimeConfig();
				const items = Array.isArray(payload?.nav_items)
					? payload.nav_items
							.map((item) => ({
								key: String(item?.key || "").trim(),
								label: String(item?.label || "").trim(),
								icon: String(item?.icon || "").trim(),
								badge: Number(item?.badge || 0)
							}))
							.filter((item) => item.key && item.label)
					: [];

				if (!cancelled && items.length > 0) {
					setRuntimeNavItems(items);
				}
			} catch {
				// Keep default nav items if public runtime config is unavailable.
			}
		}

		loadRuntimeConfig();

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (isDemo) {
			setChannels(DEMO_CHANNELS);
			setActiveChannelId(DEMO_CHANNELS[0].id);
			setMessagesByChannel(DEMO_MESSAGES_BY_CHANNEL);
			setChannelUnread(DEMO_CHANNEL_UNREAD);
			setJoinedChannelIds(DEMO_CHANNELS.map((c) => c.id));
			setBackendConnected(false);
			return;
		}

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
				const mappedChannels = fetchedChannels.map((row) => ({
					id: String(row.id),
					name: withHash(row.name),
					mood: 60
				}));

				setChannels((current) => {
					const localOnlyChannels = (current || []).filter((channel) => !isUuidLike(channel?.id));
					const merged = [...mappedChannels];
					localOnlyChannels.forEach((channel) => {
						if (!merged.some((row) => String(row.id) === String(channel.id))) {
							merged.push(channel);
						}
					});
					return merged;
				});
				setBackendConnected(true);

				const nextChannelId = mappedChannels.some((channel) => String(channel.id) === String(activeChannelId))
					? activeChannelId
					: mappedChannels[0]?.id || "";
				setActiveChannelId(nextChannelId);
				await Promise.all([
					loadChannelMessages(nextChannelId),
					refreshPulseData(mappedChannels),
					refreshCarbonLeaderboard(),
					refreshWorkspaceMembers(),
					refreshMeshNodes(),
					loadPreferences(),
					initUserSettings(),
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
		if (isDemo || activeView !== "chat" || !activeChannelId || !backendConnected) {
			return;
		}
		loadChannelMessages(activeChannelId);
	}, [isDemo, activeView, activeChannelId, backendConnected]);

	useEffect(() => {
		if (isDemo || !backendConnected || !workspaceId || !activeChannelId) {
			return;
		}

		const pollHandle = setInterval(() => {
			loadChannelMessages(activeChannelId);
			refreshWorkspaceMembers();
		}, 4000);

		return () => clearInterval(pollHandle);
	}, [isDemo, backendConnected, workspaceId, activeChannelId]);

	useEffect(() => {
		if (isDemo || !prefsLoadedRef.current || !backendConnected) {
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

	useEffect(() => {
		setChannelUnread((current) => {
			const sanitized = sanitizeUnreadMap(current, channels);
			const currentKeys = Object.keys(current || {}).sort();
			const sanitizedKeys = Object.keys(sanitized).sort();
			if (currentKeys.length !== sanitizedKeys.length) {
				return sanitized;
			}
			for (let i = 0; i < sanitizedKeys.length; i += 1) {
				const key = sanitizedKeys[i];
				if (currentKeys[i] !== key || Number(current[key] || 0) !== Number(sanitized[key] || 0)) {
					return sanitized;
				}
			}
			return current;
		});
	}, [channels]);

	useEffect(() => {
		setJoinedChannelIds((current) => {
			const joinedSet = new Set((current || []).map((id) => String(id)));
			let changed = false;
			channels.forEach((channel) => {
				if (isDirectChannel(channel)) {
					return;
				}
				const id = String(channel.id || "");
				if (!id) {
					return;
				}
				if (!joinedSet.has(id)) {
					joinedSet.add(id);
					changed = true;
				}
			});
			if (!changed) {
				return current;
			}
			return Array.from(joinedSet);
		});
	}, [channels]);

	function handleChannelChange(channelId) {
		setChannelUnread((current) => ({
			...current,
			[channelId]: 0
		}));
		setActiveChannelId(channelId);
		if (activeView !== "chat") {
			setActiveView("chat");
		}
	}

	function handleCreateChannel() {
		setGroupNameInput("project-updates");
		setGroupAddAnyone(false);
		setGroupInviteEmails("");
		setGroupModalOpen(true);
	}

	async function handleSubmitCreateGroup() {
		if (!backendConnected || !workspaceId) {
			pushAppNotice("Channel creation requires a live backend connection.", "error");
			return;
		}

		const normalized = withHash(groupNameInput || "").toLowerCase();
		if (!normalized || normalized === "#channel") {
			pushAppNotice("Please provide a valid group name.", "error");
			return;
		}

		setGroupCreateBusy(true);
		try {
			const payload = await apiRequest("/channels", {
				method: "POST",
				body: JSON.stringify({
					workspace_id: workspaceId,
					name: normalized.replace(/^#/, "")
				})
			});

			const row = payload?.data || {};
			const nextChannel = {
				id: String(row.id),
				name: withHash(row.name || normalized),
				mood: 60
			};
			setChannels((current) => {
				if (current.some((channel) => String(channel.id) === nextChannel.id)) {
					return current;
				}
				return [...current, nextChannel];
			});
			setMessagesByChannel((messageState) => ({
				...messageState,
				[nextChannel.id]: []
			}));
			setChannelUnread((unreadState) => ({
				...unreadState,
				[nextChannel.id]: 0
			}));

			if (groupAddAnyone && canManageMembers) {
				const emailList = String(groupInviteEmails || "")
					.split(",")
					.map((entry) => entry.trim().toLowerCase())
					.filter(Boolean);

				if (emailList.length) {
					const inviteResults = await Promise.allSettled(
						emailList.map((email) => inviteOrganizationMember({
							workspaceId,
							email,
							note: `Invitation sent while creating ${nextChannel.name}`,
						}))
					);
					const successCount = inviteResults.filter((result) => result.status === "fulfilled").length;
					if (successCount > 0) {
						pushAppNotice(`${successCount} invitation${successCount === 1 ? "" : "s"} sent.`, "success");
					}
				}
			}

			setGroupModalOpen(false);
			setActiveView("chat");
			setActiveChannelId(nextChannel.id);
			pushAppNotice(`Group ${nextChannel.name} created.`, "success");
		} catch (error) {
			const normalizedError = normalizeApiError(error, "Unable to create channel");
			pushAppNotice(normalizedError.message || "Unable to create channel.", "error");
		} finally {
			setGroupCreateBusy(false);
		}
	}

	async function handleInviteMember() {
		if (!workspaceId || !canManageMembers) {
			pushAppNotice("Only workspace owners or admins can invite members.", "error");
			return;
		}

		const rawEmail = typeof window !== "undefined" ? window.prompt("Invite member by email", "") : "";
		const email = String(rawEmail || "").trim().toLowerCase();
		if (!email) {
			return;
		}

		try {
			await inviteOrganizationMember({
				workspaceId,
				email,
				note: `Invitation sent from chat by ${userName}`,
			});
			pushAppNotice(`Invitation sent to ${email}.`, "success");
		} catch (error) {
			const normalized = normalizeApiError(error, "Unable to invite member");
			pushAppNotice(normalized.message || "Unable to invite member.", "error");
		}
	}

	async function handleRemoveMember(member) {
		if (!workspaceId || !canRemoveMembers) {
			pushAppNotice("Only workspace owners can remove members.", "error");
			return;
		}

		const memberUserId = String(member?.user_id || "");
		const memberName = String(member?.display_name || member?.email || "member");
		if (!memberUserId) {
			return;
		}

		if (memberUserId === currentUserId) {
			pushAppNotice("Owners cannot remove themselves.", "info");
			return;
		}

		if (String(member?.role || "member").toLowerCase() === "owner") {
			pushAppNotice("Owner members cannot be removed from chat controls.", "info");
			return;
		}

		const approved = typeof window !== "undefined"
			? window.confirm(`Remove ${memberName} from this workspace?`)
			: true;
		if (!approved) {
			return;
		}

		try {
			await removeOrganizationMember({ workspaceId, memberUserId });
			await refreshWorkspaceMembers();
			pushAppNotice(`${memberName} removed from workspace.`, "success");
		} catch (error) {
			const normalized = normalizeApiError(error, "Unable to remove member");
			pushAppNotice(normalized.message || "Unable to remove member.", "error");
		}
	}

	function handleStartDirectMessage(person) {
		const inputName = String(person?.name || "").trim();
		const rawName = inputName || (typeof window !== "undefined" ? window.prompt("Start direct message with", "Sarah Chen") : "");
		const personName = String(rawName || "").trim();
		if (!personName) {
			return;
		}

		const dmId = `dm:${personName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
		const dmName = `@${personName}`;

		setChannels((current) => {
			if (current.some((channel) => String(channel.id) === dmId)) {
				return current;
			}
			return [
				...current,
				{
					id: dmId,
					name: dmName,
					mood: 60,
					kind: "dm"
				}
			];
		});
		setMessagesByChannel((current) => ({
			...current,
			[dmId]: current[dmId] || []
		}));
		setChannelUnread((current) => ({
			...current,
			[dmId]: 0
		}));
		setActiveView("chat");
		setActiveChannelId(dmId);
		pushAppNotice(`Started direct chat with ${personName}.`, "success");
	}

	function handleJoinChannel(channelId) {
		const id = String(channelId || "");
		if (!id) {
			return;
		}
		setJoinedChannelIds((current) => {
			const set = new Set((current || []).map((value) => String(value)));
			set.add(id);
			return Array.from(set);
		});
		setActiveView("chat");
		setActiveChannelId(id);
		pushAppNotice("Joined group.", "success");
	}

	function handleLeaveChannel(channelId) {
		const id = String(channelId || "");
		if (!id) {
			return;
		}
		setJoinedChannelIds((current) => (current || []).filter((value) => String(value) !== id));
		if (String(activeChannelId) === id) {
			const joinedSet = new Set((joinedChannelIds || []).map((value) => String(value)).filter((value) => value !== id));
			const fallbackChannel = channels.find((channel) => isDirectChannel(channel) || joinedSet.has(String(channel.id)));
			if (fallbackChannel) {
				setActiveChannelId(fallbackChannel.id);
			}
		}
		pushAppNotice("Left group.", "info");
	}

	async function handleSendMessage(channelId, text, translated, sendOptions = {}) {
		if (!channelId) {
			return;
		}

		const trimmedText = String(text || "").trim();
		if (!trimmedText) {
			pushAppNotice("Message cannot be empty.", "error");
			return;
		}

		if (isDemo) {
			const now = new Date();
			setMessagesByChannel((current) => ({
				...current,
				[channelId]: [
					...(current[channelId] || []),
					{
						id: `demo-you-${Date.now()}`,
						user: "You",
						initials: "ME",
						color: "#0f67b7",
						time: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
						text: trimmedText,
						reactions: [],
					},
				],
			}));
			return;
		}

		let sourceLocale = translated ? "en-US" : null;
		let translatedEnglishText = "";
		const fromVoice = String(sendOptions?.origin || "").toLowerCase() === "voice";
		const voiceSourceLocale = String(sendOptions?.sourceLocale || "").trim();
		const shouldUseAiAdaptation = translated || fromVoice || Boolean(sendOptions?.autoDetectLanguage) || Boolean(sendOptions?.applyCulturalMeaning);
		const detected = detectSourceLanguage(text);

		if (!backendConnected && shouldUseAiAdaptation) {
			pushAppNotice("Offline mesh mode: sending original text without translation.", "info");
		}

		if (backendConnected && shouldUseAiAdaptation && (!detected.isEnglish || fromVoice)) {
			try {
				const channelTone = String(channels.find((channel) => String(channel.id) === String(channelId))?.tone || "neutral");
				const translationPayload = await apiRequest("/translate", {
					method: "POST",
					body: JSON.stringify({
						phrase: trimmedText,
						source_locale: fromVoice ? "auto" : (detected.locale || voiceSourceLocale || "auto"),
						target_locale: "en-US",
						source_culture: fromVoice ? "auto" : (detected.culture || "Global"),
						target_culture: "American",
						workplace_tone: channelTone
					})
				});

				const translationData = translationPayload?.data || translationPayload || {};
				const literal = String(translationData?.literal || "").trim();
				const cultural = String(translationData?.cultural || "").trim();
				const culturallyAdapted = cultural || literal;
				if (culturallyAdapted) {
					translatedEnglishText = culturallyAdapted;
					sourceLocale = fromVoice ? (voiceSourceLocale || "auto") : detected.locale;
					const localeLabel = fromVoice ? (voiceSourceLocale || "auto") : detected.locale;
					pushAppNotice(`Translated from ${localeLabel} to English with cultural adaptation.`, "info");
				}
			} catch (error) {
				if (fromVoice) {
					pushAppNotice("AI translation unavailable right now. Sent original voice transcript.", "info");
				} else {
					pushAppNotice("Translation unavailable right now. Sent original text.", "info");
				}
			}
		}

		let usedLocalFallback = false;

		if (backendConnected && isUuidLike(channelId)) {
			try {
				const payload = await apiRequest("/messages", {
					method: "POST",
					body: JSON.stringify({
						channel_id: channelId,
						text: trimmedText,
						text_translated: translatedEnglishText || undefined,
						source_locale: sourceLocale
					})
				});

				const apiMessage = payload?.data;
				if (apiMessage) {
					setMessagesByChannel((current) => ({
						...current,
						[channelId]: [...(current[channelId] || []), toUiMessage(apiMessage)]
					}));
					refreshWorkspaceMembers();
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

		try {
			const meshResult = await meshApi.sendLocalMessage({
				channelId: String(channelId),
				text: trimmedText,
				ttl: 6
			});

			const createdAt = new Date().toISOString();
			setMessagesByChannel((current) => ({
				...current,
				[channelId]: [
					...(current[channelId] || []),
					{
						id: `live-${String(meshResult?.id || Date.now())}`,
						userId: currentUserId || "local-user",
						user: userName || "You",
						avatarUrl: userAvatar,
						initials: userInitials,
						color: "#0f67b7",
						createdAt,
						time: formatMessageTime(createdAt),
						text: trimmedText,
						translatedText: null,
						sentimentScore: null,
						reactions: [],
						translated: false,
						lang: undefined,
						meshOrigin: true
					}
				]
			}));

			pushAppNotice("Sent over nearby mesh (offline mode). Translation and cloud features are paused.", "success");
			return;
		} catch (meshError) {
			const meshNormalized = normalizeApiError(meshError, "Unable to deliver over local mesh");
			pushAppNotice(
				usedLocalFallback
					? `Message could not be sent. Backend is offline and mesh delivery failed: ${meshNormalized.message}`
					: `Message could not be sent. Mesh delivery failed: ${meshNormalized.message}`,
				"error"
			);
			return;
		}
	}

	async function handleReactMessage(channelId, messageId, emoji) {
		if (!channelId || !messageId || !emoji) {
			return;
		}

		if (isDemo) {
			setMessagesByChannel((current) => ({
				...current,
				[channelId]: (current[channelId] || []).map((msg) =>
					String(msg.id) === String(messageId)
						? { ...msg, reactions: incrementReaction(msg.reactions || [], emoji) }
						: msg
				),
			}));
			return;
		}

		const messageKey = String(messageId);
		const emojiKey = String(emoji);
		const alreadyReacted = Array.isArray(myReactionsByMessage?.[messageKey]) && myReactionsByMessage[messageKey].includes(emojiKey);
		if (alreadyReacted) {
			pushAppNotice("You already used that reaction on this message.", "info");
			return;
		}

		let usedLocalFallback = false;

		if (backendConnected && isUuidLike(channelId) && isUuidLike(messageId)) {
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
				setMyReactionsByMessage((current) => ({
					...current,
					[messageKey]: [...(current[messageKey] || []), emojiKey]
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

		pushAppNotice(
			usedLocalFallback
				? "Reaction could not be saved. Backend connection is required."
				: "Reaction could not be saved.",
			"error"
		);
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
			await refreshWorkspaceMembers();
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
			await meshApi.register(`web-${suffix}`);
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
			await meshApi.revokeNode(nodeId);
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


	function handleUtilityAction(toolKey) {
		const key = String(toolKey || "");
		if (key === "threads") {
			setContextOpen(true);
			pushAppNotice("Opened conversation context.", "info");
			return;
		}

		if (key === "mentions") {
			setContextOpen(true);
			pushAppNotice("Mentions summary is shown in context panel.", "info");
			return;
		}

		if (key === "files") {
			setActiveView("support");
			pushAppNotice("File browser is opening in Support tools.", "info");
		}
	}

	function handleSectionAction(sectionName) {
		setContextOpen(true);
		pushAppNotice(`${sectionName} details opened in context panel.`, "info");
	}

	return (
		<div className="app-shell chat-workspace bg-background font-body text-on-surface flex overflow-hidden h-screen w-full">
			{isDemo && (
				<div
					style={{
						position: "fixed",
						top: 0,
						left: 0,
						right: 0,
						zIndex: 9999,
						background: "linear-gradient(90deg,#0A84FF,#30D158)",
						color: "#fff",
						fontSize: "12px",
						fontWeight: 600,
						padding: "6px 16px",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: "12px",
					}}
				>
					<span>
						Demo Mode — No login required. Hover any message to try{" "}
						<strong>Simplify</strong>, <strong>Explain</strong>, and{" "}
						<strong>Listen</strong> (TTS). Click <strong>Summarize</strong> in the toolbar.
					</span>
					<button
						type="button"
						onClick={onLogout}
						style={{
							background: "rgba(255,255,255,0.2)",
							border: "1px solid rgba(255,255,255,0.4)",
							color: "#fff",
							borderRadius: "6px",
							padding: "2px 10px",
							fontSize: "11px",
							fontWeight: 600,
							cursor: "pointer",
							whiteSpace: "nowrap",
						}}
					>
						Exit Demo
					</button>
				</div>
			)}
			<div className="workspace-stack h-full w-full flex" style={isDemo ? { paddingTop: "34px" } : undefined}>
				<div className="chat-layout flex h-screen w-full relative">
					<aside className="h-screen w-64 left-0 top-0 fixed bg-slate-100/60 dark:bg-slate-900/60 backdrop-blur-2xl border-r border-slate-200/30 dark:border-slate-800/30 flex flex-col p-4 gap-2 font-['Segoe_UI_Variable',sans-serif] text-[13px] leading-relaxed z-50">
						<div className="flex items-center gap-3 px-2 mb-8 mt-2">
							<div className="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-white shadow-lg">
								<span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
							</div>
							<div>
								<p className="font-bold text-on-surface leading-tight truncate max-w-[180px]">{workspaceName}</p>
								<p className="text-[11px] text-on-surface-variant truncate max-w-[180px]">{workspaceSubtitle}</p>
							</div>
						</div>
						<nav className="flex-1 flex flex-col gap-1">
							{sidebarItems.map((item) => (
								<div
									key={item.key}
									onClick={() => setActiveView(item.key)}
									className={`cursor-pointer active:opacity-80 flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
										activeView === item.key
											? "bg-white/80 dark:bg-slate-800/80 text-blue-700 dark:text-blue-300 font-semibold shadow-sm"
											: "text-slate-600 dark:text-slate-400 hover:bg-slate-200/40 dark:hover:bg-slate-800/40"
									}`}
								>
									<span className="material-symbols-outlined">{sidebarIconByKey[item.key] || "circle"}</span>
									<span>{sidebarLabelByKey[item.key] || item.label}</span>
									{item.badge > 0 ? <span className="channel-unread">{item.badge}</span> : null}
								</div>
							))}
						</nav>
						<div className="border-t border-slate-200/30 pt-4 flex flex-col gap-1">
							<div
								onClick={() => setActiveView("settings")}
								className={`cursor-pointer active:opacity-80 flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
									activeView === "settings"
										? "bg-white/80 dark:bg-slate-800/80 text-blue-700 dark:text-blue-300 font-semibold shadow-sm"
										: "text-slate-600 dark:text-slate-400 hover:bg-slate-200/40 dark:hover:bg-slate-800/40"
								}`}
							>
								<span className="material-symbols-outlined">settings</span>
								<span>Settings</span>
							</div>
							<div
								onClick={() => setActiveView("support")}
								className={`cursor-pointer active:opacity-80 flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
									activeView === "support"
										? "bg-white/80 dark:bg-slate-800/80 text-blue-700 dark:text-blue-300 font-semibold shadow-sm"
										: "text-slate-600 dark:text-slate-400 hover:bg-slate-200/40 dark:hover:bg-slate-800/40"
								}`}
							>
								<span className="material-symbols-outlined">contact_support</span>
								<span>Support</span>
							</div>
							<div className="mt-4 flex items-center gap-3 px-2">
								{userAvatar ? (
									<img
										className="w-8 h-8 rounded-full border border-white shadow-sm object-cover"
										alt={`${userName} avatar`}
										src={userAvatar}
									/>
								) : (
									<div className="w-8 h-8 rounded-full border border-white shadow-sm bg-primary-container text-on-primary-container flex items-center justify-center text-[11px] font-bold">
										{userInitials}
									</div>
								)}
								<div className="overflow-hidden">
									<p className="font-semibold text-on-surface truncate">{userName}</p>
									<p className="text-[10px] text-on-surface-variant opacity-70">{userRole}</p>
								</div>
							</div>
						</div>
					</aside>

					<main className={`ml-64 flex-1 min-h-0 flex relative ${activeView === "chat" ? "chat-main-shell overflow-hidden" : "overflow-y-auto"}`}>
						{activeView === "chat" ? (
							<Sidebar
								activeView={activeView}
								activeChannelId={activeChannelId}
								channels={channels}
								onChannelChange={handleChannelChange}
								channelUnread={channelUnread}
								navItems={navItems}
								onViewChange={setActiveView}
								onCreateChannel={handleCreateChannel}
								onStartDirectMessage={handleStartDirectMessage}
								onJoinChannel={handleJoinChannel}
								onLeaveChannel={handleLeaveChannel}
								joinedChannelIds={joinedChannelIds}
								jumpRef={jumpInputRef}
								collapsed={sidebarCollapsed}
								currentUserName={userName}
								currentUserInitials={userInitials}
								onlineMembers={onlineMembers}
								workspaceMembers={workspaceMembers}
								canManageMembers={canManageMembers}
								canRemoveMembers={canRemoveMembers}
								onInviteMember={handleInviteMember}
								onRemoveMember={handleRemoveMember}
								onSectionAction={handleSectionAction}
								isChatLayout
							/>
						) : null}

						<div className={`flex-1 min-h-0 flex ${activeView === "chat" ? "chat-main-stage overflow-hidden" : "overflow-y-auto"}`}>
						<MainPanel
									activeView={activeView}
									onViewChange={setActiveView}
									activeChannel={activeChannel}
									channelMood={activeMood}
									messages={currentMessages}
									onSendMessage={(channelLabel, text, translated, sendOptions) => {
										const channel = channels.find((item) => item.name === channelLabel) || channels.find((item) => item.id === activeChannelId);
										return handleSendMessage(channel?.id || activeChannelId, text, translated, sendOptions);
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
								workspaceId={workspaceId}
								canEditOfficeLocation={canManageMembers}
								meshNodes={meshNodes}
								onRefreshMesh={handleRefreshMeshAction}
								onRegisterMesh={handleRegisterMeshNode}
								onRevokeMesh={handleRevokeMeshNode}
								meshBusy={meshBusy}
								meshError={meshError}
								accessibilityPrefs={accessibilityPrefs}
								onChangeAccessibility={handleAccessibilityPreferenceChange}
								accessibilitySaveState={accessibilitySaveState}
									authState={liveAuth}
									onLogout={onLogout}
									currentUserName={liveAuth?.user?.display_name || liveAuth?.user?.name || ""}
									workspaceMembers={workspaceMembers}
									hasGroupChannels={hasGroupChannels}
									onCreateGroup={handleCreateChannel}
									canManageMembers={canManageMembers}
									onInviteMember={handleInviteMember}
						/>
						</div>

						{activeView === "chat" ? <ChatUtilityRail onToolAction={handleUtilityAction} onCollapse={() => setSidebarCollapsed((current) => !current)} /> : null}
					</main>
				</div>
			</div>
			<GroupCreateModal
				open={groupModalOpen}
				busy={groupCreateBusy}
				groupName={groupNameInput}
				setGroupName={setGroupNameInput}
				addAnyone={groupAddAnyone}
				setAddAnyone={setGroupAddAnyone}
				inviteEmails={groupInviteEmails}
				setInviteEmails={setGroupInviteEmails}
				onClose={() => !groupCreateBusy && setGroupModalOpen(false)}
				onSubmit={handleSubmitCreateGroup}
				canInvite={canManageMembers}
			/>
		</div>
	);
}

