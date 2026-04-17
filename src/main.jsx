import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { applyAccessibilityPreferencesGlobal, loadAccessibilityPreferencesGlobal } from "./app/accessibility";
import "./styles/global.css";

applyAccessibilityPreferencesGlobal(loadAccessibilityPreferencesGlobal());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
