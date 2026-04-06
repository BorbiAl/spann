import React from "react";
import Toggle from "./Toggle";

export default function ToggleRow({ label, note, value, onChange }) {
	return (
		<div className="toggle-row">
			<div className="toggle-text">
				<p className="toggle-label">{label}</p>
				{note ? <p className="toggle-note">{note}</p> : null}
			</div>
			<Toggle value={value} onChange={onChange} />
		</div>
	);
}
