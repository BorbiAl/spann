/**
 * Spann Groq AI Client
 *
 * Raw-fetch wrapper around the Groq chat-completions endpoint.
 * All functions are pure async — no shared mutable state.
 *
 * Environment variable required:
 *   GROQ_API_KEY — Groq API key (server-side only; never expose in the browser)
 */

import type {
  ToneIndicator,
  MessageContext,
  AccessibilityProfile,
} from '../types/index.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

const VALID_TONE_VALUES = new Set<string>([
  'URGENT',
  'CASUAL',
  'FORMAL',
  'AGGRESSIVE',
  'SUPPORTIVE',
  'NEUTRAL',
]);

// ─── Internal Groq API Types ──────────────────────────────────────────────────

interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqRequestBody {
  model: string;
  messages: GroqChatMessage[];
  temperature: number;
  max_tokens: number;
}

interface GroqChoice {
  message: { role: string; content: string | null };
  finish_reason: string;
  index: number;
}

interface GroqUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface GroqResponseBody {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: GroqChoice[];
  usage: GroqUsage;
}

interface GroqErrorBody {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

// ─── Error Types ──────────────────────────────────────────────────────────────

/** Thrown when the Groq API key is missing or empty. */
export class GroqConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GroqConfigError';
  }
}

/** Thrown when the Groq API returns a non-2xx status. */
export class GroqApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly groqErrorType?: string,
  ) {
    super(message);
    this.name = 'GroqApiError';
  }
}

/** Thrown when the AI response cannot be parsed into the expected shape. */
export class GroqParseError extends Error {
  constructor(
    message: string,
    public readonly rawOutput: string,
  ) {
    super(message);
    this.name = 'GroqParseError';
  }
}

// ─── Core Fetch Helper ────────────────────────────────────────────────────────

/**
 * Resolves the GROQ_API_KEY from process.env.
 * Call once per request — never cache the key in module scope.
 */
function resolveApiKey(): string {
  const key =
    (typeof process !== 'undefined' ? process.env['GROQ_API_KEY'] : undefined) ?? '';
  if (!key) {
    throw new GroqConfigError(
      'GROQ_API_KEY is not set. Add it to your .env file or environment.',
    );
  }
  return key;
}

interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * Sends a chat-completion request to the Groq API and returns the assistant's
 * text response. Throws on network failure or non-2xx HTTP status.
 *
 * @param messages  Full conversation history to send.
 * @param options   Optional temperature / max_tokens overrides.
 * @returns The assistant's response text, trimmed.
 */
async function groqComplete(
  messages: GroqChatMessage[],
  options: CompletionOptions = {},
): Promise<string> {
  const apiKey = resolveApiKey();

  const body: GroqRequestBody = {
    model: MODEL,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 1024,
  };

  let response: Response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new GroqApiError(
      `Network error reaching Groq API: ${cause instanceof Error ? cause.message : String(cause)}`,
      0,
    );
  }

  if (!response.ok) {
    let errorType: string | undefined;
    try {
      const errBody = (await response.json()) as GroqErrorBody;
      errorType = errBody.error.type;
      throw new GroqApiError(
        `Groq API error ${response.status}: ${errBody.error.message}`,
        response.status,
        errorType,
      );
    } catch (e) {
      if (e instanceof GroqApiError) throw e;
      throw new GroqApiError(`Groq API returned ${response.status}`, response.status);
    }
  }

  const data = (await response.json()) as GroqResponseBody;
  const content = data.choices[0]?.message?.content;

  if (content == null || content.trim() === '') {
    throw new GroqApiError('Groq API returned an empty response', response.status);
  }

  return content.trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Rewrites a message to a target Flesch-Kincaid reading level.
 *
 * @param text         The original message text.
 * @param readingLevel Target FK grade level, clamped to 1–12.
 *                     Grade 3 ≈ very simple; grade 8 ≈ middle school; grade 12 ≈ high school.
 * @returns The simplified message text.
 * @throws {GroqConfigError} If GROQ_API_KEY is missing.
 * @throws {GroqApiError}    If the Groq API call fails.
 *
 * @example
 * const simple = await simplifyMessage(slackMessage, 5);
 */
export async function simplifyMessage(
  text: string,
  readingLevel: number,
): Promise<string> {
  const clampedLevel = Math.min(12, Math.max(1, Math.round(readingLevel)));

  const gradeDescriptions: Record<number, string> = {
    1: 'a 6-year-old (grade 1) — very short sentences, only the most common words',
    2: 'a 7-year-old (grade 2) — simple sentences, everyday vocabulary',
    3: 'an 8-year-old (grade 3)',
    4: 'a 9-year-old (grade 4)',
    5: 'a 10-year-old (grade 5)',
    6: 'an 11-year-old (grade 6)',
    7: 'a 12-year-old (grade 7)',
    8: 'a 13-year-old (grade 8) — standard news writing level',
    9: 'a 14-year-old (grade 9)',
    10: 'a 15-year-old (grade 10)',
    11: 'a 16-year-old (grade 11)',
    12: 'a 17-year-old (grade 12) — high school graduate',
  };

  const gradeLabel = gradeDescriptions[clampedLevel] ?? `grade ${clampedLevel}`;

  const result = await groqComplete([
    {
      role: 'system',
      content:
        'You are an accessibility rewriting assistant for Spann. ' +
        'You receive a message and rewrite it at the requested reading level. ' +
        'Preserve the complete meaning. ' +
        'Output ONLY the rewritten message — no explanations, no quotation marks, no preamble.',
    },
    {
      role: 'user',
      content:
        `Rewrite the following message so it is easily understood by ${gradeLabel}.\n\n` +
        `Message:\n${text}`,
    },
  ]);

  return result;
}

/**
 * Classifies the emotional tone of a message into one of the {@link ToneIndicator} values.
 *
 * @param text  The message text to analyse.
 * @returns     A {@link ToneIndicator} enum value.
 * @throws {GroqConfigError} If GROQ_API_KEY is missing.
 * @throws {GroqApiError}    If the API call fails.
 * @throws {GroqParseError}  If the model returns an unrecognised tone label.
 *
 * @example
 * const tone = await analyzeTone("GET THIS DONE NOW OR ELSE");
 * // → ToneIndicator.AGGRESSIVE
 */
export async function analyzeTone(text: string): Promise<ToneIndicator> {
  const raw = await groqComplete(
    [
      {
        role: 'system',
        content:
          'You are a tone classification assistant. ' +
          'Classify the tone of the message into exactly one of these labels: ' +
          'URGENT, CASUAL, FORMAL, AGGRESSIVE, SUPPORTIVE, NEUTRAL. ' +
          'Respond with ONLY the label — no punctuation, no explanation.',
      },
      {
        role: 'user',
        content: `Classify the tone of this message:\n\n${text}`,
      },
    ],
    { temperature: 0.1, maxTokens: 16 },
  );

  const normalized = raw.toUpperCase().trim().replace(/[^A-Z]/g, '');

  if (!VALID_TONE_VALUES.has(normalized)) {
    throw new GroqParseError(
      `Unrecognised tone value "${normalized}". Expected one of: ${[...VALID_TONE_VALUES].join(', ')}`,
      raw,
    );
  }

  return normalized as ToneIndicator;
}

/**
 * Formats a raw audio/video transcript into a clean, readable HTML caption string.
 *
 * The returned HTML uses `<span class="spann-caption-segment">` blocks with
 * `data-start` / `data-end` attributes for optional timestamp synchronisation.
 *
 * @param audioTranscript  Raw transcript text (from STT or manual input).
 * @returns                HTML-formatted caption string.
 * @throws {GroqConfigError} If GROQ_API_KEY is missing.
 * @throws {GroqApiError}    If the API call fails.
 *
 * @example
 * const html = await generateCaption("um so yeah the meeting is uh cancelled today");
 */
export async function generateCaption(audioTranscript: string): Promise<string> {
  const cleaned = await groqComplete(
    [
      {
        role: 'system',
        content:
          'You are an accessibility captioning assistant. ' +
          'You receive raw speech-to-text output and produce clean, readable captions. ' +
          'Rules:\n' +
          '1. Remove filler words (um, uh, like, you know) unless they convey meaning.\n' +
          '2. Add proper punctuation and capitalisation.\n' +
          '3. Fix obvious STT homophone errors.\n' +
          '4. Split long runs into sentences of ≤ 15 words each.\n' +
          '5. Output ONLY the cleaned caption text — no labels, no timestamps, no preamble.',
      },
      {
        role: 'user',
        content: `Clean this transcript:\n\n${audioTranscript}`,
      },
    ],
    { temperature: 0.15, maxTokens: 512 },
  );

  // Wrap each sentence in a captioning span for downstream CSS/JS synchronisation
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) ?? [cleaned];
  const html = sentences
    .map((s, i) => {
      const escaped = s.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<span class="spann-caption-segment" data-index="${i}">${escaped}</span>`;
    })
    .join('\n');

  return `<p class="spann-captions">\n${html}\n</p>`;
}

/**
 * Generates three accessible reply suggestions tailored to the user's disability profile.
 *
 * Each suggestion is:
 * - Written at the cognitive / reading level in the user's preferences (if set).
 * - Calm in tone if the user has ANXIETY settings enabled.
 * - Short and unambiguous for COGNITIVE / DYSLEXIA profiles.
 *
 * @param context      The incoming message to reply to.
 * @param userProfile  The replying user's accessibility profile.
 * @returns            Array of exactly three reply suggestion strings.
 * @throws {GroqConfigError} If GROQ_API_KEY is missing.
 * @throws {GroqApiError}    If the API call fails.
 * @throws {GroqParseError}  If fewer than three suggestions can be parsed.
 *
 * @example
 * const replies = await suggestAccessibleResponse(messageCtx, myProfile);
 * // → ["Got it, thanks!", "I'll look into this shortly.", "Can you clarify what you need?"]
 */
export async function suggestAccessibleResponse(
  context: MessageContext,
  userProfile: AccessibilityProfile,
): Promise<string[]> {
  const readingLevel = userProfile.preferences.cognitive?.targetReadingLevel ?? 8;
  const calmTone = userProfile.preferences.anxiety != null;
  const short =
    userProfile.preferences.cognitive?.simplifiedLanguage === true ||
    userProfile.preferences.dyslexia != null;

  const constraints: string[] = [
    `Reading level: Flesch-Kincaid grade ${readingLevel}.`,
    calmTone
      ? 'Tone: calm, gentle, and reassuring — never confrontational.'
      : 'Tone: friendly and professional.',
    short
      ? 'Length: maximum 12 words per reply.'
      : 'Length: 10–25 words per reply.',
    'Each reply must be complete on its own — no ellipses, no trailing conjunctions.',
  ];

  const raw = await groqComplete(
    [
      {
        role: 'system',
        content:
          'You are an accessibility communication assistant for Spann. ' +
          'Generate exactly 3 reply options for the user. ' +
          'Format your response as a numbered list:\n' +
          '1. <reply>\n2. <reply>\n3. <reply>\n' +
          'Output ONLY the numbered list — no introduction, no footer.',
      },
      {
        role: 'user',
        content:
          `Message to reply to:\n"${context.rawText}"\n\n` +
          `Constraints:\n${constraints.map((c) => `- ${c}`).join('\n')}\n\n` +
          'Generate 3 accessible reply options:',
      },
    ],
    { temperature: 0.7, maxTokens: 256 },
  );

  // Parse "1. …\n2. …\n3. …" — robust to slight formatting variation
  const lines = raw
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((l) => l.length > 0);

  if (lines.length < 3) {
    throw new GroqParseError(
      `Expected 3 reply suggestions but parsed ${lines.length}.`,
      raw,
    );
  }

  return lines.slice(0, 3);
}
