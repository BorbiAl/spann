import React, { useState } from "react";
import { useTheme } from "../app/ThemeProvider";

const NAV_ITEMS = [
	{ key: "profile", label: "Profile", icon: "person", href: "#profile" },
	{ key: "appearance", label: "Appearance", icon: "palette", href: "#appearance" },
	{ key: "notifications", label: "Notifications", icon: "notifications", href: "#" },
	{ key: "shortcuts", label: "Keyboard Shortcuts", icon: "keyboard", href: "#" },
	{ key: "about", label: "About", icon: "info", href: "#about" }
];

function ThemeChoice({ active, label, previewClassName, onClick, darkLabel }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={[
				"flex-1 p-3 rounded-lg border flex flex-col items-center gap-2 transition-all",
				active
					? "border-2 border-primary bg-surface-container-lowest"
					: "border-outline-variant/30 bg-surface-container-high hover:bg-surface-container-highest"
			].join(" ")}
		>
			<div className={`w-full h-8 rounded-sm ${previewClassName}`} />
			<span className={`text-[11px] font-bold ${darkLabel ? "text-white" : "text-on-surface"}`}>{label}</span>
		</button>
	);
}

export default function SettingsView({ authState, onLogout }) {
	const { theme, toggleTheme } = useTheme();
	const [activeSection, setActiveSection] = useState("profile");
	const [fontSize, setFontSize] = useState(14);
	const [saved, setSaved] = useState(false);
	const [themeMode, setThemeMode] = useState(theme === "dark" ? "dark" : "light");

	const [displayName, setDisplayName] = useState(
		authState?.user?.display_name || authState?.user?.name || "Alex Sterling"
	);
	const [email, setEmail] = useState(
		authState?.user?.email || authState?.email || "alex.sterling@spann.io"
	);

	function handleSave(event) {
		event.preventDefault();
		setSaved(true);
		setTimeout(() => setSaved(false), 1800);
	}

	function applyThemeMode(mode) {
		setThemeMode(mode);
		if (mode === "system") {
			return;
		}
		if ((mode === "dark") !== (theme === "dark")) {
			toggleTheme();
		}
	}

	return (
		<div className="h-full overflow-y-auto bg-surface p-8 w-full view-transition">
			<div className="flex min-h-full overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-lowest">
			<aside className="h-full w-64 border-r border-outline-variant/20 flex flex-col p-4 gap-2 bg-surface/70 backdrop-blur-xl">
				<div className="px-3 py-4">
					<h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/60">System Settings</h2>
				</div>

				<nav className="flex-1 space-y-1">
					{NAV_ITEMS.map((item) => {
						const active = activeSection === item.key;
						return (
							<a
								key={item.key}
								href={item.href}
								onClick={() => setActiveSection(item.key)}
								className={[
									"flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer",
									active
										? "bg-white/80 dark:bg-slate-800/80 text-blue-700 dark:text-blue-300 font-semibold shadow-sm"
										: "text-slate-600 dark:text-slate-400 hover:bg-slate-200/40 dark:hover:bg-slate-800/40"
								].join(" ")}
							>
								<span className="material-symbols-outlined" style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>
									{item.icon}
								</span>
								<span className="text-[13px]">{item.label}</span>
							</a>
						);
					})}
				</nav>

				<div className="pt-4 border-t border-outline-variant/10">
					<button
						type="button"
						onClick={onLogout}
						className="w-full flex items-center gap-3 px-3 py-2.5 text-error hover:bg-error-container/20 rounded-lg transition-all duration-200 cursor-pointer active:opacity-80"
					>
						<span className="material-symbols-outlined">logout</span>
						<span className="text-[13px] font-medium">Sign Out</span>
					</button>
				</div>
			</aside>

			<main className="flex-1 overflow-y-auto p-8 lg:p-12 bg-surface">
				<div className="max-w-4xl mx-auto space-y-12">
					<section id="profile" className="space-y-8">
						<div>
							<h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-2">Profile Settings</h1>
							<p className="text-on-surface-variant text-sm">Manage your personal information and security preferences.</p>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
							<div className="col-span-1 bg-surface-container-lowest p-6 rounded-xl shadow-sm border border-outline-variant/10 flex flex-col items-center text-center">
								<div className="relative group">
									<img
										alt="Profile Avatar"
										className="w-32 h-32 rounded-full object-cover border-4 border-primary/10 group-hover:opacity-90 transition-opacity"
										src="https://lh3.googleusercontent.com/aida-public/AB6AXuDqSIGeFX_Jqrx7s24ANoPSbanKbS5J4eAIlPdLu9g8JSTjHzt_RBHY3DcqYa-8I8u4XkgsfFxJMrOeUDUX5F1ea53iwFcw7wLHbul6dIBZWZooO1FPOD9O6zizWk4TBf8rrJkZbjnLt3W39-WApRGT2w5_HBp6LLrr1L2msFfAM1agz6GaIA2P-RTVnU_PTLCnoVAiK0zeXoPw9A_zYxaphcrkfLZjzhah-tNIkvl9UZ62bm6T8ELWA6agwm8FVIuNr85hC5o5pwOv"
									/>
									<button type="button" className="absolute bottom-1 right-1 bg-primary text-on-primary p-2 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform" aria-label="Edit profile">
										<span className="material-symbols-outlined text-sm">edit</span>
									</button>
								</div>
								<h3 className="mt-4 font-bold text-lg">{displayName || "Alex Sterling"}</h3>
								<p className="text-xs text-on-surface-variant font-medium uppercase tracking-wider">Premium Member</p>
							</div>

							<form className="col-span-2 space-y-6" onSubmit={handleSave}>
								<div className="space-y-4">
									<div className="grid grid-cols-1 gap-1">
										<label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest px-1" htmlFor="settings-display-name">Display Name</label>
										<input id="settings-display-name" className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none" type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
									</div>
									<div className="grid grid-cols-1 gap-1">
										<label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest px-1" htmlFor="settings-email">Email Address</label>
										<input id="settings-email" className="w-full bg-surface-container-low border-none rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
									</div>
								</div>
								<div className="pt-4 flex flex-wrap gap-4">
									<button type="submit" className="px-6 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary font-semibold rounded-lg shadow-md hover:shadow-lg active:scale-95 transition-all text-sm">
										{saved ? "Saved ✓" : "Save Changes"}
									</button>
									<button type="button" className="px-6 py-2.5 bg-surface-container-highest text-on-surface-variant font-semibold rounded-lg hover:bg-surface-variant active:scale-95 transition-all text-sm flex items-center gap-2">
										<span className="material-symbols-outlined text-sm">lock</span>
										Change Password
									</button>
								</div>
							</form>
						</div>
					</section>

					<section id="appearance" className="space-y-8 pt-12 border-t border-outline-variant/10">
						<div>
							<h2 className="text-2xl font-bold tracking-tight text-on-surface mb-2">Appearance</h2>
							<p className="text-on-surface-variant text-sm">Customize how Spann looks on your screen.</p>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div className="p-6 bg-surface-container rounded-xl space-y-4">
								<h3 className="text-sm font-bold flex items-center gap-2">
									<span className="material-symbols-outlined text-primary">dark_mode</span>
									Theme Mode
								</h3>
								<div className="flex gap-3">
									<ThemeChoice
										active={themeMode === "light"}
										label="Light"
										previewClassName="bg-slate-100"
										onClick={() => applyThemeMode("light")}
									/>
									<ThemeChoice
										active={themeMode === "dark"}
										label="Dark"
										previewClassName="bg-slate-800"
										onClick={() => applyThemeMode("dark")}
										darkLabel
									/>
									<ThemeChoice
										active={themeMode === "system"}
										label="System"
										previewClassName="bg-gradient-to-r from-slate-100 to-slate-800"
										onClick={() => applyThemeMode("system")}
									/>
								</div>
							</div>

							<div className="p-6 bg-surface-container rounded-xl space-y-4">
								<h3 className="text-sm font-bold flex items-center gap-2">
									<span className="material-symbols-outlined text-primary">text_fields</span>
									Typography
								</h3>
								<div className="space-y-4">
									<div className="flex justify-between items-center">
										<span className="text-xs text-on-surface-variant">Font Size</span>
										<span className="text-xs font-bold">{fontSize}px</span>
									</div>
									<input
										type="range"
										min="12"
										max="20"
										value={fontSize}
										onChange={(event) => setFontSize(Number(event.target.value))}
										className="w-full h-1 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary"
									/>
									<div className="flex justify-between text-[10px] font-bold text-on-surface-variant/50">
										<span>SMALL</span>
										<span>NORMAL</span>
										<span>LARGE</span>
									</div>
								</div>
							</div>
						</div>
					</section>

					<section id="about" className="space-y-6 pt-12 border-t border-outline-variant/10 pb-20">
						<div className="flex items-center justify-between bg-surface-container-low p-8 rounded-2xl">
							<div className="flex items-center gap-6">
								<div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-container rounded-2xl flex items-center justify-center text-white shadow-xl">
									<span className="text-3xl font-black">S</span>
								</div>
								<div>
									<h3 className="text-xl font-bold">Spann for Desktop</h3>
									<p className="text-sm text-on-surface-variant">Version 1.0.0 (Build 2405)</p>
									<p className="text-[11px] text-on-surface-variant/60 mt-1">© 2024 Spann Technologies Inc. All rights reserved.</p>
								</div>
							</div>
							<button type="button" className="px-5 py-2 text-sm font-bold text-primary hover:bg-primary/5 rounded-lg border border-primary/20 transition-colors">
								Check for Updates
							</button>
						</div>

						<div className="grid grid-cols-3 gap-4">
							{["Release Notes", "Privacy Policy", "Terms of Service"].map((label) => (
								<a key={label} href="#" className="p-4 bg-surface-container rounded-xl text-center hover:bg-surface-container-high transition-colors">
									<span className="text-xs font-bold">{label}</span>
								</a>
							))}
						</div>
					</section>
				</div>
			</main>
			</div>
		</div>
	);
}
