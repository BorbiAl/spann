import React, { useEffect, useRef, useState } from "react";
import Layout from "./Layout";
import ThemeProvider from "./ThemeProvider";
import { useTheme } from "./ThemeProvider";
import Icon from "../components/Icon";
import {
	APP_NOTICE_EVENT_NAME,
	NETWORK_LOADING_EVENT_NAME,
	apiRequest,
	getAuthState,
	loginWithPassword,
	normalizeApiError,
	logoutSession,
	registerWithPassword
} from "../data/constants";

const ENTRY_STAGE_KEY = "spann-entry-stage";
const APP_DOWNLOAD_URL = "https://github.com/BorbiAl/spann/releases";
const SAVED_CREDENTIALS_KEY = "spann-saved-credentials";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EntryThemeToggle() {
	const { theme, toggleTheme } = useTheme();
	return (
		<button className="entry-theme-toggle" onClick={toggleTheme} type="button" aria-label="Toggle theme">
			<Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
			<span>{theme === "dark" ? "Light" : "Dark"} mode</span>
		</button>
	);
}

function evaluatePasswordStrength(rawPassword) {
	const password = String(rawPassword || "");
	if (!password) {
		return {
			score: 0,
			label: "No password",
			tone: "weak",
			suggestions: ["Use at least 12 characters.", "Mix letters, numbers, and symbols."]
		};
	}

	const checks = {
		length: password.length >= 12,
		mixedCase: /[a-z]/.test(password) && /[A-Z]/.test(password),
		number: /\d/.test(password),
		symbol: /[^A-Za-z0-9]/.test(password)
	};

	const score = Object.values(checks).filter(Boolean).length;
	const suggestions = [];
	if (!checks.length) {
		suggestions.push("Use at least 12 characters.");
	}
	if (!checks.mixedCase) {
		suggestions.push("Add both uppercase and lowercase letters.");
	}
	if (!checks.number) {
		suggestions.push("Add at least one number.");
	}
	if (!checks.symbol) {
		suggestions.push("Add at least one symbol like ! @ # $.");
	}

	if (score <= 1) {
		return { score, label: "Weak", tone: "weak", suggestions };
	}
	if (score === 2) {
		return { score, label: "Fair", tone: "fair", suggestions };
	}
	if (score === 3) {
		return { score, label: "Strong", tone: "strong", suggestions };
	}
	return { score, label: "Very strong", tone: "very-strong", suggestions: [] };
}

function generateStrongPassword() {
	const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
	const lowercase = "abcdefghijkmnopqrstuvwxyz";
	const digits = "23456789";
	const symbols = "!@#$%^&*()_+-=[]{}?";
	const all = uppercase + lowercase + digits + symbols;

	const required = [
		uppercase[Math.floor(Math.random() * uppercase.length)],
		lowercase[Math.floor(Math.random() * lowercase.length)],
		digits[Math.floor(Math.random() * digits.length)],
		symbols[Math.floor(Math.random() * symbols.length)]
	];

	const targetLength = 14;
	while (required.length < targetLength) {
		required.push(all[Math.floor(Math.random() * all.length)]);
	}

	for (let i = required.length - 1; i > 0; i -= 1) {
		const swapIndex = Math.floor(Math.random() * (i + 1));
		const temp = required[i];
		required[i] = required[swapIndex];
		required[swapIndex] = temp;
	}

	return required.join("");
}

function LandingScreen({ onContinueWeb, onContinueWorkspace, hasSession }) {
	return (
		<div className="entry-shell">
			<section className="entry-surface glass">
				<div className="entry-topbar">
					<EntryThemeToggle />
				</div>
				<p className="entry-kicker">SPANN</p>
				<h1 className="entry-title">Communication without barriers.</h1>
				<p className="entry-subtitle">
					A collaboration platform inspired by modern social apps, with extra support for accessibility,
					translation, and low-connectivity scenarios.
				</p>

				<div className="entry-actions">
					<button className="entry-cta primary" onClick={onContinueWeb}>
						<Icon name="chat" size={18} />
						<span>Open on Web</span>
					</button>
					<a className="entry-cta secondary" href={APP_DOWNLOAD_URL} target="_blank" rel="noreferrer">
						<Icon name="attach" size={18} />
						<span>Download App</span>
					</a>
				</div>

				{hasSession ? (
					<button className="entry-link" onClick={onContinueWorkspace}>
						Continue to workspace
					</button>
				) : null}

				<div className="entry-grid">
					<article className="entry-tile">
						<p className="entry-tile-head">Inclusive by design</p>
						<p className="entry-tile-text">Contrast controls, readability tools, and assistive-first views.</p>
					</article>
					<article className="entry-tile">
						<p className="entry-tile-head">Works when networks fail</p>
						<p className="entry-tile-text">Mesh relay and fallback messaging keep teams connected.</p>
					</article>
					<article className="entry-tile">
						<p className="entry-tile-head">Global team ready</p>
						<p className="entry-tile-text">Live language translation and cultural adaptation built into chat.</p>
					</article>
				</div>
			</section>
		</div>
	);
}

function AuthScreen({ onBack, onAuthenticated, defaultEmail }) {
	const [mode, setMode] = useState("login");
	const [name, setName] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [email, setEmail] = useState(defaultEmail || "");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [rememberSession, setRememberSession] = useState(true);
	const [savePassword, setSavePassword] = useState(false);
	const [errorText, setErrorText] = useState("");
	const [infoText, setInfoText] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
	const passwordStrength = evaluatePasswordStrength(password);

	function toFriendlyAuthError(normalized, authMode) {
		const code = String(normalized?.code || "").toLowerCase();
		const status = Number(normalized?.status || 0);
		const issues = Array.isArray(normalized?.details?.issues) ? normalized.details.issues : [];

		if (issues.length > 0) {
			const first = issues[0] || {};
			const fieldName = Array.isArray(first.loc) && first.loc.length > 0 ? String(first.loc[first.loc.length - 1]) : "field";
			const hint = first.msg ? String(first.msg) : "Invalid value";
			return `Please check ${fieldName}: ${hint}.`;
		}

		if (code === "email_already_exists") {
			return "This email is already registered. Try signing in or use Forgot password.";
		}

		if (code === "invalid_credentials") {
			return "We could not sign you in. Check your email and password, then try again.";
		}

		if (code === "register_failed") {
			return "We could not create your account right now. Please try again later, or use Sign In / Forgot password if you already have an account.";
		}

		if (code === "too_many_requests") {
			return "Too many attempts right now. Please wait a minute and try again.";
		}

		if (status === 422 && authMode === "register") {
			return "Some registration details are invalid. Please review the form and try again.";
		}

		if (status === 422 && authMode === "login") {
			return "Some sign-in details are invalid. Please review the form and try again.";
		}

		if (status === 429) {
			return "Too many attempts right now. Please wait a minute and try again.";
		}

		if (status >= 500) {
			return "The server is having trouble right now. Please try again in a moment.";
		}

		return normalized?.message || "Authentication failed. Please try again.";
	}

	useEffect(() => {
		const saved = localStorage.getItem(SAVED_CREDENTIALS_KEY);
		if (!saved) {
			return;
		}

		try {
			const parsed = JSON.parse(saved);
			if (parsed?.email) {
				setEmail(String(parsed.email));
			}
			if (parsed?.password) {
				setPassword(String(parsed.password));
				setSavePassword(true);
			}
		} catch (error) {
			localStorage.removeItem(SAVED_CREDENTIALS_KEY);
		}
	}, []);

	useEffect(() => {
		setErrorText("");
		setInfoText("");
	}, [mode]);

	async function handleSubmit(event) {
		event.preventDefault();
		if (!email.trim() || !password || isSubmitting) {
			return;
		}

		if (!EMAIL_PATTERN.test(email.trim())) {
			setErrorText("Please enter a valid email address.");
			return;
		}

		if (mode === "register" && !name.trim()) {
			setErrorText("Name is required to create a new account.");
			return;
		}

		if (mode === "register" && passwordStrength.score < 3) {
			setErrorText("Please choose a stronger password before creating your account.");
			return;
		}

		if (mode === "register" && password !== confirmPassword) {
			setErrorText("Passwords do not match. Please re-enter them.");
			return;
		}

		setErrorText("");
		setInfoText("");
		setIsSubmitting(true);

		try {
			if (mode === "register") {
				const result = await registerWithPassword({
					email: email.trim(),
					password,
					name: name.trim(),
					companyName: companyName.trim() || null,
					persistSession: rememberSession,
					deviceHint: "web-client"
				});
				onAuthenticated(result.authState);
			} else {
				const result = await loginWithPassword({
					email: email.trim(),
					password,
					persistSession: rememberSession,
					deviceHint: "web-client"
				});
				onAuthenticated(result.authState);
			}

			if (savePassword) {
				localStorage.setItem(
					SAVED_CREDENTIALS_KEY,
					JSON.stringify({
						email: email.trim(),
						password
					})
				);
			} else {
				localStorage.removeItem(SAVED_CREDENTIALS_KEY);
			}
		} catch (error) {
			const normalized = normalizeApiError(error, "Authentication failed");
			setErrorText(toFriendlyAuthError(normalized, mode));
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleForgotPassword() {
		if (isSendingMagicLink) {
			return;
		}

		if (!email.trim()) {
			setErrorText("Enter your email first, then press Forgot password.");
			return;
		}

		if (!EMAIL_PATTERN.test(email.trim())) {
			setErrorText("Please enter a valid email address.");
			return;
		}

		setErrorText("");
		setInfoText("Sending password reset link...");
		setIsSendingMagicLink(true);

		try {
			await apiRequest("/auth/magic-link", {
				method: "POST",
				auth: false,
				timeoutMs: 12000,
				body: JSON.stringify({ email: email.trim() })
			});
			setInfoText("If this email exists, a reset sign-in link has been sent. Check inbox and spam.");
		} catch (error) {
			const normalized = normalizeApiError(error, "Could not send reset link");
			const networkIssue = /failed to fetch|network|aborted|timeout/i.test(String(normalized.message || ""));
			if (networkIssue) {
				setErrorText("Could not contact the server. Please make sure the backend is running, then try again.");
			} else {
				setErrorText(toFriendlyAuthError(normalized, "login"));
			}
			setInfoText("");
		} finally {
			setIsSendingMagicLink(false);
		}
	}

	return (
		<div className="auth-shell">
			<section className="auth-card glass">
				<div className="entry-topbar">
					<EntryThemeToggle />
				</div>
				<div className="auth-head">
					<p className="entry-kicker">Welcome back</p>
					<h2>{mode === "login" ? "Sign in to Spann" : "Create your Spann account"}</h2>
					<p>Continue to your team channels, accessibility settings, and translation workspace.</p>
				</div>

				<div className="auth-mode-toggle" role="tablist" aria-label="Authentication mode">
					<button
						type="button"
						className={`auth-mode-btn ${mode === "login" ? "active" : ""}`}
						onClick={() => setMode("login")}
					>
						Sign In
					</button>
					<button
						type="button"
						className={`auth-mode-btn ${mode === "register" ? "active" : ""}`}
						onClick={() => setMode("register")}
					>
						Register
					</button>
				</div>

				<form className="auth-form" onSubmit={handleSubmit}>
					{mode === "register" ? (
						<label className="auth-field">
							<span>Full name</span>
							<input
								type="text"
								className="auth-input"
								value={name}
								onChange={(event) => setName(event.target.value)}
								required
							/>
						</label>
					) : null}

					{mode === "register" ? (
						<label className="auth-field">
							<span>Company name (optional)</span>
							<input
								type="text"
								className="auth-input"
								value={companyName}
								onChange={(event) => setCompanyName(event.target.value)}
								placeholder="e.g. Elsys"
							/>
						</label>
					) : null}

					<label className="auth-field">
						<span>Email</span>
						<input
							type="email"
							className="auth-input"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							required
						/>
					</label>

					<label className="auth-field">
						<span>Password</span>
						<div className="auth-password-row">
							<input
								type={showPassword ? "text" : "password"}
								className="auth-input"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								minLength={8}
								required
							/>
							{mode === "register" ? (
								<button
									type="button"
									className="auth-pass-suggest"
									onClick={() => {
										const suggested = generateStrongPassword();
										setPassword(suggested);
										setConfirmPassword(suggested);
										setInfoText("A strong password was generated. You can edit it before submitting.");
										setErrorText("");
									}}
								>
									Suggest
								</button>
							) : null}
							<button
								type="button"
								className="auth-pass-toggle"
								onClick={() => setShowPassword((current) => !current)}
							>
								{showPassword ? "Hide" : "Show"}
							</button>
						</div>
						{mode === "register" ? (
							<div className="password-strength">
								<div className="password-strength-head">
									<span>Password strength</span>
									<strong className={`password-strength-label ${passwordStrength.tone}`}>{passwordStrength.label}</strong>
								</div>
								<div className="password-strength-track" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={passwordStrength.score}>
									<div className={`password-strength-fill ${passwordStrength.tone}`} style={{ width: `${(passwordStrength.score / 4) * 100}%` }} />
								</div>
								{passwordStrength.suggestions.length > 0 ? (
									<p className="password-strength-note">Tip: {passwordStrength.suggestions[0]}</p>
								) : (
									<p className="password-strength-note success">Great password strength.</p>
								)}
							</div>
						) : null}
					</label>

					{mode === "register" ? (
						<label className="auth-field">
							<span>Confirm password</span>
							<div className="auth-password-row">
								<input
									type={showConfirmPassword ? "text" : "password"}
									className="auth-input"
									value={confirmPassword}
									onChange={(event) => setConfirmPassword(event.target.value)}
									minLength={8}
									required
								/>
								<button
									type="button"
									className="auth-pass-toggle"
									onClick={() => setShowConfirmPassword((current) => !current)}
								>
									{showConfirmPassword ? "Hide" : "Show"}
								</button>
							</div>
						</label>
					) : null}

					{mode === "login" ? (
						<button
							type="button"
							className="auth-text-link"
							onClick={handleForgotPassword}
							disabled={isSendingMagicLink}
						>
							{isSendingMagicLink ? "Sending reset link..." : "Forgot password?"}
						</button>
					) : null}

					<label className="auth-check">
						<input
							type="checkbox"
							checked={rememberSession}
							onChange={(event) => setRememberSession(event.target.checked)}
						/>
						<span>Remember my session on this device</span>
					</label>

					<label className="auth-check">
						<input
							type="checkbox"
							checked={savePassword}
							onChange={(event) => setSavePassword(event.target.checked)}
						/>
						<span>Save password on this device</span>
					</label>

					{errorText ? <p className="auth-error">{errorText}</p> : null}
					{infoText ? <p className="auth-info">{infoText}</p> : null}

					<button type="submit" className="accent-btn auth-submit">
						{isSubmitting ? "Please wait..." : mode === "login" ? "Enter Workspace" : "Create and Enter"}
					</button>
				</form>

				<button className="entry-link" onClick={onBack}>
					Back to landing
				</button>
			</section>
		</div>
	);
}

function AppBusyIndicator({ visible }) {
	if (!visible) {
		return null;
	}

	return (
		<div className="app-busy-indicator" role="status" aria-live="polite" aria-atomic="true">
			<span className="busy-spinner" aria-hidden="true" />
			<span>Working...</span>
		</div>
	);
}

function AppNotice({ notice }) {
	if (!notice?.message) {
		return null;
	}

	return (
		<div className={`app-notice ${notice.tone || "info"}`} role="status" aria-live="polite" aria-atomic="true">
			<span>{notice.message}</span>
		</div>
	);
}

function AppFlow() {
	const initialAuth = getAuthState();
	const clickFeedbackTimerRef = useRef(null);
	const noticeTimerRef = useRef(null);
	const [entryStage, setEntryStage] = useState(() => {
		if (initialAuth?.accessToken) {
			return "workspace";
		}

		const raw = localStorage.getItem(ENTRY_STAGE_KEY);
		if (raw === "landing" || raw === "auth" || raw === "workspace") {
			return raw;
		}
		return "landing";
	});
	const [authState, setAuthState] = useState(initialAuth);
	const [buttonBusy, setButtonBusy] = useState(false);
	const [networkBusy, setNetworkBusy] = useState(false);
	const [notice, setNotice] = useState(null);

	useEffect(() => {
		localStorage.setItem(ENTRY_STAGE_KEY, entryStage);
	}, [entryStage]);

	useEffect(() => {
		function showButtonFeedback() {
			setButtonBusy(true);
			if (clickFeedbackTimerRef.current) {
				clearTimeout(clickFeedbackTimerRef.current);
			}

			clickFeedbackTimerRef.current = setTimeout(() => {
				setButtonBusy(false);
				clickFeedbackTimerRef.current = null;
			}, 700);
		}

		function handleDocumentClick(event) {
			const target = event.target;
			if (!(target instanceof Element)) {
				return;
			}

			const button = target.closest("button");
			if (!button || button.disabled) {
				return;
			}

			showButtonFeedback();
		}

		function handleDocumentSubmit(event) {
			if (event.target instanceof HTMLFormElement) {
				showButtonFeedback();
			}
		}

		function handleNetworkLoading(event) {
			const pending = Number(event?.detail?.pending || 0);
			setNetworkBusy(pending > 0);
		}

		function handleAppNotice(event) {
			const detail = event?.detail || {};
			const message = String(detail.message || "").trim();
			if (!message) {
				return;
			}

			setNotice({ message, tone: detail.tone || "info" });
			if (noticeTimerRef.current) {
				clearTimeout(noticeTimerRef.current);
			}
			noticeTimerRef.current = setTimeout(() => {
				setNotice(null);
				noticeTimerRef.current = null;
			}, 2200);
		}

		document.addEventListener("click", handleDocumentClick, true);
		document.addEventListener("submit", handleDocumentSubmit, true);
		window.addEventListener(NETWORK_LOADING_EVENT_NAME, handleNetworkLoading);
		window.addEventListener(APP_NOTICE_EVENT_NAME, handleAppNotice);

		return () => {
			document.removeEventListener("click", handleDocumentClick, true);
			document.removeEventListener("submit", handleDocumentSubmit, true);
			window.removeEventListener(NETWORK_LOADING_EVENT_NAME, handleNetworkLoading);
			window.removeEventListener(APP_NOTICE_EVENT_NAME, handleAppNotice);
			if (clickFeedbackTimerRef.current) {
				clearTimeout(clickFeedbackTimerRef.current);
				clickFeedbackTimerRef.current = null;
			}
			if (noticeTimerRef.current) {
				clearTimeout(noticeTimerRef.current);
				noticeTimerRef.current = null;
			}
		};
	}, []);

	const hasSession = Boolean(authState?.accessToken);
	const isWorking = buttonBusy || networkBusy;

	async function handleLogout() {
		await logoutSession();
		setAuthState(null);
		setEntryStage("landing");
	}

	let content;
	if (entryStage === "landing") {
		content = (
			<LandingScreen
				onContinueWeb={() => setEntryStage("auth")}
				onContinueWorkspace={() => setEntryStage(hasSession ? "workspace" : "auth")}
				hasSession={hasSession}
			/>
		);
	} else if (entryStage === "auth") {
		content = (
			<AuthScreen
				onBack={() => setEntryStage("landing")}
				onAuthenticated={(nextAuthState) => {
					setAuthState(nextAuthState);
					setEntryStage("workspace");
				}}
				defaultEmail={authState?.user?.email || ""}
			/>
		);
	} else {
		content = (
			<Layout
				authState={authState}
				onLogout={handleLogout}
				onSessionExpired={() => {
					setAuthState(null);
					setEntryStage("auth");
				}}
			/>
		);
	}

	return (
		<>
			{content}
			<AppBusyIndicator visible={isWorking} />
			<AppNotice notice={notice} />
		</>
	);
}

export default function App() {
	return (
		<ThemeProvider>
			<AppFlow />
		</ThemeProvider>
	);
}