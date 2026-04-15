"""Speech-to-text service using Groq audio transcription API."""

from __future__ import annotations

import logging

import httpx

from app.config import settings
from app.services.groq_client import groq_client

logger = logging.getLogger(__name__)

GROQ_STT_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
GROQ_STT_MODEL = "whisper-large-v3-turbo"
GROQ_CORRECTION_MODEL = "llama-3.1-8b-instant"


class SpeechToTextError(RuntimeError):
    """Raised when server-side speech transcription fails."""


async def transcribe_audio_bytes(
    *,
    audio_bytes: bytes,
    filename: str,
    content_type: str,
    locale: str | None = None,
) -> str:
    """Transcribe audio bytes into text via Groq Whisper endpoint."""

    if not settings.groq_api_key:
        raise SpeechToTextError("Speech transcription provider is not configured.")

    language = ""
    if locale:
        language = str(locale).strip().split("-")[0].lower()

    headers = {"Authorization": f"Bearer {settings.groq_api_key}"}
    data: dict[str, str] = {"model": GROQ_STT_MODEL}
    if language:
        data["language"] = language

    # Groq rejects content types with codec parameters (e.g. "audio/webm;codecs=opus")
    normalized_ct = (content_type or "audio/webm").split(";")[0].strip()
    files = {"file": (filename, audio_bytes, normalized_ct)}

    logger.info(
        "stt_request",
        extra={"audio_filename": filename, "content_type": normalized_ct, "language": language, "size_bytes": len(audio_bytes)},
    )

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                GROQ_STT_API_URL,
                headers=headers,
                data=data,
                files=files,
            )
            if not response.is_success:
                logger.error(
                    "stt_groq_error",
                    extra={"status": response.status_code, "body": response.text[:500]},
                )
                response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        raise SpeechToTextError("Speech transcription request failed.") from exc
    except Exception as exc:  # noqa: BLE001
        logger.error("stt_unexpected_error", extra={"error": str(exc)})
        raise SpeechToTextError("Speech transcription request failed.") from exc

    text = str(payload.get("text", "")).strip() if isinstance(payload, dict) else ""
    if not text:
        raise SpeechToTextError("No transcription text returned.")

    return await _correct_transcript(text, language=language or "")


async def _correct_transcript(text: str, *, language: str) -> str:
    """Fix typical speech recognition errors using a fast LLM pass."""

    lang_hint = f" The text is in language code '{language}'." if language else ""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a speech recognition post-processor. "
                "Fix only obvious transcription errors — misheard homophones, wrong similar-sounding words "
                "(e.g. 'газана' → 'казана'), or clear mis-spellings caused by pronunciation."
                f"{lang_hint}"
                " Do NOT change punctuation, capitalisation, tone, or any word you are not certain is wrong. "
                "Return ONLY the corrected text with no explanation, no quotes, no prefix."
            ),
        },
        {"role": "user", "content": text},
    ]

    try:
        corrected = await groq_client.chat(
            messages,
            model=GROQ_CORRECTION_MODEL,
            temperature=0.3,
            max_tokens=len(text) * 2 + 50,
            task_type="stt_correction",
        )
        return corrected.strip() or text
    except Exception:  # noqa: BLE001
        logger.warning("stt_correction_failed", extra={"original": text})
        return text
