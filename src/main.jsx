import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setDemoMode } from "./lib/demoMode";
import "./styles/global.css";

// Activate demo mode when ?demo=1 is in the URL (no auth required)
if (typeof window !== "undefined") {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      setDemoMode(true);
    }
  } catch {
    // ignore
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
    mutations: { retry: 0 },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
