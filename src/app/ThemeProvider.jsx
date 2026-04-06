import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

export function useTheme() {
	return useContext(ThemeContext);
}

export default function ThemeProvider({ children }) {
	const [theme, setTheme] = useState(() => localStorage.getItem("spann-theme") || "dark");

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
		localStorage.setItem("spann-theme", theme);
	}, [theme]);

	const value = useMemo(
		() => ({
			theme,
			toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark"))
		}),
		[theme]
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
