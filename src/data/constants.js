export const MESSAGES = [
	{
		id: 1,
		user: "Alex K",
		initials: "AK",
		color: "#0A84FF",
		time: "9:41 AM",
		text: "Morning team! Deployment went smooth overnight 🚀",
		reactions: ["👏 3", "🚀 2"],
		translated: false
	},
	{
		id: 2,
		user: "Maria G",
		initials: "MG",
		color: "#BF5AF2",
		time: "9:43 AM",
		text: "Great news! The carbon report for Q1 is ready to review.",
		reactions: ["✅ 5"],
		translated: true,
		lang: "🇪🇸"
	},
	{
		id: 3,
		user: "Jin Park",
		initials: "JP",
		color: "#30D158",
		time: "9:47 AM",
		text: "Mesh network held up perfectly during the conference. 6 nodes, zero drops.",
		reactions: ["💪 4", "🔥 2"],
		translated: false
	},
	{
		id: 4,
		user: "Sara M",
		initials: "SM",
		color: "#FF9F0A",
		time: "9:52 AM",
		text: "Reminder: accessibility audit call at 11. Bring your findings!",
		reactions: ["👍 6"],
		translated: false
	}
];

export const NODES = [
	{ id: 1, name: "iPhone 15 Pro — Alex", signal: 3, ping: "12ms", status: "active" },
	{ id: 2, name: "MacBook Air — Maria", signal: 3, ping: "8ms", status: "active" },
	{ id: 3, name: "iPad Pro — Jin", signal: 2, ping: "34ms", status: "active" },
	{ id: 4, name: "Samsung S24 — Sara", signal: 2, ping: "41ms", status: "active" },
	{ id: 5, name: "Pixel 8 — Tom", signal: 1, ping: "89ms", status: "weak" },
	{ id: 6, name: "ThinkPad — Dev", signal: 3, ping: "5ms", status: "active" }
];

export const LEADERBOARD = [
	{ rank: 1, name: "Jin Park", score: "4.2 kg", trend: "↓", color: "#30D158" },
	{ rank: 2, name: "Maria G", score: "6.8 kg", trend: "↓", color: "#30D158" },
	{ rank: 3, name: "Alex K", score: "12.4 kg", trend: "↑", color: "#FF453A" },
	{ rank: 4, name: "Sara M", score: "14.1 kg", trend: "→", color: "#FF9F0A" },
	{ rank: 5, name: "Tom B", score: "18.9 kg", trend: "↑", color: "#FF453A" }
];

export const CHANNELS = [
	{ name: "#general", unread: 2, mood: 78 },
	{ name: "#emergencies", unread: 4, mood: 36 },
	{ name: "#carbon-reports", unread: 1, mood: 69 },
	{ name: "#team-pulse", unread: 0, mood: 82 }
];

export const CULTURES = [
	"🇺🇸 American",
	"🇬🇧 British",
	"🇧🇬 Bulgarian",
	"🇯🇵 Japanese",
	"🇩🇪 German",
	"🇧🇷 Brazilian",
	"🇸🇦 Arabic"
];

export const NAV_ITEMS = [
	{ key: "chat", label: "Chat", icon: "chat", badge: 3 },
	{ key: "mesh", label: "Mesh", icon: "tower", badge: 1 },
	{ key: "carbon", label: "Carbon", icon: "leaf", badge: 0 },
	{ key: "pulse", label: "Pulse", icon: "wave", badge: 2 },
	{ key: "accessibility", label: "Access", icon: "eye", badge: 0 },
	{ key: "translator", label: "Translate", icon: "globe", badge: 1 }
];

export const DEFAULT_UNREAD_BY_CHANNEL = CHANNELS.reduce((accumulator, channel) => {
	accumulator[channel.name] = channel.unread;
	return accumulator;
}, {});

export const DEFAULT_MESSAGES_BY_CHANNEL = {
	"#general": MESSAGES.map((message) => ({ ...message, reactions: [...message.reactions] })),
	"#emergencies": [
		{
			id: 101,
			user: "Ops Bot",
			initials: "OB",
			color: "#FF453A",
			time: "9:20 AM",
			text: "Incident bridge opened. Confirm on-call responders in the next 5 minutes.",
			reactions: ["🚨 5", "✅ 3"],
			translated: false
		},
		{
			id: 102,
			user: "Sara M",
			initials: "SM",
			color: "#FF9F0A",
			time: "9:28 AM",
			text: "Cellular degradation detected in Zone C. Mesh fallback is active.",
			reactions: ["📡 2", "👍 4"],
			translated: false
		}
	],
	"#carbon-reports": [
		{
			id: 201,
			user: "Maria G",
			initials: "MG",
			color: "#BF5AF2",
			time: "8:57 AM",
			text: "Uploaded Q1 emissions baseline and regional variance breakdown.",
			reactions: ["📊 4", "✅ 2"],
			translated: true,
			lang: "🇪🇸"
		},
		{
			id: 202,
			user: "Alex K",
			initials: "AK",
			color: "#0A84FF",
			time: "9:11 AM",
			text: "Please review commute assumptions before we lock the summary deck.",
			reactions: ["👀 3"],
			translated: false
		}
	],
	"#team-pulse": [
		{
			id: 301,
			user: "Jin Park",
			initials: "JP",
			color: "#30D158",
			time: "9:02 AM",
			text: "Energy is trending high after the launch update. Great momentum this morning.",
			reactions: ["🔥 6", "💪 2"],
			translated: false
		},
		{
			id: 302,
			user: "People Ops",
			initials: "PO",
			color: "#5B3FD4",
			time: "9:15 AM",
			text: "Reminder: share one unblocker in today's pulse check-in.",
			reactions: ["🧠 3", "✅ 4"],
			translated: false
		}
	]
};

export const INCOMING_MESSAGE_BANK = {
	"#general": [
		"Can someone validate the rollout metric trend for APAC?",
		"Customer health score refreshed. No new critical alerts.",
		"Drafted summary for leadership review, feedback welcome."
	],
	"#emergencies": [
		"Latency spike detected in failover path. Monitoring active.",
		"Zone B recovered. Keeping mesh bridge online for 10 more minutes.",
		"Incident command requests final status confirmation from field devices."
	],
	"#carbon-reports": [
		"Daily transport log imported successfully.",
		"Remote-work delta improved by 2.4% since yesterday.",
		"Please verify facility energy offsets for compliance."
	],
	"#team-pulse": [
		"Pulse score uplift recorded after standup.",
		"Noise floor in #general dropped back to baseline.",
		"Engagement trend holds steady across EMEA and US teams."
	]
};

export const INCOMING_AUTHORS = [
	{ user: "NOC Bot", initials: "NB", color: "#FF9F0A" },
	{ user: "Relay Bot", initials: "RB", color: "#0A84FF" },
	{ user: "Maria G", initials: "MG", color: "#BF5AF2" },
	{ user: "Jin Park", initials: "JP", color: "#30D158" }
];

export function loadFromStorage(key, fallbackValue) {
	try {
		const raw = localStorage.getItem(key);
		if (raw === null) {
			return fallbackValue;
		}
		return JSON.parse(raw);
	} catch (error) {
		return fallbackValue;
	}
}

export function parseReactionValue(reaction) {
	const split = String(reaction || "").split(" ");
	return {
		emoji: split[0],
		count: Number.parseInt(split[1], 10) || 0
	};
}

export function incrementReaction(reactions, emoji) {
	const next = [...(reactions || [])];
	const existingIndex = next.findIndex((item) => String(item).startsWith(`${emoji} `));

	if (existingIndex === -1) {
		next.push(`${emoji} 1`);
		return next;
	}

	const parsed = parseReactionValue(next[existingIndex]);
	next[existingIndex] = `${emoji} ${parsed.count + 1}`;
	return next;
}

const runtimeApiBase = typeof window !== "undefined" ? window.SPANN_API_BASE : "";
const envApiBase = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";
const isFileProtocol = typeof window !== "undefined" && window.location?.protocol === "file:";
const isAndroid = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent || "");

// Native shells run without the Vite proxy, so file:// builds need an absolute backend URL.
const nativeDefaultApiBase = isAndroid ? "http://10.0.2.2:8000" : "http://127.0.0.1:8000";
const fallbackApiBase = isFileProtocol ? nativeDefaultApiBase : "/api";

// Prefer runtime override, then Vite env, then protocol-aware fallback.
export const API_BASE = String(runtimeApiBase || envApiBase || fallbackApiBase).replace(/\/+$/, "");

export async function apiRequest(path, options = {}) {
	const response = await fetch(`${API_BASE}${path}`, {
		method: options.method || "GET",
		headers: {
			"Content-Type": "application/json",
			...(options.headers || {})
		},
		...(options.body ? { body: options.body } : {})
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(text || `HTTP ${response.status}`);
	}

	return response.json();
}
