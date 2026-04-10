"""Translation service built on top of Groq chat completions."""

from __future__ import annotations

import json
import re

from app.schemas.translate import TranslateRequest
from app.services.groq_client import groq_client

LITERAL_SYSTEM_PROMPT = (
    "You are a professional translator. Return ONLY JSON with no markdown:\n"
    "{\n"
    '  "literal": "strict, direct, word-level translation"\n'
    "}\n"
    "Rules:\n"
    "- Keep the meaning as literal as possible.\n"
    "- Do NOT culturally adapt idioms or tone.\n"
    "- Do NOT paraphrase for naturalness.\n"
    "- Preserve imperative/request forms exactly."
)

CULTURAL_SYSTEM_PROMPT = (
    "You are a cultural communication expert. Return ONLY JSON with no markdown:\n"
    "{\n"
    '  "cultural": "culturally adapted version",\n'
    '  "explanation": "one sentence explaining the cultural difference"\n'
    "}\n"
    "Rules:\n"
    "- Adapt naturally for the target culture and workplace tone.\n"
    "- You may rewrite idioms and expressions for cultural fit."
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


async def translate_culturally(payload: TranslateRequest) -> dict[str, str]:
    """Generate literal and culturally adapted translations from AI output."""

    base_prompt = (
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

    literal_raw = await groq_client.chat(
        [
            {"role": "system", "content": LITERAL_SYSTEM_PROMPT},
            {"role": "user", "content": base_prompt},
        ],
        max_tokens=200,
        task_type="translation",
    )

    literal_parsed = _extract_json(literal_raw)
    literal = str(literal_parsed.get("literal", "")).strip() or payload.phrase

    cultural_raw = await groq_client.chat(
        [
            {"role": "system", "content": CULTURAL_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"{base_prompt}, strict_literal={literal}. "
                    "Use the literal only as reference, then culturally adapt for the target audience."
                ),
            },
        ],
        max_tokens=300,
        task_type="translation",
    )

    cultural_parsed = _extract_json(cultural_raw)
    cultural = str(cultural_parsed.get("cultural", "")).strip() or literal
    explanation = str(cultural_parsed.get("explanation", "")).strip() or "Cultural adaptation applied for target context."

    return {
        "literal": literal,
        "cultural": cultural,
        "explanation": explanation,
    }
