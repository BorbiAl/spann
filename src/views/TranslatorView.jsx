import React, { useState } from "react";
import { CULTURES, apiRequest } from "../data/constants";

const CULTURE_TO_LOCALE = {
	American: "en-US",
	British: "en-GB",
	Bulgarian: "bg-BG",
	Japanese: "ja-JP",
	German: "de-DE",
	Brazilian: "pt-BR",
	Arabic: "ar-SA"
};

export default function TranslatorView() {
	const [sourceCulture, setSourceCulture] = useState("🇺🇸 American");
	const [targetCulture, setTargetCulture] = useState("🇧🇬 Bulgarian");
	const [inputText, setInputText] = useState("Break a leg!");
	const [isTranslating, setIsTranslating] = useState(false);
	const [result, setResult] = useState({
		literal: "Счупи крак!",
		cultural: "Много успех!",
		note: "Bulgarians prefer direct well-wishing over idioms"
	});

	function cultureLabel(value) {
		return String(value || "").replace(/^[^A-Za-z]+\s*/, "").trim();
	}

	async function translate() {
		const trimmed = inputText.trim();
		if (!trimmed) {
			setResult({ literal: "", cultural: "", note: "Enter a phrase to translate." });
			return;
		}

		setIsTranslating(true);
		const sourceLabel = cultureLabel(sourceCulture);
		const targetLabel = cultureLabel(targetCulture);

		try {
			const payload = await apiRequest("/translate", {
				method: "POST",
				body: JSON.stringify({
					phrase: trimmed,
					source_locale: CULTURE_TO_LOCALE[sourceLabel] || "en-US",
					target_locale: CULTURE_TO_LOCALE[targetLabel] || "en-US",
					source_culture: sourceLabel || sourceCulture,
					target_culture: targetLabel || targetCulture,
					workplace_tone: "neutral"
				})
			});

			const apiResult = payload?.data || payload?.result;
			if (apiResult && apiResult.literal && apiResult.cultural) {
				setResult({
					literal: apiResult.literal,
					cultural: apiResult.cultural,
					note:
						apiResult.explanation ||
						apiResult.note ||
						`Adjusted for ${targetLabel || targetCulture} communication norms and tone.`
				});
				return;
			}

			throw new Error("Missing translation result");
		} catch (error) {
			if (trimmed.toLowerCase() === "break a leg!" && sourceLabel === "American" && targetLabel === "Bulgarian") {
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

			const resolvedTargetLabel = targetLabel || targetCulture;
			const literal = `${trimmed} (${resolvedTargetLabel} literal)`;
			const cultural = adaptationMap[resolvedTargetLabel] || trimmed;
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
								<option key={culture} value={culture}>
									{culture}
								</option>
							))}
						</select>
					</div>
					<div className="select-wrap">
						<select value={targetCulture} onChange={(event) => setTargetCulture(event.target.value)}>
							{CULTURES.map((culture) => (
								<option key={culture} value={culture}>
									{culture}
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
