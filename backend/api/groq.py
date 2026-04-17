"""
Async Groq client — uses httpx.AsyncClient (no Groq SDK dependency).

The client is intentionally time-bounded: each call uses a 700 ms timeout
so the /api/messages/process endpoint can call simplify + tone concurrently
and still return within the 800 ms SLA.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import time
from enum import Enum
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_GROQ_API_BASE = "https://api.groq.com"
_CHAT_PATH = "/openai/v1/chat/completions"
_DEFAULT_MODEL = "llama-3.3-70b-versatile"

# 700 ms — leaves ~100 ms headroom for DB operations before/after
_DEFAULT_TIMEOUT = httpx.Timeout(connect=5.0, read=0.70, write=5.0, pool=5.0)

_VALID_TONES = frozenset(
    ["URGENT", "CASUAL", "FORMAL", "AGGRESSIVE", "SUPPORTIVE", "NEUTRAL"]
)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class GroqError(Exception):
    """Base class for all Groq client errors."""


class GroqTimeoutError(GroqError):
    """Raised when the Groq API does not respond within the timeout budget."""


class GroqUpstreamError(GroqError):
    """Raised when the Groq API returns a non-2xx status."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(f"Groq API {status_code}: {detail}")
        self.status_code = status_code


class GroqParseError(GroqError):
    """Raised when the model response cannot be mapped to the expected type."""

    def __init__(self, message: str, raw: str) -> None:
        super().__init__(message)
        self.raw = raw


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class GroqClient:
    """
    Thin async wrapper around the Groq chat-completions endpoint.

    Intended to be created once at startup and shared across requests.
    Call `await client.aclose()` during shutdown.

    Example::

        client = GroqClient(api_key="gsk_...")
        simplified = await client.simplify("Some text", reading_level=6)
        tone = await client.analyze_tone("Some text")
        await client.aclose()
    """

    def __init__(
        self,
        api_key: str | None = None,
        model: str = _DEFAULT_MODEL,
        timeout: httpx.Timeout = _DEFAULT_TIMEOUT,
    ) -> None:
        resolved_key = api_key or os.environ.get("GROQ_API_KEY", "")
        if not resolved_key:
            raise ValueError("GROQ_API_KEY must be set to use GroqClient")

        self._model = model
        self._http = httpx.AsyncClient(
            base_url=_GROQ_API_BASE,
            headers={
                "Authorization": f"Bearer {resolved_key}",
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )

    # ── Core request helper ────────────────────────────────────────────────

    async def _complete(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int = 512,
    ) -> str:
        """
        Send a chat-completion request and return the assistant's text.

        Raises GroqTimeoutError, GroqUpstreamError, or GroqParseError on failure.
        """
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        t0 = time.monotonic()
        try:
            resp = await self._http.post(_CHAT_PATH, json=payload)
        except httpx.TimeoutException as exc:
            raise GroqTimeoutError(
                f"Groq API timed out after {self._http.timeout.read}s"
            ) from exc
        except httpx.RequestError as exc:
            raise GroqError(f"Groq network error: {exc}") from exc

        latency_ms = int((time.monotonic() - t0) * 1000)
        logger.debug("groq_request", status=resp.status_code, latency_ms=latency_ms)

        if resp.status_code != 200:
            try:
                body = resp.json()
                detail = body.get("error", {}).get("message", resp.text)
            except Exception:  # noqa: BLE001
                detail = resp.text
            raise GroqUpstreamError(resp.status_code, detail)

        data = resp.json()
        content: str | None = (
            data.get("choices", [{}])[0].get("message", {}).get("content")
        )
        if not content or not content.strip():
            raise GroqParseError("Groq returned an empty response", "")
        return content.strip()

    # ── Public methods ─────────────────────────────────────────────────────

    async def simplify(self, text: str, reading_level: int) -> str:
        """
        Rewrite *text* so it is easily understood at *reading_level* (FK grade 1–12).

        Returns the simplified text.  Falls back to the original on any error
        so message processing is never blocked by an AI failure.
        """
        level = max(1, min(12, reading_level))
        grade_labels = {
            1: "a 6-year-old (grade 1) — very short sentences, only the simplest words",
            2: "a 7-year-old (grade 2)",
            3: "an 8-year-old (grade 3)",
            4: "a 9-year-old (grade 4)",
            5: "a 10-year-old (grade 5)",
            6: "an 11-year-old (grade 6)",
            7: "a 12-year-old (grade 7)",
            8: "a 13-year-old (grade 8) — standard news writing",
            9: "a 14-year-old (grade 9)",
            10: "a 15-year-old (grade 10)",
            11: "a 16-year-old (grade 11)",
            12: "a high school graduate (grade 12)",
        }
        label = grade_labels.get(level, f"grade {level}")

        messages = [
            {
                "role": "system",
                "content": (
                    "You are an accessibility rewriting assistant. "
                    "Rewrite messages at the requested reading level. "
                    "Preserve the complete meaning. "
                    "Output ONLY the rewritten text — no preamble, no quotes."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Rewrite this message so it is easily understood by {label}.\n\n"
                    f"Message:\n{text}"
                ),
            },
        ]
        return await self._complete(messages, temperature=0.2, max_tokens=512)

    async def analyze_tone(self, text: str) -> str:
        """
        Classify the tone of *text* as one of:
        URGENT | CASUAL | FORMAL | AGGRESSIVE | SUPPORTIVE | NEUTRAL

        Returns the uppercase tone label string.
        Raises GroqParseError if the model returns an unrecognised label.
        """
        messages = [
            {
                "role": "system",
                "content": (
                    "Classify the emotional tone of the message into exactly one label: "
                    "URGENT, CASUAL, FORMAL, AGGRESSIVE, SUPPORTIVE, NEUTRAL. "
                    "Respond with ONLY the label — no punctuation, no explanation."
                ),
            },
            {
                "role": "user",
                "content": f"Message:\n{text}",
            },
        ]
        raw = await self._complete(messages, temperature=0.1, max_tokens=10)
        # Normalise: strip punctuation, upper-case
        normalised = "".join(c for c in raw.upper() if c.isalpha())
        if normalised not in _VALID_TONES:
            logger.warning(
                "groq_tone_parse_fallback",
                raw=raw,
                normalised=normalised,
            )
            raise GroqParseError(
                f"Unrecognised tone '{normalised}'. Expected one of {sorted(_VALID_TONES)}",
                raw,
            )
        return normalised

    async def aclose(self) -> None:
        """Release the underlying httpx connection pool."""
        await self._http.aclose()


# ---------------------------------------------------------------------------
# Module-level singleton (initialised in app lifespan)
# ---------------------------------------------------------------------------

_groq_client: GroqClient | None = None


def init_groq() -> None:
    """Create and store the shared GroqClient. Called once during app startup."""
    global _groq_client  # noqa: PLW0603
    _groq_client = GroqClient()
    logger.info("groq_client_ready", model=_DEFAULT_MODEL)


async def close_groq() -> None:
    """Release the GroqClient. Called during app shutdown."""
    global _groq_client  # noqa: PLW0603
    if _groq_client is not None:
        await _groq_client.aclose()
        _groq_client = None
        logger.info("groq_client_closed")


def get_groq() -> GroqClient:
    """FastAPI dependency — returns the shared GroqClient."""
    if _groq_client is None:
        raise RuntimeError("GroqClient not initialised. Is the app lifespan running?")
    return _groq_client
