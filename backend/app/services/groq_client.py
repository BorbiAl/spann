"""Groq API client with retries, latency logging, and strict output handling."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MAX_RETRIES = 3
BASE_BACKOFF_SECONDS = 1
REQUEST_TIMEOUT_SECONDS = 25


class GroqClientError(RuntimeError):
    """Raised when Groq requests fail after retries."""


class GroqClient:
    """Async Groq chat-completion wrapper with observability."""

    def __init__(self) -> None:
        self._client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS)

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        temperature: float = 0.2,
        max_tokens: int = 300,
    ) -> str:
        """Run a chat completion request and return assistant text."""

        selected_model = model or settings.groq_model
        headers = {
            "Authorization": f"Bearer {settings.groq_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": selected_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        for attempt in range(1, MAX_RETRIES + 1):
            started = time.perf_counter()
            try:
                response = await self._client.post(GROQ_API_URL, headers=headers, json=payload)
                response.raise_for_status()
                body = response.json()

                latency_ms = round((time.perf_counter() - started) * 1000, 2)
                usage = body.get("usage", {}) if isinstance(body, dict) else {}
                logger.info(
                    "groq_chat_success",
                    extra={
                        "latency_ms": latency_ms,
                        "attempt": attempt,
                        "model": selected_model,
                        "prompt_tokens": usage.get("prompt_tokens", 0),
                        "completion_tokens": usage.get("completion_tokens", 0),
                        "total_tokens": usage.get("total_tokens", 0),
                    },
                )

                choices = body.get("choices", []) if isinstance(body, dict) else []
                if not choices:
                    raise GroqClientError("Groq response did not include any choices.")

                message = choices[0].get("message", {})
                content = message.get("content") if isinstance(message, dict) else None
                if not content or not isinstance(content, str):
                    raise GroqClientError("Groq response content was empty or invalid.")

                return content.strip()

            except (httpx.HTTPError, ValueError, GroqClientError) as exc:
                latency_ms = round((time.perf_counter() - started) * 1000, 2)
                logger.warning(
                    "groq_chat_retry",
                    extra={
                        "attempt": attempt,
                        "latency_ms": latency_ms,
                        "error": str(exc),
                    },
                )

                if attempt == MAX_RETRIES:
                    raise GroqClientError(f"Groq request failed after {MAX_RETRIES} attempts: {exc}") from exc

                await asyncio.sleep(BASE_BACKOFF_SECONDS * (2 ** (attempt - 1)))

        raise GroqClientError("Groq request failed unexpectedly.")

    async def close(self) -> None:
        """Close HTTP resources on service shutdown."""

        await self._client.aclose()


groq_client = GroqClient()
