import React, { useState } from "react";
import { CULTURES, apiRequest } from "../data/constants";

const CULTURE_BY_KEY = CULTURES.reduce((accumulator, culture) => {
	accumulator[culture.key] = culture;
	return accumulator;
}, {});

export default function TranslatorView() {
	const [sourceCulture, setSourceCulture] = useState("American");
	const [targetCulture, setTargetCulture] = useState("Bulgarian");
	const [inputText, setInputText] = useState("Break a leg!");
	const [isTranslating, setIsTranslating] = useState(false);
	const [statusNote, setStatusNote] = useState("");
	const [result, setResult] = useState({
		literal: "Счупи крак!",
		cultural: "Много успех!",
		note: "Bulgarians prefer direct well-wishing over idioms"
	});

	async function translate() {
		const trimmed = inputText.trim();
		if (!trimmed) {
			setResult({ literal: "", cultural: "", note: "Enter a phrase to translate." });
			return;
		}

		setIsTranslating(true);
		setStatusNote("");
		const sourceOption = CULTURE_BY_KEY[sourceCulture];
		const targetOption = CULTURE_BY_KEY[targetCulture];

		try {
			const payload = await apiRequest("/translate", {
				method: "POST",
				body: JSON.stringify({
					phrase: trimmed,
					source_locale: sourceOption?.locale || "en-US",
					target_locale: targetOption?.locale || "en-US",
					source_culture: sourceCulture,
					target_culture: targetCulture,
					workplace_tone: "neutral"
				})
			});

			const apiResult = payload?.data || payload?.result;
			if (apiResult && apiResult.literal && apiResult.cultural) {
				const explanation =
					apiResult.explanation ||
					apiResult.note ||
					`Adjusted for ${targetOption?.label || targetCulture} communication norms and tone.`;

				setResult({
					literal: apiResult.literal,
					cultural: apiResult.cultural,
					note: explanation
				});

				if (String(explanation).toLowerCase().includes("fallback")) {
					setStatusNote("Live translator is unavailable right now. Showing fallback output.");
				}
				return;
			}

			throw new Error("Missing translation result");
		} catch (error) {
			const status = Number(error?.status || 0);
			if (status === 401) {
				setStatusNote("Your session expired. Sign in again to use translation.");
			} else {
				setStatusNote("Translation service is currently unavailable. Showing fallback output.");
			}

			if (trimmed.toLowerCase() === "break a leg!" && sourceCulture === "American" && targetCulture === "Bulgarian") {
				setResult({
					literal: "Счупи крак!",
					cultural: "Много успех!",
					note: "Bulgarians prefer direct well-wishing over idioms"
				});
				return;
			}

			const adaptationMap = {
				British: "Best of luck.",
				Japanese: "頑張ってください。",
				German: "Viel Erfolg!",
				Brazilian: "Boa sorte!",
				Arabic: "بالتوفيق!",
				Bulgarian: "Много успех!",
				American: "You got this!"
			};

			const resolvedTargetLabel = targetOption?.label || targetCulture;
			const literal = `${trimmed} (${resolvedTargetLabel} literal)`;
			const cultural = adaptationMap[targetCulture] || trimmed;
			const note = `Adjusted for ${resolvedTargetLabel} communication norms and tone.`;

			setResult({ literal, cultural, note });
		} finally {
			setIsTranslating(false);
		}
	}

	return (
		<div className="view-transition">
			<section className="card">
				<p className="title">Cultural Translator</p>
				<p className="caption">Localize intent, not just words.</p>

				<div className="translator-controls">
					<div className="select-wrap">
						<select value={sourceCulture} onChange={(event) => setSourceCulture(event.target.value)}>
							{CULTURES.map((culture) => (
								<option key={culture.key} value={culture.key}>
									{culture.label}
								</option>
							))}
						</select>
					</div>
					<div className="select-wrap">
						<select value={targetCulture} onChange={(event) => setTargetCulture(event.target.value)}>
							{CULTURES.map((culture) => (
								<option key={culture.key} value={culture.key}>
									{culture.label}
								</option>
							))}
						</select>
					</div>
				</div>

				<textarea
					className="translator-input"
					value={inputText}
					onChange={(event) => setInputText(event.target.value)}
					placeholder="Paste a phrase to localize..."
				/>

				<button className="accent-btn" onClick={translate} disabled={isTranslating}>
					{isTranslating ? "Translating..." : "Translate"}
				</button>

				{statusNote ? <p className="caption">{statusNote}</p> : null}

				<div className="result-grid">
					<div className="result-box">
						<p className="result-head">Literal</p>
						<p className="result-text">{result.literal}</p>
					</div>
					<div className="result-box">
						<p className="result-head">Cultural Adaptation</p>
						<p className="result-text">{result.cultural}</p>
						<p className="result-note">{result.note}</p>
					</div>
				</div>
			</section>
		</div>
	);
}
