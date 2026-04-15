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
	{ key: "American", label: "English (US)", locale: "en-US" },
	{ key: "British", label: "English (UK)", locale: "en-GB" },
	{ key: "Bulgarian", label: "Bulgarian", locale: "bg-BG" },
	{ key: "Japanese", label: "Japanese", locale: "ja-JP" },
	{ key: "German", label: "German", locale: "de-DE" },
	{ key: "Brazilian", label: "Portuguese (Brazil)", locale: "pt-BR" },
	{ key: "Arabic", label: "Arabic (Saudi Arabia)", locale: "ar-SA" }
];

export const NAV_ITEMS = [
	{ key: "chat", label: "Chat", icon: "chat", badge: 3 },
	{ key: "mesh", label: "Mesh", icon: "tower", badge: 1 },
	{ key: "carbon", label: "Carbon", icon: "leaf", badge: 0 },
	{ key: "pulse", label: "Pulse", icon: "wave", badge: 2 },
	{ key: "accessibility", label: "Access", icon: "eye", badge: 0 },
	{ key: "translator", label: "Translate", icon: "globe", badge: 1 },
	{ key: "settings", label: "Settings", icon: "settings", badge: 0 }
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
const envNativeApiBase = (typeof import.meta !== "undefined" && import.meta.env?.VITE_NATIVE_API_BASE_URL) || "";
const isFileProtocol = typeof window !== "undefined" && window.location?.protocol === "file:";
const nativeConfiguredApiBase = String(envNativeApiBase || runtimeApiBase || "").trim();
const fallbackApiBase = isFileProtocol ? nativeConfiguredApiBase : "/api";

// Prefer runtime override, then Vite env, then protocol-aware fallback.
export const API_BASE = String(runtimeApiBase || envApiBase || fallbackApiBase).replace(/\/+$/, "");

function shouldRetryDirectBackend(responseStatus) {
	return Number(responseStatus) === 404 && String(API_BASE).startsWith("/api") && nativeConfiguredApiBase;
}

async function fetchWithProxyFallback(path, requestInit) {
	const normalizedPath = String(path || "").startsWith("/") ? String(path) : `/${String(path || "")}`;
	let response = await fetch(`${API_BASE}${normalizedPath}`, requestInit);
	if (!shouldRetryDirectBackend(response.status)) {
		return response;
	}

	response = await fetch(`${nativeDefaultApiBase}${normalizedPath}`, requestInit);
	return response;
}

const AUTH_STATE_STORAGE_KEY = "spann-auth-state";
const AUTH_STATE_SESSION_KEY = "spann-auth-state-session";
const NETWORK_LOADING_EVENT = "spann:network-loading";
const APP_NOTICE_EVENT = "spann:notice";
const AUTH_STATE_UPDATED_EVENT = "spann:auth-state-updated";
let pendingNetworkRequests = 0;

function emitNetworkLoading() {
	if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
		return;
	}

	window.dispatchEvent(
		new CustomEvent(NETWORK_LOADING_EVENT, {
			detail: {
				pending: pendingNetworkRequests
			}
		})
	);
}

function beginNetworkRequest() {
	pendingNetworkRequests += 1;
	emitNetworkLoading();
}

function endNetworkRequest() {
	pendingNetworkRequests = Math.max(0, pendingNetworkRequests - 1);
	emitNetworkLoading();
}

export const NETWORK_LOADING_EVENT_NAME = NETWORK_LOADING_EVENT;
export const APP_NOTICE_EVENT_NAME = APP_NOTICE_EVENT;
export const AUTH_STATE_UPDATED_EVENT_NAME = AUTH_STATE_UPDATED_EVENT;

export function pushAppNotice(message, tone = "info") {
	const text = String(message || "").trim();
	if (!text || typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
		return;
	}

	window.dispatchEvent(
		new CustomEvent(APP_NOTICE_EVENT, {
			detail: {
				message: text,
				tone: tone === "error" ? "error" : tone === "success" ? "success" : "info"
			}
		})
	);
}

function readJson(raw) {
	if (!raw) {
		return null;
	}

	try {
		return JSON.parse(raw);
	} catch (error) {
		return null;
	}
}

function decodeJwtPayload(token) {
	const parts = String(token || "").split(".");
	if (parts.length < 2) {
		return null;
	}

	try {
		const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
		const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
		const decoded = atob(padded);
		return JSON.parse(decoded);
	} catch (error) {
		return null;
	}
}

function normalizeAuthState(authState) {
	if (!authState || typeof authState !== "object") {
		return null;
	}

	const accessToken = String(authState.accessToken || authState.access_token || "").trim();
	const refreshToken = String(authState.refreshToken || authState.refresh_token || "").trim();
	if (!accessToken || !refreshToken) {
		return null;
	}

	const claims = decodeJwtPayload(accessToken) || {};
	const expiresAt = Number(authState.expiresAt) || (Number(claims.exp) ? Number(claims.exp) * 1000 : null);
	const workspaceId = String(authState.workspaceId || claims.workspace_id || "").trim();
	const userId = String(authState.userId || authState.user?.id || claims.sub || "").trim();

	return {
		accessToken,
		refreshToken,
		expiresAt: expiresAt || null,
		workspaceId: workspaceId || "",
		userId: userId || "",
		user: authState.user && typeof authState.user === "object" ? authState.user : {},
		persist: Boolean(authState.persist)
	};
}

export function getAuthState() {
	const persistent = readJson(localStorage.getItem(AUTH_STATE_STORAGE_KEY));
	const session = readJson(sessionStorage.getItem(AUTH_STATE_SESSION_KEY));
	return normalizeAuthState(persistent) || normalizeAuthState(session);
}

export function setAuthState(authState, options = {}) {
	const normalized = normalizeAuthState({ ...authState, persist: options.persist ?? authState.persist });
	if (!normalized) {
		clearAuthState();
		return null;
	}

	const persist = Boolean(options.persist ?? normalized.persist);
	const payload = JSON.stringify({ ...normalized, persist });
	if (persist) {
		localStorage.setItem(AUTH_STATE_STORAGE_KEY, payload);
		sessionStorage.removeItem(AUTH_STATE_SESSION_KEY);
	} else {
		sessionStorage.setItem(AUTH_STATE_SESSION_KEY, payload);
		localStorage.removeItem(AUTH_STATE_STORAGE_KEY);
	}

	if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
		window.dispatchEvent(new CustomEvent(AUTH_STATE_UPDATED_EVENT, { detail: { authState: { ...normalized, persist } } }));
	}

	return { ...normalized, persist };
}

export function clearAuthState() {
	localStorage.removeItem(AUTH_STATE_STORAGE_KEY);
	sessionStorage.removeItem(AUTH_STATE_SESSION_KEY);
	if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
		window.dispatchEvent(new CustomEvent(AUTH_STATE_UPDATED_EVENT, { detail: { authState: null } }));
	}
}

export function normalizeApiError(error, fallbackMessage = "Request failed") {
	if (!error) {
		return { code: "UNKNOWN_ERROR", message: fallbackMessage, status: 0, details: null };
	}

	if (typeof error === "object") {
		const message = String(error.message || error.error?.message || fallbackMessage);
		const code = String(error.code || error.error?.code || "REQUEST_FAILED");
		const status = Number(error.status || 0);
		const details = error.details || error.error?.details || null;
		return { message, code, status, details };
	}

	return { code: "REQUEST_FAILED", message: String(error), status: 0, details: null };
}

let refreshInFlight = null;

async function refreshAccessToken() {
	const current = getAuthState();
	if (!current?.refreshToken) {
		throw new Error("No refresh token available");
	}

	if (!refreshInFlight) {
		refreshInFlight = (async () => {
			beginNetworkRequest();
			try {
				const response = await fetch(`${API_BASE}/auth/refresh`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({ refresh_token: current.refreshToken })
				});

				if (!response.ok) {
					clearAuthState();
					const payload = await response.text();
					throw new Error(payload || `HTTP ${response.status}`);
				}

				const payload = await response.json();
				const tokenData = payload?.data || payload || {};
				const claims = decodeJwtPayload(tokenData.access_token) || {};
				const nextState = setAuthState(
					{
						accessToken: tokenData.access_token,
						refreshToken: tokenData.refresh_token,
						expiresAt: Date.now() + (Number(tokenData.expires_in) || 0) * 1000,
						workspaceId: current.workspaceId || claims.workspace_id || "",
						userId: current.userId || claims.sub || "",
						user: current.user,
						persist: current.persist
					},
					{ persist: current.persist }
				);

				if (!nextState) {
					throw new Error("Unable to persist refreshed auth state");
				}

				return nextState.accessToken;
			} finally {
				endNetworkRequest();
			}
		})();
	}

	try {
		return await refreshInFlight;
	} finally {
		refreshInFlight = null;
	}
}

async function requestRaw(path, options = {}, accessToken) {
	if (!API_BASE) {
		const error = new Error("API base URL is not configured. Set VITE_API_BASE_URL or VITE_NATIVE_API_BASE_URL.");
		error.code = "API_BASE_NOT_CONFIGURED";
		error.status = 0;
		throw error;
	}

	beginNetworkRequest();
	const timeoutMs = Math.max(0, Number(options.timeoutMs || 0));
	const controller = timeoutMs > 0 ? new AbortController() : null;
	const timeoutHandle =
		controller !== null
			? setTimeout(() => {
				controller.abort();
			}, timeoutMs)
			: null;

	const headers = {
		"Content-Type": "application/json",
		...(options.headers || {})
	};

	if (options.auth !== false && accessToken) {
		headers.Authorization = `Bearer ${accessToken}`;
	}

	try {
		let response;
		try {
			response = await fetchWithProxyFallback(path, {
				method: options.method || "GET",
				headers,
				...(options.body ? { body: options.body } : {}),
				...(controller ? { signal: controller.signal } : {})
			});
		} finally {
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
		}

		let payload = null;
		const contentType = response.headers.get("content-type") || "";
		if (contentType.includes("application/json")) {
			payload = await response.json();
		} else {
			const text = await response.text();
			payload = text ? { message: text } : null;
		}

		if (!response.ok) {
			const errorBody = payload?.error || payload?.detail || payload || {};
			const error = new Error(errorBody.message || payload?.message || `HTTP ${response.status}`);
			error.status = response.status;
			error.code = errorBody.code || errorBody.error_code || "REQUEST_FAILED";
			error.details = errorBody.details || null;
			throw error;
		}

		return payload;
	} finally {
		endNetworkRequest();
	}
}

async function requestFormDataRaw(path, options = {}, accessToken) {
	if (!API_BASE) {
		const error = new Error("API base URL is not configured. Set VITE_API_BASE_URL or VITE_NATIVE_API_BASE_URL.");
		error.code = "API_BASE_NOT_CONFIGURED";
		error.status = 0;
		throw error;
	}

	beginNetworkRequest();
	const timeoutMs = Math.max(0, Number(options.timeoutMs || 0));
	const controller = timeoutMs > 0 ? new AbortController() : null;
	const timeoutHandle =
		controller !== null
			? setTimeout(() => {
				controller.abort();
			}, timeoutMs)
			: null;

	const headers = {
		...(options.headers || {})
	};

	if (options.auth !== false && accessToken) {
		headers.Authorization = `Bearer ${accessToken}`;
	}

	try {
		let response;
		try {
			response = await fetchWithProxyFallback(path, {
				method: options.method || "POST",
				headers: Object.keys(headers).length ? headers : undefined,
				...(options.body ? { body: options.body } : {}),
				...(controller ? { signal: controller.signal } : {})
			});
		} finally {
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
			}
		}

		let payload = null;
		const contentType = response.headers.get("content-type") || "";
		if (contentType.includes("application/json")) {
			payload = await response.json();
		} else {
			const text = await response.text();
			payload = text ? { message: text } : null;
		}

		if (!response.ok) {
			const errorBody = payload?.error || payload?.detail || payload || {};
			const error = new Error(errorBody.message || payload?.message || `HTTP ${response.status}`);
			error.status = response.status;
			error.code = errorBody.code || errorBody.error_code || "REQUEST_FAILED";
			error.details = errorBody.details || null;
			throw error;
		}

		return payload;
	} finally {
		endNetworkRequest();
	}
}

export async function apiRequest(path, options = {}) {
	const authState = getAuthState();
	const token = options.accessToken || authState?.accessToken;
	const allowAuthFailOpen = Boolean(options.allowAuthFailOpen);

	try {
		return await requestRaw(path, options, token);
	} catch (error) {
		if (options.auth === false || options.skipRefresh) {
			throw error;
		}

		if (Number(error.status) === 401 && allowAuthFailOpen) {
			return requestRaw(path, { ...options, auth: false, skipRefresh: true }, null);
		}

		if (Number(error.status) !== 401 || !authState?.refreshToken || path === "/auth/refresh") {
			throw error;
		}

		try {
			const nextToken = await refreshAccessToken();
			return requestRaw(path, { ...options, skipRefresh: true }, nextToken);
		} catch (refreshError) {
			if (allowAuthFailOpen) {
				return requestRaw(path, { ...options, auth: false, skipRefresh: true }, null);
			}
			throw refreshError;
		}
	}
}

export async function apiRequestFormData(path, options = {}) {
	const authState = getAuthState();
	const token = options.accessToken || authState?.accessToken;
	const allowAuthFailOpen = Boolean(options.allowAuthFailOpen);

	try {
		return await requestFormDataRaw(path, options, token);
	} catch (error) {
		if (options.auth === false || options.skipRefresh) {
			throw error;
		}

		if (Number(error.status) === 401 && allowAuthFailOpen) {
			return requestFormDataRaw(path, { ...options, auth: false, skipRefresh: true }, null);
		}

		if (Number(error.status) !== 401 || !authState?.refreshToken || path === "/auth/refresh") {
			throw error;
		}

		try {
			const nextToken = await refreshAccessToken();
			return requestFormDataRaw(path, { ...options, skipRefresh: true }, nextToken);
		} catch (refreshError) {
			if (allowAuthFailOpen) {
				return requestFormDataRaw(path, { ...options, auth: false, skipRefresh: true }, null);
			}
			throw refreshError;
		}
	}
}

export async function loginWithPassword({ email, password, deviceHint, persistSession = true }) {
	const payload = await apiRequest("/auth/login", {
		method: "POST",
		auth: false,
		body: JSON.stringify({ email, password, device_hint: deviceHint || null })
	});

	const data = payload?.data || payload || {};
	const claims = decodeJwtPayload(data.access_token) || {};
	const authState = setAuthState(
		{
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresAt: Date.now() + (Number(data.expires_in) || 0) * 1000,
			workspaceId: claims.workspace_id || "",
			userId: claims.sub || data.user?.id || "",
			user: data.user || {},
			persist: Boolean(persistSession)
		},
		{ persist: Boolean(persistSession) }
	);

	return {
		authState,
		payload
	};
}

export async function registerWithPassword({
	email,
	password,
	confirmPassword,
	name,
	companyName,
	deviceHint,
	locale,
	persistSession = true
}) {
	const payload = await apiRequest("/auth/register", {
		method: "POST",
		auth: false,
		body: JSON.stringify({
			email,
			password,
			confirm_password: confirmPassword || null,
			name,
			company_name: companyName || null,
			device_hint: deviceHint || null,
			locale: locale || "en-US"
		})
	});

	const data = payload?.data || payload || {};
	const claims = decodeJwtPayload(data.access_token) || {};
	const authState = setAuthState(
		{
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresAt: Date.now() + (Number(data.expires_in) || 0) * 1000,
			workspaceId: data.workspace_id || claims.workspace_id || "",
			userId: claims.sub || data.user?.id || "",
			user: data.user || { display_name: name, email },
			persist: Boolean(persistSession)
		},
		{ persist: Boolean(persistSession) }
	);

	return {
		authState,
		payload
	};
}

export async function logoutSession() {
	const authState = getAuthState();
	try {
		if (authState?.refreshToken) {
			await apiRequest("/auth/logout", {
				method: "POST",
				body: JSON.stringify({ refresh_token: authState.refreshToken })
			});
		}
	} catch (error) {
		// Best-effort server revocation; local cleanup must still happen.
	} finally {
		clearAuthState();
	}
}

export async function fetchOrganizationOnboarding(search) {
	const query = search ? `?search=${encodeURIComponent(String(search))}` : "";
	const payload = await apiRequest(`/organizations/onboarding${query}`);
	return payload?.data || payload || {};
}

export async function createOrganization({ name }) {
	const payload = await apiRequest("/organizations", {
		method: "POST",
		body: JSON.stringify({ name })
	});
	return payload?.data || payload || {};
}

export async function inviteOrganizationMember({ workspaceId, email, note }) {
	const payload = await apiRequest(`/organizations/${encodeURIComponent(workspaceId)}/invites`, {
		method: "POST",
		body: JSON.stringify({
			email,
			note: note || null
		})
	});
	return payload?.data || payload || {};
}

export async function fetchOrganizationMembers({ workspaceId }) {
	const payload = await apiRequest(`/organizations/${encodeURIComponent(workspaceId)}/members`);
	return payload?.data || payload || [];
}

export async function removeOrganizationMember({ workspaceId, memberUserId }) {
	const payload = await apiRequest(`/organizations/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberUserId)}`, {
		method: "DELETE"
	});
	return payload?.data || payload || {};
}

export async function requestOrganizationJoin({ workspaceId, message }) {
	const payload = await apiRequest("/organizations/join-requests", {
		method: "POST",
		body: JSON.stringify({
			workspace_id: workspaceId,
			message: message || null
		})
	});
	return payload?.data || payload || {};
}

export async function decideOrganizationJoinRequest({ joinRequestId, decision }) {
	const payload = await apiRequest(`/organizations/join-requests/${encodeURIComponent(joinRequestId)}/decision`, {
		method: "POST",
		body: JSON.stringify({ decision })
	});
	return payload?.data || payload || {};
}

export async function decideOrganizationInvitation({ invitationId, decision }) {
	const payload = await apiRequest(`/organizations/invitations/${encodeURIComponent(invitationId)}/decision`, {
		method: "POST",
		body: JSON.stringify({ decision })
	});
	return payload?.data || payload || {};
}

export async function fetchPublicRuntimeConfig() {
	const payload = await apiRequest("/config/public", {
		auth: false,
		skipRefresh: true
	});
	return payload?.data || payload || {};
}
