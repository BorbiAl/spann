"""Thread summarization AI service.

Accepts a list of recent messages, makes one Groq call, and returns
bullet points, key decisions, and action items.  Fail-open: any error
returns empty lists so the caller always gets a valid response.
"""

from __future__ import annotations

import json
import logging
import re

from app.config import settings
from app.schemas.summarize import SummarizeResponse
from app.services.groq_client import groq_client

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are a workplace communication assistant. Read the conversation thread below \
and return ONLY a valid JSON object — no markdown fences, no extra text.

Schema:
{
  "bullets": ["concise bullet 1", "concise bullet 2", ...],
  "decisions": ["decision made 1", ...],
  "action_items": ["action item 1", ...]
}

Rules:
- bullets: 3-6 short sentences capturing the most important points discussed.
- decisions: list every explicit decision reached (e.g. "Agreed to ship v2 on Friday"). \
  Use [] when none.
- action_items: list every concrete next step or assignment (e.g. "Alice to update \
  the roadmap doc"). Use [] when none.
- Keep every item under 20 words.
- Output must be valid JSON with exactly these three array keys.\
"""


def _extract_json(raw: str) -> dict:  # type: ignore[type-arg]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            return json.loads(match.group(0))
        raise


def _parse_string_list(value: object, max_items: int = 8) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value[:max_items] if isinstance(item, str) and str(item).strip()]


async def summarize_thread(messages: list[dict]) -> SummarizeResponse:  # type: ignore[type-arg]
    """Run the summarize pipeline in a single Groq call.

    messages: list of dicts with at least 'text' and optionally 'user' keys,
              in chronological order.

    Fail-open: any exception returns empty lists.
    """
    if not messages:
        return SummarizeResponse(bullets=[], decisions=[], action_items=[], message_count=0, cached=False)

    thread_text = "\n".join(
        f"[{msg.get('user', 'unknown')}]: {msg.get('text', '')}"
        for msg in messages
        if msg.get("text") and str(msg["text"]).strip() not in ("[deleted]", "")
    )

    if not thread_text.strip():
        return SummarizeResponse(bullets=[], decisions=[], action_items=[], message_count=0, cached=False)

    user_prompt = f"Thread:\n{thread_text}"

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
        return SummarizeResponse(
            bullets=_parse_string_list(parsed.get("bullets"), 6),
            decisions=_parse_string_list(parsed.get("decisions"), 6),
            action_items=_parse_string_list(parsed.get("action_items"), 6),
            message_count=len(messages),
            cached=False,
        )
    except Exception:  # noqa: BLE001
        logger.warning("summarize_fallback", extra={"message_count": len(messages)})
        return SummarizeResponse(bullets=[], decisions=[], action_items=[], message_count=len(messages), cached=False)
