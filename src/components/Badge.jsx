import React from "react";

export default function Badge({ children, tone = "accent" }) {
	return <span className={`badge ${tone}`}>{children}</span>;
}
