import React, { useState } from 'react';
import { CULTURES, apiRequest } from '../data/constants';
import Icon from '../components/Icon'; 

const CULTURE_BY_KEY = CULTURES.reduce((accumulator, culture) => {
accumulator[culture.key] = culture;
return accumulator;
}, {});

const CULTURE_EMOJI = {
American: '🇺🇸',
British: '🇬🇧',
Bulgarian: '🇧🇬',
Japanese: '🇯🇵',
German: '🇩🇪',
Brazilian: '🇧🇷',
Arabic: '🇸🇦'
};

export default function TranslatorView() {
const [sourceCulture, setSourceCulture] = useState('American');
const [targetCulture, setTargetCulture] = useState('Japanese');
const [inputText, setInputText] = useState('');
const [isTranslating, setIsTranslating] = useState(false);
const [statusNote, setStatusNote] = useState('');

const [result, setResult] = useState({
literal: 'Could you possibly do this for me?',
cultural: 'お手数ですが、こちらをお願いできますでしょうか？',
note: "In Japanese business culture, direct requests can seem aggressive. The phrase 'Otesuu desuga' (I'm sorry to trouble you) is used as a buffer. It acknowledges the recipient's effort before the request is even made, which is essential for maintaining 'Wa' (harmony).",
tags: ['Business Etiquette', 'Polite Form (Keigo)', 'High Context'],
sentiment: 85,
        sentimentLabel: 'Highly Formal'
});

const [history, setHistory] = useState([
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
]);

async function translate() {
const trimmed = inputText.trim();
if (!trimmed) {
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

const apiResult = payload?.data || payload?.result;
if (apiResult && apiResult.literal && apiResult.cultural) {
const explanation =
apiResult.explanation ||
apiResult.note ||
`Adjusted for ${targetOption?.label || targetCulture} communication norms and tone.`;

setResult({
literal: apiResult.literal,
cultural: apiResult.cultural,
note: explanation,
tags: ['Auto Detected'],
sentiment: 50,
sentimentLabel: 'Neutral'
});

if (String(explanation).toLowerCase().includes('fallback')) {
setStatusNote('Live translator is unavailable right now. Showing fallback output.');
}

setHistory(prev => [
{
id: Date.now(),
sourceCulture,
targetCulture,
sourceEmoji: CULTURE_EMOJI[sourceCulture] || '🌐',
targetEmoji: CULTURE_EMOJI[targetCulture] || '🌐',
literal: trimmed,
cultural: `"${apiResult.cultural}"`,
time: 'Just now'
},
...prev
]);

return;
}
throw new Error('Missing translation result');
} catch (error) {
const status = Number(error?.status || 0);
if (status === 401) {
setStatusNote('Your session expired. Sign in again to use translation.');
} else {
setStatusNote('Translation service is currently unavailable. Showing fallback output.');
}

const adaptationMap = {
British: 'Best of luck.',
Japanese: '頑張ってください。',
German: 'Viel Erfolg!',
Brazilian: 'Boa sorte!',
Arabic: 'بالتوفيق!',
Bulgarian: 'Много успех!',
American: 'You got this!'
};

const resolvedTargetLabel = targetOption?.label || targetCulture;
const fallbackLiteral = `${trimmed} (${resolvedTargetLabel} literal)`;
const fallbackCultural = adaptationMap[targetCulture] || trimmed;
const fallbackNote = `Adjusted for ${resolvedTargetLabel} communication norms and tone.`;

setResult({ 
                literal: fallbackLiteral, 
                cultural: fallbackCultural, 
                note: fallbackNote,
                tags: ['Fallback'],
                sentiment: 50,
                sentimentLabel: 'Neutral'
            });
            
            setHistory(prev => [
{
id: Date.now(),
sourceCulture,
targetCulture,
sourceEmoji: CULTURE_EMOJI[sourceCulture] || '🌐',
targetEmoji: CULTURE_EMOJI[targetCulture] || '🌐',
literal: trimmed,
cultural: `"${fallbackCultural}"`,
time: 'Just now'
},
...prev
]);
} finally {
setIsTranslating(false);
}
}

return (
<div className="view-transition" style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", color: "var(--text)" }}>
<div style={{ flex: 1, padding: "32px", overflowY: "auto", margin: "0 auto", width: "100%", maxWidth: "1280px" }}>
<header style={{ marginBottom: "40px" }}>
<h1 style={{ fontSize: "30px", fontWeight: "bold", letterSpacing: "-0.02em", color: "var(--text)", marginBottom: "8px" }}>Cultural Translator</h1>
<p style={{ color: "var(--text-muted)", maxWidth: "800px", fontSize: "15px", lineHeight: "1.6" }}>
Bridge the gap between languages and cultural contexts. Understand not just the words, but the intent and etiquette behind them.
</p>
</header>

<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px", alignItems: "flex-start" }}>

{/* Input Section */}
<section className="card" style={{ display: "flex", flexDirection: "column", minHeight: "380px" }}>
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--bg3)", padding: "6px", borderRadius: "8px", border: "1px solid var(--panel-border)" }}>
<select
value={sourceCulture}
onChange={(e) => setSourceCulture(e.target.value)}
style={{ background: "transparent", border: "none", color: "var(--text)", outline: "none", fontSize: "14px", fontWeight: "500", cursor: "pointer", padding: "4px 8px" }}
>
{CULTURES.map((culture) => (
<option key={culture.key} value={culture.key}>
{CULTURE_EMOJI[culture.key] || '🌐'} {culture.label}
</option>
))}
</select>
<Icon name="swap_horiz" size={16} />
<select
value={targetCulture}
onChange={(e) => setTargetCulture(e.target.value)}
style={{ background: "transparent", border: "none", color: "var(--text)", outline: "none", fontSize: "14px", fontWeight: "500", cursor: "pointer", padding: "4px 8px" }}
>
{CULTURES.map((culture) => (
<option key={culture.key} value={culture.key}>
{CULTURE_EMOJI[culture.key] || '🌐'} {culture.label}
</option>
))}
</select>
</div>
<span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em" }}>Input Text</span>
</div>

<textarea 
placeholder="Type a message or phrase to translate culturally..."
style={{ flex: 1, height: "180px", background: "transparent", border: "none", resize: "none", outline: "none", fontSize: "20px", color: "var(--text)", padding: "0" }}
value={inputText}
onChange={(e) => setInputText(e.target.value)}
/>

<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
<div style={{ display: "flex", gap: "12px", color: "var(--text-muted)" }}>
<button style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", padding: "4px" }}><Icon name="mic" size={22} /></button>
<button style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", padding: "4px" }}><Icon name="attach_file" size={22} /></button>
</div>
<button 
onClick={translate}
disabled={isTranslating}
style={{ 
background: "var(--accent)", color: "#fff", border: "none", 
padding: "12px 32px", borderRadius: "10px", fontWeight: "600", fontSize: "15px",
cursor: "pointer", opacity: isTranslating ? 0.7 : 1, transition: "background 0.2s" 
}}>
{isTranslating ? 'Translating...' : 'Translate Context'}
</button>
</div>
</section>

{/* Output Section */}
<div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
{/* Dual Boxes */}
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
<div className="card" style={{ background: "var(--card-bg)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
<div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", marginBottom: "12px" }}>
<Icon name="translate" size={16} />
<span style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>Literal Translation</span>
</div>
<p style={{ fontStyle: "italic", fontSize: "16px", color: "var(--text)" }}>{result.literal}</p>
</div>

<div className="card" style={{ border: "1px solid var(--accent-soft)", background: "var(--accent-soft)", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center" }}>
<div style={{ position: "absolute", top: "-10px", right: "-10px", opacity: 0.1, color: "var(--accent)" }}>
                                    <Icon name="auto_awesome" size={64} />
                                </div>
<div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--accent)", marginBottom: "12px" }}>
<Icon name="auto_awesome" size={16} />
<span style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>Cultural Context</span>
</div>
<p style={{ fontWeight: "700", fontSize: "18px", color: "var(--text)" }}>{result.cultural}</p>
</div>
</div>

{/* Explanation Card */}
<div className="card" style={{ background: "var(--accent)", color: "#fff", border: "none" }}>
<div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
<div style={{ background: "rgba(255,255,255,0.2)", padding: "10px", borderRadius: "10px" }}>
<Icon name="lightbulb" size={24} />
</div>
<div style={{ flex: 1 }}>
<h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "8px" }}>Nuance Explanation</h3>
<p style={{ fontSize: "14px", lineHeight: "1.6", opacity: 0.9 }}>{result.note}</p>
<div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "16px" }}>
{result.tags.map(tag => (
<span key={tag} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", fontSize: "10px", padding: "4px 10px", borderRadius: "6px", textTransform: "uppercase", fontWeight: "bold", letterSpacing: "0.5px" }}>{tag}</span>
))}
</div>
</div>
</div>
</div>

{/* Tone Sentiment Bar */}
<div className="card">
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
<span style={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "1px" }}>Sentiment & Politeness Spectrum</span>
</div>
<div style={{ height: "8px", width: "100%", background: "var(--bg3)", borderRadius: "4px", overflow: "hidden", display: "flex" }}>
<div style={{ height: "100%", background: "var(--accent)", width: `${result.sentiment}%`, borderRadius: "4px" }} />
</div>
<div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", fontSize: "11px", color: "var(--text-muted)", fontWeight: "500" }}>
<span>Casual</span>
<span style={{ color: "var(--accent)", fontWeight: "bold" }}>{result.sentimentLabel}</span>
</div>
</div>
</div>
</div>

{/* History List */}
<section style={{ marginTop: "56px", paddingBottom: "40px" }}>
<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
<h2 style={{ fontSize: "20px", fontWeight: "bold", color: "var(--text)" }}>Recent Translations</h2>
<button style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: "600", fontSize: "14px", cursor: "pointer" }}>View All History</button>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
{history.map(item => (
<div key={item.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
<div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
<div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "20px" }}>
<span>{item.sourceEmoji}</span>
<Icon name="arrow_forward" size={16} />
<span>{item.targetEmoji}</span>
</div>
<div>
<p style={{ fontSize: "15px", fontWeight: "600", color: "var(--text)", marginBottom: "4px" }}>{item.literal}</p>
<p style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>{item.cultural}</p>
</div>
</div>
<div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
<span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{item.time}</span>
<Icon name="chevron_right" size={20} />
</div>
</div>
))}
</div>
</section>
</div>
</div>
);
}
