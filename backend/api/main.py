"""Spann Platform API — accessibility plugin management."""
from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="Spann Platform API",
    version="0.1.0",
    description="REST API for managing Spann accessibility profiles and AI processing tasks.",
    docs_url="/docs",
    redoc_url="/redoc",
)

_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "spann-platform-api"}


# ─── Accessibility Profiles ───────────────────────────────────────────────────

DISABILITY_TYPES = frozenset(
    ["visual", "auditory", "motor", "cognitive", "dyslexia", "anxiety", "autism_spectrum"]
)


class AccessibilityProfileIn(BaseModel):
    user_id: str
    platform: str
    disabilities: list[str]
    preferences: dict[str, object] = {}


class AccessibilityProfileOut(AccessibilityProfileIn):
    id: str


@app.post(
    "/profiles",
    response_model=AccessibilityProfileOut,
    status_code=status.HTTP_201_CREATED,
    tags=["profiles"],
)
async def create_profile(body: AccessibilityProfileIn) -> AccessibilityProfileOut:
    invalid = [d for d in body.disabilities if d not in DISABILITY_TYPES]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown disability types: {invalid}",
        )
    # TODO: persist to Supabase
    return AccessibilityProfileOut(id="placeholder", **body.model_dump())


# ─── AI Processing ────────────────────────────────────────────────────────────

AI_TASKS = frozenset(
    [
        "simplify_language",
        "generate_alt_text",
        "create_captions",
        "audio_description",
        "trigger_warning_check",
        "tts_synthesis",
        "stt_transcription",
    ]
)


class ProcessRequest(BaseModel):
    task: str
    content: str
    context: str | None = None


class ProcessResponse(BaseModel):
    task: str
    output: str
    model: str
    latency_ms: int


@app.post("/process", response_model=ProcessResponse, tags=["ai"])
async def process_message(body: ProcessRequest) -> ProcessResponse:
    if body.task not in AI_TASKS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown task: {body.task}. Valid: {sorted(AI_TASKS)}",
        )
    from backend.ai.groq_client import SpannAIService, AITask  # lazy import

    service = SpannAIService()
    result = service.process(AITask(body.task), body.content)
    return ProcessResponse(
        task=result.task.value,
        output=result.output,
        model=result.model,
        latency_ms=result.latency_ms,
    )
