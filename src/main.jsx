import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { applyAccessibilityPreferencesGlobal, loadAccessibilityPreferencesGlobal } from "./app/accessibility";
import "./styles/global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
    mutations: { retry: 0 },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
