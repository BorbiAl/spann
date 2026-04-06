import React from "react";

export default function ProgressRing({ value, max, size = 120 }) {
	const radius = 45;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (value / max) * circumference;

	return (
		<svg width={size} height={size} viewBox="0 0 100 100" aria-label="progress ring">
			<circle cx="50" cy="50" r={radius} fill="none" stroke="var(--bg3)" strokeWidth="8" />
			<circle
				cx="50"
				cy="50"
				r={radius}
				fill="none"
				stroke="var(--accent)"
				strokeWidth="8"
				strokeDasharray={circumference}
				strokeDashoffset={offset}
				strokeLinecap="round"
				transform="rotate(-90 50 50)"
				style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)" }}
			/>
		</svg>
	);
}
