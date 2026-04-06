import React from "react";

export default function WaveformBars({ level }) {
	const bars = Array.from({ length: 20 }, (_, index) => {
		const variance = Math.max(18, Math.min(100, level + Math.sin(index * 0.6) * 28));
		return {
			id: index,
			height: `${variance}%`,
			delay: `${index * 60}ms`
		};
	});

	return (
		<div className="wave-bars">
			{bars.map((bar) => (
				<div key={bar.id} className="wave-bar" style={{ height: bar.height, animationDelay: bar.delay }} />
			))}
		</div>
	);
}
