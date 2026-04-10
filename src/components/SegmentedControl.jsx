import './SegmentedControl.css';
import React from "react";

export default function SegmentedControl({ options, value, onChange }) {
	return (
		<div className="segment">
			{options.map((option) => (
				<button
					key={option}
					className={value === option ? "active" : ""}
					onClick={() => onChange(option)}
				>
					{option}
				</button>
			))}
		</div>
	);
}
