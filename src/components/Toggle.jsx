import './Toggle.css';
import React from "react";

export default function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      className="ios-toggle"
      style={{ background: value ? "var(--accent)" : "var(--bg3)" }}
      role="switch"
      aria-checked={value}
    >
      <div className="ios-thumb" style={{ left: value ? 22 : 2 }} />
    </div>
  );
}
