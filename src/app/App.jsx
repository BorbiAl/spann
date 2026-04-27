/* eslint-disable @typescript-eslint/no-unused-vars */
import './App.css';
import React, { useEffect, useRef, useState } from "react";
import Layout from "./Layout";
import ThemeProvider from "./ThemeProvider";
import { useTheme } from "./ThemeProvider";
import {
	ACCESSIBILITY_PREFS_EVENT,
	ACCESSIBILITY_PREFS_KEY,
	applyAccessibilityPreferencesGlobal,
	loadAccessibilityPreferencesGlobal,
} from "./accessibility";
import Icon from "../components/Icon";
import {
	APP_NOTICE_EVENT_NAME,
	AUTH_STATE_UPDATED_EVENT_NAME,
	apiRequest,
	createOrganization,
	decideOrganizationInvitation,
	decideOrganizationJoinRequest,
	fetchOrganizationMembers,
	fetchOrganizationOnboarding,
	getAuthState,
	inviteOrganizationMember,
	loginWithPassword,
	normalizeApiError,
	removeOrganizationMember,
	logoutSession,
	registerWithPassword,
	requestOrganizationJoin,
	setAuthState
} from "../data/constants";
import { isDemoMode, setDemoMode } from "../lib/demoMode";

const ENTRY_STAGE_KEY = "spann-entry-stage";
const APP_DOWNLOAD_URL = "https://github.com/BorbiAl/spann/releases";
const SAVED_CREDENTIALS_KEY = "spann-saved-credentials";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loadCredentialFromBrowser() {
	if (typeof window === "undefined" || !navigator?.credentials?.get) {
		return null;
	}

	try {
		const credential = await navigator.credentials.get({
			password: true,
			mediation: "optional"
		});
		if (!credential || credential.type !== "password") {
			return null;
		}

		return {
			email: String(credential.id || "").trim(),
			password: String(credential.password || "")
		};
	} catch {
		return null;
	}
}

async function saveCredentialToBrowser({ email, password }) {
	if (typeof window === "undefined" || !window.PasswordCredential || !navigator?.credentials?.store) {
		return;
	}

	const normalizedEmail = String(email || "").trim();
	const rawPassword = String(password || "");
	if (!normalizedEmail || !rawPassword) {
		return;
	}

	try {
		const credential = new window.PasswordCredential({
			id: normalizedEmail,
			password: rawPassword,
			name: normalizedEmail
		});
		await navigator.credentials.store(credential);
	} catch {
		// Ignore if browser blocks credential store or does not support it in this context.
	}
}

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


function LandingScreen({ onContinueWeb, onContinueWorkspace, onTryDemo, hasSession }) {
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
					<button className="entry-cta secondary" onClick={onTryDemo} type="button">
						<Icon name="bolt" size={18} />
						<span>Try Demo</span>
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

function AuthScreen({ onAuthenticated, defaultEmail }) {
	const [mode, setMode] = useState("login");
	const [name, setName] = useState("");
	const [email, setEmail] = useState(defaultEmail || "");
	const [locale, setLocale] = useState("en-US");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showRegisterPasswords, setShowRegisterPasswords] = useState(false);
	const [rememberEmail, setRememberEmail] = useState(false);
	const [agreeTerms, setAgreeTerms] = useState(false);
	const [errorText, setErrorText] = useState("");
	const [infoText, setInfoText] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
	const passwordStrength = evaluatePasswordStrength(password);
	const securePercent = Math.max(15, Math.min(100, passwordStrength.score * 25));

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

		if (code === "passwords_do_not_match") {
			return "Passwords do not match. Please re-enter them.";
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
			loadCredentialFromBrowser().then((credential) => {
				if (!credential) {
					return;
				}
				if (credential.email) {
					setEmail(credential.email);
					setRememberEmail(true);
				}
				if (credential.password) {
					setPassword(credential.password);
				}
			});
			return;
		}

		try {
			const parsed = JSON.parse(saved);
			if (parsed?.email) {
				setEmail(String(parsed.email));
				setRememberEmail(true);
			}
		} catch (error) {
			localStorage.removeItem(SAVED_CREDENTIALS_KEY);
		}

		loadCredentialFromBrowser().then((credential) => {
			if (!credential) {
				return;
			}
			if (credential.email) {
				setEmail(credential.email);
				setRememberEmail(true);
			}
			if (credential.password) {
				setPassword(credential.password);
			}
		});
	}, []);

	useEffect(() => {
		setErrorText("");
		setInfoText("");
		setShowRegisterPasswords(false);
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

		if (mode === "register" && password !== confirmPassword) {
			setErrorText("Passwords do not match. Please re-enter them.");
			return;
		}

		if (mode === "register" && !agreeTerms) {
			setErrorText("Please agree to the Terms of Service and Privacy Policy.");
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
					confirmPassword,
					name: name.trim(),
					companyName: null,
					locale,
					persistSession: true,
					deviceHint: "web-client"
				});
				onAuthenticated(result.authState);
			} else {
				const result = await loginWithPassword({
					email: email.trim(),
					password,
					persistSession: true,
					deviceHint: "web-client"
				});
				onAuthenticated(result.authState);
			}

			if (rememberEmail) {
				localStorage.setItem(
					SAVED_CREDENTIALS_KEY,
					JSON.stringify({
						email: email.trim()
					})
				);
				await saveCredentialToBrowser({ email: email.trim(), password });
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
		<div className={`auth-shell auth-mode-${mode}`}>
			<div className="auth-theme-toggle-wrap">
				<EntryThemeToggle />
			</div>
			{errorText ? (
				<div className="auth-banner error" role="alert" aria-live="assertive">
					<span className="auth-banner-leading" aria-hidden="true">!</span>
					<span>{errorText}</span>
					<button type="button" onClick={() => setErrorText("")} aria-label="Dismiss alert">
						<Icon name="close" size={14} />
					</button>
				</div>
			) : null}
			{!errorText && infoText ? (
				<div className="auth-banner info" role="status" aria-live="polite">
					<span className="auth-banner-leading" aria-hidden="true">i</span>
					<span>{infoText}</span>
					<button type="button" onClick={() => setInfoText("")} aria-label="Dismiss info">
						<Icon name="close" size={14} />
					</button>
				</div>
			) : null}
			<section className={`auth-card ${mode === "register" ? "register" : "login"}`}>
				{mode === "register" ? (
					<aside className="auth-aside">
						<div className="auth-aside-brand">
							<div className="logo-chip">
								<svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
									<circle cx="14" cy="14" r="2.4" fill="currentColor" />
									<circle cx="14" cy="5" r="1.8" fill="currentColor" fillOpacity="0.95" />
									<circle cx="14" cy="23" r="1.8" fill="currentColor" fillOpacity="0.95" />
									<circle cx="5" cy="14" r="1.8" fill="currentColor" fillOpacity="0.95" />
									<circle cx="23" cy="14" r="1.8" fill="currentColor" fillOpacity="0.95" />
									<circle cx="7.6" cy="7.6" r="1.6" fill="currentColor" fillOpacity="0.9" />
									<circle cx="20.4" cy="7.6" r="1.6" fill="currentColor" fillOpacity="0.9" />
									<circle cx="7.6" cy="20.4" r="1.6" fill="currentColor" fillOpacity="0.9" />
									<circle cx="20.4" cy="20.4" r="1.6" fill="currentColor" fillOpacity="0.9" />
									<path d="M14 7.8V11.2M14 16.8V20.2M7.8 14H11.2M16.8 14H20.2M9.4 9.4L11.8 11.8M16.2 16.2L18.6 18.6M18.6 9.4L16.2 11.8M11.8 16.2L9.4 18.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.78" />
								</svg>
							</div>
							<p className="auth-brand-wordmark">Spann</p>
						</div>
						<h3>The future of collaborative communication starts here.</h3>
						<p>Join a workspace built on atmospheric focus and seamless connectivity.</p>
						<div className="auth-aside-list">
							<div className="auth-feature-row">
								<div className="auth-feature-icon">
									<Icon name="security" size={16} />
								</div>
								<div>
									<strong>Enterprise Security</strong>
									<span>End-to-end encrypted messaging.</span>
								</div>
							</div>
							<div className="auth-feature-row">
								<div className="auth-feature-icon">
									<Icon name="bolt" size={16} />
								</div>
								<div>
									<strong>Instant Sync</strong>
									<span>Unified across all your devices.</span>
								</div>
							</div>
						</div>
					</aside>
				) : null}

				<div className={`auth-main ${mode === "register" ? "auth-main-register" : ""}`}>
					<div className="auth-head">
						{mode === "login" ? (
							<div className="auth-login-brand">
								<div className="auth-login-logo">
									<Icon name="hub" size={15} />
								</div>
								<strong>Spann</strong>
							</div>
						) : null}
						<h2>{mode === "login" ? "Sign in" : "Create an account"}</h2>
						{mode === "login" ? (
							<p>Access your premium workspace</p>
						) : (
							<p>
								Already have an account?{" "}
								<button type="button" className="auth-text-link inline" onClick={() => setMode("login")}>
									Log in
								</button>
							</p>
						)}
					</div>

					<form className={`auth-form ${mode === "register" ? "auth-register-form" : ""}`} onSubmit={handleSubmit}>
						{mode === "register" ? (
							<>
								<label className="auth-field">
									<span>Full name</span>
									<input
										type="text"
										className="auth-input"
										autoComplete="name"
										name="name"
										value={name}
										onChange={(event) => setName(event.target.value)}
										placeholder="John Doe"
										required
									/>
								</label>

								<label className="auth-field">
									<span>Email address</span>
									<input
										type="email"
										className="auth-input"
										autoComplete="username"
										name="email"
										value={email}
										onChange={(event) => setEmail(event.target.value)}
										placeholder="name@company.com"
										required
									/>
								</label>

									<div className="auth-form-grid">
										<label className="auth-field">
											<span>Preferred language</span>
											<select className="auth-input" value={locale} onChange={(event) => setLocale(event.target.value)}>
												<option value="en-US">English (US)</option>
												<option value="en-GB">English (UK)</option>
												<option value="bg-BG">Bulgarian</option>
												<option value="es-ES">Spanish</option>
												<option value="fr-FR">French</option>
												<option value="de-DE">German</option>
												<option value="it-IT">Italian</option>
												<option value="pt-BR">Portuguese (BR)</option>
												<option value="tr-TR">Turkish</option>
												<option value="ar-SA">Arabic</option>
												<option value="hi-IN">Hindi</option>
												<option value="zh-CN">Chinese (Simplified)</option>
												<option value="ja-JP">Japanese</option>
												<option value="ko-KR">Korean</option>
											</select>
										</label>

									</div>

								<div className="auth-form-grid">
									<label className="auth-field">
										<span>Password</span>
										<div className="auth-input-wrap">
											<input
												type={showRegisterPasswords ? "text" : "password"}
												className="auth-input"
													autoComplete="new-password"
													name="new-password"
												value={password}
												onChange={(event) => setPassword(event.target.value)}
												placeholder="••••••••"
												minLength={8}
												required
											/>
											<button
												type="button"
												className="auth-pass-toggle"
												onClick={() => setShowRegisterPasswords((value) => !value)}
												aria-label={showRegisterPasswords ? "Hide password" : "Preview password"}
											>
												{showRegisterPasswords ? (
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
														<path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
														<path d="M10.6 10.6A2 2 0 0012 14a2 2 0 001.4-.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
														<path d="M9.9 4.2A10.9 10.9 0 0112 4c5.2 0 8.9 3.4 10 8-0.4 1.6-1.3 3.1-2.5 4.3M6.2 6.2A11.4 11.4 0 002 12c1.1 4.6 4.8 8 10 8 1.8 0 3.5-.4 5-1.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
													</svg>
												) : (
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
														<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
														<circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
													</svg>
												)}
											</button>
										</div>
									</label>
									<label className="auth-field">
										<span>Confirm password</span>
										<div className="auth-input-wrap">
											<input
												type={showRegisterPasswords ? "text" : "password"}
												className="auth-input"
													autoComplete="new-password"
													name="confirm-password"
												value={confirmPassword}
												onChange={(event) => setConfirmPassword(event.target.value)}
												placeholder="••••••••"
												minLength={8}
												required
											/>
											<button
												type="button"
												className="auth-pass-toggle"
												onClick={() => setShowRegisterPasswords((value) => !value)}
												aria-label={showRegisterPasswords ? "Hide password confirmation" : "Preview password confirmation"}
											>
												{showRegisterPasswords ? (
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
														<path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
														<path d="M10.6 10.6A2 2 0 0012 14a2 2 0 001.4-.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
														<path d="M9.9 4.2A10.9 10.9 0 0112 4c5.2 0 8.9 3.4 10 8-0.4 1.6-1.3 3.1-2.5 4.3M6.2 6.2A11.4 11.4 0 002 12c1.1 4.6 4.8 8 10 8 1.8 0 3.5-.4 5-1.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
													</svg>
												) : (
													<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
														<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
														<circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
													</svg>
												)}
											</button>
										</div>
									</label>
								</div>

								<div className="password-strength register-style">
									<div className="password-strength-head">
										<span>
											Strength: <strong className={`password-strength-label ${passwordStrength.tone}`}>{passwordStrength.label}</strong>
										</span>
										<span>{securePercent}% secure</span>
									</div>
									<div className="password-strength-track" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={passwordStrength.score}>
										<div className={`password-strength-fill ${passwordStrength.tone}`} style={{ width: `${securePercent}%` }} />
									</div>
									<p className="password-strength-note">Hint: Use at least 12 characters, including numbers and symbols.</p>
								</div>

								<label className="auth-check register-check">
									<input type="checkbox" checked={agreeTerms} onChange={(event) => setAgreeTerms(event.target.checked)} />
									<span>
										I agree to the <a href="https://github.com/BorbiAl/spann/blob/main/README.md" target="_blank" rel="noreferrer">Terms of Service</a> and <a href="https://github.com/BorbiAl/spann/blob/main/README.md" target="_blank" rel="noreferrer">Privacy Policy</a>.
									</span>
								</label>

								<button type="submit" className="accent-btn auth-submit" disabled={isSubmitting}>
									{isSubmitting ? "Registering..." : "Register"}
									<span className="auth-submit-arrow">→</span>
								</button>

								<div className="auth-social-row" aria-hidden="true">
									<button type="button" className="auth-social-btn">
										<span className="auth-social-logo google" aria-hidden="true"></span>
										Google
									</button>
									<button type="button" className="auth-social-btn">
										<span className="auth-social-logo microsoft" aria-hidden="true"></span>
										Microsoft
									</button>
								</div>
							</>
						) : (
							<>
								<input
									type="text"
									className="auth-input"
									autoComplete="username"
									name="username"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									placeholder="Email, phone, or Skype"
									required
								/>
								<input
									type="password"
									className="auth-input"
									autoComplete="current-password"
									name="password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									placeholder="Password"
									required
								/>

								<div className="auth-inline-row">
									<label className="auth-check compact">
										<input
											type="checkbox"
											checked={rememberEmail}
											onChange={(event) => setRememberEmail(event.target.checked)}
										/>
										<span>Remember email</span>
									</label>
									<button type="button" className="auth-text-link inline" onClick={handleForgotPassword} disabled={isSendingMagicLink}>
										{isSendingMagicLink ? "Sending..." : "Forgot password?"}
									</button>
								</div>

								<button type="submit" className="accent-btn auth-submit" disabled={isSubmitting}>
									{isSubmitting ? "Signing in..." : "Sign In"}
								</button>

								<p className="auth-inline-note">
									No account?{" "}
									<button type="button" className="auth-text-link inline" onClick={() => setMode("register")}>Create an account</button>
								</p>
							</>
						)}
					</form>
				</div>
			</section>
			{mode === "register" ? (
				<div className="auth-security-note">
					<div className="auth-security-icon">
						<Icon name="security" size={14} />
					</div>
					<p>Your data is stored securely using industry-standard AES-256 encryption.</p>
				</div>
			) : null}
			{mode === "login" ? (
				<div className="auth-login-footer">
					<span>Terms of use</span>
					<span>Privacy &amp; cookies</span>
					<span>© 2026 Spann</span>
				</div>
			) : null}
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
	const noticeTimerRef = useRef(null);
	const [entryStage, setEntryStage] = useState(() => {
		if (initialAuth?.accessToken) {
			return "organization";
		}

		const raw = localStorage.getItem(ENTRY_STAGE_KEY);
		if (raw === "landing" || raw === "auth" || raw === "organization" || raw === "workspace") {
			return raw;
		}
		return "landing";
	});
	const [authState, setAuthState] = useState(initialAuth);
	const [notice, setNotice] = useState(null);

	useEffect(() => {
		function handleAuthStateUpdated(event) {
			const nextAuth = event?.detail?.authState;
			setAuthState(nextAuth || null);
		}

		window.addEventListener(AUTH_STATE_UPDATED_EVENT_NAME, handleAuthStateUpdated);
		return () => window.removeEventListener(AUTH_STATE_UPDATED_EVENT_NAME, handleAuthStateUpdated);
	}, []);

	useEffect(() => {
		function applyFromStorage() {
			applyAccessibilityPreferencesGlobal(loadAccessibilityPreferencesGlobal());
		}

		function handleStorage(event) {
			if (event?.key && event.key !== ACCESSIBILITY_PREFS_KEY) {
				return;
			}
			applyFromStorage();
		}

		applyFromStorage();
		window.addEventListener("storage", handleStorage);
		window.addEventListener(ACCESSIBILITY_PREFS_EVENT, applyFromStorage);

		return () => {
			window.removeEventListener("storage", handleStorage);
			window.removeEventListener(ACCESSIBILITY_PREFS_EVENT, applyFromStorage);
		};
	}, []);

	useEffect(() => {
		localStorage.setItem(ENTRY_STAGE_KEY, entryStage);
	}, [entryStage]);

	useEffect(() => {
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

		window.addEventListener(APP_NOTICE_EVENT_NAME, handleAppNotice);

		return () => {
			window.removeEventListener(APP_NOTICE_EVENT_NAME, handleAppNotice);
			if (noticeTimerRef.current) {
				clearTimeout(noticeTimerRef.current);
				noticeTimerRef.current = null;
			}
		};
	}, []);

	const hasSession = Boolean(authState?.accessToken);

	async function handleLogout() {
		setDemoMode(false);
		await logoutSession();
		setAuthState(null);
		setEntryStage("landing");
	}

	function handleEnterDemo() {
		setDemoMode(true);
		// Provide a minimal auth state — never persisted, only in component state
		setAuthState({
			accessToken: "demo",
			refreshToken: "demo",
			workspaceId: "demo-workspace",
			userId: "demo-user",
			user: {
				display_name: "Demo User",
				email: "demo@spann.app",
				role: "member",
				locale: "en-US",
			},
			persist: false,
		});
		setEntryStage("workspace");
	}

	// Auto-enter demo mode if URL param was set before mount
	useEffect(() => {
		if (isDemoMode() && entryStage === "landing") {
			handleEnterDemo();
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	let content;
	if (entryStage === "landing") {
		content = (
			<LandingScreen
				onContinueWeb={() => setEntryStage("auth")}
				onContinueWorkspace={() => setEntryStage(hasSession ? "organization" : "auth")}
				onTryDemo={handleEnterDemo}
				hasSession={hasSession}
			/>
		);
	} else if (entryStage === "auth") {
		content = (
			<AuthScreen
				onBack={() => setEntryStage("landing")}
				onAuthenticated={(nextAuthState) => {
					setAuthState(nextAuthState);
					setEntryStage("organization");
				}}
				defaultEmail={authState?.user?.email || ""}
			/>
		);
	} else if (entryStage === "organization") {
		content = (
			<OrganizationOnboardingScreen
				authState={authState}
				onWorkspaceReady={(nextAuthState) => {
					setAuthState(nextAuthState || authState);
					setEntryStage("workspace");
				}}
				onLogout={handleLogout}
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

function OrganizationOnboardingScreen({ authState, onWorkspaceReady, onLogout }) {
	const [mode, setMode] = useState("create");
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [errorText, setErrorText] = useState("");
	const [infoText, setInfoText] = useState("");
	const [createName, setCreateName] = useState("");
	const [inviteEmails, setInviteEmails] = useState("");
	const [joinMessage, setJoinMessage] = useState("");
	const [workspaceMembers, setWorkspaceMembers] = useState([]);
	const [membersLoading, setMembersLoading] = useState(false);
	const [state, setState] = useState({
		my_organizations: [],
		discoverable_organizations: [],
		pending_invitations: [],
		pending_join_requests: [],
		current_workspace_id: ""
	});

	async function loadState() {
		setLoading(true);
		setErrorText("");
		try {
			const payload = await fetchOrganizationOnboarding();
			setState({
				my_organizations: Array.isArray(payload?.my_organizations) ? payload.my_organizations : [],
				discoverable_organizations: Array.isArray(payload?.discoverable_organizations) ? payload.discoverable_organizations : [],
				pending_invitations: Array.isArray(payload?.pending_invitations) ? payload.pending_invitations : [],
				pending_join_requests: Array.isArray(payload?.pending_join_requests) ? payload.pending_join_requests : [],
				current_workspace_id: String(payload?.current_workspace_id || "")
			});
		} catch (error) {
			const normalized = normalizeApiError(error, "Could not load organization setup state.");
			setErrorText(normalized.message || "Could not load organization setup state.");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		loadState();
	}, []);

	function persistWorkspaceId(workspaceId, workspaceMeta = null) {
		const nextUser = {
			...(authState?.user || {}),
			...(workspaceMeta?.role ? { role: workspaceMeta.role } : {}),
			...(workspaceMeta?.name ? { workspace_name: workspaceMeta.name } : {}),
		};
		const nextAuthState = {
			...(authState || {}),
			workspaceId: workspaceId || authState?.workspaceId || "",
			user: nextUser
		};
		const saved = setAuthState(nextAuthState, {
			persist: Boolean(authState?.persist)
		});
		onWorkspaceReady(saved || nextAuthState);
	}

	async function handleCreateOrganization(event) {
		event.preventDefault();
		if (submitting) {
			return;
		}

		if (!createName.trim()) {
			setErrorText("Organization name is required.");
			return;
		}

		setSubmitting(true);
		setErrorText("");
		setInfoText("");

		try {
			const created = await createOrganization({ name: createName.trim() });
			const organization = created?.organization || created || {};
			const workspaceId = String(organization.id || organization.workspace_id || "");
			if (!workspaceId) {
				throw new Error("Organization was created but workspace id is missing.");
			}

			const emails = inviteEmails
				.split(/[\n,;]+/)
				.map((email) => String(email || "").trim().toLowerCase())
				.filter((email) => EMAIL_PATTERN.test(email));

			let invitedCount = 0;
			for (const email of emails) {
				try {
					await inviteOrganizationMember({
						workspaceId,
						email,
						note: "You have been invited to join this organization."
					});
					invitedCount += 1;
				} catch {
					// Continue inviting remaining emails even if one fails.
				}
			}

			if (invitedCount > 0) {
				setInfoText(`Organization created. Sent ${invitedCount} invitation${invitedCount === 1 ? "" : "s"}.`);
			} else {
				setInfoText("Organization created successfully.");
			}

			persistWorkspaceId(workspaceId, {
				role: "owner",
				name: String(organization.name || createName.trim())
			});
		} catch (error) {
			const normalized = normalizeApiError(error, "Could not create organization.");
			setErrorText(normalized.message || "Could not create organization.");
		} finally {
			setSubmitting(false);
		}
	}

	async function handleJoinRequest(workspaceId) {
		if (!workspaceId || submitting) {
			return;
		}

		setSubmitting(true);
		setErrorText("");
		setInfoText("");
		try {
			await requestOrganizationJoin({ workspaceId, message: joinMessage.trim() || null });
			setInfoText("Join request submitted. An owner will approve or reject it.");
			await loadState();
		} catch (error) {
			const normalized = normalizeApiError(error, "Could not submit join request.");
			setErrorText(normalized.message || "Could not submit join request.");
		} finally {
			setSubmitting(false);
		}
	}

	async function handleJoinDecision(joinRequestId, decision) {
		if (!joinRequestId || submitting) {
			return;
		}

		setSubmitting(true);
		setErrorText("");
		setInfoText("");
		try {
			await decideOrganizationJoinRequest({ joinRequestId, decision });
			setInfoText(decision === "approve" ? "Join request approved." : "Join request rejected.");
			await loadState();
		} catch (error) {
			const normalized = normalizeApiError(error, "Could not update join request.");
			setErrorText(normalized.message || "Could not update join request.");
		} finally {
			setSubmitting(false);
		}
	}

	async function handleInvitationDecision(invitationId, decision, workspaceId) {
		if (!invitationId || submitting) {
			return;
		}

		setSubmitting(true);
		setErrorText("");
		setInfoText("");
		try {
			await decideOrganizationInvitation({ invitationId, decision });
			if (decision === "accept") {
				setInfoText("Invitation accepted.");
				persistWorkspaceId(workspaceId || authState?.workspaceId || "");
				return;
			}
			setInfoText("Invitation rejected.");
			await loadState();
		} catch (error) {
			const normalized = normalizeApiError(error, "Could not update invitation.");
			setErrorText(normalized.message || "Could not update invitation.");
		} finally {
			setSubmitting(false);
		}
	}

	async function handleRemoveMember(memberUserId) {
		if (!managedWorkspaceId || !memberUserId || submitting || !canManageMembers) {
			return;
		}

		setSubmitting(true);
		setErrorText("");
		setInfoText("");
		try {
			await removeOrganizationMember({ workspaceId: managedWorkspaceId, memberUserId });
			setWorkspaceMembers((current) => current.filter((member) => String(member?.user_id || "") !== String(memberUserId)));
			setInfoText("Member removed from organization.");
		} catch (error) {
			const normalized = normalizeApiError(error, "Could not remove member.");
			setErrorText(normalized.message || "Could not remove member.");
		} finally {
			setSubmitting(false);
		}
	}

	const myOrganizations = Array.isArray(state?.my_organizations) ? state.my_organizations : [];
	const managedOrganization = myOrganizations.find((item) => {
		const role = String(item?.role || "member").toLowerCase();
		return role === "owner" || role === "admin";
	}) || null;
	const managedWorkspaceId = String(managedOrganization?.workspace_id || managedOrganization?.id || "");
	const canManageMembers = String(managedOrganization?.role || "").toLowerCase() === "owner";
	const discoverableOrganizations = Array.isArray(state?.discoverable_organizations) ? state.discoverable_organizations : [];
	const pendingInvitations = Array.isArray(state?.pending_invitations) ? state.pending_invitations : [];
	const pendingJoinRequests = Array.isArray(state?.pending_join_requests) ? state.pending_join_requests : [];
	const hasOrganization = myOrganizations.length > 0;
	const canContinueToWorkspace = hasOrganization;
	const overviewItems = [
		{ id: "orgs", label: "Your organizations", value: myOrganizations.length },
		{ id: "invites", label: "Invitations", value: pendingInvitations.length },
		{ id: "discoverable", label: "Public organizations", value: discoverableOrganizations.length },
		{ id: "requests", label: "Join requests", value: pendingJoinRequests.length },
	];

	useEffect(() => {
		let cancelled = false;
		async function loadMembers() {
			if (!managedWorkspaceId) {
				setWorkspaceMembers([]);
				return;
			}
			setMembersLoading(true);
			try {
				const members = await fetchOrganizationMembers({ workspaceId: managedWorkspaceId });
				if (!cancelled) {
					setWorkspaceMembers(Array.isArray(members) ? members : []);
				}
			} catch {
				if (!cancelled) {
					setWorkspaceMembers([]);
				}
			} finally {
				if (!cancelled) {
					setMembersLoading(false);
				}
			}
		}

		loadMembers();
		return () => {
			cancelled = true;
		};
	}, [managedWorkspaceId]);

	function handleContinueToWorkspace() {
		if (!canContinueToWorkspace) {
			return;
		}

		const fallbackWorkspaceId = String(
			authState?.workspaceId ||
			state?.current_workspace_id ||
			myOrganizations[0]?.id ||
			myOrganizations[0]?.workspace_id ||
			""
		);

		if (fallbackWorkspaceId && fallbackWorkspaceId !== authState?.workspaceId) {
			const selectedOrg = myOrganizations.find((item) => String(item?.workspace_id || item?.id || "") === fallbackWorkspaceId);
			persistWorkspaceId(fallbackWorkspaceId, {
				role: String(selectedOrg?.role || "member"),
				name: String(selectedOrg?.name || "")
			});
			return;
		}

		onWorkspaceReady(authState);
	}

	return (
		<div className="auth-shell auth-mode-register org-onboarding-shell">
			<div className="auth-theme-toggle-wrap">
				<EntryThemeToggle />
			</div>
			<section className="auth-card register org-onboarding-card">
				<div className="auth-main org-onboarding-main">
					<div className="auth-head">
						<h2>Create an organization or join one</h2>
						<p>Set up your team space before entering the workspace.</p>
					</div>

					<div className="org-mode-switch" role="tablist" aria-label="Organization setup mode">
						<button
							type="button"
							className={`org-mode-btn ${mode === "create" ? "active" : ""}`}
							onClick={() => setMode("create")}
							role="tab"
							aria-selected={mode === "create"}
						>
							Create organization
						</button>
						<button
							type="button"
							className={`org-mode-btn ${mode === "join" ? "active" : ""}`}
							onClick={() => setMode("join")}
							role="tab"
							aria-selected={mode === "join"}
						>
							Join organization
						</button>
					</div>

					<div className="org-overview-grid" aria-label="Organization onboarding summary">
						{overviewItems.map((item) => (
							<div key={item.id} className="org-overview-card">
								<p className="org-overview-value">{item.value}</p>
								<p className="org-overview-label">{item.label}</p>
							</div>
						))}
					</div>

					{errorText ? (
						<div className="auth-banner error" role="alert" aria-live="assertive">
							<span>{errorText}</span>
							<button type="button" onClick={() => setErrorText("")} aria-label="Dismiss alert">
								<Icon name="close" size={14} />
							</button>
						</div>
					) : null}
					{!errorText && infoText ? (
						<div className="auth-banner info" role="status" aria-live="polite">
							<span>{infoText}</span>
							<button type="button" onClick={() => setInfoText("")} aria-label="Dismiss info">
								<Icon name="close" size={14} />
							</button>
						</div>
					) : null}

					{loading ? <p className="org-loading">Loading organization options...</p> : null}

					{!loading && mode === "create" ? (
						<form className="auth-form org-panel" onSubmit={handleCreateOrganization}>
							<label className="auth-field">
								<span>Organization name</span>
								<input
									type="text"
									className="auth-input"
									value={createName}
									onChange={(event) => setCreateName(event.target.value)}
									placeholder="Acme Engineering"
									required
								/>
							</label>
							<label className="auth-field">
								<span>Invite emails (comma or newline separated)</span>
								<textarea
									className="auth-input"
									value={inviteEmails}
									onChange={(event) => setInviteEmails(event.target.value)}
									placeholder="teammate1@company.com, teammate2@company.com"
									rows={4}
								/>
							</label>
							<button type="submit" className="accent-btn auth-submit" disabled={submitting}>
								{submitting ? "Creating..." : "Create organization"}
							</button>
						</form>
					) : null}

					{!loading && mode === "join" ? (
						<div className="auth-form org-panel">
							<label className="auth-field">
								<span>Optional message to owner</span>
								<textarea
									className="auth-input"
									value={joinMessage}
									onChange={(event) => setJoinMessage(event.target.value)}
									placeholder="Hi, I work with your team and need access to this workspace."
									rows={3}
								/>
							</label>
							<div className="org-list">
								{discoverableOrganizations.length === 0 ? <p className="org-empty">No public organizations available right now.</p> : null}
								{discoverableOrganizations.map((organization) => (
									<div key={organization.id} className="org-list-item">
										<div>
											<strong className="org-name">{organization.name}</strong>
											<div className="status-subtext org-meta">{organization.slug}</div>
										</div>
										<button type="button" className="auth-text-link inline" disabled={submitting} onClick={() => handleJoinRequest(organization.id)}>
											Request to join
										</button>
									</div>
								))}
							</div>
						</div>
					) : null}

							{!loading && myOrganizations.length === 0 && pendingInvitations.length === 0 && discoverableOrganizations.length === 0 ? (
								<div className="org-section org-empty-state">
									<h3 className="org-section-title">No organizations yet</h3>
									<p className="org-empty">No workspaces are currently available. Create one to continue.</p>
								</div>
							) : null}
						</div>

						<aside className="org-secondary-column">
							{pendingInvitations.length > 0 ? (
								<div className="org-section">
									<h3 className="org-section-title">Invitations</h3>
									{pendingInvitations.map((invitation) => (
										<div key={invitation.id} className="org-list-item">
											<div>
												<strong className="org-name">{invitation.workspace_name || "Organization"}</strong>
												<div className="status-subtext org-meta">{invitation.email}</div>
											</div>
											<div className="auth-inline-row org-item-actions">
												<button type="button" className="auth-text-link inline" disabled={submitting} onClick={() => handleInvitationDecision(invitation.id, "accept", invitation.workspace_id)}>Accept</button>
												<button type="button" className="auth-text-link inline" disabled={submitting} onClick={() => handleInvitationDecision(invitation.id, "reject", invitation.workspace_id)}>Reject</button>
											</div>
										</div>
									))}
								</div>
							) : null}

							{pendingJoinRequests.length > 0 ? (
								<div className="org-section">
									<h3 className="org-section-title">Pending join requests</h3>
									{pendingJoinRequests.map((requestItem) => (
										<div key={requestItem.id} className="org-list-item">
											<div>
												<strong className="org-name">{requestItem.requester_display_name || requestItem.requester_email || "User"}</strong>
												<div className="status-subtext org-meta">{requestItem.workspace_name || "Organization"}</div>
											</div>
											<div className="auth-inline-row org-item-actions">
												<button type="button" className="auth-text-link inline" disabled={submitting} onClick={() => handleJoinDecision(requestItem.id, "approve")}>Approve</button>
												<button type="button" className="auth-text-link inline" disabled={submitting} onClick={() => handleJoinDecision(requestItem.id, "reject")}>Reject</button>
											</div>
										</div>
									))}
								</div>
							) : null}

							{myOrganizations.length > 0 ? (
								<div className="org-section">
									<h3 className="org-section-title">Your organizations</h3>
									<div className="org-list">
										{myOrganizations.map((item) => (
											<div key={item.id || item.workspace_id || item.slug || item.name} className="org-list-item">
												<div>
													<strong className="org-name">{item.name || "Organization"}</strong>
													<div className="status-subtext org-meta">{item.slug || "private"}</div>
												</div>
												<span className="org-role-pill">{item.role || "member"}</span>
											</div>
										))}
									</div>
								</div>
							) : null}

							{managedWorkspaceId ? (
								<div className="org-section">
									<h3 className="org-section-title">Organization members</h3>
									{membersLoading ? <p className="org-loading">Loading members...</p> : null}
									{!membersLoading && workspaceMembers.length === 0 ? <p className="org-empty">No members found.</p> : null}
									{workspaceMembers.map((member) => {
										const memberName = member?.display_name || member?.email || "Member";
										const memberRole = String(member?.role || "member");
										const isSelf = String(member?.user_id || "") === String(authState?.userId || authState?.user?.id || "");
										return (
											<div key={String(member?.user_id || memberName)} className="org-list-item">
												<div>
													<strong className="org-name">{memberName}</strong>
													<div className="status-subtext org-meta">{memberRole}</div>
												</div>
												{canManageMembers && !isSelf && memberRole !== "owner" ? (
													<button type="button" className="auth-text-link inline" disabled={submitting} onClick={() => handleRemoveMember(member.user_id)}>
														Remove
													</button>
												) : (
													<span className="org-role-pill">{isSelf ? "you" : memberRole}</span>
												)}
											</div>
										);
									})}
								</div>
							) : null}

							<div className="org-footer-card">
								<button type="button" className="auth-text-link inline" onClick={onLogout}>Sign out</button>
								{canContinueToWorkspace ? (
									<button
										type="button"
										className="accent-btn auth-submit"
										onClick={handleContinueToWorkspace}
									>
										Continue to workspace
									</button>
								) : (
									<p className="org-continue-hint">Create or join an organization to continue.</p>
								)}
							</div>
						</aside>
			</section>
		</div>
	);
}