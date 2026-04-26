"""Groq API client with typed errors, circuit breaker, and metrics."""

from __future__ import annotations

import asyncio
import logging
import time
from types import TracebackType

import httpx

from app.config import settings
from app.metrics import groq_api_calls_total, groq_api_errors_total, groq_api_latency_seconds

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
MAX_RETRIES = 2
BASE_BACKOFF_SECONDS = 0.25
REQUEST_TIMEOUT_SECONDS = 8
CIRCUIT_BREAKER_THRESHOLD = 5
CIRCUIT_BREAKER_OPEN_SECONDS = 60


class GroqAPIError(RuntimeError):
    """Base Groq API failure class."""


class GroqTimeoutError(GroqAPIError):
    """Raised when Groq request exceeds timeout."""


class GroqRateLimitError(GroqAPIError):
    """Raised when Groq responds with 429 rate limit error."""


class GroqClient:
    """Async Groq chat-completion wrapper with circuit breaker behavior."""

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        self._consecutive_failures = 0
        self._circuit_open_until = 0.0

    async def __aenter__(self) -> "GroqClient":
        """Initialize reusable HTTP client context."""

        if self._client is None:
            self._client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        """Close HTTP resources on context exit."""

        await self.close()

    def _ensure_client(self) -> httpx.AsyncClient:
        """Create client lazily and return the shared instance."""

        if self._client is None:
            self._client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS)
        return self._client

    @staticmethod
    def _estimate_tokens(messages: list[dict[str, str]], output_text: str = "") -> tuple[int, int]:
        """Approximate token counts using 4 chars/token heuristic."""

        input_chars = sum(len(str(m.get("content", ""))) for m in messages)
        output_chars = len(output_text)
        return max(1, input_chars // 4), max(1, output_chars // 4) if output_chars else 0

    def _record_failure(self) -> None:
        """Update circuit breaker state on failures."""

        self._consecutive_failures += 1
        if self._consecutive_failures >= CIRCUIT_BREAKER_THRESHOLD:
            self._circuit_open_until = time.time() + CIRCUIT_BREAKER_OPEN_SECONDS

    def _record_success(self) -> None:
        """Reset circuit breaker counters on successful calls."""

        self._consecutive_failures = 0
        self._circuit_open_until = 0.0

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        temperature: float = 0.2,
        max_tokens: int = 300,
        task_type: str = "translation",
    ) -> str:
        """Run a chat completion request and return assistant text."""

        now = time.time()
        if now < self._circuit_open_until:
            remaining = int(self._circuit_open_until - now)
            groq_api_errors_total.labels(task_type=task_type, error_type="circuit_open").inc()
            raise GroqAPIError(f"Circuit open for {remaining}s")

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
        groq_api_calls_total.labels(task_type=task_type).inc()

        for attempt in range(1, MAX_RETRIES + 1):
            started = time.perf_counter()
            try:
                response = await self._ensure_client().post(GROQ_API_URL, headers=headers, json=payload)
                if response.status_code == 429:
                    raise GroqRateLimitError("Groq rate limit exceeded")
                response.raise_for_status()
                body = response.json()
                groq_api_latency_seconds.labels(task_type=task_type).observe(time.perf_counter() - started)

                latency_ms = round((time.perf_counter() - started) * 1000, 2)
                usage = body.get("usage", {}) if isinstance(body, dict) else {}
                choices = body.get("choices", []) if isinstance(body, dict) else []
                if not choices:
                    raise GroqAPIError("Groq response did not include any choices.")

                message = choices[0].get("message", {})
                content = message.get("content") if isinstance(message, dict) else None
                if not content or not isinstance(content, str):
                    raise GroqAPIError("Groq response content was empty or invalid.")

                estimated_in, estimated_out = self._estimate_tokens(messages, content)
                logger.info(
                    "groq_chat_success",
                    extra={
                        "latency_ms": latency_ms,
                        "attempt": attempt,
                        "task_type": task_type,
                        "model": selected_model,
                        "prompt_tokens": usage.get("prompt_tokens", 0),
                        "completion_tokens": usage.get("completion_tokens", 0),
                        "total_tokens": usage.get("total_tokens", 0),
                        "estimated_prompt_tokens": estimated_in,
                        "estimated_completion_tokens": estimated_out,
                    },
                )

                self._record_success()

                return str(content).strip()

            except httpx.TimeoutException as exc:
                self._record_failure()
                groq_api_errors_total.labels(task_type=task_type, error_type="timeout").inc()
                if attempt == MAX_RETRIES:
                    raise GroqTimeoutError("Groq request timed out") from exc
                await asyncio.sleep(BASE_BACKOFF_SECONDS * (2 ** (attempt - 1)))
            except GroqRateLimitError:
                self._record_failure()
                groq_api_errors_total.labels(task_type=task_type, error_type="rate_limit").inc()
                if attempt == MAX_RETRIES:
                    raise
                await asyncio.sleep(BASE_BACKOFF_SECONDS * (2 ** (attempt - 1)))
            except (httpx.HTTPError, ValueError, GroqAPIError) as exc:
                self._record_failure()
                groq_api_errors_total.labels(task_type=task_type, error_type=type(exc).__name__).inc()
                latency_ms = round((time.perf_counter() - started) * 1000, 2)
                logger.warning(
                    "groq_chat_retry",
                    extra={
                        "attempt": attempt,
                        "task_type": task_type,
                        "latency_ms": latency_ms,
                        "error": str(exc),
                    },
                )

                if attempt == MAX_RETRIES:
                    raise GroqAPIError(f"Groq request failed after {MAX_RETRIES} attempts: {exc}") from exc

                await asyncio.sleep(BASE_BACKOFF_SECONDS * (2 ** (attempt - 1)))

        raise GroqAPIError("Groq request failed unexpectedly.")

    async def close(self) -> None:
        """Close HTTP resources on service shutdown."""

        if self._client is not None:
            await self._client.aclose()
            self._client = None


groq_client = GroqClient()
