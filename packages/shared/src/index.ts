// ─── Types ────────────────────────────────────────────────────────────────────
export * from './types/index.js';

// ─── AI ───────────────────────────────────────────────────────────────────────
export {
  simplifyMessage,
  analyzeTone,
  generateCaption,
  suggestAccessibleResponse,
  GroqConfigError,
  GroqApiError,
  GroqParseError,
} from './ai/groqClient.js';

// ─── Text Processing ──────────────────────────────────────────────────────────
export {
  stripMarkdown,
  addDyslexiaSpacing,
  calculateReadingLevel,
  summarizeThread,
} from './utils/textProcessor.js';

// ─── General Utilities ────────────────────────────────────────────────────────
export {
  sanitizeForScreenReader,
  readingLevelScore,
  isRTL,
  truncate,
  formatTimestamp,
  requiredTasksForProfile,
} from './utils/index.js';

// ─── Legacy AI Client (SpannAIClient) ─────────────────────────────────────────
export { SpannAIClient, createAIClient } from './ai/client.js';
export type { GroqClientConfig } from './ai/client.js';
