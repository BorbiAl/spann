import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

export function useTheme() {
	return useContext(ThemeContext);
}

export default function ThemeProvider({ children }) {
	const [theme, setTheme] = useState(() => {
		const saved = localStorage.getItem("spann-theme");
		if (saved === "dark" || saved === "light" || saved === "system") {
			return saved;
		}

		if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
			return "dark";
		}
		return "light";
	});
	const [forcedTheme, setForcedTheme] = useState(null);
	const [systemTheme, setSystemTheme] = useState(() => {
		if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
			return "dark";
		}
		return "light";
	});
	const resolvedTheme = forcedTheme || (theme === "system" ? systemTheme : theme);

	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) {
			return undefined;
		}

		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = (event) => {
			setSystemTheme(event.matches ? "dark" : "light");
		};

		setSystemTheme(media.matches ? "dark" : "light");
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, []);

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", resolvedTheme);
		document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
	}, [resolvedTheme]);

	useEffect(() => {
		localStorage.setItem("spann-theme", theme);
	}, [theme]);

	const value = useMemo(
		() => ({
			theme,
			resolvedTheme,
			forcedTheme,
			setForcedTheme,
			setTheme,
			toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark"))
		}),
		[theme, resolvedTheme, forcedTheme]
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
