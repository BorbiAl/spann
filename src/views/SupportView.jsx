import React, { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
	{
		icon: "rocket_launch",
		title: "Getting Started",
		description: "Set up your workspace, invite your team, and send your first message.",
		articles: 12,
	},
	{
		icon: "forum",
		title: "Channels & Messaging",
		description: "Create channels, manage threads, reactions, and direct messages.",
		articles: 18,
	},
	{
		icon: "hub",
		title: "Mesh Network",
		description: "Configure offline mesh nodes, signal handoffs, and failover rules.",
		articles: 9,
	},
	{
		icon: "eco",
		title: "Carbon Tracker",
		description: "Log transport activity, read your footprint, and earn badges.",
		articles: 7,
	},
	{
		icon: "monitor_heart",
		title: "Pulse & Sentiment",
		description: "Understand channel energy scores and configure alert thresholds.",
		articles: 8,
	},
	{
		icon: "lock",
		title: "Security & Privacy",
		description: "Manage permissions, tokens, audit logs, and data retention.",
		articles: 14,
	},
	{
		icon: "settings",
		title: "Admin & Settings",
		description: "Workspace configuration, SSO, billing, and integrations.",
		articles: 21,
	},
	{
		icon: "accessibility",
		title: "Accessibility",
		description: "Enable dyslexia mode, high contrast, text-to-speech, and more.",
		articles: 6,
	},
];

const POPULAR_ARTICLES = [
	{ title: "How to invite team members to your workspace", category: "Getting Started", views: "12.4k" },
	{ title: "Setting up offline mesh nodes for field teams", category: "Mesh Network", views: "9.8k" },
	{ title: "Understanding your channel sentiment score", category: "Pulse & Sentiment", views: "7.2k" },
	{ title: "Enabling end-to-end encryption for channels", category: "Security & Privacy", views: "6.9k" },
	{ title: "Logging carbon activity from mobile devices", category: "Carbon Tracker", views: "5.1k" },
	{ title: "Configuring SAML SSO for your organisation", category: "Admin & Settings", views: "4.7k" },
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
		await new Promise((r) => setTimeout(r, 1000));
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

	const filteredCategories = search.trim()
		? CATEGORIES.filter(
				(c) =>
					c.title.toLowerCase().includes(search.toLowerCase()) ||
					c.description.toLowerCase().includes(search.toLowerCase())
		  )
		: CATEGORIES;

	const filteredArticles = search.trim()
		? POPULAR_ARTICLES.filter(
				(a) =>
					a.title.toLowerCase().includes(search.toLowerCase()) ||
					a.category.toLowerCase().includes(search.toLowerCase())
		  )
		: POPULAR_ARTICLES;

	const overallStatus = STATUS_ITEMS.some((s) => s.status === "outage")
		? "outage"
		: STATUS_ITEMS.some((s) => s.status === "degraded")
		? "degraded"
		: "operational";

	const statusLabel = { operational: "All systems operational", degraded: "Partial degradation", outage: "Service outage" };
	const statusColour = { operational: "text-green-600", degraded: "text-yellow-600", outage: "text-red-600" };

	return (
		<div className="h-full overflow-y-auto bg-surface">
			{showContact && <ContactModal onClose={() => setShowContact(false)} />}

			{/* Header */}
			<div className="border-b border-outline-variant/10 bg-surface-container-lowest px-8 py-10">
				<div className="max-w-3xl mx-auto text-center space-y-4">
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

			<div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
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
					<a href="#" className="text-xs font-semibold text-primary hover:underline flex-shrink-0">
						Status page →
					</a>
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
									active={activeCategory === cat.title}
									onClick={() => setActiveCategory(activeCategory === cat.title ? null : cat.title)}
								/>
							))}
						</div>
					) : (
						<p className="text-sm text-on-surface-variant py-4">No topics match your search.</p>
					)}
				</section>

				{/* Popular articles */}
				<section>
					<h2 className="text-base font-bold text-on-surface mb-4">
						{activeCategory ? `Articles in "${activeCategory}"` : "Popular articles"}
					</h2>
					<div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest divide-y divide-outline-variant/10 overflow-hidden">
						{(activeCategory
							? filteredArticles.filter((a) => a.category === activeCategory)
							: filteredArticles
						).length > 0 ? (
							(activeCategory
								? filteredArticles.filter((a) => a.category === activeCategory)
								: filteredArticles
							).map((article) => (
								<a
									key={article.title}
									href="#"
									className="flex items-center gap-4 px-5 py-4 hover:bg-surface-container transition-colors group"
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
									<span className="text-xs text-on-surface-variant/60 flex-shrink-0">{article.views} views</span>
									<span className="material-symbols-outlined text-on-surface-variant/40 text-base group-hover:text-primary transition-colors">
										chevron_right
									</span>
								</a>
							))
						) : (
							<div className="px-5 py-8 text-center text-sm text-on-surface-variant">
								No articles found.{" "}
								<button type="button" onClick={() => setShowContact(true)} className="text-primary hover:underline font-medium">
									Contact support instead.
								</button>
							</div>
						)}
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

						<a
							href="#"
							className="flex flex-col items-start gap-3 p-5 rounded-xl border border-outline-variant/20 bg-surface-container-lowest hover:bg-surface-container-low hover:border-primary/30 transition-all group"
						>
							<span className="material-symbols-outlined text-2xl text-primary">forum</span>
							<div>
								<p className="font-semibold text-sm text-on-surface group-hover:text-primary transition-colors">Community forum</p>
								<p className="text-xs text-on-surface-variant mt-0.5">Ask the community</p>
							</div>
						</a>
					</div>
				</section>
			</div>
		</div>
	);
}
