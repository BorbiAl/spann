import './MeshView.css';
import React, { useMemo, useState } from "react";
import Icon from "../components/Icon";
import SegmentedControl from "../components/SegmentedControl";
import { NODES } from "../data/constants";

export default function MeshView({ meshNodes, onRefreshNodes, onRegisterNode, onRevokeNode, isBusy, errorText }) {
	const [mode, setMode] = useState("Mesh");
	const meshActive = mode === "Mesh";
	const connectedCount = useMemo(
		() => (Array.isArray(meshNodes) ? meshNodes.filter((node) => !node?.revoked).length : 0),
		[meshNodes]
	);

	const stagePoints = [
		{ id: "tl", x: 24, y: 26 },
		{ id: "tr", x: 74, y: 26 },
		{ id: "bl", x: 24, y: 74 },
		{ id: "br", x: 74, y: 74 },
		{ id: "core", x: 49, y: 50, core: true }
	];

	const stageLinks = [
		["tl", "tr"],
		["tr", "br"],
		["br", "bl"],
		["bl", "tl"],
		["tl", "core"],
		["tr", "core"],
		["bl", "core"],
		["br", "core"]
	];

	function stagePointById(id) {
		return stagePoints.find((point) => point.id === id);
	}

	function toSignalBars(rawSignal, status) {
		if (status === "standby" || status === "revoked") {
			return 1;
		}

		const asNumber = Number(rawSignal || 0);
		if (!Number.isFinite(asNumber) || asNumber <= 0) {
			return 2;
		}

		if (asNumber <= 3) {
			return Math.max(1, Math.min(3, Math.round(asNumber)));
		}

		if (asNumber >= 70) {
			return 3;
		}
		if (asNumber >= 35) {
			return 2;
		}
		return 1;
	}

	function toDataLabel(node, index) {
		if (node.ping) {
			return `${node.ping} data`;
		}

		const fallback = ["1.2 GB", "850 MB", "1.1 GB", "45 MB", "620 MB", "390 MB"];
		return fallback[index % fallback.length];
	}

	function toShortName(rawName, fallback) {
		const value = String(rawName || "").trim();
		if (!value) {
			return fallback;
		}

		const stripped = value.split(/\s[-\u2014]\s/)[0];
		return stripped || fallback;
	}

	const preparedNodes = (Array.isArray(meshNodes) && meshNodes.length ? meshNodes : NODES).map((node, index) => {
		if (node.id && node.name) {
			const status = node.status === "weak" ? "weak" : "active";
			const bars = toSignalBars(node.signal, status);
			const progress = status === "weak" ? 15 : bars === 3 ? 85 : bars === 2 ? 62 : 35;
			return {
				id: node.id,
				nodeId: node.nodeId || node.id,
				name: node.name,
				shortName: toShortName(node.name, `Node ${index + 1}`),
				status,
				statusLabel: status === "active" ? "Active" : "Standby",
				signal: bars,
				progress,
				dataText: toDataLabel(node, index),
				revoked: Boolean(node.revoked)
			};
		}

		const nodeId = String(node.node_id || node.id || `node-${index + 1}`);
		const lastSeen = node.last_seen || node.last_ping_at
			? new Date(node.last_seen || node.last_ping_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
			: "--";
		const revoked = Boolean(node.revoked);
		const status = revoked ? "standby" : "active";
		const bars = toSignalBars(node.signal_strength, status);
		const progress = revoked ? 15 : bars === 3 ? 85 : bars === 2 ? 62 : 35;
		const uiName = String(node.user?.display_name || "").trim() ? `${node.user.display_name} - ${nodeId.slice(-4)}` : nodeId;
		return {
			id: nodeId,
			nodeId,
			name: uiName,
			shortName: toShortName(uiName, `Node ${index + 1}`),
			status,
			statusLabel: revoked ? "Standby" : "Active",
			signal: bars,
			progress,
			dataText: revoked ? `Last seen ${lastSeen}` : toDataLabel(node, index),
			revoked
		};
	});

	const graphNames = preparedNodes.slice(0, 4).map((node, index) => node.shortName || `Node ${index + 1}`);
	const stageLabels = {
		tl: graphNames[0] || "Node A",
		tr: graphNames[1] || "Node B",
		bl: graphNames[2] || "Node C",
		br: graphNames[3] || "Node D",
		core: "Spann Core"
	};

	return (
		<div className="mesh-page view-transition">
			<section className="mesh-alert-strip" role="status" aria-live="polite">
				<div className="mesh-alert-copy">
					<Icon name="lan" size={14} />
					<span>
						{meshActive
							? `Internet disconnected. Mesh network active with ${Math.max(connectedCount, preparedNodes.length)} local peers.`
							: "Internet stable. Mesh standby remains available for automatic failover."}
					</span>
				</div>
				<button type="button" className="mesh-alert-btn" onClick={onRefreshNodes} disabled={isBusy}>
					{isBusy ? "Checking..." : "Reconnect"}
				</button>
			</section>

			<div className="mesh-content-grid">
				<section className="mesh-topology-card">
					<div className="mesh-topology-head">
						<div className="mesh-status-chip">
							<span className="mesh-status-dot" />
							<span>{meshActive ? "Self-Healing Active" : "Gateway Priority Active"}</span>
						</div>
						<SegmentedControl options={["Internet", "Mesh"]} value={mode} onChange={setMode} />
					</div>

					<div className="mesh-topology-stage">
						<svg className="mesh-topology-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
							{stageLinks.map(([fromId, toId], index) => {
								const from = stagePointById(fromId);
								const to = stagePointById(toId);
								return (
									<line
										key={`${fromId}-${toId}`}
										x1={from.x}
										y1={from.y}
										x2={to.x}
										y2={to.y}
										className="mesh-topology-link"
										style={{ animationDelay: `${index * 180}ms` }}
									/>
								);
							})}
							{stagePoints.map((point, index) => (
								<g key={point.id}>
									<circle
										cx={point.x}
										cy={point.y}
										r={point.core ? 4.5 : 2.3}
										className={`mesh-topology-node ${point.core ? "core" : ""}`}
									/>
									<circle
										cx={point.x}
										cy={point.y}
										r={point.core ? 6.2 : 4.1}
										className="mesh-topology-wave"
										style={{ animationDelay: `${index * 260}ms` }}
									/>
								</g>
							))}
						</svg>
						{stagePoints.map((point) => (
							<div
								key={`label-${point.id}`}
								className={`mesh-topology-label ${point.core ? "core" : ""}`}
								style={{ left: `${point.x}%`, top: `${point.y}%` }}
							>
								{stageLabels[point.id]}
							</div>
						))}
					</div>

					<div className="mesh-topology-foot">
						<div className="mesh-peer-box">
							<span>TOTAL PEERS</span>
							<strong>{Math.max(connectedCount, preparedNodes.length)}</strong>
						</div>
						<div className="mesh-foot-actions">
							<button type="button" className="header-btn" onClick={onRefreshNodes} disabled={isBusy}>
								{isBusy ? "Refreshing..." : "Refresh"}
							</button>
							<button type="button" className="mesh-plus-btn" onClick={onRegisterNode} disabled={isBusy} aria-label="Register node">
								<Icon name="add" size={18} />
							</button>
						</div>
					</div>

					{errorText ? <p className="mesh-error-text">{errorText}</p> : null}
				</section>

				<aside className="mesh-devices-card">
					<div className="mesh-devices-head">
						<h3>Connected Devices</h3>
					</div>

					<div className="mesh-devices-list">
						{preparedNodes.slice(0, 5).map((node, index) => (
							<div key={node.id} className="mesh-device-item">
								<div className="mesh-device-row">
									<div className="mesh-device-icon">{String(node.shortName || "N").slice(0, 1).toUpperCase()}</div>
									<div className="mesh-device-meta">
										<p>{node.name}</p>
										<span>
											{node.statusLabel} - {node.dataText}
										</span>
									</div>
									<button
										type="button"
										className="mesh-revoke-btn"
										onClick={() => onRevokeNode(node.nodeId || node.id)}
										disabled={isBusy || node.revoked}
										title={node.revoked ? "Node already revoked" : "Revoke node"}
									>
										{node.revoked ? "Done" : "Revoke"}
									</button>
								</div>
								<div className="mesh-device-progress-row">
									<div className="mesh-device-progress-track">
										<span style={{ width: `${Math.max(12, Math.min(100, Number(node.progress || 0)))}%` }} />
									</div>
									<strong>{Math.max(12, Math.min(100, Number(node.progress || 0)))}%</strong>
								</div>
							</div>
						))}
					</div>

					<button type="button" className="mesh-view-all-btn" onClick={onRefreshNodes} disabled={isBusy}>
						View All Nodes
					</button>
				</aside>
			</div>

			<section className="mesh-tunnel-card">
				<div className="mesh-tunnel-copy">
					<h4>Encrypted Tunnel</h4>
					<p>Your local mesh is secured with 256-bit peer-to-peer encryption.</p>
				</div>
				<button type="button" className="mesh-tunnel-btn">Audit Security</button>
			</section>
		</div>
	);
}
