"""Translation service built on top of Groq chat completions."""

from __future__ import annotations

import json
import re

from app.schemas.translate import TranslateRequest
from app.services.groq_client import groq_client

LITERAL_SYSTEM_PROMPT = (
    "You are a word-for-word literal translator. Return ONLY JSON with no markdown:\n"
    "{\n"
    '  "literal": "word-for-word literal translation in target_locale"\n'
    "}\n"
    "Rules:\n"
    "- Translate each word individually from source_locale to target_locale.\n"
    "- Preserve the exact source word order as closely as the target script allows.\n"
    "- Do NOT interpret idioms — translate the words as written (e.g. 'break a leg' → translate 'break', 'a', 'leg' literally).\n"
    "- Do NOT make the result sound natural or grammatically correct in the target language.\n"
    "- Do NOT adapt tone, register, or cultural meaning.\n"
    "- Do NOT paraphrase or substitute synonyms for naturalness.\n"
    "- The output will intentionally read as awkward or foreign — that is correct."
)

CULTURAL_SYSTEM_PROMPT = (
    "You are a cultural communication expert for cross-language workplace communication. Return ONLY JSON with no markdown:\n"
    "{\n"
    '  "cultural": "AI-adapted translation in target_locale for target_culture",\n'
    '  "explanation": "one sentence explaining the cultural adaptation"\n'
    "}\n"
    "Rules:\n"
    "- Translate into target_locale and adapt for target_culture and workplace_tone.\n"
    "- You may rewrite idioms and expressions for cultural fit.\n"
    "- For idioms/proverbs, prefer a natural target-language equivalent; if none exists, use a concise meaning-based paraphrase.\n"
    "- Keep factual intent and requests intact while adapting tone and pragmatics.\n"
    "- Output must be in target_locale, regardless of source language."
)


def _extract_json(raw: str) -> dict[str, str]:
    """Parse model output JSON, tolerating fenced code blocks."""

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", raw)
        if not match:
            raise
        return json.loads(match.group(0))


def _base_locale(value: str) -> str:
    """Normalize locale to lowercase language tag (e.g. en-US -> en)."""

    return str(value or "").strip().split("-")[0].lower()


def _pick_value(payload: dict[str, str], *keys: str) -> str:
    """Pick first non-empty string from known JSON keys."""

    for key in keys:
        candidate = str(payload.get(key, "")).strip()
        if candidate:
            return candidate
    return ""


async def translate_culturally(payload: TranslateRequest) -> dict[str, str]:
    """Generate literal and culturally adapted translations from AI output."""

    base_prompt = (
        "Translate this phrase from source_locale to target_locale.\n"
        "phrase: {phrase}\n"
        "source_locale: {src}\n"
        "target_locale: {tgt}\n"
        "source_culture: {src_culture}\n"
        "target_culture: {tgt_culture}\n"
        "workplace_tone: {tone}"
    ).format(
        phrase=payload.phrase,
        src=payload.source_locale,
        tgt=payload.target_locale,
        src_culture=payload.source_culture,
        tgt_culture=payload.target_culture,
        tone=payload.workplace_tone,
    )

    literal_raw = await groq_client.chat(
        [
            {"role": "system", "content": LITERAL_SYSTEM_PROMPT},
            {"role": "user", "content": base_prompt},
        ],
        temperature=0.0,
        max_tokens=200,
        task_type="translation",
    )

    literal_parsed = _extract_json(literal_raw)
    literal = _pick_value(literal_parsed, "literal", "literal_translation", "translation")

    source_lang = _base_locale(payload.source_locale)
    target_lang = _base_locale(payload.target_locale)
    source_text = str(payload.phrase).strip()
    same_as_source = literal.casefold() == source_text.casefold()

    if not literal or (source_lang != target_lang and same_as_source):
        retry_prompt = (
            "Previous output was invalid. "
            "Translate each word individually (word-for-word) from source_locale to target_locale and return ONLY JSON {\"literal\":\"...\"}. "
            "Never return the original source phrase when source and target locales differ. "
            f"phrase={payload.phrase}, source_locale={payload.source_locale}, target_locale={payload.target_locale}"
        )
        literal_retry_raw = await groq_client.chat(
            [
                {"role": "system", "content": LITERAL_SYSTEM_PROMPT},
                {"role": "user", "content": retry_prompt},
            ],
            temperature=0.0,
            max_tokens=200,
            task_type="translation",
        )
        literal_retry_parsed = _extract_json(literal_retry_raw)
        literal = _pick_value(literal_retry_parsed, "literal", "literal_translation", "translation")

    if not literal:
        raise ValueError("literal_missing")

    if source_lang != target_lang and literal.casefold() == source_text.casefold():
        raise ValueError("literal_not_translated")

    cultural_raw = await groq_client.chat(
        [
            {"role": "system", "content": CULTURAL_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"{base_prompt}, strict_literal={literal}. "
                    "Use strict_literal as the semantic baseline and produce a culturally adapted translation for the target audience."
                ),
            },
        ],
        temperature=0.4,
        max_tokens=300,
        task_type="translation",
    )

    cultural_parsed = _extract_json(cultural_raw)
    cultural = _pick_value(cultural_parsed, "cultural", "adapted", "translation") or literal
    explanation = _pick_value(cultural_parsed, "explanation", "rationale") or "Cultural adaptation applied for target context."

    return {
        "literal": literal,
        "cultural": cultural,
        "explanation": explanation,
    }
