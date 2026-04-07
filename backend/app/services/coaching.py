"""Coaching nudge generation service."""

from __future__ import annotations

import json

from app.services.groq_client import groq_client

COACHING_SYSTEM_PROMPT = (
    "You are a team communication coach. Analyse this message for tone issues. "
    "If the message is fine, return null. If there is an issue, return ONLY a JSON object:\n"
    "{\n"
    '  "nudge": "one short actionable suggestion under 12 words",\n'
    '  "severity": "low|medium|high"\n'
    "}"
)


async def generate_coaching_nudge(*, text: str, tone: str, locale: str) -> dict[str, str] | None:
    """Produce a short coaching nudge when AI identifies a tone risk."""

    user_prompt = "message={text}, channel_tone={tone}, user_locale={locale}".format(
        text=text,
        tone=tone,
        locale=locale,
    )

    raw = await groq_client.chat(
        [
            {"role": "system", "content": COACHING_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=180,
        task_type="coaching",
    )

    if raw.strip().lower() == "null":
        return None

    parsed = json.loads(raw)
    nudge = str(parsed.get("nudge", "")).strip()
    severity = str(parsed.get("severity", "low")).strip().lower()
    if severity not in {"low", "medium", "high"}:
        severity = "low"

    if not nudge:
        return None

    words = nudge.split()
    if len(words) > 12:
        nudge = " ".join(words[:12])

    return {"nudge": nudge, "severity": severity}
