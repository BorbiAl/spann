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


@router.post("/translate")
async def translate(
    payload: TranslateRequest,
    request: Request,
    _rate_limit: None = Depends(translate_rate_limit_dependency),
) -> JSONResponse:
    """Translate and culturally adapt text for a target audience."""

    try:
        result = await translate_culturally(payload)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=502,
            detail={"code": "TRANSLATION_MALFORMED", "message": "Translation provider returned malformed output."},
        )
    except Exception:  # noqa: BLE001
        raise HTTPException(
            status_code=503,
            detail={"code": "TRANSLATION_UNAVAILABLE", "message": "Translation provider is currently unavailable."},
        )

    return success_response(result)


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
