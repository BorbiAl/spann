import Groq from 'groq-sdk';
import type { AITask, AIProcessingResult } from '../types/index.js';

export interface GroqClientConfig {
  apiKey: string;
  model: string;
  timeoutMs?: number;
  maxRetries?: number;
}

const TASK_PROMPTS: Record<AITask, string> = {
  simplify_language:
    'Rewrite the following message in simple, clear language (reading level: grade 6–8). Preserve the full meaning. Output only the rewritten message.\n\nMessage: {content}',
  generate_alt_text:
    'Write a concise, descriptive alt text (under 125 characters) for this image or visual content. Output only the alt text.\n\nContent: {content}',
  create_captions:
    'Format the following as accurate, timestamped captions for a video or audio clip. Output only the captions.\n\nTranscript: {content}',
  audio_description:
    'Write a natural-language audio description for a visually impaired user describing: {content}',
  trigger_warning_check:
    'Analyze this message for content that could trigger anxiety, trauma, or distress. If found, output a one-sentence trigger warning prefixed with "TW:". If safe, output "SAFE".\n\nMessage: {content}',
  tts_synthesis:
    'Prepare this text for natural text-to-speech by expanding abbreviations, adding phonetic hints for unusual words, and inserting SSML <break> tags. Output only the processed text.\n\nText: {content}',
  stt_transcription:
    'Clean and punctuate this raw speech-to-text transcription. Fix obvious homophones and filler words. Output only the cleaned text.\n\nRaw: {content}',
};

export class SpannAIClient {
  private readonly groq: Groq;
  private readonly model: string;

  constructor(private readonly config: GroqClientConfig) {
    this.groq = new Groq({
      apiKey: config.apiKey,
      timeout: config.timeoutMs ?? 30_000,
      maxRetries: config.maxRetries ?? 2,
    });
    this.model = config.model;
  }

  async process(task: AITask, content: string, context?: string): Promise<AIProcessingResult> {
    const promptTemplate = TASK_PROMPTS[task];
    let prompt = promptTemplate.replace('{content}', content);
    if (context) prompt += `\n\nContext: ${context}`;

    const start = Date.now();

    const completion = await this.groq.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You are Spann, an AI accessibility assistant. Provide clear, concise, and accurate outputs that help make digital communication accessible to everyone.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    });

    const output = completion.choices[0]?.message?.content ?? '';
    const tokensUsed = completion.usage?.total_tokens;

    return {
      task,
      output,
      confidence: 0.95,
      model: this.model,
      latencyMs: Date.now() - start,
      tokensUsed,
    };
  }

  async processBatch(
    requests: Array<{ task: AITask; content: string; context?: string }>
  ): Promise<AIProcessingResult[]> {
    return Promise.all(requests.map(({ task, content, context }) => this.process(task, content, context)));
  }
}

export function createAIClient(config: GroqClientConfig): SpannAIClient {
  return new SpannAIClient(config);
}
