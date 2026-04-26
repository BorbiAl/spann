import React, { useEffect, useRef, useState } from 'react';
import { apiRequest, apiRequestFormData, fetchPublicRuntimeConfig } from '../data/constants';

function isGarbledMultilingualText(value) {
	const text = String(value || '');
	return /\uFFFD/.test(text) || /^\s*[?？]{4,}\s*$/.test(text);
}

function toHistoryEntry(sourceCulture, targetCulture, literal, cultural) {
	return {
		id: Date.now(),
		sourceCulture,
		targetCulture,
		sourceEmoji: '🌐',
		targetEmoji: '🌐',
		literal,
		cultural,
		time: 'Just now'
	};
}

function cultureLabel(cultureKey, cultureByKey) {
	return cultureByKey[cultureKey]?.label || cultureKey;
}

function localeCode(cultureKey, cultureByKey) {
	const locale = cultureByKey[cultureKey]?.locale || '';
	const [, region] = String(locale).split('-');
	return (region || locale || '--').toUpperCase();
}

function buildCultureFallback(targetCulture, originalText) {
	const target = String(targetCulture || '');
	const phrase = String(originalText || '').trim();
	const normalized = phrase.toLowerCase().replace(/[!?.,]+$/g, '');
	const isLuckWish = normalized === 'break a leg' || normalized === 'good luck';

	const directByCulture = {
		American: 'You got this!',
		British: 'Best of luck.',
		Bulgarian: 'Много успех!',
		Japanese: '頑張ってください。',
		German: 'Viel Erfolg!',
		Brazilian: 'Boa sorte!',
		Arabic: 'بالتوفيق!'
	};

	if (isLuckWish && directByCulture[target]) {
		return directByCulture[target];
	}

	if (directByCulture[target]) {
		return `${directByCulture[target]} (${phrase})`;
	}

	return `[${targetCulture}] ${phrase}`;
}

function estimateSentimentFromText(value) {
	const text = String(value || '').toLowerCase();
	if (!text.trim()) {
		return 50;
	}

	const positive = [
		'thanks', 'thank you', 'great', 'good', 'excellent', 'awesome', 'appreciate', 'success', 'well done',
		'благодаря', 'успех', 'чудесно', 'страхотно', 'добре',
		'merci', 'gracias', 'danke', 'boa sorte', 'congrats'
	];
	const negative = [
		'urgent', 'asap', 'problem', 'issue', 'blocked', 'angry', 'hate', 'bad', 'frustrated',
		'спешно', 'проблем', 'грешка', 'лошо', 'ядосан',
		'erreur', 'malo', 'schlecht'
	];

	let score = 50;
	for (const token of positive) {
		if (text.includes(token)) {
			score += 8;
		}
	}
	for (const token of negative) {
		if (text.includes(token)) {
			score -= 8;
		}
	}

	if (text.includes('!')) {
		score += 2;
	}
	if (text.includes('?')) {
		score -= 1;
	}

	return Math.max(0, Math.min(100, Math.round(score)));
}

function sentimentLabelFromScore(score) {
	if (score >= 70) {
		return 'Positive';
	}
	if (score >= 45) {
		return 'Neutral';
	}
	return 'Direct';
}

async function requestLegacyAdaptation(trimmed, sourceCulture, targetCulture) {
	const payload = await apiRequest('/translator/adapt', {
		method: 'POST',
		body: JSON.stringify({
			inputText: trimmed,
			sourceCulture,
			targetCulture
		})
	});

	const data = payload?.result || payload?.data || {};
	if (!data || typeof data !== 'object') {
		return null;
	}

	return {
		literal: String(data.literal || trimmed),
		cultural: String(data.cultural || buildCultureFallback(targetCulture, trimmed)),
		note: String(data.note || 'Cultural adaptation applied for target audience.')
	};
}

function LanguageDropdown({ value, onChange, ariaLabel, cultures, cultureByKey }) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef(null);

	useEffect(() => {
		if (!open) {
			return undefined;
		}

		function onPointerDown(event) {
			if (!rootRef.current || rootRef.current.contains(event.target)) {
				return;
			}
			setOpen(false);
		}

		function onEscape(event) {
			if (event.key === 'Escape') {
				setOpen(false);
			}
		}

		document.addEventListener('mousedown', onPointerDown);
		document.addEventListener('keydown', onEscape);

		return () => {
			document.removeEventListener('mousedown', onPointerDown);
			document.removeEventListener('keydown', onEscape);
		};
	}, [open]);

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen((current) => !current)}
				className="flex items-center gap-2 px-3 py-2 hover:bg-surface-container-high rounded-md transition-colors text-sm font-medium cursor-pointer min-h-[44px] text-on-surface"
				aria-label={ariaLabel}
				aria-haspopup="listbox"
				aria-expanded={open}
			>
				<span className="inline-flex min-w-[32px] justify-center px-1.5 py-0.5 rounded bg-surface-container-high text-[11px] font-semibold text-on-surface-variant">
					{localeCode(value, cultureByKey)}
				</span>
				<span className="min-w-[138px] text-left">{cultureLabel(value, cultureByKey)}</span>
				<span className="material-symbols-outlined text-xs text-on-surface-variant">expand_more</span>
			</button>

			{open ? (
				<div className="absolute left-0 top-full mt-2 min-w-full w-max max-h-64 overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-xl z-40 p-1">
					{cultures.map((culture) => (
						<button
							key={culture.key}
							type="button"
							onClick={() => {
								onChange(culture.key);
								setOpen(false);
							}}
							className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
								value === culture.key ? 'bg-primary text-white' : 'text-on-surface hover:bg-surface-container-high'
							}`}
							role="option"
							aria-selected={value === culture.key}
						>
							<span
								className={`inline-flex min-w-[32px] justify-center px-1.5 py-0.5 rounded text-[11px] font-semibold ${
									value === culture.key ? 'bg-white/20 text-white' : 'bg-surface-container-high text-on-surface-variant'
								}`}
							>
								{localeCode(culture.key, cultureByKey)}
							</span>
							<span>{culture.label}</span>
						</button>
					))}
				</div>
			) : null}
		</div>
	);
}

export default function TranslatorView() {
	const [cultures, setCultures] = useState([]);
	const [sourceCulture, setSourceCulture] = useState('');
	const [targetCulture, setTargetCulture] = useState('');
	const [inputText, setInputText] = useState('');
	const [isTranslating, setIsTranslating] = useState(false);
	const [statusNote, setStatusNote] = useState('');
	const [result, setResult] = useState(null);
	const [history, setHistory] = useState([]);
	const fileInputRef = useRef(null);

	const cultureByKey = cultures.reduce((accumulator, culture) => {
		accumulator[culture.key] = culture;
		return accumulator;
	}, {});

	useEffect(() => {
		let cancelled = false;

		async function loadRuntimeConfig() {
			try {
				const payload = await fetchPublicRuntimeConfig();
				const rows = Array.isArray(payload?.cultures)
					? payload.cultures
							.map((item) => ({
								key: String(item?.key || item?.culture || '').trim(),
								label: String(item?.label || item?.name || '').trim(),
								locale: String(item?.locale || '').trim()
							}))
							.filter((item) => item.key && item.label && item.locale)
					: [];

				if (cancelled) {
					return;
				}

				if (rows.length > 0) {
					setCultures(rows);
					setSourceCulture((current) => current || rows[0].key);
					setTargetCulture((current) => current || rows[Math.min(1, rows.length - 1)].key);
					return;
				}
			} catch {
				// Fallback to browser locale when public runtime config is unavailable.
			}

			const browserLocale = Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
			const fallback = [{ key: browserLocale, label: browserLocale, locale: browserLocale }];
			if (!cancelled) {
				setCultures(fallback);
				setSourceCulture(browserLocale);
				setTargetCulture(browserLocale);
			}
		}

		loadRuntimeConfig();
		return () => {
			cancelled = true;
		};
	}, []);

	async function translate() {
		const trimmed = inputText.trim();
		if (!trimmed || isTranslating) {
			return;
		}

		setIsTranslating(true);
		setStatusNote('');

		const sourceOption = cultureByKey[sourceCulture];
		const targetOption = cultureByKey[targetCulture];

		try {
			const payload = await apiRequest('/translate', {
				method: 'POST',
				allowAuthFailOpen: true,
				body: JSON.stringify({
					phrase: trimmed,
					source_locale: sourceOption?.locale || 'en-US',
					target_locale: targetOption?.locale || 'en-US',
					source_culture: sourceCulture,
					target_culture: targetCulture,
					workplace_tone: 'neutral'
				})
			});

			const data = payload?.data || payload?.result || {};
			let nextLiteral = data.literal_translation || data.literal || trimmed;
			const rawCultural = data.cultural_adaptation || data.cultural || trimmed;
			let nextCultural = isGarbledMultilingualText(rawCultural) ? `[${cultureLabel(targetCulture, cultureByKey)}] ${trimmed}` : rawCultural;
			let nextNote = data.explanation || data.note || 'Translation complete.';

			const sourceLocale = String(sourceOption?.locale || 'en-US');
			const targetLocale = String(targetOption?.locale || 'en-US');
			const looksLikeFailOpen =
				sourceLocale !== targetLocale &&
				(String(nextLiteral).trim() === trimmed || String(nextCultural).trim() === trimmed);

			if (looksLikeFailOpen) {
				setStatusNote('Primary translator returned partial output. Please retry.');
			}
			const nextTags = Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : ['translation'];
			const parsedSentiment = Number(data.sentiment_score);
			const nextSentiment = Number.isFinite(parsedSentiment)
				? Math.min(100, Math.max(0, parsedSentiment))
				: estimateSentimentFromText(nextCultural || nextLiteral);
			const nextLabel = String(data.sentiment_label || sentimentLabelFromScore(nextSentiment));

			setResult({
				literal: String(nextLiteral),
				cultural: String(nextCultural),
				note: String(nextNote),
				tags: nextTags.map((tag) => String(tag)),
				sentiment: nextSentiment,
				sentimentLabel: String(nextLabel)
			});
			setHistory((current) => [toHistoryEntry(sourceCulture, targetCulture, String(nextLiteral), String(nextCultural)), ...current].slice(0, 8));
		} catch (error) {
			setStatusNote('Translation service is unavailable right now. Please try again.');
		} finally {
			setIsTranslating(false);
		}
	}

	async function handleMicInput() {
		if (typeof window === 'undefined') {
			return;
		}

		const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!SpeechRecognition) {
			setStatusNote('Voice input is not supported in this browser.');
			return;
		}

		try {
			setStatusNote('Listening...');
			const recognition = new SpeechRecognition();
			recognition.lang = cultureByKey[sourceCulture]?.locale || 'en-US';
			recognition.interimResults = false;
			recognition.maxAlternatives = 1;
			recognition.onresult = (event) => {
				const transcript = String(event?.results?.[0]?.[0]?.transcript || '').trim();
				if (!transcript) {
					setStatusNote('No speech detected. Try again.');
					return;
				}
				setInputText((current) => (current ? `${current} ${transcript}` : transcript));
				setStatusNote('Voice input added.');
			};
			recognition.onerror = () => setStatusNote('Voice input failed. Please retry.');
			recognition.start();
		} catch {
			setStatusNote('Unable to start voice input.');
		}
	}

	async function handleAudioFileSelected(event) {
		const file = event?.target?.files?.[0];
		if (!file) {
			return;
		}

		if (!String(file.type || '').startsWith('audio/')) {
			setStatusNote('Please select an audio file.');
			event.target.value = '';
			return;
		}

		const formData = new FormData();
		formData.append('audio', file);
		const locale = cultureByKey[sourceCulture]?.locale || '';
		if (locale) {
			formData.append('locale', locale);
		}

		setStatusNote('Transcribing audio...');
		try {
			const payload = await apiRequestFormData('/speech-to-text', {
				method: 'POST',
				auth: false,
				body: formData,
				timeoutMs: 30000
			});
			const text = String(payload?.data?.text || '').trim();
			if (text) {
				setInputText((current) => (current ? `${current} ${text}` : text));
				setStatusNote('Audio transcription added.');
			} else {
				setStatusNote('No transcript was returned.');
			}
		} catch {
			setStatusNote('Audio transcription failed.');
		} finally {
			event.target.value = '';
		}
	}

	function handleViewAllHistory() {
		if (!history.length) {
			setStatusNote('No translation history yet.');
			return;
		}
		const exportText = history
			.map((item) => `${item.time} | ${item.sourceCulture} -> ${item.targetCulture}\nLiteral: ${item.literal}\nCultural: ${item.cultural}`)
			.join('\n\n');
		window.alert(exportText);
	}

	return (
		<main className="h-full overflow-y-auto bg-surface p-8 w-full view-transition">
			<header className="mb-10">
				<h1 className="text-3xl font-bold tracking-tight text-on-surface mb-2">Cultural Translator</h1>
				<p className="text-on-surface-variant max-w-2xl">
					Bridge the gap between languages and cultural contexts. Understand not just the words, but the intent and etiquette behind them.
				</p>
				{statusNote ? <p className="mt-3 text-sm text-on-surface-variant">{statusNote}</p> : null}
			</header>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
				<section className="bg-surface-container-low rounded-xl p-6 shadow-sm border border-outline-variant/10">
					<div className="flex items-center justify-between mb-6 flex-wrap gap-3">
						<div className="flex items-center gap-3 bg-surface-container-lowest p-1.5 rounded-lg shadow-sm border border-outline-variant/20 flex-wrap">
							<LanguageDropdown
								value={sourceCulture}
								onChange={setSourceCulture}
								ariaLabel="Choose source language"
								cultures={cultures}
								cultureByKey={cultureByKey}
							/>
							<span className="material-symbols-outlined text-on-surface-variant text-sm" aria-hidden="true">
								swap_horiz
							</span>
							<LanguageDropdown
								value={targetCulture}
								onChange={setTargetCulture}
								ariaLabel="Choose target language"
								cultures={cultures}
								cultureByKey={cultureByKey}
							/>
						</div>
						<span className="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Input Text</span>
					</div>

					<textarea
						className="w-full h-64 bg-transparent border-none focus:ring-0 text-xl font-medium placeholder:text-on-surface-variant/40 resize-none leading-relaxed"
						placeholder="Type a message or phrase to translate culturally..."
						value={inputText}
						onChange={(event) => setInputText(event.target.value)}
					/>

					<div className="mt-4 flex justify-between items-center">
						<div className="flex gap-2">
							<button type="button" onClick={handleMicInput} className="p-2 text-on-surface-variant hover:text-primary transition-colors" aria-label="Use microphone">
								<span className="material-symbols-outlined">mic</span>
							</button>
							<button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-on-surface-variant hover:text-primary transition-colors" aria-label="Attach file">
								<span className="material-symbols-outlined">attach_file</span>
							</button>
							<input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioFileSelected} />
						</div>
						<button
							type="button"
							onClick={translate}
							disabled={isTranslating}
							className="bg-gradient-to-br from-primary to-primary-container text-white px-8 py-3 rounded-lg font-semibold shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-60"
						>
							{isTranslating ? 'Translating...' : 'Translate Context'}
						</button>
					</div>
				</section>

				<div className="space-y-6">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/20 shadow-sm">
							<div className="flex items-center gap-2 mb-3 text-on-surface-variant">
								<span className="material-symbols-outlined text-sm">translate</span>
								<span className="text-[10px] font-bold uppercase tracking-widest">Literal Translation</span>
							</div>
							<p className="text-on-surface font-medium italic">{result?.literal || 'No translation yet.'}</p>
						</div>

						<div className="bg-surface-container-lowest p-5 rounded-xl border border-primary/20 shadow-sm relative overflow-hidden group">
							<div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
								<span className="material-symbols-outlined text-4xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
									auto_awesome
								</span>
							</div>
							<div className="flex items-center gap-2 mb-3 text-primary">
								<span className="material-symbols-outlined text-sm">auto_awesome</span>
								<span className="text-[10px] font-bold uppercase tracking-widest">Cultural Context</span>
							</div>
							<p className="text-on-surface font-semibold">{result?.cultural || 'Run a translation to see adaptation output.'}</p>
						</div>
					</div>

					<section className="bg-tertiary-container rounded-xl p-6 text-on-tertiary-container shadow-md border border-on-tertiary-fixed-variant/10">
						<div className="flex items-start gap-4">
							<div className="bg-white/20 p-2 rounded-lg">
								<span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
									lightbulb
								</span>
							</div>
							<div>
								<h3 className="text-lg font-bold mb-2">Nuance Explanation</h3>
								<p className="text-sm leading-relaxed opacity-90">{result?.note || 'Explanations are generated per translation request.'}</p>
								<div className="mt-4 flex flex-wrap gap-2">
									{(result?.tags || []).map((tag) => (
										<span key={tag} className="bg-white/10 text-[10px] px-2 py-1 rounded border border-white/20 uppercase font-bold tracking-tighter">
											{tag}
										</span>
									))}
								</div>
							</div>
						</div>
					</section>

					<div className="bg-surface-container-low p-4 rounded-xl">
						<div className="flex justify-between items-center mb-2">
							<span className="text-[10px] font-bold uppercase text-on-surface-variant">Sentiment &amp; Politeness Spectrum</span>
							<span className="text-[11px] font-semibold text-primary">{Math.round(Number(result?.sentiment || 50))}%</span>
						</div>
						<div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden flex">
							<div className="h-full bg-primary" style={{ width: `${Number(result?.sentiment || 50)}%` }} />
						</div>
						<div className="flex justify-between mt-2 text-[10px] text-on-surface-variant font-medium">
							<span>Casual</span>
							<span className="text-primary font-bold">{result?.sentimentLabel || 'Neutral'}</span>
						</div>
					</div>
				</div>
			</div>

			<section className="mt-12">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-xl font-bold">Recent Translations</h2>
					<button type="button" onClick={handleViewAllHistory} className="text-primary text-sm font-semibold hover:underline">
						View All History
					</button>
				</div>
				<div className="space-y-3">
					{history.map((item) => (
						<div
							key={item.id}
							className="flex items-center justify-between p-4 bg-surface-container-low hover:bg-surface-container-high transition-colors rounded-xl cursor-pointer group"
						>
							<div className="flex items-center gap-6 min-w-0">
								<div className="flex items-center gap-2 text-lg">
									<span>{item.sourceEmoji}</span>
									<span className="material-symbols-outlined text-sm text-on-surface-variant">arrow_forward</span>
									<span>{item.targetEmoji}</span>
								</div>
								<div className="min-w-0">
									<p className="text-sm font-semibold truncate max-w-xs">{item.literal}</p>
									<p className="text-xs text-on-surface-variant italic truncate max-w-xs">{item.cultural}</p>
								</div>
							</div>
							<div className="flex items-center gap-4">
								<span className="text-[11px] text-on-surface-variant">{item.time}</span>
								<span className="material-symbols-outlined text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">
									chevron_right
								</span>
							</div>
						</div>
					))}
				</div>
			</section>
		</main>
	);
}
