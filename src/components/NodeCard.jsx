import React from "react";
import Badge from "./Badge";

export default function NodeCard({ node }) {
	return (
		<div className="node-card">
			<div className="node-main">
				<p className="node-name">{node.name}</p>
				<p className="node-meta">Last ping {node.ping}</p>
			</div>
			<div style={{ display: "flex", alignItems: "center" }}>
				<div className="signal-stack">
					{[1, 2, 3].map((bar) => {
						const on = bar <= node.signal;
						const cls = on ? (node.status === "weak" ? "weak" : "on") : "";
						return <span key={bar} className={cls} />;
					})}
				</div>
				<Badge tone={node.status === "weak" ? "orange" : "green"}>{node.status}</Badge>
			</div>
		</div>
	);
}
