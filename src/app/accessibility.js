export const ACCESSIBILITY_PREFS_KEY = "spann-accessibility-preferences";
export const ACCESSIBILITY_PREFS_EVENT = "spann-accessibility-updated";

export const DEFAULT_ACCESSIBILITY_PREFS = {
	dyslexia: false,
	highContrast: false,
	simplified: false,
	tts: false,
	fontSize: 15,
	colorBlind: "Normal",
	micJoined: false,
};

export function normalizeAccessibilityPreferences(rawPreferences) {
	const raw = rawPreferences && typeof rawPreferences === "object" ? rawPreferences : {};
	return {
		...DEFAULT_ACCESSIBILITY_PREFS,
		...raw,
		fontSize: Math.max(13, Math.min(22, Number(raw?.fontSize || DEFAULT_ACCESSIBILITY_PREFS.fontSize))),
		colorBlind: String(raw?.colorBlind || DEFAULT_ACCESSIBILITY_PREFS.colorBlind),
	};
}

export function loadAccessibilityPreferencesGlobal() {
	try {
		const raw = localStorage.getItem(ACCESSIBILITY_PREFS_KEY);
		if (!raw) {
			return { ...DEFAULT_ACCESSIBILITY_PREFS };
		}
		return normalizeAccessibilityPreferences(JSON.parse(raw));
	} catch {
		return { ...DEFAULT_ACCESSIBILITY_PREFS };
	}
}

export function applyAccessibilityPreferencesGlobal(rawPreferences) {
	if (typeof document === "undefined") {
		return;
	}

	const preferences = normalizeAccessibilityPreferences(rawPreferences);
	const root = document.documentElement;
	const body = document.body;
	const fontSize = Number(preferences.fontSize || DEFAULT_ACCESSIBILITY_PREFS.fontSize);
	const colorBlind = String(preferences.colorBlind || DEFAULT_ACCESSIBILITY_PREFS.colorBlind);

	const colorBlindFilters = {
		Normal: "none",
		Deuter: "saturate(0.92) hue-rotate(-12deg)",
		Protan: "saturate(0.86) hue-rotate(16deg)",
		Tritan: "saturate(0.86) hue-rotate(52deg)",
	};
	const colorBlindFilter = colorBlindFilters[colorBlind] || "none";
	const highContrastFilter = preferences.highContrast ? "contrast(1.18) saturate(0.92)" : "";
	const combinedFilter = [colorBlindFilter !== "none" ? colorBlindFilter : "", highContrastFilter]
		.filter(Boolean)
		.join(" ");

	const textScale = Math.max(0.88, Math.min(1.5, fontSize / 15));
	root.style.setProperty("--body-size", `${fontSize}px`);
	root.style.setProperty("--a11y-text-scale", String(textScale));
	root.style.setProperty("--a11y-color-filter", combinedFilter || "none");
	root.style.fontSize = `${Math.round(textScale * 100)}%`;

	body.classList.toggle("a11y-dyslexia", Boolean(preferences.dyslexia));
	body.classList.toggle("a11y-high-contrast", Boolean(preferences.highContrast));
	body.classList.toggle("a11y-simplified", Boolean(preferences.simplified));
	body.classList.toggle("a11y-cognitive-reading", Boolean(preferences.simplified));
	body.classList.toggle("a11y-colorblind", colorBlind !== "Normal");
	body.classList.toggle("a11y-tts", Boolean(preferences.tts));
}

export function persistAccessibilityPreferencesGlobal(rawPreferences) {
	const normalized = normalizeAccessibilityPreferences(rawPreferences);
	localStorage.setItem(ACCESSIBILITY_PREFS_KEY, JSON.stringify(normalized));
	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent(ACCESSIBILITY_PREFS_EVENT));
	}
	return normalized;
}
