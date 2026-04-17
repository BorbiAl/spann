import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "../app/ThemeProvider";
import { apiRequest, getAuthState, setAuthState } from "../data/constants";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
	{ key: "channels",      label: "Channel Settings",   icon: "tune" },
	{ key: "profile",       label: "Profile",            icon: "person" },
	{ key: "appearance",    label: "Appearance",          icon: "palette" },
	{ key: "notifications", label: "Notifications",       icon: "notifications" },
	{ key: "shortcuts",     label: "Keyboard Shortcuts",  icon: "keyboard" },
	{ key: "about",         label: "About",               icon: "info" },
];

const TIMEZONES = [
	"UTC",
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"America/Anchorage",
	"America/Halifax",
	"America/Sao_Paulo",
	"Europe/London",
	"Europe/Paris",
	"Europe/Berlin",
	"Europe/Moscow",
	"Asia/Dubai",
	"Asia/Kolkata",
	"Asia/Bangkok",
	"Asia/Shanghai",
	"Asia/Tokyo",
	"Asia/Seoul",
	"Australia/Sydney",
	"Pacific/Auckland",
];

const LOCALES = [
	{ value: "en-US", label: "English (US)" },
	{ value: "en-GB", label: "English (UK)" },
	{ value: "bg-BG", label: "Български" },
	{ value: "es-ES", label: "Español" },
	{ value: "fr-FR", label: "Français" },
	{ value: "de-DE", label: "Deutsch" },
	{ value: "pt-BR", label: "Português (BR)" },
	{ value: "ja-JP", label: "日本語" },
	{ value: "zh-CN", label: "中文 (简体)" },
	{ value: "ko-KR", label: "한국어" },
	{ value: "ar-SA", label: "العربية" },
];

const KEYBOARD_SHORTCUTS = [
	{ group: "Navigation",    keys: ["Ctrl", "K"],          label: "Quick jump to channel or person" },
	{ group: "Navigation",    keys: ["Alt", "↑ / ↓"],       label: "Jump to previous / next unread channel" },
	{ group: "Navigation",    keys: ["Ctrl", "Shift", "K"], label: "Open direct messages" },
	{ group: "Messaging",     keys: ["Enter"],               label: "Send message" },
	{ group: "Messaging",     keys: ["Shift", "Enter"],      label: "New line within message" },
	{ group: "Messaging",     keys: ["↑"],                   label: "Edit your last message" },
	{ group: "Messaging",     keys: ["Escape"],              label: "Cancel edit / close panel" },
	{ group: "Messaging",     keys: ["Ctrl", "B"],           label: "Bold selected text" },
	{ group: "Messaging",     keys: ["Ctrl", "I"],           label: "Italic selected text" },
	{ group: "Messaging",     keys: ["Ctrl", "Shift", "X"],  label: "Strikethrough selected text" },
	{ group: "Interface",     keys: ["Ctrl", "/"],           label: "Show keyboard shortcuts" },
	{ group: "Interface",     keys: ["Ctrl", "Shift", "\\"], label: "Toggle sidebar" },
	{ group: "Interface",     keys: ["Ctrl", ","],           label: "Open settings" },
	{ group: "Interface",     keys: ["F11"],                 label: "Toggle fullscreen" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────

function Kbd({ children }) {
	return (
		<kbd className="px-2 py-0.5 text-[11px] font-bold rounded border border-outline-variant/40 bg-surface-container-high text-on-surface-variant font-mono">
			{children}
		</kbd>
	);
}

function SettingRow({ label, description, children }) {
	return (
		<div className="flex items-start justify-between gap-4 sm:gap-6 py-5 border-b border-outline-variant/10 last:border-0">
			<div className="min-w-0 flex-1">
				<p className="text-sm font-medium text-on-surface">{label}</p>
				{description && <p className="mt-1 text-xs text-on-surface-variant">{description}</p>}
			</div>
			<div className="flex-shrink-0">{children}</div>
		</div>
	);
}

function Toggle({ checked, onChange, disabled }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className={[
				"relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full p-0.5",
				"border shadow-[inset_0_1px_1px_rgba(0,0,0,0.08)] transition-all duration-200",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
				checked
					? "bg-primary/90 border-primary/40"
					: "bg-surface-container-high border-outline-variant/40",
				disabled ? "opacity-50 cursor-not-allowed" : "",
			].join(" ")}
		>
			<span
				aria-hidden="true"
				className={[
					"material-symbols-outlined absolute left-1.5 top-1/2 -translate-y-1/2 text-[11px] leading-none transition-opacity duration-150",
					checked ? "opacity-0" : "opacity-60 text-on-surface-variant",
				].join(" ")}
			>
				close_small
			</span>
			<span
				aria-hidden="true"
				className={[
					"material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] leading-none transition-opacity duration-150",
					checked ? "opacity-90 text-on-primary" : "opacity-0",
				].join(" ")}
			>
				check_small
			</span>
			<span
				className={[
					"pointer-events-none relative z-10 inline-block h-6 w-6 rounded-full transform transition-transform duration-200",
					"bg-white border border-black/5 shadow-[0_1px_3px_rgba(0,0,0,0.18)]",
					checked ? "translate-x-5" : "translate-x-0",
				].join(" ")}
			/>
		</button>
	);
}

function SaveBar({ state, onSave, onReset, dirty }) {
	return (
		<div className={[
			"flex items-center gap-3 pt-5 mt-4 border-t border-outline-variant/10",
			"transition-opacity duration-200",
			dirty ? "opacity-100" : "opacity-40 pointer-events-none",
		].join(" ")}>
			<button
				type="submit"
				onClick={onSave}
				disabled={state === "saving" || !dirty}
				className="px-5 py-2 bg-primary text-on-primary text-sm font-semibold rounded-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
			>
				{state === "saving" && (
					<span className="material-symbols-outlined text-sm animate-spin" style={{ animationDuration: "0.8s" }}>refresh</span>
				)}
				{state === "saved" ? "Saved ✓" : state === "error" ? "Error — retry" : "Save changes"}
			</button>
			<button
				type="button"
				onClick={onReset}
				disabled={state === "saving" || !dirty}
				className="px-5 py-2 text-sm font-semibold text-on-surface-variant bg-surface-container rounded-lg hover:bg-surface-container-high active:scale-95 transition-all disabled:opacity-60"
			>
				Discard
			</button>
			{state === "error" && (
				<span className="text-xs text-error">Could not save. Please try again.</span>
			)}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile section
// ─────────────────────────────────────────────────────────────────────────────

function ProfileSection({ authState }) {
	const [profile, setProfile] = useState(null);
	const [loading, setLoading] = useState(true);
	const [form, setForm] = useState({
		display_name: "",
		bio: "",
		timezone: "",
		locale: "en-US",
		avatar_url: "",
	});
	const [original, setOriginal] = useState(null);
	const [saveState, setSaveState] = useState("idle");
	const avatarInputRef = useRef(null);

	const toProfileForm = useCallback((data) => ({
		display_name: data?.display_name || authState?.user?.display_name || authState?.user?.name || "",
		bio: data?.bio || "",
		timezone: data?.timezone || "",
		locale: data?.locale || authState?.user?.locale || "en-US",
		avatar_url: data?.avatar_url || "",
	}), [authState?.user?.display_name, authState?.user?.locale, authState?.user?.name]);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		apiRequest("/users/me")
			.then((payload) => {
				if (cancelled) return;
				const data = payload?.data || payload || {};
				const next = toProfileForm(data);
				setProfile(data);
				setForm(next);
				setOriginal(next);
			})
			.catch(() => {
				if (cancelled) return;
				const fallback = toProfileForm({});
				setForm(fallback);
				setOriginal(fallback);
			})
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [toProfileForm]);

	const dirty = original && JSON.stringify(form) !== JSON.stringify(original);

	async function handleSave() {
		setSaveState("saving");
		try {
			const profileChanged =
				form.display_name !== original.display_name ||
				form.bio !== original.bio ||
				form.timezone !== original.timezone ||
				form.avatar_url !== original.avatar_url;

			// Only call PATCH /users/me when name/bio/timezone actually changed
			if (profileChanged) {
				const safeDisplayName = form.display_name.trim() || original.display_name || authState?.user?.display_name || authState?.user?.name || "";
				const profilePayload = {
					display_name: safeDisplayName || undefined,
					bio: form.bio.trim(),
					timezone: form.timezone || "",
				};

				if (String(email || "").trim()) {
					profilePayload.email = String(email).trim();
				}

				if (form.avatar_url !== original.avatar_url) {
					profilePayload.avatar_url = form.avatar_url || "";
				}

				await apiRequest("/users/me", {
					method: "PATCH",
					body: JSON.stringify(profilePayload),
				});
			}

			const onboardingChanged = form.locale !== original.locale;

			if (onboardingChanged) {
				await apiRequest("/users/me/preferences", {
					method: "PATCH",
					body: JSON.stringify({
						locale: form.locale,
					}),
				});
			}

			const latestPayload = await apiRequest("/users/me");
			const latestData = latestPayload?.data || latestPayload || {};
			const currentAuth = authState || getAuthState();
			if (currentAuth?.accessToken && currentAuth?.refreshToken) {
				const nextUser = {
					...(currentAuth.user || {}),
					display_name: latestData?.display_name || currentAuth?.user?.display_name || currentAuth?.user?.name || "",
					avatar_url: latestData?.avatar_url ?? currentAuth?.user?.avatar_url ?? null,
					bio: latestData?.bio ?? currentAuth?.user?.bio ?? null,
					timezone: latestData?.timezone ?? currentAuth?.user?.timezone ?? null,
					locale: latestData?.locale || form.locale || currentAuth?.user?.locale || "en-US",
					email: latestData?.email || currentAuth?.user?.email || email || "",
					name: latestData?.display_name || currentAuth?.user?.name || currentAuth?.user?.display_name || "",
				};

				setAuthState(
					{
						...currentAuth,
						user: nextUser,
					},
					{ persist: Boolean(currentAuth?.persist) }
				);
			}
			const next = toProfileForm(latestData);
			setProfile(latestData);
			setForm(next);
			setOriginal(next);
			setSaveState("saved");
			setTimeout(() => setSaveState("idle"), 2500);
		} catch {
			setSaveState("error");
			setTimeout(() => setSaveState("idle"), 3000);
		}
	}

	function handleReset() {
		setForm({ ...original });
		setSaveState("idle");
	}

	function handleAvatarSelect(event) {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}
		if (!file.type.startsWith("image/")) {
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			const result = typeof reader.result === "string" ? reader.result : "";
			if (!result) {
				return;
			}
			setForm((current) => ({ ...current, avatar_url: result }));
		};
		reader.readAsDataURL(file);
	}

	const email = profile?.email || authState?.user?.email || authState?.email || "";
	const initials = form.display_name
		? form.display_name.trim().split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
		: "?";

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-on-surface">Profile</h1>
				<p className="mt-1 text-sm text-on-surface-variant">Manage your personal information and how others see you.</p>
			</div>

			{loading ? (
				<div className="flex items-center gap-3 text-on-surface-variant py-8">
					<span className="material-symbols-outlined animate-spin" style={{ animationDuration: "0.8s" }}>refresh</span>
					<span className="text-sm">Loading profile…</span>
				</div>
			) : (
				<>
					{/* Avatar */}
					<div className="flex items-center gap-5 pb-7 border-b border-outline-variant/10">
						<div className="relative group">
							{form.avatar_url ? (
								<img
									src={form.avatar_url}
									alt="Avatar"
									className="w-20 h-20 rounded-full object-cover border-2 border-outline-variant/20"
								/>
							) : (
								<div className="w-20 h-20 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-2xl font-bold border-2 border-outline-variant/20">
									{initials}
								</div>
							)}
							<button
								type="button"
								onClick={() => avatarInputRef.current?.click()}
								className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
								aria-label="Change avatar"
								title="Change avatar"
							>
								<span className="material-symbols-outlined text-white text-xl">photo_camera</span>
							</button>
							<input
								ref={avatarInputRef}
								type="file"
								accept="image/*"
								onChange={handleAvatarSelect}
								className="hidden"
							/>
						</div>
						<div>
							<p className="font-semibold text-on-surface">{form.display_name || "—"}</p>
							<p className="text-sm text-on-surface-variant">{email}</p>
							<p className="text-xs text-on-surface-variant/60 mt-0.5 capitalize">{profile?.role || "member"}</p>
						</div>
					</div>

					{/* Fields */}
					<div className="space-y-6">
						<div className="grid grid-cols-1 gap-2">
							<label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider" htmlFor="s-display-name">
								Display Name
							</label>
							<input
								id="s-display-name"
								type="text"
								maxLength={64}
								value={form.display_name}
								onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
								className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
								placeholder="Your display name"
							/>
						</div>

						<div className="grid grid-cols-1 gap-2">
							<label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider" htmlFor="s-email">
								Email Address
							</label>
							<input
								id="s-email"
								type="email"
								value={email}
								readOnly
								className="w-full bg-surface-container border border-outline-variant/10 rounded-lg px-4 py-2.5 text-sm text-on-surface-variant cursor-not-allowed"
							/>
							<p className="text-xs text-on-surface-variant/60 pl-1">Email cannot be changed here.</p>
						</div>

						<div className="grid grid-cols-1 gap-2">
							<label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider" htmlFor="s-bio">
								Bio
							</label>
							<textarea
								id="s-bio"
								rows={3}
								maxLength={500}
								value={form.bio}
								onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
								className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
								placeholder="A short bio about yourself…"
							/>
							<p className="text-right text-xs text-on-surface-variant/50">{form.bio.length}/500</p>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
							<div className="grid grid-cols-1 gap-2">
								<label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider" htmlFor="s-timezone">
									Timezone
								</label>
								<select
									id="s-timezone"
									value={form.timezone}
									onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
									className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
								>
									<option value="">— Select timezone —</option>
									{TIMEZONES.map((tz) => (
										<option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
									))}
								</select>
							</div>

							<div className="grid grid-cols-1 gap-2">
								<label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider" htmlFor="s-locale">
									Language
								</label>
								<select
									id="s-locale"
									value={form.locale}
									onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))}
									className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
								>
									{LOCALES.map(({ value, label }) => (
										<option key={value} value={value}>{label}</option>
									))}
								</select>
							</div>
						</div>

					</div>

					<SaveBar state={saveState} onSave={handleSave} onReset={handleReset} dirty={dirty} />
				</>
			)}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Appearance section
// ─────────────────────────────────────────────────────────────────────────────

function AppearanceSection({ accessibilityPrefs, onChangeAccessibility }) {
	const { theme, setTheme } = useTheme();

	const themeMode = theme === "dark" || theme === "light" || theme === "system" ? theme : "light";
	const fontSize = Number(accessibilityPrefs?.fontSize || 15);

	function applyTheme(mode) {
		if (mode === "dark" || mode === "light" || mode === "system") {
			setTheme(mode);
		}
	}

	function ThemeChoice({ value, label, preview }) {
		const active = themeMode === value;
		return (
			<button
				type="button"
				onClick={() => applyTheme(value)}
				className={[
					"flex-1 p-3 rounded-xl border flex flex-col items-center gap-2 transition-all",
					active
						? "border-2 border-primary bg-primary/5"
						: "border border-outline-variant/30 bg-surface-container hover:bg-surface-container-high",
				].join(" ")}
			>
				<div className={`w-full h-10 rounded-lg ${preview}`} />
				<span className="text-[11px] font-semibold text-on-surface">{label}</span>
			</button>
		);
	}

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-on-surface">Appearance</h1>
				<p className="mt-1 text-sm text-on-surface-variant">Customize how Spann looks on your device.</p>
			</div>

			<div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest divide-y divide-outline-variant/10">
				<div className="p-5 space-y-3">
					<p className="text-sm font-semibold text-on-surface flex items-center gap-2">
						<span className="material-symbols-outlined text-primary text-base">dark_mode</span>
						Theme
					</p>
					<div className="flex gap-3">
						<ThemeChoice value="light" label="Light" preview="bg-slate-100 border border-slate-200" />
						<ThemeChoice value="dark"  label="Dark"  preview="bg-slate-800" />
						<ThemeChoice value="system" label="System" preview="bg-gradient-to-r from-slate-100 to-slate-800" />
					</div>
				</div>

				<div className="p-5 space-y-4">
					<p className="text-sm font-semibold text-on-surface flex items-center gap-2">
						<span className="material-symbols-outlined text-primary text-base">text_fields</span>
						Message font size
					</p>
					<div className="space-y-2">
						<div className="flex justify-between items-center">
							<span className="text-xs text-on-surface-variant">Size</span>
							<span className="text-xs font-bold text-on-surface">{fontSize}px</span>
						</div>
						<input
							type="range"
							min="13"
							max="20"
							step="1"
							value={fontSize}
							onChange={(e) => onChangeAccessibility("fontSize", Number(e.target.value))}
							className="w-full h-1.5 bg-surface-container-highest rounded-full appearance-none cursor-pointer accent-primary"
						/>
						<div className="flex justify-between text-[10px] font-semibold text-on-surface-variant/50 uppercase tracking-wider">
							<span>Small</span>
							<span>Normal</span>
							<span>Large</span>
						</div>
					</div>
					<p className="mt-0.5 rounded-lg bg-surface-container p-3 text-sm text-on-surface-variant" style={{ fontSize: `${fontSize}px` }}>
						Preview — This is what your messages will look like.
					</p>
				</div>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications section
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_NOTIF = {
	direct_messages: true,
	mentions: true,
	channel_updates: false,
	pulse_alerts: true,
	email_digest: false,
	sounds: true,
};

function NotificationsSection({ accessibilityPrefs, onChangeAccessibility }) {
	const notifPrefs = { ...DEFAULT_NOTIF, ...(accessibilityPrefs?.notification_prefs || {}) };

	function update(key, value) {
		onChangeAccessibility("notification_prefs", { ...notifPrefs, [key]: value });
	}

	const rows = [
		{
			key: "direct_messages",
			label: "Direct messages",
			description: "Notify me when I receive a direct message.",
		},
		{
			key: "mentions",
			label: "Mentions & keywords",
			description: "Notify me when someone mentions me or a tracked keyword.",
		},
		{
			key: "channel_updates",
			label: "Channel activity",
			description: "Notify me when there are new messages in channels I follow.",
		},
		{
			key: "pulse_alerts",
			label: "Pulse alerts",
			description: "Notify me when a channel sentiment crosses an alert threshold.",
		},
		{
			key: "email_digest",
			label: "Email digest",
			description: "Receive a daily summary of activity while away.",
		},
		{
			key: "sounds",
			label: "Notification sounds",
			description: "Play a sound when a notification arrives.",
		},
	];

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-on-surface">Notifications</h1>
				<p className="mt-1 text-sm text-on-surface-variant">Choose what you're notified about and how.</p>
			</div>

			<div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest px-5 sm:px-6">
				{rows.map((row) => (
					<SettingRow key={row.key} label={row.label} description={row.description}>
						<Toggle
							checked={Boolean(notifPrefs[row.key])}
							onChange={(v) => update(row.key, v)}
						/>
					</SettingRow>
				))}
			</div>

			<p className="text-xs text-on-surface-variant/60">
				Changes are saved automatically. Desktop-level notification permissions are managed by your OS.
			</p>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard Shortcuts section
// ─────────────────────────────────────────────────────────────────────────────

function ShortcutsSection() {
	const groups = [...new Set(KEYBOARD_SHORTCUTS.map((s) => s.group))];

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-on-surface">Keyboard Shortcuts</h1>
				<p className="mt-1 text-sm text-on-surface-variant">Speed up your workflow with these shortcuts.</p>
			</div>

			{groups.map((group) => (
				<div key={group} className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest overflow-hidden">
					<div className="px-5 py-3 bg-surface-container border-b border-outline-variant/10">
						<p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{group}</p>
					</div>
						<div className="divide-y divide-outline-variant/10">
						{KEYBOARD_SHORTCUTS.filter((s) => s.group === group).map((shortcut) => (
								<div key={shortcut.label} className="flex items-center justify-between px-5 py-4 gap-4">
								<span className="text-sm text-on-surface">{shortcut.label}</span>
								<div className="flex items-center gap-1 flex-shrink-0">
									{shortcut.keys.map((key, i) => (
										<React.Fragment key={key}>
											{i > 0 && <span className="text-on-surface-variant/40 text-xs">+</span>}
											<Kbd>{key}</Kbd>
										</React.Fragment>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// About section
// ─────────────────────────────────────────────────────────────────────────────

function AboutSection() {
	const [checkState, setCheckState] = useState("idle");

	async function handleCheckUpdates() {
		setCheckState("checking");
		try {
			const payload = await apiRequest("/health", { auth: false, skipRefresh: true, timeoutMs: 7000 });
			const serverVersion = String(payload?.version || payload?.data?.version || "").trim();
			const localVersion = String(import.meta.env.VITE_APP_VERSION || "").trim();
			setCheckState(serverVersion && localVersion && serverVersion !== localVersion ? "update_available" : "latest");
		} catch {
			setCheckState("error");
		}
		setTimeout(() => setCheckState("idle"), 3000);
	}

	const links = [
		{ label: "Release Notes",   href: "https://github.com/BorbiAl/spann/releases" },
		{ label: "Privacy Policy",  href: "https://github.com/BorbiAl/spann/blob/main/README.md" },
		{ label: "Terms of Service", href: "https://github.com/BorbiAl/spann/blob/main/README.md" },
		{ label: "Support",          href: "mailto:support@spann.io" },
	];

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-on-surface">About</h1>
				<p className="mt-1 text-sm text-on-surface-variant">Version information and legal resources.</p>
			</div>

			<div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 flex items-center gap-6">
				<div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center flex-shrink-0 shadow-md">
					<span className="text-on-primary text-3xl font-black">S</span>
				</div>
				<div className="flex-1 min-w-0">
					<h2 className="text-lg font-bold text-on-surface">Spann</h2>
					<p className="text-sm text-on-surface-variant">Version 1.0.0 · Build 2405</p>
					<p className="text-xs text-on-surface-variant/50 mt-0.5">© 2025 Spann Technologies Inc.</p>
				</div>
				<button
					type="button"
					onClick={handleCheckUpdates}
					disabled={checkState === "checking"}
					className="flex-shrink-0 px-4 py-2 text-sm font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 active:scale-95 transition-all disabled:opacity-60"
				>
					{checkState === "checking" && "Checking…"}
					{checkState === "latest"   && "✓ Up to date"}
					{checkState === "update_available" && "Update available"}
					{checkState === "error"    && "Check failed"}
					{checkState === "idle"     && "Check for updates"}
				</button>
			</div>

			<div className="grid grid-cols-2 gap-3">
				{links.map(({ label, href }) => (
					<a
						key={label}
						href={href}
						className="flex items-center gap-2 p-4 rounded-xl border border-outline-variant/10 bg-surface-container-lowest hover:bg-surface-container transition-colors"
					>
						<span className="material-symbols-outlined text-on-surface-variant text-base">open_in_new</span>
						<span className="text-sm font-medium text-on-surface">{label}</span>
					</a>
				))}
			</div>
		</div>
	);
}

function ChannelSettingsSection({ activeChannelName, channels, workspaceMembers }) {
	const normalizedName = String(activeChannelName || "").replace(/^#/, "").trim();
	const channelList = Array.isArray(channels) ? channels : [];
	const selectedChannel = channelList.find((channel) => String(channel?.name || "").replace(/^#/, "") === normalizedName) || null;
	const members = Array.isArray(workspaceMembers) ? workspaceMembers : [];
	const onlineCount = members.filter((member) => Boolean(member?.is_online)).length;

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-on-surface">Channel Settings</h1>
				<p className="mt-1 text-sm text-on-surface-variant">Configure behavior for the currently selected chat channel.</p>
			</div>

			<div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 space-y-5">
				<div>
					<p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Selected channel</p>
					<h2 className="mt-1 text-lg font-bold text-on-surface">#{normalizedName || "unknown"}</h2>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<div className="rounded-lg border border-outline-variant/10 bg-surface p-3">
						<p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Tone</p>
						<p className="mt-1 text-sm font-semibold text-on-surface">{String(selectedChannel?.tone || "neutral")}</p>
					</div>
					<div className="rounded-lg border border-outline-variant/10 bg-surface p-3">
						<p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Members online</p>
						<p className="mt-1 text-sm font-semibold text-on-surface">{onlineCount}</p>
					</div>
					<div className="rounded-lg border border-outline-variant/10 bg-surface p-3">
						<p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">Type</p>
						<p className="mt-1 text-sm font-semibold text-on-surface">{String(selectedChannel?.name || "").startsWith("@") ? "Direct" : "Group"}</p>
					</div>
				</div>

				<p className="text-xs text-on-surface-variant">More channel-level controls can be expanded here (retention, posting permissions, mention policy, pinned guidance).</p>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsView({ authState, onLogout, accessibilityPrefs, onChangeAccessibility, initialSection, activeChannelName, channels, workspaceMembers }) {
	const [activeSection, setActiveSection] = useState(initialSection || "profile");
	const [selectedChannelName, setSelectedChannelName] = useState(String(activeChannelName || ""));

	useEffect(() => {
		setSelectedChannelName(String(activeChannelName || ""));
	}, [activeChannelName]);

	// Allow the global Ctrl+/ shortcut to jump to a section even while settings is already open
	useEffect(() => {
		function handler(e) {
			const detail = e?.detail || {};
			if (detail.section) {
				setActiveSection(detail.section);
			}
			if (detail.channelName) {
				setSelectedChannelName(String(detail.channelName));
			}
		}
		document.addEventListener("spann:goto-settings", handler);
		return () => document.removeEventListener("spann:goto-settings", handler);
	}, []);

	function renderSection() {
		switch (activeSection) {
			case "channels":
				return <ChannelSettingsSection activeChannelName={selectedChannelName} channels={channels} workspaceMembers={workspaceMembers} />;
			case "profile":
				return <ProfileSection authState={authState} />;
			case "appearance":
				return <AppearanceSection accessibilityPrefs={accessibilityPrefs} onChangeAccessibility={onChangeAccessibility} />;
			case "notifications":
				return <NotificationsSection accessibilityPrefs={accessibilityPrefs} onChangeAccessibility={onChangeAccessibility} />;
			case "shortcuts":
				return <ShortcutsSection />;
			case "about":
				return <AboutSection />;
			default:
				return null;
		}
	}

	return (
		<div className="h-full overflow-y-auto bg-surface p-4 sm:p-6 w-full view-transition">
			<div className="flex min-h-full overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-lowest">
				{/* Sidebar */}
				<aside className="w-56 border-r border-outline-variant/10 flex flex-col p-4 gap-2 bg-surface/70 backdrop-blur-xl flex-shrink-0">
					<div className="px-3 py-4">
						<h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">Settings</h2>
					</div>

					<nav className="flex-1 space-y-1">
						{NAV_ITEMS.map((item) => {
							const active = activeSection === item.key;
							return (
								<button
									key={item.key}
									type="button"
									onClick={() => setActiveSection(item.key)}
									className={[
										"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer text-left",
										active
											? "bg-primary/10 text-primary font-semibold"
											: "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
									].join(" ")}
								>
									<span
										className="material-symbols-outlined text-[20px] flex-shrink-0"
										style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
									>
										{item.icon}
									</span>
									<span className="text-[13px]">{item.label}</span>
								</button>
							);
						})}
					</nav>

					<div className="pt-2 border-t border-outline-variant/10">
						<button
							type="button"
							onClick={onLogout}
							className="w-full flex items-center gap-3 px-3 py-2.5 text-error hover:bg-error-container/20 rounded-lg transition-all cursor-pointer"
						>
							<span className="material-symbols-outlined text-[20px]">logout</span>
							<span className="text-[13px] font-medium">Sign out</span>
						</button>
					</div>
				</aside>

				{/* Content */}
				<main className="flex-1 overflow-y-auto p-6 sm:p-8 lg:p-10 max-w-3xl w-full mx-auto">
					{renderSection()}
				</main>
			</div>
		</div>
	);
}
