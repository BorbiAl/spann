/**
 * Spann Text Processor
 *
 * Pure utility functions for transforming message text to be more accessible.
 * `summarizeThread` is the only async function — it calls the Groq API.
 *
 * All functions are stateless and safe to call in both Node.js and browser contexts.
 */

import type { MessageContext } from '../types/index.js';

// ─── stripMarkdown ────────────────────────────────────────────────────────────

/**
 * Removes Slack and Discord markdown noise so text is clean for screen readers
 * and plain-text rendering.
 *
 * Handles:
 * - Discord: `**bold**`, `__underline__`, `*italic*`, `_italic_`, `~~strike~~`,
 *   `` `code` ``, ` ```block``` `, `<@userId>`, `<#channelId>`, `<:emoji:id>`,
 *   `<a:emoji:id>`, `||spoiler||`
 * - Slack: `*bold*`, `_italic_`, `~strike~`, `` `code` ``, `<!here>`,
 *   `<!channel>`, `<!everyone>`, `<@U123>`, `<#C123|name>`, `<https://url|text>`,
 *   `<https://url>`, `:emoji_name:`
 *
 * @param text  Raw message text with platform markdown.
 * @returns     Plain text safe for screen readers.
 *
 * @example
 * stripMarkdown("*Hello* <@U123>, check `this` out!");
 * // → "Hello @user, check this out!"
 */
export function stripMarkdown(text: string): string {
  let out = text;

  // ── Code blocks (Discord triple-backtick, must come before inline code) ──
  out = out.replace(/```[\s\S]*?```/g, (match) => {
    // Preserve the inner text but strip the fences
    return match.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
  });

  // ── Slack-style angle-bracket tokens ──────────────────────────────────────
  // <https://url|display text> → display text
  out = out.replace(/<https?:\/\/[^|>]+\|([^>]+)>/g, '$1');
  // <https://url> → [link]
  out = out.replace(/<https?:\/\/[^>]+>/g, '[link]');
  // <!here>, <!channel>, <!everyone> → @here / @channel / @everyone
  out = out.replace(/<!(\w+)>/g, '@$1');
  // <@U12345> → @user  (Slack user mention)
  out = out.replace(/<@[UW][A-Z0-9]+>/g, '@user');
  // <#C12345|channel-name> → #channel-name
  out = out.replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1');
  // <#C12345> (no label) → #channel
  out = out.replace(/<#[A-Z0-9]+>/g, '#channel');

  // ── Discord user / channel / role mentions ────────────────────────────────
  // <@!123456789> or <@123456789>
  out = out.replace(/<@!?\d+>/g, '@user');
  // <#123456789>
  out = out.replace(/<#\d+>/g, '#channel');
  // <@&123456789> (role)
  out = out.replace(/<@&\d+>/g, '@role');

  // ── Discord custom emoji: <:name:id> or <a:name:id> ──────────────────────
  out = out.replace(/<a?:([^:]+):\d+>/g, ':$1:');

  // ── Discord spoiler tags: ||hidden|| → hidden ─────────────────────────────
  out = out.replace(/\|\|(.+?)\|\|/gs, '$1');

  // ── Bold/Underline/Italic (order matters: longer patterns first) ──────────
  // Discord **bold** / Slack *bold*
  out = out.replace(/\*\*(.+?)\*\*/gs, '$1');
  // Discord __underline__
  out = out.replace(/__(.+?)__/gs, '$1');
  // Discord ~~strikethrough~~
  out = out.replace(/~~(.+?)~~/gs, '$1');
  // Slack ~strikethrough~
  out = out.replace(/~(.+?)~/gs, '$1');
  // Discord/Slack *italic* and _italic_
  out = out.replace(/\*(.+?)\*/gs, '$1');
  out = out.replace(/_(.+?)_/gs, '$1');

  // ── Inline code ── ────────────────────────────────────────────────────────
  out = out.replace(/`([^`]+)`/g, '$1');

  // ── Slack/Discord emoji shortcodes: :smile: → smile ──────────────────────
  out = out.replace(/:([a-z0-9_+-]{2,32}):/gi, (_, name: string) =>
    // Convert underscores to spaces for more natural screen-reader output
    name.replace(/_/g, ' '),
  );

  // ── Bare URLs left after the above passes ────────────────────────────────
  out = out.replace(/https?:\/\/\S+/g, '[link]');

  // ── Normalise whitespace ──────────────────────────────────────────────────
  out = out.replace(/[ \t]{2,}/g, ' ').trim();

  return out;
}

// ─── addDyslexiaSpacing ───────────────────────────────────────────────────────

/**
 * Wraps message text in HTML with dyslexia-friendly CSS classes.
 *
 * Applies **bionic reading** — the first ~40% of each word is wrapped in a
 * `<b class="spann-bionic">` tag. Readers with dyslexia use the bolded anchor
 * to recognise words faster and reduce visual tracking errors.
 *
 * The outer `<span>` uses CSS custom properties that map to the user's
 * `DyslexiaSettings` (letter-spacing, word-spacing, line-height, font-family).
 * Apply `.spann-dyslexia-text` in your stylesheet to activate them.
 *
 * @param text  Plain text (run through {@link stripMarkdown} first if needed).
 * @returns     HTML string with bionic-reading markup.
 *
 * @example
 * addDyslexiaSpacing("Hello world");
 * // → '<span class="spann-dyslexia-text"><b class="spann-bionic">He</b>llo
 * //     <b class="spann-bionic">wo</b>rld</span>'
 */
export function addDyslexiaSpacing(text: string): string {
  /**
   * Returns the number of characters to bold at the start of a word.
   * Formula: ceil(length × 0.4), minimum 1, maximum (length - 1).
   */
  function bionicSplit(word: string): number {
    const len = word.length;
    if (len <= 1) return len;
    return Math.min(len - 1, Math.max(1, Math.ceil(len * 0.4)));
  }

  // Tokenise preserving whitespace so we can reconstruct the string
  const tokens = text.split(/(\s+)/);

  const processed = tokens.map((token) => {
    // Preserve whitespace tokens as-is
    if (/^\s+$/.test(token)) return token;

    // Separate leading/trailing punctuation from the alphabetic core
    const match = token.match(/^([^a-zA-Z]*)([a-zA-Z'-]+)([^a-zA-Z]*)$/);
    if (!match) {
      // No alphabetic characters — return escaped as-is
      return escapeHtml(token);
    }

    const [, prefix, word, suffix] = match as [string, string, string, string];
    const pivot = bionicSplit(word);
    const bold = word.slice(0, pivot);
    const rest = word.slice(pivot);

    return (
      escapeHtml(prefix) +
      `<b class="spann-bionic">${escapeHtml(bold)}</b>` +
      escapeHtml(rest) +
      escapeHtml(suffix)
    );
  });

  return `<span class="spann-dyslexia-text">${processed.join('')}</span>`;
}

/** Minimal HTML escaping for user-supplied text. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── calculateReadingLevel ────────────────────────────────────────────────────

/**
 * Computes the Flesch-Kincaid Grade Level for a block of text.
 *
 * Formula: `0.39 × (words/sentences) + 11.8 × (syllables/words) − 15.59`
 *
 * The result is clamped to the range **1–12** to keep it usable as a direct
 * input to {@link simplifyMessage}.
 *
 * @param text  Any plain-text string (strip markdown first for accuracy).
 * @returns     FK grade level, an integer in [1, 12].
 *              Returns 1 for very short or empty input.
 *
 * @example
 * calculateReadingLevel("The cat sat on the mat.");
 * // → 1
 * calculateReadingLevel("Photosynthesis is the biochemical process...");
 * // → 11
 */
export function calculateReadingLevel(text: string): number {
  const words = tokenizeWords(text);
  const sentenceCount = countSentences(text);

  if (words.length === 0 || sentenceCount === 0) return 1;

  const totalSyllables = words.reduce((acc, w) => acc + countSyllables(w), 0);

  const avgWordsPerSentence = words.length / sentenceCount;
  const avgSyllablesPerWord = totalSyllables / words.length;

  const raw = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;

  return Math.min(12, Math.max(1, Math.round(raw)));
}

/** Split text into word tokens (alphabetic only, no punctuation). */
function tokenizeWords(text: string): string[] {
  return text.match(/[a-zA-Z'-]+/g) ?? [];
}

/** Count sentences by splitting on terminal punctuation. */
function countSentences(text: string): number {
  const matches = text.match(/[.!?]+/g);
  // If no punctuation at all, treat the whole input as one sentence
  return matches?.length ?? 1;
}

/**
 * Syllable counter using vowel-cluster heuristics plus common English exception rules.
 * More accurate than a naive vowel count for words ending in silent -e, -le, -ed, etc.
 */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;

  let count = 0;
  let prevVowel = false;

  // Count vowel clusters
  for (let i = 0; i < w.length; i++) {
    const isVowel = /[aeiouy]/.test(w[i] as string);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }

  // Subtract silent -e (e.g. "make", "late")
  if (w.endsWith('e') && count > 1) count--;

  // Subtract silent -ed  (e.g. "jumped" → 1 syl, "wanted" → 2 syl)
  if (w.endsWith('ed') && !/[td]ed$/.test(w) && count > 1) count--;

  // Add back -le as its own syllable (e.g. "ta-ble", "peo-ple")
  if (w.endsWith('le') && w.length > 2 && !/[aeiouy]le$/.test(w)) count++;

  // Add -ion (e.g. "na-tion" = 2)
  count += (w.match(/ion/g) ?? []).length - 1;

  return Math.max(1, count);
}

// ─── summarizeThread ──────────────────────────────────────────────────────────

/**
 * Produces a two-sentence summary of a message thread using the Groq AI.
 *
 * Sentence 1: What the thread is about.
 * Sentence 2: What conclusion or action was reached (or "No conclusion yet." if unresolved).
 *
 * @param messages  Ordered array of {@link MessageContext} objects in the thread.
 * @returns         A two-sentence plain-text summary.
 * @throws {GroqConfigError} If GROQ_API_KEY is not set.
 * @throws {GroqApiError}    If the Groq API call fails.
 *
 * @example
 * const summary = await summarizeThread(threadMessages);
 * // → "The team discussed the deployment schedule for v2.3.
 * //    They agreed to ship on Friday pending QA sign-off."
 */
export async function summarizeThread(messages: MessageContext[]): Promise<string> {
  if (messages.length === 0) {
    return 'This thread has no messages.';
  }

  if (messages.length === 1) {
    const single = messages[0];
    // Single-message "thread" — just clean and summarise inline
    return `The thread contains one message from ${single?.authorId}: "${single?.rawText.slice(0, 120)}". No further discussion.`;
  }

  // Build a compact transcript — trim each message to 200 chars to stay within token budget
  const transcript = messages
    .map((m, i) => {
      const preview = m.rawText.length > 200 ? `${m.rawText.slice(0, 197)}…` : m.rawText;
      return `[${i + 1}] ${m.authorId}: ${preview}`;
    })
    .join('\n');

  // Lazy import to avoid circular dependency issues at module parse time
  const { default: fetch } = await import('node:fetch').catch(() => ({
    default: globalThis.fetch,
  }));

  // We call the Groq API directly here rather than going through groqComplete to
  // keep the function self-contained and avoid exporting internal helpers.
  const apiKey =
    (typeof process !== 'undefined' ? process.env['GROQ_API_KEY'] : undefined) ?? '';

  if (!apiKey) {
    throw new Error(
      'GROQ_API_KEY is not set. summarizeThread requires the Groq API.',
    );
  }

  const body = {
    model: MODEL_NAME,
    messages: [
      {
        role: 'system',
        content:
          'You are an accessibility summarisation assistant. ' +
          'Summarise the following message thread in EXACTLY two sentences. ' +
          'Sentence 1: what the thread is about. ' +
          'Sentence 2: what conclusion or action was reached (or "No conclusion yet." if open). ' +
          'Output ONLY the two sentences — no bullet points, no preamble, no labels.',
      },
      {
        role: 'user',
        content: `Thread transcript:\n\n${transcript}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 128,
  };

  const response = await (fetch as typeof globalThis.fetch)(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(`Groq API error ${response.status} in summarizeThread`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string | null } }>;
  };

  const content = data.choices[0]?.message?.content?.trim();
  if (!content) throw new Error('Groq returned an empty summary.');

  // Enforce the two-sentence contract — take the first two sentences if the
  // model returned more.
  const sentences = content.match(/[^.!?]+[.!?]+/g) ?? [content];
  return sentences.slice(0, 2).join(' ').trim();
}

/** Module-level constant so we don't hard-code the model string in two places. */
const MODEL_NAME = 'llama-3.3-70b-versatile';
