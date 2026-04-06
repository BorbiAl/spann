import React, { useState } from "react";
import NodeCard from "../components/NodeCard";
import SegmentedControl from "../components/SegmentedControl";
import { NODES } from "../data/constants";

export default function MeshView() {
	const [mode, setMode] = useState("Mesh");
	const meshActive = mode === "Mesh";

	const points = [
		{ id: 1, x: 16, y: 20 },
		{ id: 2, x: 35, y: 45 },
		{ id: 3, x: 50, y: 24 },
		{ id: 4, x: 65, y: 68 },
		{ id: 5, x: 78, y: 34 },
		{ id: 6, x: 88, y: 58 }
	];

	const links = [
		[1, 2],
		[2, 3],
		[3, 5],
		[5, 6],
		[2, 4],
		[4, 6],
		[1, 3],
		[3, 4]
	];

	function pointById(id) {
		return points.find((point) => point.id === id);
	}

	return (
		<div className="view-transition">
			<section className="card">
				<div className="hero-row">
					<div>
						<div className="status-row" style={{ color: meshActive ? "var(--green)" : "var(--text-secondary)" }}>
							<span className="pulse-dot" />
							<span>{meshActive ? "Mesh Active — 6 nodes connected" : "Internet Mode — gateway stable"}</span>
						</div>
						<p className="caption">Autonomous failover keeps teams connected when infrastructure degrades.</p>
					</div>
					<SegmentedControl options={["Internet", "Mesh"]} value={mode} onChange={setMode} />
				</div>

				<div className="mesh-map">
					<svg className="mesh-svg" viewBox="0 0 100 80" preserveAspectRatio="none">
						{links.map(([fromId, toId], index) => {
							const from = pointById(fromId);
							const to = pointById(toId);
							return (
								<line
									key={`${fromId}-${toId}`}
									x1={from.x}
									y1={from.y}
									x2={to.x}
									y2={to.y}
									className="mesh-line"
									style={{ animationDelay: `${index * 250}ms` }}
								/>
							);
						})}

						{points.map((point, index) => (
							<g key={point.id}>
								<circle cx={point.x} cy={point.y} r="3" className="mesh-node" />
								<circle
									cx={point.x}
									cy={point.y}
									r="4"
									className="mesh-wave"
									style={{ animationDelay: `${index * 350}ms` }}
								/>
							</g>
						))}
					</svg>
				</div>

				{meshActive ? <div className="warning-banner">⚠ Cellular signal lost — switching to mesh</div> : null}
			</section>

			<section className="card">
				<p className="title">Node Health</p>
				<div className="node-list">
					{NODES.map((node) => (
						<NodeCard key={node.id} node={node} />
					))}
				</div>
			</section>
		</div>
	);
}
