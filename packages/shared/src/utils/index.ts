/** Remove screen-reader noise: emoji shortcodes, markdown decorators, raw URLs. */
export function sanitizeForScreenReader(text: string): string {
  return text
    .replace(/:[a-z0-9_+-]+:/gi, '') // emoji shortcodes
    .replace(/([*_~`])\1?(.+?)\1?\1?/g, '$2') // bold/italic/strikethrough/code
    .replace(/https?:\/\/\S+/g, '[link]') // raw URLs
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Flesch-Kincaid Grade Level — returns a grade number (lower = more accessible). */
export function readingLevelScore(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  if (words.length === 0 || sentences.length === 0) return 0;
  const syllables = words.reduce((acc, w) => acc + countSyllables(w), 0);
  return (
    0.39 * (words.length / sentences.length) +
    11.8 * (syllables / words.length) -
    15.59
  );
}

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  const matches = w.match(/[aeiouy]+/g);
  return Math.max(matches?.length ?? 1, 1);
}

/** Detect right-to-left script for layout hints. */
export function isRTL(text: string): boolean {
  return /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/.test(text);
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}…`;
}

export function formatTimestamp(date: Date, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/** Derive which accessibility tasks are needed for a given profile. */
export function requiredTasksForProfile(
  disabilities: string[],
  hasAttachments: boolean
): string[] {
  const tasks: string[] = [];
  if (disabilities.includes('cognitive') || disabilities.includes('dyslexia')) {
    tasks.push('simplify_language');
  }
  if (disabilities.includes('visual') && hasAttachments) {
    tasks.push('generate_alt_text', 'audio_description');
  }
  if (disabilities.includes('auditory') && hasAttachments) {
    tasks.push('create_captions');
  }
  if (disabilities.includes('anxiety') || disabilities.includes('autism_spectrum')) {
    tasks.push('trigger_warning_check');
  }
  return [...new Set(tasks)];
}
