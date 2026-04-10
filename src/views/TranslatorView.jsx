import React, { useEffect, useRef, useState } from 'react';
import { CULTURES, apiRequest } from '../data/constants';

const CULTURE_BY_KEY = CULTURES.reduce((accumulator, culture) => {
	accumulator[culture.key] = culture;
	return accumulator;
}, {});

const CULTURE_EMOJI = {
	American: '\uD83C\uDDFA\uD83C\uDDF8',
	British: '\uD83C\uDDEC\uD83C\uDDE7',
	Bulgarian: '\uD83C\uDDE7\uD83C\uDDEC',
	Japanese: '\uD83C\uDDEF\uD83C\uDDF5',
	German: '\uD83C\uDDE9\uD83C\uDDEA',
	Brazilian: '\uD83C\uDDE7\uD83C\uDDF7',
	Arabic: '\uD83C\uDDF8\uD83C\uDDE6'
};

const INITIAL_RESULT = {
	literal: 'Could you possibly do this for me?',
	cultural: '\u304A\u624B\u6570\u3067\u3059\u304C\u3001\u3053\u3061\u3089\u3092\u304A\u9858\u3044\u3067\u304D\u307E\u3059\u3067\u3057\u3087\u3046\u304B\uFF1F',
	note:
		"In Japanese business culture, direct requests can seem aggressive. The phrase 'Otesuu desuga' (I'm sorry to trouble you) is used as a buffer. It acknowledges the recipient's effort before the request is even made, which is essential for maintaining Wa (harmony).",
	tags: ['Business Etiquette', 'Polite Form (Keigo)', 'High Context'],
	sentiment: 85,
	sentimentLabel: 'Highly Formal'
};

const INITIAL_HISTORY = [
	{
		id: 1,
		sourceCulture: 'American',
		targetCulture: 'French',
		sourceEmoji: '🇺🇸',
		targetEmoji: '🇫🇷',
		literal: "Let's grab a coffee sometime soon.",
		cultural: '"On se fait un café ?" (Casual/Implicit)',
		time: '2 hours ago'
	},
	{
		id: 2,
		sourceCulture: 'American',
		targetCulture: 'German',
		sourceEmoji: '🇺🇸',
		targetEmoji: '🇩🇪',
		literal: "I don't think that's the best idea.",
		cultural: '"Das sehe ich anders." (Direct/Constructive)',
		time: 'Yesterday'
	}
];

function isGarbledMultilingualText(value) {
	const text = String(value || '');
	return /\uFFFD/.test(text) || /^\s*[?？]{4,}\s*$/.test(text);
}

function toHistoryEntry(sourceCulture, targetCulture, literal, cultural) {
	return {
		id: Date.now(),
		sourceCulture,
		targetCulture,
		sourceEmoji: CULTURE_EMOJI[sourceCulture] || '🌐',
		targetEmoji: CULTURE_EMOJI[targetCulture] || '🌐',
		literal,
		cultural,
		time: 'Just now'
	};
}

function cultureLabel(cultureKey) {
	return CULTURE_BY_KEY[cultureKey]?.label || cultureKey;
}

function localeCode(cultureKey) {
	const locale = CULTURE_BY_KEY[cultureKey]?.locale || '';
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

	return `[${cultureLabel(targetCulture)}] ${phrase}`;
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

function LanguageDropdown({ value, onChange, ariaLabel }) {
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
					{localeCode(value)}
				</span>
				<span className="min-w-[138px] text-left">{cultureLabel(value)}</span>
				<span className="material-symbols-outlined text-xs text-on-surface-variant">expand_more</span>
			</button>

			{open ? (
				<div className="absolute left-0 top-full mt-2 min-w-full w-max max-h-64 overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-xl z-40 p-1">
					{CULTURES.map((culture) => (
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
								{localeCode(culture.key)}
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
	const [sourceCulture, setSourceCulture] = useState('American');
	const [targetCulture, setTargetCulture] = useState('Japanese');
	const [inputText, setInputText] = useState('');
	const [isTranslating, setIsTranslating] = useState(false);
	const [statusNote, setStatusNote] = useState('');
	const [result, setResult] = useState(INITIAL_RESULT);
	const [history, setHistory] = useState(INITIAL_HISTORY);

	async function translate() {
		const trimmed = inputText.trim();
		if (!trimmed || isTranslating) {
			return;
		}

		setIsTranslating(true);
		setStatusNote('');

		const sourceOption = CULTURE_BY_KEY[sourceCulture];
		const targetOption = CULTURE_BY_KEY[targetCulture];

		try {
			const payload = await apiRequest('/translate', {
				method: 'POST',
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
			let nextCultural = isGarbledMultilingualText(rawCultural) ? `[${cultureLabel(targetCulture)}] ${trimmed}` : rawCultural;
			let nextNote = data.explanation || data.note || 'Translation complete.';

			const sourceLocale = String(sourceOption?.locale || 'en-US');
			const targetLocale = String(targetOption?.locale || 'en-US');
			const looksLikeFailOpen =
				sourceLocale !== targetLocale &&
				(String(nextCultural).trim() === trimmed || String(nextNote).toLowerCase().includes('fallback'));

			if (looksLikeFailOpen) {
				try {
					const legacyResult = await requestLegacyAdaptation(trimmed, sourceCulture, targetCulture);
					if (legacyResult) {
						nextLiteral = legacyResult.literal;
						nextCultural = legacyResult.cultural;
						nextNote = legacyResult.note;
					}
				} catch (legacyError) {
					nextCultural = buildCultureFallback(targetCulture, trimmed);
					nextNote = 'Translation fallback applied for selected language.';
				}
			}
			const nextTags = Array.isArray(data.tags) && data.tags.length > 0 ? data.tags : INITIAL_RESULT.tags;
			const nextSentiment = Number.isFinite(data.sentiment_score)
				? Math.min(100, Math.max(0, Number(data.sentiment_score)))
				: INITIAL_RESULT.sentiment;
			const nextLabel = data.sentiment_label || INITIAL_RESULT.sentimentLabel;

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
			let fallbackLiteral = trimmed;
			let fallbackCultural = `[${cultureLabel(targetCulture)}] ${trimmed}`;
			let fallbackNote = 'Translation service is unavailable. Showing local fallback output.';

			try {
				const legacyResult = await requestLegacyAdaptation(trimmed, sourceCulture, targetCulture);
				if (legacyResult) {
					fallbackLiteral = legacyResult.literal;
					fallbackCultural = legacyResult.cultural;
					fallbackNote = 'Primary translator unavailable. Used compatibility translator output.';
				}
			} catch (legacyError) {
				fallbackCultural = buildCultureFallback(targetCulture, trimmed);
			}
			setResult((current) => ({
				...current,
				literal: fallbackLiteral,
				cultural: fallbackCultural
			}));
			setHistory((current) => [toHistoryEntry(sourceCulture, targetCulture, fallbackLiteral, fallbackCultural), ...current].slice(0, 8));
			setStatusNote(fallbackNote);
		} finally {
			setIsTranslating(false);
		}
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
							/>
							<span className="material-symbols-outlined text-on-surface-variant text-sm" aria-hidden="true">
								swap_horiz
							</span>
							<LanguageDropdown
								value={targetCulture}
								onChange={setTargetCulture}
								ariaLabel="Choose target language"
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
							<button type="button" className="p-2 text-on-surface-variant hover:text-primary transition-colors" aria-label="Use microphone">
								<span className="material-symbols-outlined">mic</span>
							</button>
							<button type="button" className="p-2 text-on-surface-variant hover:text-primary transition-colors" aria-label="Attach file">
								<span className="material-symbols-outlined">attach_file</span>
							</button>
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
							<p className="text-on-surface font-medium italic">{result.literal}</p>
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
							<p className="text-on-surface font-semibold">{result.cultural}</p>
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
								<p className="text-sm leading-relaxed opacity-90">{result.note}</p>
								<div className="mt-4 flex flex-wrap gap-2">
									{result.tags.map((tag) => (
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
						</div>
						<div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden flex">
							<div className="h-full bg-primary" style={{ width: `${result.sentiment}%` }} />
						</div>
						<div className="flex justify-between mt-2 text-[10px] text-on-surface-variant font-medium">
							<span>Casual</span>
							<span className="text-primary font-bold">{result.sentimentLabel}</span>
						</div>
					</div>
				</div>
			</div>

			<section className="mt-12">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-xl font-bold">Recent Translations</h2>
					<button type="button" className="text-primary text-sm font-semibold hover:underline">
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
