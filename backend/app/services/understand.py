"""Message understanding service — simplification, explanation, idiom detection."""

from __future__ import annotations

import json
import re

from app.schemas.understand import UnderstandRequest
from app.services.groq_client import groq_client

SYSTEM_PROMPT = (
    "You are a communication clarity assistant. Analyze a workplace chat message and return ONLY JSON with no markdown:\n"
    "{\n"
    '  "simplified": "plain-language rewrite at requested reading level, same meaning, shorter sentences",\n'
    '  "explanation": "1-2 sentences: what this message really means, including implied requests or tone",\n'
    '  "tone_hint": "one word: Friendly | Formal | Urgent | Sarcastic | Casual | Assertive | Neutral",\n'
    '  "idioms": [\n'
    '    {"phrase": "exact phrase from message", "meaning": "what it means literally in context", "localized_equivalent": "plain equivalent"}\n'
    "  ]\n"
    "}\n"
    "Rules:\n"
    "- simplified must be genuinely simpler — shorter sentences, no jargon, same factual content.\n"
    "- explanation must be concrete and specific to THIS message. No generic filler like 'the sender is communicating'.\n"
    "- idioms: only include actual idioms, figures of speech, or culturally opaque phrases. Empty array if none.\n"
    "- tone_hint: pick the single most accurate label.\n"
    "- Never invent content not in the original message.\n"
    "- Return valid JSON only. No text before or after."
)


def _extract_json(raw: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", raw)
        if not match:
            raise
        return json.loads(match.group(0))


def _repair(result: dict, original_text: str) -> dict:
    """Ensure all required fields are present and well-typed."""

    simplified = str(result.get("simplified") or "").strip() or original_text
    explanation = str(result.get("explanation") or "").strip() or "No additional context available."
    tone_hint = str(result.get("tone_hint") or "Neutral").strip() or "Neutral"

    raw_idioms = result.get("idioms")
    idioms = []
    if isinstance(raw_idioms, list):
        for item in raw_idioms:
            if not isinstance(item, dict):
                continue
            phrase = str(item.get("phrase") or "").strip()
            meaning = str(item.get("meaning") or "").strip()
            localized = str(item.get("localized_equivalent") or "").strip()
            if phrase and meaning:
                idioms.append({"phrase": phrase, "meaning": meaning, "localized_equivalent": localized or meaning})

    return {
        "simplified": simplified,
        "explanation": explanation,
        "tone_hint": tone_hint,
        "idioms": idioms,
    }


async def analyze_message(request: UnderstandRequest) -> dict:
    """Call Groq to simplify and explain a message."""

    reading_level = str(request.user_preferences.reading_level or "standard").strip() or "standard"
    language = str(request.user_preferences.language or "en").strip() or "en"

    user_prompt = (
        f"Message:\n{request.message_text}\n\n"
        f"Target reading level: {reading_level}\n"
        f"User language: {language}\n\n"
        "Analyze this message and return the JSON structure."
    )

    raw = await groq_client.chat(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        max_tokens=512,
        task_type="translation",
    )

    parsed = _extract_json(raw)
    return _repair(parsed, request.message_text)
