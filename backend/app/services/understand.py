"""Unified Understand AI service.

One Groq call returns all five fields — simplified text, explanation,
idiom list, tone hint, and translation.  Every failure path returns the
original text so the caller always gets a usable response.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re

from app.config import settings
from app.schemas.understand import IdiomEntry, MessageContext, UnderstandResponse, UserPreferences
from app.services.groq_client import groq_client
from app.services.redis_client import redis_client

logger = logging.getLogger(__name__)

_UNDERSTAND_CACHE_TTL = 86_400  # 24 hours — understand results are deterministic


def _understand_cache_key(message_text: str, reading_level: str, language: str) -> str:
    """Stable cache key based on the three inputs that affect the result."""
    raw = f"{message_text}|{reading_level}|{language}"
    digest = hashlib.sha256(raw.encode()).hexdigest()[:24]
    return f"understand:{digest}"

# -------------------------------------------------------------------------
# Prompt
# -------------------------------------------------------------------------
_SYSTEM_PROMPT = """\
You are a workplace communication assistant. Analyse the message and return \
ONLY a valid JSON object — no markdown fences, no extra text.

Schema:
{
  "simplified": "rewritten at <reading_level>: simpler vocabulary, shorter sentences",
  "explanation": "one sentence covering any jargon, acronyms, or needed context",
  "idioms": [
    {
      "phrase": "exact non-literal phrase as it appears in the message",
      "meaning": "plain-English explanation of what it actually means in this context",
      "localized_equivalent": "the most natural way a native target_language speaker would express the same idea — never a word-for-word translation",
      "category": "one of: idiom | phrasal_verb | metaphor | slang | jargon"
    }
  ],
  "tone_hint": "one-to-four words describing the tone",
  "translated": "full message translated into target_language using meaning-for-meaning phrasing"
}

Rules:
- reading_level values: "simple" → 5th-grade vocabulary, "general" → high-school, "advanced" → professional.
- idioms: detect ALL non-literal language — fixed idioms ("break a leg"), phrasal verbs used \
figuratively ("run this by you"), workplace metaphors ("move the needle", "boil the ocean"), \
slang ("heads-up", "deep dive"), and domain jargon ("circle back", "low-hanging fruit"). \
Max 5 entries. Use [] when none present.
- meaning: explain what the phrase means in THIS workplace context, not its etymology. \
Keep it one short sentence. Example: "break a leg" → "Good luck with your presentation."
- localized_equivalent: give the idiomatic phrase a native target_language speaker \
would actually say. NEVER translate word-for-word. If the concept has no direct equivalent, \
describe it naturally. Example for German: "break a leg" → "Hals- und Beinbruch", \
"spill the beans" → "aus dem Nähkästchen plaudern".
- category: classify each entry as exactly one of: idiom, phrasal_verb, metaphor, slang, jargon.
- translated: preserve the meaning and register of the original; do not translate idioms \
literally — replace each with the localized_equivalent.
- tone_hint: must be 1-4 words, e.g. "casual", "urgent and direct", "politely formal".
- All string values must be non-empty. When uncertain, echo the original message text.\
"""


# -------------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------------

def _extract_json(raw: str) -> dict:  # type: ignore[type-arg]
    """Parse model output, tolerating stray markdown fences."""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            return json.loads(match.group(0))
        raise


_VALID_CATEGORIES = {"idiom", "phrasal_verb", "metaphor", "slang", "jargon"}


def _parse_idioms(raw: object, original_text: str) -> list[IdiomEntry]:
    """Coerce the AI idiom list to typed entries, dropping malformed items."""
    if not isinstance(raw, list):
        return []
    out: list[IdiomEntry] = []
    for item in raw[:5]:
        if not isinstance(item, dict):
            continue
        phrase = str(item.get("phrase") or "").strip()
        meaning = str(item.get("meaning") or "").strip()
        equiv = str(item.get("localized_equivalent") or "").strip()
        category = str(item.get("category") or "").strip().lower()
        if category not in _VALID_CATEGORIES:
            category = "idiom"
        # Skip entries where the localized_equivalent is just a literal translation
        # (heuristic: identical to phrase after lowercasing → fall back to phrase)
        if not equiv or equiv.lower() == phrase.lower():
            equiv = phrase
        if phrase and meaning:
            out.append(IdiomEntry(phrase=phrase, meaning=meaning, localized_equivalent=equiv, category=category))
    return out


def _parse_response(parsed: dict, original_text: str) -> UnderstandResponse:  # type: ignore[type-arg]
    """Extract fields with per-field fallbacks so one bad key never kills the response."""
    simplified = str(parsed.get("simplified") or original_text).strip() or original_text
    explanation = str(parsed.get("explanation") or "").strip()
    tone_hint = str(parsed.get("tone_hint") or "").strip()
    translated = str(parsed.get("translated") or original_text).strip() or original_text
    idioms = _parse_idioms(parsed.get("idioms"), original_text)
    return UnderstandResponse(
        simplified=simplified,
        explanation=explanation,
        idioms=idioms,
        tone_hint=tone_hint,
        translated=translated,
    )


def _fallback(text: str) -> UnderstandResponse:
    """Return original text unchanged when the AI call fails."""
    return UnderstandResponse(
        simplified=text,
        explanation="",
        idioms=[],
        tone_hint="",
        translated=text,
    )


# -------------------------------------------------------------------------
# Public API
# -------------------------------------------------------------------------

async def understand_message(
    *,
    message_text: str,
    user_preferences: UserPreferences,
    context: MessageContext,
) -> UnderstandResponse:
    """Run the full Understand pipeline in a single Groq call.

    Cache-first: results are stored in Redis for 24 h keyed by
    (message_text, reading_level, language).  Cache hits return in <5 ms.

    Fail-open contract: any exception returns the original message text
    so the caller always receives a valid UnderstandResponse.
    """
    cache_key = _understand_cache_key(
        message_text, user_preferences.reading_level, user_preferences.language
    )

    # ── Cache read ────────────────────────────────────────────────────────────
    try:
        cached_raw = await redis_client.get_json(cache_key)
        if cached_raw:
            return UnderstandResponse.model_validate(json.loads(cached_raw))
    except Exception:  # noqa: BLE001
        pass  # Redis unavailable — proceed to Groq

    # ── Groq call ─────────────────────────────────────────────────────────────
    user_prompt = (
        f"message: {message_text}\n"
        f"reading_level: {user_preferences.reading_level}\n"
        f"target_language: {user_preferences.language}\n"
        f"channel_tone: {context.channel_tone or 'neutral'}\n"
        f"thread_context: {context.thread or 'none'}"
    )

    try:
        raw = await groq_client.chat(
            [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            model=settings.groq_fast_model,
            temperature=0.2,
            max_tokens=600,
            task_type="understand",
        )
        parsed = _extract_json(raw)
        result = _parse_response(parsed, message_text)
    except Exception:  # noqa: BLE001
        logger.warning("understand_fallback", extra={"text_length": len(message_text)})
        return _fallback(message_text)

    # ── Cache write ───────────────────────────────────────────────────────────
    try:
        await redis_client.set_json(
            cache_key, json.dumps(result.model_dump()), ex_seconds=_UNDERSTAND_CACHE_TTL
        )
    except Exception:  # noqa: BLE001
        pass

    return result
