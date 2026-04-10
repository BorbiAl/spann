import React, { useMemo, useState } from "react";

export default function MeshView({ meshNodes, onRefreshNodes, onRegisterNode, onRevokeNode, isBusy, errorText }) {
	const [mode, setMode] = useState("Mesh");
	const [showAllNodes, setShowAllNodes] = useState(false);
	const meshActive = mode === "Mesh";

	const connectedCount = useMemo(
		() => (Array.isArray(meshNodes) ? meshNodes.filter((node) => !node?.revoked).length : 0),
		[meshNodes]
	);

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
		// Show last_seen instead of made-up data
		if (node.last_seen) {
			const lastSeen = new Date(node.last_seen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			return `Last seen ${lastSeen}`;
		}
		if (node.last_ping_at) {
			const lastSeen = new Date(node.last_ping_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			return `Last seen ${lastSeen}`;
		}
		return "No data";
	}

	function toShortName(rawName, fallback) {
		const value = String(rawName || "").trim();
		if (!value) {
			return fallback;
		}

		const stripped = value.split(/\s[-\u2014]\s/)[0];
		return stripped || fallback;
	}

	const preparedNodes = (Array.isArray(meshNodes) && meshNodes.length ? meshNodes : []).map((node, index) => {
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

	return (
		<div className="h-full overflow-y-auto bg-surface p-8 w-full view-transition">
			<div className="flex flex-col relative overflow-hidden bg-background min-h-full font-body text-on-surface rounded-2xl border border-outline-variant/10">
			<style>{`
        .mica-surface {
            background: rgba(249, 249, 249, 0.8);
            backdrop-filter: blur(20px);
        }
        .node-pulse {
            animation: pulse 3s infinite ease-in-out;
        }
        @keyframes pulse {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.2); }
        }
			`}</style>
			{/* TopNavBar */}
			<header className="w-full top-0 sticky bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-xl shadow-sm z-40 font-['Segoe_UI_Variable',sans-serif] text-sm antialiased">
				<div className="flex justify-between items-center px-6 h-12 w-full">
					<div className="flex items-center gap-6">
						<span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Spann</span>
						{/* Mesh/Internet Toggle */}
						<div className="flex bg-surface-container-low p-1 rounded-full border border-outline-variant/20">
							<button
								onClick={() => setMode("Internet")}
								className={`px-4 py-1 rounded-full text-xs font-medium transition-colors ${!meshActive ? "bg-white shadow-sm text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
							>
								Internet
							</button>
							<button
								onClick={() => setMode("Mesh")}
								className={`px-4 py-1 rounded-full text-xs font-medium transition-colors ${meshActive ? "bg-white shadow-sm text-primary" : "text-on-surface-variant hover:text-on-surface"}`}
							>
								Mesh
							</button>
						</div>
					</div>
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-1">
							<button className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors rounded-full active:scale-95 duration-150">
								<span className="material-symbols-outlined text-[20px]">settings</span>
							</button>
							<button className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors rounded-full active:scale-95 duration-150">
								<span className="material-symbols-outlined text-[20px]">help_outline</span>
							</button>
							<button className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors rounded-full active:scale-95 duration-150">
								<span className="material-symbols-outlined text-[20px]">account_circle</span>
							</button>
						</div>
					</div>
				</div>
				{/* Dynamic Background Gradient Separation */}
				<div className="h-[1px] w-full bg-gradient-to-r from-transparent via-slate-200/50 to-transparent dark:via-slate-800/50" />
			</header>

			{/* Offline Alert Banner */}
			<div className="px-8 pt-4">
				<div className="bg-error-container text-on-error-container px-6 py-3 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 border border-error/10">
					<div className="flex items-center gap-3">
						<span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>wifi_off</span>
						<span className="text-sm font-medium">Internet disconnected. Mesh network active with {connectedCount} local peer{connectedCount !== 1 ? 's' : ''}.</span>
					</div>
					<button
						onClick={onRefreshNodes}
						disabled={isBusy}
						className="text-xs font-bold uppercase tracking-wider px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
					>
						{isBusy ? "Checking..." : "Reconnect"}
					</button>
				</div>
			</div>

			{/* Node Map Area */}
			<div className="flex-1 relative p-8 flex gap-6 overflow-hidden">
				{/* Central Node Map (SVG Visualization) */}
				<div className="flex-1 bg-white rounded-3xl relative overflow-hidden shadow-sm flex items-center justify-center border border-outline-variant/10">
					<div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(#005faa 0.5px, transparent 0.5px)", backgroundSize: "24px 24px" }} />
					<svg className="w-full h-full max-w-4xl p-12" viewBox="0 0 800 600">
						{/* Dynamic Lines (Network Connections) */}
						<g className="stroke-primary/20" strokeWidth="1.5">
							{preparedNodes.slice(0, 8).map((node, i) => {
								const angle = (i / Math.max(preparedNodes.length, 1)) * Math.PI * 2;
								const x = 400 + 180 * Math.cos(angle);
								const y = 300 + 180 * Math.sin(angle);
								return <line key={`line-${i}`} x1="400" x2={x} y1="300" y2={y} />;
							})}
						</g>
						
						{/* Central Hub Node */}
						<g transform="translate(400,300)">
							<circle className="fill-primary/10 stroke-primary stroke-2" r="30" />
							<circle className="fill-primary/5 node-pulse" r="40" />
							<text className="fill-primary font-bold text-xs" textAnchor="middle" y="50">Spann Core</text>
						</g>

						{/* Dynamic Peripheral Nodes */}
						{preparedNodes.slice(0, 8).map((node, i) => {
							const angle = (i / Math.max(preparedNodes.length, 1)) * Math.PI * 2;
							const x = 400 + 180 * Math.cos(angle);
							const y = 300 + 180 * Math.sin(angle);
							const isRevoked = node.revoked;
							const circleColor = isRevoked ? "fill-outline-variant" : "fill-tertiary-container";
							return (
								<g key={node.id} transform={`translate(${x},${y})`}>
									<circle className={`${circleColor} stroke-white stroke-2`} r="12" />
									<text className="fill-on-surface-variant text-[10px]" textAnchor="middle" y="30">{node.shortName.slice(0, 15)}</text>
								</g>
							);
						})}
					</svg>

					{/* Status Overlay (Bento Style) */}
					<div className="absolute top-6 left-6 flex flex-col gap-3">
						<div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-outline-variant/10 w-48">
							<p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Mesh Status</p>
							<div className="flex items-center gap-2">
								<div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
								<span className="text-sm font-semibold">{meshActive ? "Self-Healing Active" : "Gateway Priority Active"}</span>
							</div>
						</div>
					</div>

					<div className="absolute bottom-6 right-6 flex items-end gap-3">
						<div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-outline-variant/10">
							<p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">Total Peers</p>
							<p className="text-3xl font-bold text-primary">{connectedCount}</p>
						</div>
						<button onClick={onRegisterNode} disabled={isBusy} className="bg-primary text-white p-4 rounded-2xl shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity">
							<span className="material-symbols-outlined">add</span>
						</button>
					</div>
				</div>

				{/* Side Device List */}
				<div className="w-80 flex flex-col gap-4">
					<div className="mica-surface rounded-3xl p-6 flex-1 flex flex-col border border-outline-variant/10 shadow-sm overflow-hidden">
						<h3 className="font-bold text-lg mb-2">Connected Devices</h3>
						<p className="text-xs text-on-surface-variant mb-4">{connectedCount} node{connectedCount !== 1 ? 's' : ''} active</p>
						<div className="flex-1 overflow-y-auto space-y-4 pr-2">
							{(showAllNodes ? preparedNodes : preparedNodes.slice(0, 4)).map((node, i) => {
								const icons = ["smartphone", "laptop", "tablet", "desktop_windows", "router", "smartphone", "laptop", "tablet"];
								const icon = icons[i % icons.length];
								let progressColor = "bg-primary";
								if (node.progress > 85) progressColor = "bg-tertiary";
								if (node.progress < 30) progressColor = "bg-outline-variant";

								return (
									<div key={node.id} onClick={() => onRevokeNode && onRevokeNode(node.nodeId || node.id)} className="group p-3 rounded-2xl hover:bg-surface-container-high transition-all cursor-pointer">
										<div className="flex items-center gap-3 mb-2">
											<div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary transition-colors">
												<span className="material-symbols-outlined">{icon}</span>
											</div>
											<div className="flex-1 overflow-hidden">
												<p className="font-semibold text-sm truncate">{node.name || node.shortName}</p>
												<p className="text-[10px] text-on-surface-variant">{node.statusLabel} • {node.dataText}</p>
											</div>
										</div>
										<div className="flex items-center gap-2">
											<div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
												<div className={`h-full ${progressColor}`} style={{ width: `${node.progress}%` }} />
											</div>
											<span className="text-[10px] font-bold text-on-surface-variant">{node.progress}%</span>
										</div>
									</div>
								);
							})}
						</div>
						{preparedNodes.length > 4 && (
							<button onClick={() => setShowAllNodes(!showAllNodes)} disabled={isBusy} className="w-full mt-4 py-3 rounded-2xl bg-surface-container-high text-on-surface font-semibold text-sm hover:brightness-95 transition-all">
								{showAllNodes ? "Show Less" : `View All ${preparedNodes.length} Nodes`}
							</button>
						)}
					</div>

					<div className="bg-primary-container p-6 rounded-3xl text-white relative overflow-hidden group shadow-lg">
						<div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
							<span className="material-symbols-outlined text-[120px]" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
						</div>
						<h4 className="font-bold mb-1">Encrypted Tunnel</h4>
						<p className="text-xs text-white/80 leading-relaxed mb-4">Your local mesh is secured with 256-bit AES peer-to-peer encryption.</p>
						<button className="px-4 py-2 bg-white/20 rounded-xl text-xs font-bold hover:bg-white/30 transition-colors">
							Audit Security
						</button>
					</div>
				</div>
			</div>
			</div>
		</div>
	);
}
