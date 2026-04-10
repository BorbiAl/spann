import React, { useState } from "react";
import { useTheme } from "../app/ThemeProvider";

// ─── inline SVG icons (settings-specific) ────────────────────────────────────
function PersonIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="8" r="4" />
			<path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
		</svg>
	);
}
function PaletteIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="12" r="9" />
			<circle cx="8.5" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
			<circle cx="15.5" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
			<circle cx="9" cy="14" r="1.3" fill="currentColor" stroke="none" />
			<circle cx="15" cy="14" r="1.3" fill="currentColor" stroke="none" />
			<path d="M12 21a3 3 0 0 0 3-3h-6a3 3 0 0 0 3 3z" />
		</svg>
	);
}
function BellIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="M6 10a6 6 0 1 1 12 0c0 3.5 1 5.5 2 7H4c1-1.5 2-3.5 2-7z" />
			<path d="M10 20a2 2 0 0 0 4 0" />
		</svg>
	);
}
function KeyboardIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<rect x="3" y="7" width="18" height="10" rx="2" />
			<path d="M7 11h.01M11 11h.01M15 11h.01M7 14h10" />
		</svg>
	);
}
function InfoCircleIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="12" cy="12" r="9" />
			<path d="M12 10v6" />
			<circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
		</svg>
	);
}
function LogoutIcon() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
			<path d="M10 17l5-5-5-5" />
			<path d="M15 12H4" />
		</svg>
	);
}
function EditIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 20h9" />
			<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
		</svg>
	);
}

// ─── nav items ────────────────────────────────────────────────────────────────
const SECTIONS = [
	{ key: "profile",       label: "Profile",            Icon: PersonIcon },
	{ key: "appearance",    label: "Appearance",         Icon: PaletteIcon },
	{ key: "notifications", label: "Notifications",      Icon: BellIcon },
	{ key: "shortcuts",     label: "Keyboard Shortcuts", Icon: KeyboardIcon },
	{ key: "about",         label: "About",              Icon: InfoCircleIcon },
];

// ─── sub-components ───────────────────────────────────────────────────────────

function FieldRow({ label, id, value, onChange, type = "text" }) {
	return (
		<div className="flex flex-col gap-1">
			<label htmlFor={id} className="text-[11px] font-bold text-[#404752] dark:text-slate-400 uppercase tracking-widest px-1">
				{label}
			</label>
			<input
				id={id}
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="w-full bg-[#f3f3f3] dark:bg-slate-800 border-none rounded-lg px-4 py-3 text-sm text-[#1a1c1c] dark:text-white focus:ring-2 focus:ring-[#005faa]/20 transition-all outline-none"
			/>
		</div>
	);
}

function ThemeButton({ label, active, preview, onClick }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={[
				"flex-1 p-3 rounded-lg flex flex-col items-center gap-2 transition-all",
				active
					? "border-2 border-[#005faa] bg-white dark:bg-slate-900"
					: "border border-[#c0c7d4]/30 bg-[#eeeeee]/60 dark:bg-slate-800/60 hover:bg-[#e8e8e8] dark:hover:bg-slate-700",
			].join(" ")}
		>
			<div className={`w-full h-8 rounded-sm ${preview}`} />
			<span className={`text-[11px] font-bold ${active ? "text-[#005faa]" : "text-[#404752] dark:text-slate-400"}`}>{label}</span>
		</button>
	);
}

function SectionProfile({ authState }) {
	const displayNameInit = authState?.user?.display_name || authState?.user?.name || "Alex Sterling";
	const emailInit       = authState?.user?.email || authState?.email || "alex.sterling@spann.io";

	const [displayName, setDisplayName] = useState(displayNameInit);
	const [email, setEmail]             = useState(emailInit);
	const [saved, setSaved]             = useState(false);

	function handleSave(e) {
		e.preventDefault();
		setSaved(true);
		setTimeout(() => setSaved(false), 2000);
	}

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-3xl font-extrabold tracking-tight text-[#1a1c1c] dark:text-white mb-2">Profile Settings</h1>
				<p className="text-[#404752] dark:text-slate-400 text-sm">Manage your personal information and security preferences.</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
				{/* Avatar card */}
				<div className="col-span-1 bg-white dark:bg-slate-900 border border-[#c0c7d4]/20 p-6 rounded-xl shadow-sm flex flex-col items-center text-center">
					<div className="relative group">
						<div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#005faa] to-[#0078d4] flex items-center justify-center text-white text-3xl font-black select-none border-4 border-[#005faa]/10 group-hover:opacity-90 transition-opacity">
							{displayName.charAt(0).toUpperCase()}
						</div>
						<button
							type="button"
							className="absolute bottom-1 right-1 bg-[#005faa] text-white p-2 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform"
							aria-label="Change avatar"
						>
							<EditIcon />
						</button>
					</div>
					<h3 className="mt-4 font-bold text-lg text-[#1a1c1c] dark:text-white">{displayName || "User"}</h3>
					<p className="text-xs text-[#404752] dark:text-slate-400 font-medium uppercase tracking-wider">Premium Member</p>
				</div>

				{/* Info fields */}
				<form className="col-span-2 flex flex-col gap-6" onSubmit={handleSave}>
					<FieldRow label="Display Name" id="settings-display-name" value={displayName} onChange={setDisplayName} />
					<FieldRow label="Email Address" id="settings-email" value={email} onChange={setEmail} type="email" />

					<div className="flex flex-wrap gap-4 pt-2">
						<button
							type="submit"
							className="px-6 py-2.5 bg-gradient-to-br from-[#005faa] to-[#0078d4] text-white font-semibold rounded-lg shadow-md hover:shadow-lg active:scale-95 transition-all text-sm"
						>
							{saved ? "Saved ✓" : "Save Changes"}
						</button>
						<button
							type="button"
							className="px-6 py-2.5 bg-[#e2e2e2] dark:bg-slate-700 text-[#404752] dark:text-slate-300 font-semibold rounded-lg hover:bg-[#d3d3d3] dark:hover:bg-slate-600 active:scale-95 transition-all text-sm flex items-center gap-2"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
								<rect x="6" y="11" width="12" height="9" rx="2" /><path d="M9 11V8a3 3 0 0 1 6 0v3" />
							</svg>
							Change Password
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

function SectionAppearance() {
	const { theme, toggleTheme } = useTheme();
	const [themeMode, setThemeMode] = useState(theme === "dark" ? "dark" : "light");
	const [fontSize, setFontSize]   = useState(14);

	function applyTheme(mode) {
		setThemeMode(mode);
		if (mode === "system") return; // no-op for now
		if ((mode === "dark") !== (theme === "dark")) toggleTheme();
	}

	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-3xl font-extrabold tracking-tight text-[#1a1c1c] dark:text-white mb-2">Appearance</h2>
				<p className="text-[#404752] dark:text-slate-400 text-sm">Customize how Spann looks on your screen.</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{/* Theme Mode */}
				<div className="p-6 bg-[#eeeeee] dark:bg-slate-800 rounded-xl space-y-4">
					<h3 className="text-sm font-bold text-[#1a1c1c] dark:text-white flex items-center gap-2">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#005faa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
							<path d="M21 13.2A8.5 8.5 0 1 1 10.8 3 6.8 6.8 0 0 0 21 13.2z" />
						</svg>
						Theme Mode
					</h3>
					<div className="flex gap-3">
						<ThemeButton label="Light"  active={themeMode === "light"}  preview="bg-slate-100"                              onClick={() => applyTheme("light")} />
						<ThemeButton label="Dark"   active={themeMode === "dark"}   preview="bg-slate-800"                              onClick={() => applyTheme("dark")} />
						<ThemeButton label="System" active={themeMode === "system"} preview="bg-gradient-to-r from-slate-100 to-slate-800" onClick={() => applyTheme("system")} />
					</div>
				</div>

				{/* Typography */}
				<div className="p-6 bg-[#eeeeee] dark:bg-slate-800 rounded-xl space-y-4">
					<h3 className="text-sm font-bold text-[#1a1c1c] dark:text-white flex items-center gap-2">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#005faa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
							<path d="M4 7h16M4 12h10M4 17h7" />
						</svg>
						Typography
					</h3>
					<div className="space-y-3">
						<div className="flex justify-between items-center">
							<span className="text-xs text-[#404752] dark:text-slate-400">Font Size</span>
							<span className="text-xs font-bold text-[#1a1c1c] dark:text-white">{fontSize}px</span>
						</div>
						<input
							type="range"
							min="12"
							max="20"
							value={fontSize}
							onChange={(e) => setFontSize(Number(e.target.value))}
							className="w-full h-1 bg-[#c0c7d4] rounded-lg appearance-none cursor-pointer accent-[#005faa]"
						/>
						<div className="flex justify-between text-[10px] font-bold text-[#404752]/50 dark:text-slate-500">
							<span>SMALL</span>
							<span>NORMAL</span>
							<span>LARGE</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function SectionNotifications() {
	const [items, setItems] = useState([
		{ key: "mentions",  label: "Direct Mentions",       note: "Notify me when someone @mentions me",    enabled: true },
		{ key: "dms",       label: "Direct Messages",       note: "Notify me for all direct messages",      enabled: true },
		{ key: "channels",  label: "Channel Activity",      note: "Notify for messages in followed channels", enabled: false },
		{ key: "sounds",    label: "Notification Sounds",   note: "Play a sound for new notifications",     enabled: true },
	]);

	function toggle(key) {
		setItems((prev) => prev.map((item) => item.key === key ? { ...item, enabled: !item.enabled } : item));
	}

	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-3xl font-extrabold tracking-tight text-[#1a1c1c] dark:text-white mb-2">Notifications</h2>
				<p className="text-[#404752] dark:text-slate-400 text-sm">Control how and when you receive notifications.</p>
			</div>

			<div className="bg-[#f3f3f3] dark:bg-slate-800/60 rounded-xl overflow-hidden">
				{items.map((item, idx) => (
					<div
						key={item.key}
						className={`flex items-center justify-between p-4 hover:bg-[#e8e8e8] dark:hover:bg-slate-700/50 transition-colors ${idx < items.length - 1 ? "border-b border-[#c0c7d4]/10" : ""}`}
					>
						<div>
							<p className="font-medium text-sm text-[#1a1c1c] dark:text-white">{item.label}</p>
							<p className="text-xs text-[#404752] dark:text-slate-400 mt-0.5">{item.note}</p>
						</div>
						<button
							type="button"
							onClick={() => toggle(item.key)}
							aria-checked={item.enabled}
							role="switch"
							className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${item.enabled ? "bg-[#005faa]" : "bg-[#e2e2e2] dark:bg-slate-600"}`}
						>
							<span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${item.enabled ? "translate-x-6" : "translate-x-1"}`} />
						</button>
					</div>
				))}
			</div>
		</div>
	);
}

function SectionShortcuts() {
	const shortcuts = [
		{ action: "Jump to search",          keys: ["Ctrl", "K"] },
		{ action: "New direct message",      keys: ["Ctrl", "Shift", "K"] },
		{ action: "Toggle sidebar",          keys: ["Ctrl", "\\"] },
		{ action: "Mark all as read",        keys: ["Esc"] },
		{ action: "Toggle text-to-speech",   keys: ["Alt", "Z"] },
		{ action: "Switch to next channel",  keys: ["Alt", "↓"] },
		{ action: "Switch to prev channel",  keys: ["Alt", "↑"] },
	];

	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-3xl font-extrabold tracking-tight text-[#1a1c1c] dark:text-white mb-2">Keyboard Shortcuts</h2>
				<p className="text-[#404752] dark:text-slate-400 text-sm">Quick actions available throughout the workspace.</p>
			</div>

			<div className="bg-[#f3f3f3] dark:bg-slate-800/60 rounded-xl overflow-hidden">
				{shortcuts.map((item, idx) => (
					<div
						key={item.action}
						className={`flex items-center justify-between px-5 py-3.5 hover:bg-[#e8e8e8] dark:hover:bg-slate-700/50 transition-colors ${idx < shortcuts.length - 1 ? "border-b border-[#c0c7d4]/10" : ""}`}
					>
						<span className="text-sm text-[#1a1c1c] dark:text-white">{item.action}</span>
						<div className="flex items-center gap-1">
							{item.keys.map((key, ki) => (
								<React.Fragment key={key}>
									{ki > 0 && <span className="text-xs text-[#404752] dark:text-slate-400">+</span>}
									<kbd className="px-2 py-0.5 rounded bg-white dark:bg-slate-700 font-mono text-xs border border-[#c0c7d4]/30 dark:border-slate-600 shadow-sm text-[#1a1c1c] dark:text-white">{key}</kbd>
								</React.Fragment>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function SectionAbout() {
	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-3xl font-extrabold tracking-tight text-[#1a1c1c] dark:text-white mb-2">About</h2>
				<p className="text-[#404752] dark:text-slate-400 text-sm">Version and legal information.</p>
			</div>

			{/* Version card */}
			<div className="flex items-center justify-between bg-[#f3f3f3] dark:bg-slate-800/60 p-8 rounded-2xl">
				<div className="flex items-center gap-6">
					<div className="w-16 h-16 bg-gradient-to-br from-[#005faa] to-[#0078d4] rounded-2xl flex items-center justify-center text-white shadow-xl">
						<span className="text-3xl font-black select-none">S</span>
					</div>
					<div>
						<h3 className="text-xl font-bold text-[#1a1c1c] dark:text-white">Spann for Desktop</h3>
						<p className="text-sm text-[#404752] dark:text-slate-400">Version 1.0.0 (Build 2405)</p>
						<p className="text-[11px] text-[#404752]/60 dark:text-slate-500 mt-1">© 2024 Spann Technologies Inc. All rights reserved.</p>
					</div>
				</div>
				<button
					type="button"
					className="px-5 py-2 text-sm font-bold text-[#005faa] hover:bg-[#005faa]/5 rounded-lg border border-[#005faa]/20 transition-colors"
				>
					Check for Updates
				</button>
			</div>

			{/* Links */}
			<div className="grid grid-cols-3 gap-4">
				{["Release Notes", "Privacy Policy", "Terms of Service"].map((link) => (
					<a
						key={link}
						href="#"
						className="p-4 bg-[#eeeeee] dark:bg-slate-800 rounded-xl text-center hover:bg-[#e8e8e8] dark:hover:bg-slate-700 transition-colors"
					>
						<span className="text-xs font-bold text-[#1a1c1c] dark:text-white">{link}</span>
					</a>
				))}
			</div>
		</div>
	);
}

// ─── main component ───────────────────────────────────────────────────────────

export default function SettingsView({ authState, onLogout }) {
	const [activeSection, setActiveSection] = useState("profile");

	function renderContent() {
		switch (activeSection) {
			case "profile":       return <SectionProfile authState={authState} />;
			case "appearance":    return <SectionAppearance />;
			case "notifications": return <SectionNotifications />;
			case "shortcuts":     return <SectionShortcuts />;
			case "about":         return <SectionAbout />;
			default:              return <SectionProfile authState={authState} />;
		}
	}

	return (
		<div className="view-transition flex h-full min-h-screen">
			{/* Inner settings sidebar */}
			<aside
				className="w-56 shrink-0 flex flex-col p-4 gap-1 border-r border-[#c0c7d4]/20 dark:border-slate-700/40"
				style={{ background: "rgba(249,249,249,0.7)", backdropFilter: "blur(20px)" }}
			>
				<div className="px-3 py-4">
					<h2 className="text-xs font-bold uppercase tracking-widest text-[#404752]/60 dark:text-slate-500">
						System Settings
					</h2>
				</div>

				<nav className="flex-1 space-y-0.5">
					{SECTIONS.map(({ key, label, Icon: SectionIcon }) => (
						<button
							key={key}
							type="button"
							onClick={() => setActiveSection(key)}
							className={[
								"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150",
								activeSection === key
									? "bg-white/80 dark:bg-slate-800/80 text-[#005faa] dark:text-blue-400 font-semibold shadow-sm"
									: "text-slate-600 dark:text-slate-400 hover:bg-slate-200/40 dark:hover:bg-slate-800/40",
							].join(" ")}
						>
							<SectionIcon />
							<span className="text-[13px]">{label}</span>
						</button>
					))}
				</nav>

				{/* Sign Out at bottom */}
				<div className="pt-4 border-t border-[#c0c7d4]/10 dark:border-slate-700/40">
					<button
						type="button"
						onClick={onLogout}
						className="w-full flex items-center gap-3 px-3 py-2.5 text-[#ba1a1a] hover:bg-[#ffdad6]/30 dark:hover:bg-red-900/20 rounded-lg transition-all duration-150"
					>
						<LogoutIcon />
						<span className="text-[13px] font-medium">Sign Out</span>
					</button>
				</div>
			</aside>

			{/* Main content area */}
			<main className="flex-1 overflow-y-auto p-8 lg:p-12">
				<div className="max-w-3xl mx-auto">
					{renderContent()}
				</div>
			</main>
		</div>
	);
}
