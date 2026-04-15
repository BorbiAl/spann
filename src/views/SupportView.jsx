import React, { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
	{
		icon: "rocket_launch",
		title: "Getting Started",
		description: "Set up your workspace, invite your team, and send your first message.",
	},
	{
		icon: "forum",
		title: "Channels & Messaging",
		description: "Create channels, manage threads, reactions, and direct messages.",
	},
	{
		icon: "hub",
		title: "Mesh Network",
		description: "Configure offline mesh nodes, signal handoffs, and failover rules.",
	},
	{
		icon: "eco",
		title: "Carbon Tracker",
		description: "Log transport activity, read your footprint, and earn badges.",
	},
	{
		icon: "monitor_heart",
		title: "Pulse & Sentiment",
		description: "Understand channel energy scores and configure alert thresholds.",
	},
	{
		icon: "lock",
		title: "Security & Privacy",
		description: "Manage permissions, tokens, audit logs, and data retention.",
	},
	{
		icon: "settings",
		title: "Admin & Settings",
		description: "Workspace configuration, SSO, billing, and integrations.",
	},
	{
		icon: "accessibility",
		title: "Accessibility",
		description: "Enable dyslexia mode, high contrast, text-to-speech, and more.",
	},
];

const SIMPLE_GUIDES = [
	{
		title: "Set up your workspace in 5 minutes",
		category: "Getting Started",
		views: "12.4k",
		summary: "Create the workspace, add first channels, and invite your team.",
		steps: [
			"Open Settings, then Workspace.",
			"Set your workspace name and timezone.",
			"Create #general, #announcements, and one team channel.",
			"Invite teammates by email.",
			"Post a welcome message in #general."
		]
	},
	{
		title: "Reset your session quickly",
		category: "Getting Started",
		views: "8.2k",
		summary: "Fix login loops or stale sessions in under a minute.",
		steps: [
			"Sign out from Settings.",
			"Close and reopen the app.",
			"Sign in again with your normal account.",
			"If it still fails, use 'Submit a ticket' below and include the time of the error."
		]
	},
	{
		title: "Create and manage channels",
		category: "Channels & Messaging",
		views: "11.1k",
		summary: "Set up channels your team can navigate easily.",
		steps: [
			"Use clear names like #ops, #design, #sales.",
			"Pin one message with channel purpose and rules.",
			"Use threads for side topics to keep channels clean.",
			"Archive channels that are no longer active."
		]
	},
	{
		title: "Fix missing or delayed messages",
		category: "Channels & Messaging",
		views: "7.6k",
		summary: "Quick checks when messages do not appear.",
		steps: [
			"Refresh the channel once.",
			"Check that you are in the correct workspace and channel.",
			"Verify your network connection.",
			"If only one channel is affected, ask a workspace admin to confirm permissions."
		]
	},
	{
		title: "Register a mesh node",
		category: "Mesh Network",
		views: "9.8k",
		summary: "Connect a device to your mesh in a few steps.",
		steps: [
			"Open Mesh view.",
			"Choose 'Register node'.",
			"Give the node a clear name (for example: Floor-2-Tablet).",
			"Confirm it appears as active in the node list."
		]
	},
	{
		title: "Revoke a compromised mesh node",
		category: "Mesh Network",
		views: "6.2k",
		summary: "Remove node access if a device is lost.",
		steps: [
			"Open Mesh view and locate the device.",
			"Choose Revoke on that node.",
			"Confirm the node status changes to revoked.",
			"Register a replacement node if needed."
		]
	},
	{
		title: "Log your commute correctly",
		category: "Carbon Tracker",
		views: "5.1k",
		summary: "Use the bottom quick actions to keep carbon data accurate.",
		steps: [
			"Open Carbon view.",
			"Tap the transport button matching your commute.",
			"Wait for the success notice.",
			"Repeat once per commute type used that day."
		]
	},
	{
		title: "Understand leaderboard scores",
		category: "Carbon Tracker",
		views: "4.3k",
		summary: "Know how score and kg values are shown.",
		steps: [
			"Higher points indicate better carbon performance.",
			"Avg shows estimated kg impact.",
			"Your highlighted row marks your account.",
			"Ask support if totals look incorrect after a full refresh."
		]
	},
	{
		title: "Read pulse scores simply",
		category: "Pulse & Sentiment",
		views: "7.2k",
		summary: "Turn pulse values into practical team actions.",
		steps: [
			"Green/high means healthy communication.",
			"Neutral means monitor trends, no urgent action.",
			"Low or critical means check recent conflict-heavy threads.",
			"Reassess after key announcements."
		]
	},
	{
		title: "Troubleshoot pulse 422/empty data",
		category: "Pulse & Sentiment",
		views: "3.9k",
		summary: "What to do when pulse data fails to load.",
		steps: [
			"Refresh channels first.",
			"Confirm channel exists and you can open messages.",
			"Try another channel to isolate the issue.",
			"Submit a ticket with channel name and timestamp if still failing."
		]
	},
	{
		title: "Set secure workspace defaults",
		category: "Security & Privacy",
		views: "6.9k",
		summary: "Apply baseline security with minimal setup.",
		steps: [
			"Review member roles and remove old accounts.",
			"Require strong passwords and session expiry.",
			"Use private channels for sensitive discussions.",
			"Rotate credentials for shared service accounts."
		]
	},
	{
		title: "Respond to suspicious activity",
		category: "Security & Privacy",
		views: "5.4k",
		summary: "Contain risk quickly if access looks suspicious.",
		steps: [
			"Revoke suspicious sessions and mesh nodes.",
			"Reset affected user passwords.",
			"Review recent channel/message activity.",
			"Contact support with incident timeline."
		]
	},
	{
		title: "Use Settings view effectively",
		category: "Admin & Settings",
		views: "4.7k",
		summary: "Find profile, appearance, shortcuts, and account options fast.",
		steps: [
			"Open Settings from sidebar or Carbon header.",
			"Use the left tabs to switch sections.",
			"Save one section before moving to the next.",
			"Use the shortcut list to speed up daily actions."
		]
	},
	{
		title: "Common admin checklist",
		category: "Admin & Settings",
		views: "3.8k",
		summary: "Weekly checks for stable workspace operations.",
		steps: [
			"Review member list and roles.",
			"Check support tickets with high priority.",
			"Verify mesh node health and revoke unused nodes.",
			"Review carbon and pulse trends for anomalies."
		]
	},
	{
		title: "Enable accessibility quickly",
		category: "Accessibility",
		views: "3.2k",
		summary: "Turn on readability tools in less than two minutes.",
		steps: [
			"Open Accessibility view.",
			"Enable needed toggles (high contrast, simplified mode, TTS).",
			"Adjust font size and color mode.",
			"Test chat readability immediately."
		]
	},
	{
		title: "Accessibility troubleshooting",
		category: "Accessibility",
		views: "2.7k",
		summary: "Fix common accessibility preference issues.",
		steps: [
			"Change one setting at a time.",
			"Refresh the page after major changes.",
			"Check browser/system accessibility settings for conflicts.",
			"Contact support if a toggle does not persist."
		]
	}
];

const STATUS_ITEMS = [
	{ label: "API", status: "operational" },
	{ label: "Chat", status: "operational" },
	{ label: "Mesh relay", status: "operational" },
	{ label: "Carbon sync", status: "degraded" },
	{ label: "Notifications", status: "operational" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function StatusDot({ status }) {
	const colours = {
		operational: "bg-green-500",
		degraded: "bg-yellow-400",
		outage: "bg-red-500",
	};
	return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colours[status] || "bg-outline"}`} />;
}

function CategoryCard({ icon, title, description, articles, active, onClick }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={[
				"text-left p-5 rounded-xl border transition-all duration-150 hover:shadow-sm active:scale-[0.98]",
				active
					? "border-primary bg-primary/5 shadow-sm"
					: "border-outline-variant/20 bg-surface-container-lowest hover:bg-surface-container-low",
			].join(" ")}
		>
			<span className={`material-symbols-outlined text-2xl mb-3 block ${active ? "text-primary" : "text-on-surface-variant"}`}>
				{icon}
			</span>
			<p className="font-semibold text-sm text-on-surface leading-tight">{title}</p>
			<p className="mt-1 text-xs text-on-surface-variant line-clamp-2">{description}</p>
			<p className="mt-3 text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-wider">
				{articles} articles
			</p>
		</button>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact form modal
// ─────────────────────────────────────────────────────────────────────────────

function ContactModal({ onClose }) {
	const [form, setForm] = useState({ subject: "", body: "", priority: "normal" });
	const [state, setState] = useState("idle"); // idle | sending | sent

	async function handleSubmit(e) {
		e.preventDefault();
		if (!form.subject.trim() || !form.body.trim()) return;
		setState("sending");

		const subject = encodeURIComponent(`[${String(form.priority || "normal").toUpperCase()}] ${form.subject.trim()}`);
		const body = encodeURIComponent(form.body.trim());
		const mailto = `mailto:support@spann.io?subject=${subject}&body=${body}`;
		window.location.href = mailto;
		setState("sent");
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
			onClick={onClose}
		>
			<div
				className="relative w-full max-w-lg mx-4 bg-surface rounded-2xl shadow-xl border border-outline-variant/20 p-7"
				onClick={(e) => e.stopPropagation()}
			>
				<button
					type="button"
					onClick={onClose}
					className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-surface-container transition-colors"
					aria-label="Close"
				>
					<span className="material-symbols-outlined text-on-surface-variant text-xl">close</span>
				</button>

				{state === "sent" ? (
					<div className="py-8 flex flex-col items-center gap-4 text-center">
						<span className="material-symbols-outlined text-5xl text-green-500">check_circle</span>
						<h3 className="text-lg font-bold text-on-surface">Ticket submitted</h3>
						<p className="text-sm text-on-surface-variant">
							We've received your request and will respond within 24 hours. Check your email for a confirmation.
						</p>
						<button
							type="button"
							onClick={onClose}
							className="mt-2 px-5 py-2 bg-primary text-on-primary text-sm font-semibold rounded-lg"
						>
							Done
						</button>
					</div>
				) : (
					<>
						<h3 className="text-lg font-bold text-on-surface mb-5">Submit a support ticket</h3>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-1.5">
								<label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider" htmlFor="s-subject">
									Subject
								</label>
								<input
									id="s-subject"
									type="text"
									required
									maxLength={120}
									value={form.subject}
									onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
									placeholder="Briefly describe your issue"
									className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
								/>
							</div>

							<div className="space-y-1.5">
								<label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider" htmlFor="s-priority">
									Priority
								</label>
								<select
									id="s-priority"
									value={form.priority}
									onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
									className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
								>
									<option value="low">Low — general question</option>
									<option value="normal">Normal — something isn't working</option>
									<option value="high">High — blocking my team</option>
									<option value="critical">Critical — data loss or outage</option>
								</select>
							</div>

							<div className="space-y-1.5">
								<label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider" htmlFor="s-body">
									Description
								</label>
								<textarea
									id="s-body"
									required
									rows={5}
									maxLength={2000}
									value={form.body}
									onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
									placeholder="Steps to reproduce, what you expected vs. what happened, and any error messages…"
									className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
								/>
								<p className="text-right text-xs text-on-surface-variant/50">{form.body.length}/2000</p>
							</div>

							<div className="flex gap-3 pt-1">
								<button
									type="submit"
									disabled={state === "sending"}
									className="flex-1 py-2.5 bg-primary text-on-primary text-sm font-semibold rounded-lg hover:opacity-90 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
								>
									{state === "sending" && (
										<span className="material-symbols-outlined text-sm animate-spin" style={{ animationDuration: "0.8s" }}>refresh</span>
									)}
									{state === "sending" ? "Sending…" : "Submit ticket"}
								</button>
								<button
									type="button"
									onClick={onClose}
									className="px-5 py-2.5 text-sm font-semibold text-on-surface-variant bg-surface-container rounded-lg hover:bg-surface-container-high active:scale-95 transition-all"
								>
									Cancel
								</button>
							</div>
						</form>
					</>
				)}
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────────────────────

export default function SupportView() {
	const [search, setSearch] = useState("");
	const [activeCategory, setActiveCategory] = useState(null);
	const [showContact, setShowContact] = useState(false);
	const [selectedGuideTitle, setSelectedGuideTitle] = useState("");

	const articleCountsByCategory = SIMPLE_GUIDES.reduce((counts, guide) => {
		const key = String(guide.category || "");
		counts[key] = Number(counts[key] || 0) + 1;
		return counts;
	}, {});

	const filteredCategories = search.trim()
		? CATEGORIES.filter(
				(c) =>
					c.title.toLowerCase().includes(search.toLowerCase()) ||
					c.description.toLowerCase().includes(search.toLowerCase())
		  )
		: CATEGORIES;

	const filteredArticles = search.trim()
		? SIMPLE_GUIDES.filter(
				(a) =>
					a.title.toLowerCase().includes(search.toLowerCase()) ||
					a.category.toLowerCase().includes(search.toLowerCase()) ||
					a.summary.toLowerCase().includes(search.toLowerCase())
		  )
		: SIMPLE_GUIDES;

	const displayedGuides = activeCategory
		? filteredArticles.filter((a) => a.category === activeCategory)
		: filteredArticles;

	const selectedGuide =
		displayedGuides.find((guide) => guide.title === selectedGuideTitle) || displayedGuides[0] || null;

	const overallStatus = STATUS_ITEMS.some((s) => s.status === "outage")
		? "outage"
		: STATUS_ITEMS.some((s) => s.status === "degraded")
		? "degraded"
		: "operational";

	const statusLabel = { operational: "All systems operational", degraded: "Partial degradation", outage: "Service outage" };
	const statusColour = { operational: "text-green-600", degraded: "text-yellow-600", outage: "text-red-600" };

	return (
		<div className="h-full overflow-y-auto bg-surface p-8 w-full view-transition">
			{showContact && <ContactModal onClose={() => setShowContact(false)} />}

			{/* Header */}
			<div className="border-b border-outline-variant/10 bg-surface-container-lowest px-8 py-10 rounded-2xl">
				<div className="w-full text-center space-y-4">
					<h1 className="text-3xl font-extrabold tracking-tight text-on-surface">How can we help?</h1>
					<p className="text-on-surface-variant">
						Search our documentation, browse help topics, or reach out directly.
					</p>
					{/* Search */}
					<div className="relative mt-2">
						<span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-xl pointer-events-none">
							search
						</span>
						<input
							type="search"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search help articles…"
							className="w-full bg-surface border border-outline-variant/30 rounded-xl pl-12 pr-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all shadow-sm"
						/>
						{search && (
							<button
								type="button"
								onClick={() => setSearch("")}
								className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
							>
								<span className="material-symbols-outlined text-xl">close</span>
							</button>
						)}
					</div>
				</div>
			</div>

			<div className="w-full px-2 py-8 space-y-10">
				{/* System status banner */}
				<div className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant/10 rounded-xl px-5 py-3">
					<div className="flex items-center gap-3">
						<StatusDot status={overallStatus} />
						<span className={`text-sm font-semibold ${statusColour[overallStatus]}`}>
							{statusLabel[overallStatus]}
						</span>
					</div>
					<div className="hidden sm:flex items-center gap-4">
						{STATUS_ITEMS.map((item) => (
							<div key={item.label} className="flex items-center gap-1.5">
								<StatusDot status={item.status} />
								<span className="text-xs text-on-surface-variant">{item.label}</span>
							</div>
						))}
					</div>
					<button
						type="button"
						onClick={() => setShowContact(true)}
						className="text-xs font-semibold text-primary hover:underline flex-shrink-0"
					>
						Report issue →
					</button>
				</div>

				{/* Help topic grid */}
				<section>
					<h2 className="text-base font-bold text-on-surface mb-4">Browse by topic</h2>
					{filteredCategories.length > 0 ? (
						<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
							{filteredCategories.map((cat) => (
								<CategoryCard
									key={cat.title}
									{...cat}
									articles={articleCountsByCategory[cat.title] || 0}
									active={activeCategory === cat.title}
									onClick={() => setActiveCategory(activeCategory === cat.title ? null : cat.title)}
								/>
							))}
						</div>
					) : (
						<p className="text-sm text-on-surface-variant py-4">No topics match your search.</p>
					)}
				</section>

				{/* Simple guides */}
				<section>
					<h2 className="text-base font-bold text-on-surface mb-4">
						{activeCategory ? `Simple guides in "${activeCategory}"` : "Simple guides"}
					</h2>
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
						<div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest divide-y divide-outline-variant/10 overflow-hidden">
							{displayedGuides.length > 0 ? (
								displayedGuides.map((article) => (
									<button
										type="button"
										key={article.title}
										onClick={() => setSelectedGuideTitle(article.title)}
										className={`w-full text-left flex items-center gap-4 px-5 py-4 transition-colors group ${selectedGuide?.title === article.title ? "bg-primary/5" : "hover:bg-surface-container"}`}
									>
										<span className="material-symbols-outlined text-on-surface-variant text-base flex-shrink-0 group-hover:text-primary transition-colors">
											article
										</span>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors truncate">
												{article.title}
											</p>
											<p className="text-xs text-on-surface-variant">{article.category}</p>
										</div>
										<span className="text-xs text-on-surface-variant/60 flex-shrink-0">{article.views}</span>
									</button>
								))
							) : (
								<div className="px-5 py-8 text-center text-sm text-on-surface-variant">
									No guides found.{" "}
									<button type="button" onClick={() => setShowContact(true)} className="text-primary hover:underline font-medium">
										Contact support instead.
									</button>
								</div>
							)}
						</div>

						<div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-5">
							{selectedGuide ? (
								<div className="space-y-4">
									<div>
										<p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Simple guide</p>
										<h3 className="text-base font-bold text-on-surface mt-1">{selectedGuide.title}</h3>
										<p className="text-sm text-on-surface-variant mt-2">{selectedGuide.summary}</p>
									</div>
									<div className="space-y-2">
										{selectedGuide.steps.map((step, idx) => (
											<div key={`${selectedGuide.title}-${idx}`} className="flex items-start gap-3">
												<span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
													{idx + 1}
												</span>
												<p className="text-sm text-on-surface leading-relaxed">{step}</p>
											</div>
										))}
									</div>
								</div>
							) : (
								<p className="text-sm text-on-surface-variant">Pick a guide to see step-by-step instructions.</p>
							)}
						</div>
					</div>
				</section>

				{/* Contact options */}
				<section>
					<h2 className="text-base font-bold text-on-surface mb-4">Still need help?</h2>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
						<button
							type="button"
							onClick={() => setShowContact(true)}
							className="flex flex-col items-start gap-3 p-5 rounded-xl border border-outline-variant/20 bg-surface-container-lowest hover:bg-surface-container-low hover:border-primary/30 transition-all text-left group"
						>
							<span className="material-symbols-outlined text-2xl text-primary">support_agent</span>
							<div>
								<p className="font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">Submit a ticket</p>
								<p className="text-xs text-on-surface-variant mt-0.5">Response within 24 hours</p>
							</div>
						</button>

						<a
							href="mailto:support@spann.io"
							className="flex flex-col items-start gap-3 p-5 rounded-xl border border-outline-variant/20 bg-surface-container-lowest hover:bg-surface-container-low hover:border-primary/30 transition-all group"
						>
							<span className="material-symbols-outlined text-2xl text-primary">mail</span>
							<div>
								<p className="font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">Email us</p>
								<p className="text-xs text-on-surface-variant mt-0.5">support@spann.io</p>
							</div>
						</a>

						<button
							type="button"
							onClick={() => {
								setActiveCategory("Channels & Messaging");
								setSelectedGuideTitle("Create and manage channels");
							}}
							className="flex flex-col items-start gap-3 p-5 rounded-xl border border-outline-variant/20 bg-surface-container-lowest hover:bg-surface-container-low hover:border-primary/30 transition-all group text-left"
						>
							<span className="material-symbols-outlined text-2xl text-primary">forum</span>
							<div>
								<p className="font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">Community forum</p>
								<p className="text-xs text-on-surface-variant mt-0.5">Open messaging guides</p>
							</div>
						</button>
					</div>
				</section>
			</div>
		</div>
	);
}
