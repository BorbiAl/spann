"""Translation service built on top of Groq chat completions."""

from __future__ import annotations

import json

from app.schemas.translate import TranslateRequest
from app.services.groq_client import groq_client

TRANSLATION_SYSTEM_PROMPT = (
    "You are a cultural communication expert. Given a phrase, source locale, target locale, "
    "source culture, and target culture, return ONLY a JSON object with no markdown:\n"
    "{\n"
    '  "literal": "direct translation",\n'
    '  "cultural": "culturally adapted version",\n'
    '  "explanation": "one sentence explaining the cultural difference"\n'
    "}"
)


async def translate_culturally(payload: TranslateRequest) -> dict[str, str]:
    """Generate literal and culturally adapted translations from AI output."""

    user_prompt = (
        "phrase={phrase}, source_locale={src}, target_locale={tgt}, source_culture={src_culture}, "
        "target_culture={tgt_culture}, workplace_tone={tone}"
    ).format(
        phrase=payload.phrase,
        src=payload.source_locale,
        tgt=payload.target_locale,
        src_culture=payload.source_culture,
        tgt_culture=payload.target_culture,
        tone=payload.workplace_tone,
    )

    raw = await groq_client.chat(
        [
            {"role": "system", "content": TRANSLATION_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=350,
        task_type="translation",
    )

    parsed = json.loads(raw)
    return {
        "literal": str(parsed.get("literal", "")).strip(),
        "cultural": str(parsed.get("cultural", "")).strip(),
        "explanation": str(parsed.get("explanation", "")).strip(),
    }
