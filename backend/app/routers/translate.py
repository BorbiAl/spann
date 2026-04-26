"""Translation endpoint routes."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from app.middleware.rate_limit import translate_rate_limit_dependency
from app.schemas.common import success_response
from app.schemas.translate import TranslateRequest
from app.services.speech_to_text import SpeechToTextError, transcribe_audio_bytes
from app.services.translation import translate_culturally

router = APIRouter(tags=["translate"])


def _sentiment_score_label(text: str) -> tuple[int, str]:
    """Return lightweight sentiment signal for translation UX metadata."""

    normalized = str(text or "").lower()
    positives = ("thanks", "thank", "great", "good", "please", "appreciate", "excellent")
    negatives = ("urgent", "asap", "blocked", "issue", "problem", "angry", "hate")
    score = 50
    if any(token in normalized for token in positives):
        score += 20
    if any(token in normalized for token in negatives):
        score -= 20
    score = max(0, min(100, score))
    label = "formal" if score >= 70 else "neutral" if score >= 40 else "direct"
    return score, label


def _normalize_translation_result(result: dict[str, object], phrase: str) -> dict[str, object]:
    """Ensure response includes required production fields."""

    literal = str(result.get("literal") or phrase).strip() or phrase
    cultural = str(result.get("cultural") or literal).strip() or literal
    explanation = str(result.get("explanation") or "Translation completed.").strip() or "Translation completed."

    raw_tags = result.get("tags")
    tags = [str(tag).strip() for tag in raw_tags] if isinstance(raw_tags, list) else []
    tags = [tag for tag in tags if tag]
    if not tags:
        tags = ["translation"]

    score, default_label = _sentiment_score_label(cultural)
    sentiment_score = int(result.get("sentiment_score") or score)
    sentiment_score = max(0, min(100, sentiment_score))
    sentiment_label = str(result.get("sentiment_label") or default_label).strip() or default_label

    return {
        "literal": literal,
        "cultural": cultural,
        "explanation": explanation,
        "tags": tags,
        "sentiment_score": sentiment_score,
        "sentiment_label": sentiment_label,
    }


@router.post("/translate")
async def translate(
    payload: TranslateRequest,
    request: Request,
    _rate_limit: None = Depends(translate_rate_limit_dependency),
) -> JSONResponse:
    """Translate and culturally adapt text for a target audience."""

    try:
        result = await translate_culturally(payload)
        normalized = _normalize_translation_result(result, payload.phrase)
    except json.JSONDecodeError:
        normalized = _normalize_translation_result(
            {
                "literal": payload.phrase,
                "cultural": payload.phrase,
                "explanation": "Translation fallback applied because provider output was malformed.",
                "tags": ["fallback", "provider_malformed"],
            },
            payload.phrase,
        )
    except Exception:  # noqa: BLE001
        normalized = _normalize_translation_result(
            {
                "literal": payload.phrase,
                "cultural": payload.phrase,
                "explanation": "Translation fallback applied because provider is currently unavailable.",
                "tags": ["fallback", "provider_unavailable"],
            },
            payload.phrase,
        )

    return success_response(normalized)


@router.post("/speech-to-text")
async def speech_to_text(
    request: Request,
    audio: UploadFile = File(...),
    locale: str | None = Form(default=None),
    _rate_limit: None = Depends(translate_rate_limit_dependency),
) -> JSONResponse:
    """Transcribe uploaded audio and return plain text."""

    content_type = str(audio.content_type or "")
    if not content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail={"code": "INVALID_AUDIO", "message": "Expected an audio upload."})

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail={"code": "EMPTY_AUDIO", "message": "Uploaded audio is empty."})

    try:
        text = await transcribe_audio_bytes(
            audio_bytes=audio_bytes,
            filename=audio.filename or "dictation.webm",
            content_type=content_type,
            locale=locale,
        )
    except SpeechToTextError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "STT_UNAVAILABLE", "message": "Speech transcription is unavailable right now."},
        ) from exc

    return success_response({"text": text})
