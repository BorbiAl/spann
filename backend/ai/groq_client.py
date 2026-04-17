"""Spann AI service layer — Groq LLM integration for accessibility tasks."""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from enum import Enum

from groq import Groq


class AITask(str, Enum):
    SIMPLIFY_LANGUAGE = "simplify_language"
    GENERATE_ALT_TEXT = "generate_alt_text"
    CREATE_CAPTIONS = "create_captions"
    AUDIO_DESCRIPTION = "audio_description"
    TRIGGER_WARNING_CHECK = "trigger_warning_check"
    TTS_SYNTHESIS = "tts_synthesis"
    STT_TRANSCRIPTION = "stt_transcription"


@dataclass
class AIResult:
    task: AITask
    output: str
    model: str
    latency_ms: int
    tokens_used: int | None = None


_SYSTEM_PROMPT = (
    "You are Spann, an AI accessibility assistant. "
    "Provide clear, concise, accurate outputs that make digital communication "
    "accessible to everyone regardless of disability."
)

_TASK_PROMPTS: dict[AITask, str] = {
    AITask.SIMPLIFY_LANGUAGE: (
        "Rewrite the following message at a grade 6–8 reading level. "
        "Preserve the full meaning. Output only the rewritten message.\n\nMessage: {content}"
    ),
    AITask.GENERATE_ALT_TEXT: (
        "Write a concise alt text (under 125 chars) for this image/visual content. "
        "Output only the alt text.\n\nContent: {content}"
    ),
    AITask.CREATE_CAPTIONS: (
        "Format the following as accurate, timestamped captions. "
        "Output only the captions.\n\nTranscript: {content}"
    ),
    AITask.AUDIO_DESCRIPTION: (
        "Write a natural-language audio description for a visually impaired listener: {content}"
    ),
    AITask.TRIGGER_WARNING_CHECK: (
        "Analyze this message for triggering content. "
        "If found, output a one-sentence trigger warning prefixed with 'TW:'. "
        "If safe, output 'SAFE'.\n\nMessage: {content}"
    ),
    AITask.TTS_SYNTHESIS: (
        "Expand abbreviations and add SSML <break> tags for natural TTS. "
        "Output only the processed text.\n\nText: {content}"
    ),
    AITask.STT_TRANSCRIPTION: (
        "Clean and punctuate this raw STT transcription. "
        "Fix obvious errors and remove filler words. "
        "Output only the cleaned text.\n\nRaw: {content}"
    ),
}


class SpannAIService:
    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 2,
    ) -> None:
        self.client = Groq(
            api_key=api_key or os.environ["GROQ_API_KEY"],
            timeout=timeout,
            max_retries=max_retries,
        )
        self.model = model or os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

    def process(self, task: AITask, content: str, context: str | None = None) -> AIResult:
        prompt = _TASK_PROMPTS[task].format(content=content)
        if context:
            prompt += f"\n\nContext: {context}"

        start = time.monotonic()
        completion = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=1024,
        )
        latency_ms = int((time.monotonic() - start) * 1000)

        output = completion.choices[0].message.content or ""
        tokens = getattr(completion.usage, "total_tokens", None)

        return AIResult(
            task=task,
            output=output,
            model=self.model,
            latency_ms=latency_ms,
            tokens_used=tokens,
        )

    def process_batch(
        self, requests: list[tuple[AITask, str, str | None]]
    ) -> list[AIResult]:
        return [self.process(task, content, ctx) for task, content, ctx in requests]
