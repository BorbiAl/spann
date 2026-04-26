import React, { useEffect, useMemo, useState } from "react";
import { useUserSettingsStore } from "../store/userSettings";

const COLOR_BLIND_OPTIONS = ["Normal", "Deuter", "Protan", "Tritan"];

// Language options for the preferred_language field (AI explanation target)
const LANGUAGE_OPTIONS = [
	{ value: "en", label: "English" },
	{ value: "es", label: "Español" },
	{ value: "fr", label: "Français" },
	{ value: "de", label: "Deutsch" },
	{ value: "pt", label: "Português" },
	{ value: "it", label: "Italiano" },
	{ value: "ja", label: "日本語" },
	{ value: "zh", label: "中文" },
	{ value: "ko", label: "한국어" },
	{ value: "ar", label: "العربية" },
	{ value: "bg", label: "Български" },
	{ value: "tr", label: "Türkçe" },
];

function Toggle({ checked, onChange, ariaLabel }) {
	return (
		<button
			type="button"
			onClick={() => onChange(!checked)}
			aria-label={ariaLabel}
			aria-pressed={checked}
			className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
				checked ? "bg-primary" : "bg-surface-container-highest"
			}`}
		>
			<span
				className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
					checked ? "translate-x-6" : "translate-x-1"
				}`}
			/>
		</button>
	);
}

function SettingRow({ icon, title, description, right }) {
	return (
		<div className="flex items-center justify-between p-4 hover:bg-surface-container-high transition-colors">
			<div className="flex items-center gap-4">
				<span className="material-symbols-outlined text-on-surface-variant">{icon}</span>
				<div>
					<p className="font-medium text-on-surface">{title}</p>
					<p className="text-xs text-on-surface-variant">{description}</p>
				</div>
			</div>
			{right}
		</div>
	);
}

export default function AccessibilityView({ preferences, onChangePreference, saveState }) {
	// User settings store — reading/intelligence settings backed by the API
	const { settings: userSettings, updateSetting, isSaving: isSettingsSaving } = useUserSettingsStore();

	const normalizedPreferences = useMemo(
		() => ({
			dyslexia: Boolean(preferences?.dyslexia),
			highContrast: Boolean(preferences?.highContrast),
			simplified: Boolean(preferences?.simplified),
			tts: Boolean(preferences?.tts),
			fontSize: Number(preferences?.fontSize || 15),
			colorBlind: preferences?.colorBlind || "Normal"
		}),
		[preferences]
	);

	const [draft, setDraft] = useState(normalizedPreferences);

	useEffect(() => {
		setDraft(normalizedPreferences);
	}, [normalizedPreferences]);

	useEffect(() => {
		function onHotkey(event) {
			if (event.altKey && (event.key === "z" || event.key === "Z")) {
				event.preventDefault();
				setDraft((current) => ({ ...current, tts: !current.tts }));
			}
		}

		window.addEventListener("keydown", onHotkey);
		return () => window.removeEventListener("keydown", onHotkey);
	}, []);

	const dyslexia = draft.dyslexia;
	const highContrast = draft.highContrast;
	const simplified = draft.simplified;
	const tts = draft.tts;
	const fontSize = draft.fontSize;
	const colorBlind = draft.colorBlind;

	const colorBlindFilters = {
		Normal: "none",
		Deuter: "saturate(0.9) hue-rotate(-14deg)",
		Protan: "saturate(0.85) hue-rotate(18deg)",
		Tritan: "saturate(0.85) hue-rotate(58deg)"
	};

	const previewTitle = simplified
		? "Design updates are easier to understand."
		: "The future of collaborative design is here.";
	const previewBody = simplified
		? "Spann helps your team communicate clearly in every channel."
		: "Spann allows your team to communicate across different modalities without friction. Our new accessibility engine ensures every voice is heard and every message is understood clearly.";

	const percent = Math.round((fontSize / 16) * 100);

	const hasChanges =
		draft.dyslexia !== normalizedPreferences.dyslexia ||
		draft.highContrast !== normalizedPreferences.highContrast ||
		draft.simplified !== normalizedPreferences.simplified ||
		draft.tts !== normalizedPreferences.tts ||
		draft.fontSize !== normalizedPreferences.fontSize ||
		draft.colorBlind !== normalizedPreferences.colorBlind;

	const statusText = hasChanges
		? "Unsaved accessibility changes."
		: saveState === "saving"
		? "Saving accessibility settings..."
		: saveState === "saved"
		? "Accessibility settings saved and active."
		: "Accessibility settings are synced.";

	function updateDraft(key, value) {
		setDraft((current) => ({
			...current,
			[key]: value
		}));
	}

	function cycleColorMode() {
		const currentIndex = COLOR_BLIND_OPTIONS.indexOf(colorBlind);
		const next = COLOR_BLIND_OPTIONS[(currentIndex + 1) % COLOR_BLIND_OPTIONS.length];
		updateDraft("colorBlind", next);
	}

	function handleDiscard() {
		setDraft(normalizedPreferences);
	}

	function handleApplyChanges() {
		if (!hasChanges) {
			return;
		}

		if (draft.dyslexia !== normalizedPreferences.dyslexia) {
			onChangePreference("dyslexia", draft.dyslexia);
		}
		if (draft.highContrast !== normalizedPreferences.highContrast) {
			onChangePreference("highContrast", draft.highContrast);
		}
		if (draft.simplified !== normalizedPreferences.simplified) {
			onChangePreference("simplified", draft.simplified);
		}
		if (draft.tts !== normalizedPreferences.tts) {
			onChangePreference("tts", draft.tts);
		}
		if (draft.fontSize !== normalizedPreferences.fontSize) {
			onChangePreference("fontSize", draft.fontSize);
		}
		if (draft.colorBlind !== normalizedPreferences.colorBlind) {
			onChangePreference("colorBlind", draft.colorBlind);
		}
	}

	return (
		<div className="h-full overflow-y-auto bg-surface p-8 w-full view-transition">
			<div>
				<header className="mb-10">
					<h1 className="text-3xl font-bold tracking-tight text-on-surface mb-2">Accessibility Settings</h1>
					<p className="text-on-surface-variant max-w-2xl">Make Spann easier to see, hear, and use.</p>
				</header>

				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
					<div className="lg:col-span-7 space-y-8">
						<section className="space-y-4">
							<div className="flex items-center gap-2 px-2">
								<span className="material-symbols-outlined text-primary">visibility</span>
								<h3 className="font-semibold text-on-surface">Visual Enhancements</h3>
							</div>
							<div className="bg-surface-container-low rounded-xl overflow-hidden">
									<SettingRow
									icon="font_download"
									title="Dyslexia Font"
									description="Uses OpenDyslexic for better readability."
										right={<Toggle checked={dyslexia} onChange={(value) => updateDraft("dyslexia", value)} ariaLabel="Toggle dyslexia font" />}
								/>
								<SettingRow
									icon="contrast"
									title="High Contrast Mode"
									description="Increases text contrast against backgrounds."
										right={<Toggle checked={highContrast} onChange={(value) => updateDraft("highContrast", value)} ariaLabel="Toggle high contrast mode" />}
								/>
								<SettingRow
									icon="palette"
									title="Color Blind Modes"
									description="Adjust colors for Protanopia, Deuteranopia, or Tritanopia."
									right={
										<button type="button" onClick={cycleColorMode} className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors" aria-label="Cycle color blind mode">
											<span className="text-xs font-semibold">{colorBlind}</span>
											<span className="material-symbols-outlined">chevron_right</span>
										</button>
									}
								/>
							</div>
						</section>

						<section className="space-y-4">
							<div className="flex items-center gap-2 px-2">
								<span className="material-symbols-outlined text-primary">menu_book</span>
								<h3 className="font-semibold text-on-surface">Cognitive &amp; Reading</h3>
							</div>
							<div className="bg-surface-container-low rounded-xl overflow-hidden">
								<SettingRow
									icon="auto_stories"
									title="Simplified Language"
									description="Reduces complex terminology in system messages."
										right={<Toggle checked={simplified} onChange={(value) => updateDraft("simplified", value)} ariaLabel="Toggle simplified language" />}
								/>
								<SettingRow
									icon="record_voice_over"
									title="Text-to-Speech"
									description="Read messages aloud using high-quality neutral voices."
										right={<Toggle checked={tts} onChange={(value) => updateDraft("tts", value)} ariaLabel="Toggle text to speech" />}
								/>
							</div>
						</section>

						{/* ── Message Intelligence ──────────────────────────── */}
						<section className="space-y-4">
							<div className="flex items-center gap-2 px-2">
								<span className="material-symbols-outlined text-primary">auto_awesome</span>
								<h3 className="font-semibold text-on-surface">Message Intelligence</h3>
								{isSettingsSaving && (
									<span className="ml-auto text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant opacity-60">
										Saving…
									</span>
								)}
							</div>
							<div className="bg-surface-container-low rounded-xl overflow-hidden divide-y divide-outline-variant/10">
								{/* Reading Level */}
								<SettingRow
									icon="menu_book"
									title="Reading Level"
									description="Controls how messages are simplified by AI."
									right={
										<div className="flex items-center gap-1 rounded-full bg-surface-container-high border border-outline-variant/20 p-0.5">
											{(["standard", "simple"]).map((level) => (
												<button
													key={level}
													type="button"
													onClick={() => updateSetting("reading_level", level)}
													className={[
														"px-3 py-1 rounded-full text-[11px] font-semibold capitalize transition-colors",
														userSettings.reading_level === level
															? "bg-primary text-on-primary shadow-sm"
															: "text-on-surface-variant hover:text-on-surface",
													].join(" ")}
												>
													{level === "simple" ? "Simple" : "Standard"}
												</button>
											))}
										</div>
									}
								/>

								{/* Auto-Simplify */}
								<SettingRow
									icon="auto_fix_high"
									title="Auto-Simplify Messages"
									description="Show simplified text by default for incoming messages."
									right={
										<Toggle
											checked={userSettings.auto_simplify}
											onChange={(v) => updateSetting("auto_simplify", v)}
											ariaLabel="Toggle auto-simplify"
										/>
									}
								/>

								{/* Preferred Language */}
								<SettingRow
									icon="translate"
									title="Explanation Language"
									description="Language used when AI explains idioms and context."
									right={
										<select
											value={userSettings.preferred_language}
											onChange={(e) => updateSetting("preferred_language", e.target.value)}
											className="bg-surface-container border border-outline-variant/20 rounded-lg px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
										>
											{LANGUAGE_OPTIONS.map(({ value, label }) => (
												<option key={value} value={value}>{label}</option>
											))}
										</select>
									}
								/>

								{/* TTS Auto-Play */}
								<SettingRow
									icon="volume_up"
									title="TTS Auto-Play"
									description="Automatically read new messages aloud as they arrive."
									right={
										<Toggle
											checked={userSettings.tts_auto_play}
											onChange={(v) => updateSetting("tts_auto_play", v)}
											ariaLabel="Toggle TTS auto-play"
										/>
									}
								/>
							</div>
						</section>

						<section className="space-y-4">
							<div className="flex items-center gap-2 px-2">
								<span className="material-symbols-outlined text-primary">format_size</span>
								<h3 className="font-semibold text-on-surface">Text Size</h3>
							</div>
							<div className="bg-surface-container-low rounded-xl p-6 space-y-6">
								<div className="flex items-center gap-4">
									<span className="text-xs font-bold text-on-surface-variant">A</span>
									<input
										type="range"
										min="13"
										max="22"
										value={fontSize}
										onChange={(event) => updateDraft("fontSize", Number(event.target.value))}
										className="flex-1 accent-primary"
									/>
									<span className="text-xl font-bold text-on-surface-variant">A</span>
								</div>
								<p className="text-center text-sm text-on-surface-variant">
									Currently set to <span className="text-primary font-bold">{percent}% ({percent >= 125 ? "Large" : "Standard"})</span>
								</p>
							</div>
						</section>
					</div>

					<div className="lg:col-span-5">
						<div className="lg:sticky lg:top-6 space-y-6">
							<div
								className="bg-surface-container-lowest rounded-2xl shadow-xl shadow-on-surface/5 overflow-hidden border border-outline-variant/10"
								style={{ filter: colorBlindFilters[colorBlind] }}
							>
								<div className="bg-gradient-to-br from-primary to-primary-container p-4 flex items-center gap-3">
									<div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
										<span className="material-symbols-outlined text-sm">preview</span>
									</div>
									<span className="text-white font-medium text-sm">Live Preview</span>
								</div>
								<div className="p-8 space-y-6">
									<div className="flex items-start gap-4">
										<div className="w-12 h-12 rounded-full overflow-hidden bg-surface-container flex-shrink-0">
											<img
												alt="Preview User"
												className="w-full h-full object-cover"
												src="https://lh3.googleusercontent.com/aida-public/AB6AXuAkvuKlsBcunjuKFf7IsHe3HHKFacmqiluiRtW3iPrOnSBQ5zOrV8WdrWjuuRmMbml7g_pZnIQyuj_yOzUNx70gM9H969678lUSFrTfY0ZgMY_mvJW7BeK4fobwFBVEhfc6hKbfSiteFhMnkHMLGnDw3mOvkcBACOMU6L8BCjISKZEiddn3c7SXRP0CNhcONZlkg3S5f6wjOvAi2Wi_sZKrV3VB-T8iTpJvGPkKDavNXxpS28MKSyxe96ZnHSfUvBR6xZdQyrcDPhJF"
											/>
										</div>
										<div className="space-y-2">
											<p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Workspace Update</p>
											<h4 className="text-xl font-bold leading-snug" style={{ fontFamily: dyslexia ? "OpenDyslexic, Inter, sans-serif" : "Inter, sans-serif" }}>
												{previewTitle}
											</h4>
											<p className="text-base leading-relaxed text-on-surface-variant" style={{ fontWeight: highContrast ? 600 : 400 }}>
												{previewBody}
											</p>
										</div>
									</div>
									<div className="pt-6 border-t border-outline-variant/20 flex justify-end gap-2">
										<button
											type="button"
											onClick={handleDiscard}
											disabled={!hasChanges}
											className="px-4 py-2 rounded-lg bg-surface-container-highest text-sm font-semibold hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
										>
											Discard
										</button>
										<button
											type="button"
											onClick={handleApplyChanges}
											disabled={!hasChanges || saveState === "saving"}
											className="px-6 py-2 rounded-lg bg-gradient-to-br from-primary to-primary-container text-white text-sm font-semibold shadow-md shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
										>
											Apply Changes
										</button>
									</div>
									<p className="text-xs text-on-surface-variant">{statusText}</p>
								</div>
							</div>

							<div className="p-6 bg-tertiary-fixed text-on-tertiary-fixed rounded-xl border border-on-tertiary-fixed-variant/10">
								<div className="flex items-center gap-3 mb-2">
									<span className="material-symbols-outlined text-on-tertiary-fixed-variant">lightbulb</span>
									<h5 className="font-bold">Pro Tip</h5>
								</div>
								<p className="text-sm opacity-90">
									Press <kbd className="px-1.5 py-0.5 rounded bg-white/50 font-mono text-xs border border-on-tertiary-fixed-variant/20">Alt + Z</kbd> to toggle Text-to-Speech anywhere in the application.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
