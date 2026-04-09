import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

export function useTheme() {
	return useContext(ThemeContext);
}

export default function ThemeProvider({ children }) {
	const [theme, setTheme] = useState(() => {
		const saved = localStorage.getItem("spann-theme");
		if (saved === "dark" || saved === "light") {
			return saved;
		}

		if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
			return "dark";
		}
		return "light";
	});

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
		localStorage.setItem("spann-theme", theme);
	}, [theme]);

	const value = useMemo(
		() => ({
			theme,
			setTheme,
			toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark"))
		}),
		[theme]
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
