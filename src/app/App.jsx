import React from "react";
import Layout from "./Layout";
import ThemeProvider from "./ThemeProvider";

export default function App() {
	return (
		<ThemeProvider>
			<Layout />
		</ThemeProvider>
	);
}