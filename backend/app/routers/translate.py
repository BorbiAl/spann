"""Speech-to-text endpoint route.

The /translate endpoint has been replaced by /understand which combines
simplification, idiom detection, tone analysis, and translation in one call.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from app.middleware.rate_limit import translate_rate_limit_dependency
from app.schemas.common import success_response
from app.services.speech_to_text import SpeechToTextError, transcribe_audio_bytes

router = APIRouter(tags=["translate"])


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
