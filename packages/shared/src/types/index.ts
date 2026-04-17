// =============================================================================
// Spann — Shared Accessibility Types
// =============================================================================

// ─── Disability ───────────────────────────────────────────────────────────────

/** Every disability category Spann explicitly supports. */
export enum DisabilityType {
  VISUAL = 'VISUAL',
  DEAF = 'DEAF',
  MOTOR = 'MOTOR',
  COGNITIVE = 'COGNITIVE',
  DYSLEXIA = 'DYSLEXIA',
  ANXIETY = 'ANXIETY',
}

// ─── Tone ─────────────────────────────────────────────────────────────────────

/** AI-detected tone of an incoming message. */
export enum ToneIndicator {
  URGENT = 'URGENT',
  CASUAL = 'CASUAL',
  FORMAL = 'FORMAL',
  AGGRESSIVE = 'AGGRESSIVE',
  SUPPORTIVE = 'SUPPORTIVE',
  NEUTRAL = 'NEUTRAL',
}

// ─── Per-disability Settings ──────────────────────────────────────────────────

/** Settings for users with visual impairments. */
export interface VisualSettings {
  /** Enable integration with system screen reader (NVDA, JAWS, VoiceOver). */
  screenReaderEnabled: boolean;
  /** Force high-contrast UI theme. */
  highContrast: boolean;
  /** Base font size token. */
  fontSize: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Colour-blindness simulation / correction mode. */
  colorBlindMode: 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';
  /** How much detail to include in AI-generated alt text. */
  altTextVerbosity: 'concise' | 'detailed';
}

/** Settings for Deaf / hard-of-hearing users. */
export interface DeafSettings {
  /** Auto-generate captions for audio and video content. */
  captionsEnabled: boolean;
  /** Caption font size token. */
  captionFontSize: 'sm' | 'md' | 'lg';
  /** Show sign-language overlay widget where available. */
  signLanguageOverlay: boolean;
  /** Flash the UI on new notifications instead of playing audio. */
  flashAlerts: boolean;
  /** Automatically transcribe voice messages. */
  transcriptAutoGenerate: boolean;
}

/** Settings for users with motor impairments. */
export interface MotorSettings {
  /** Restrict all interactions to keyboard-only paths. */
  keyboardNavOnly: boolean;
  /** Simulate Sticky Keys — modifier keys latch until a second key is pressed. */
  stickyKeys: boolean;
  /** Dwell-click time in milliseconds (0 = disabled). */
  dwellTimeMs: number;
  /** Enlarge all interactive hit targets to ≥ 44 × 44 px. */
  largeClickTargets: boolean;
  /** Suppress swipe/gesture shortcuts in favour of button equivalents. */
  reducedGestures: boolean;
}

/** Settings for users with cognitive disabilities. */
export interface CognitiveSettings {
  /** Automatically simplify incoming messages. */
  simplifiedLanguage: boolean;
  /**
   * Target Flesch-Kincaid grade level for simplified output.
   * Range: 1 (very simple) – 12 (high school senior).
   */
  targetReadingLevel: number;
  /** Respect prefers-reduced-motion and suppress all animations. */
  reduceMotion: boolean;
  /** Collapse non-essential UI chrome to reduce cognitive load. */
  focusMode: boolean;
  /** How often to surface task reminders. */
  reminderFrequency: 'none' | 'low' | 'medium' | 'high';
}

/** Settings for users with dyslexia. */
export interface DyslexiaSettings {
  /** Switch body font to OpenDyslexic. */
  dyslexicFont: boolean;
  /** Extra letter spacing. */
  letterSpacing: 'normal' | 'wide' | 'wider';
  /** Extra line height. */
  lineHeight: 'normal' | 'relaxed' | 'loose';
  /** Extra word spacing. */
  wordSpacing: 'normal' | 'wide';
  /** Apply bionic reading — bold the first syllable of each word. */
  bionicReading: boolean;
}

/** Settings for users with anxiety or autism-spectrum needs. */
export interface AnxietySettings {
  /** Prepend AI-generated trigger warnings to potentially distressing messages. */
  triggerWarnings: boolean;
  /** Show a tone badge on each message. */
  toneAlerts: boolean;
  /** Filter or soften messages detected as AGGRESSIVE. */
  aggressiveToneFilter: boolean;
  /** Batch notifications and deliver them quietly on a schedule. */
  notificationQuiet: boolean;
  /** Strip non-essential formatting from notifications. */
  simplifiedNotifications: boolean;
}

/**
 * Discriminated union of per-disability setting objects.
 * Use with a `switch (s.type)` to narrow the settings payload.
 */
export type AccessibilitySettings =
  | { type: DisabilityType.VISUAL; settings: VisualSettings }
  | { type: DisabilityType.DEAF; settings: DeafSettings }
  | { type: DisabilityType.MOTOR; settings: MotorSettings }
  | { type: DisabilityType.COGNITIVE; settings: CognitiveSettings }
  | { type: DisabilityType.DYSLEXIA; settings: DyslexiaSettings }
  | { type: DisabilityType.ANXIETY; settings: AnxietySettings };

/**
 * Flat preferences bag stored on the profile — each key is optional because
 * a user may only have settings for a subset of disability types.
 */
export interface AccessibilityPreferences {
  visual?: VisualSettings;
  deaf?: DeafSettings;
  motor?: MotorSettings;
  cognitive?: CognitiveSettings;
  dyslexia?: DyslexiaSettings;
  anxiety?: AnxietySettings;
}

/** A user's complete Spann accessibility profile. */
export interface AccessibilityProfile {
  /** Platform-scoped user identifier. */
  userId: string;
  /** Which disability categories are active for this user. */
  disabilityTypes: DisabilityType[];
  /** Settings keyed by disability type — only populated types are present. */
  preferences: AccessibilityPreferences;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Platform Messages ────────────────────────────────────────────────────────

export type Platform = 'slack' | 'teams' | 'discord';

/** Minimal context describing an incoming platform message. */
export interface MessageContext {
  /** Source platform. */
  platformId: Platform;
  /** Channel or conversation identifier. */
  channelId: string;
  /** Platform user ID of the message author. */
  authorId: string;
  /** Raw message text including all platform markdown. */
  rawText: string;
  /** UTC timestamp of the original message. */
  timestamp: Date;
  /** Parent thread ID if this is a threaded reply. */
  threadId?: string;
  /** Attached media or files. */
  attachments?: MessageAttachment[];
}

/** A file or media attachment on a platform message. */
export interface MessageAttachment {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  name: string;
  mimeType?: string;
  /** AI-generated or human-provided alt text. */
  altText?: string;
  /** Audio/video transcript (auto-generated or provided). */
  transcript?: string;
  durationSeconds?: number;
}

/** A message that has been processed through the Spann accessibility engine. */
export interface ProcessedMessage {
  /** The original incoming message context. */
  original: MessageContext;
  /** AI-simplified version of the raw text. */
  simplified: string;
  /** AI-detected tone classification. */
  toneIndicator: ToneIndicator;
  /** HTML-formatted caption string (for audio/video content). */
  captionHtml: string;
  /**
   * Flesch-Kincaid grade level of the simplified text.
   * Clamped to the range 1–12.
   */
  readingLevel: number;
  /** Trigger warning prepended by the AI when ANXIETY settings are active. */
  triggerWarning?: string;
  /** Alt text strings for each attachment, in the same order as `original.attachments`. */
  altDescriptions?: string[];
  metadata: ProcessingMetadata;
}

/** Telemetry captured during AI processing. */
export interface ProcessingMetadata {
  modelUsed: string;
  latencyMs: number;
  tokensUsed?: number;
  processedAt: Date;
}

// ─── Legacy / Cross-package types (kept for platform-app compatibility) ───────

export interface PlatformMessage {
  id: string;
  platform: Platform;
  channelId: string;
  userId: string;
  content: string;
  timestamp: Date;
  threadId?: string;
  attachments?: MessageAttachment[];
  metadata?: Record<string, unknown>;
}

export interface AccessibleMessage extends PlatformMessage {
  altText?: string;
  audioDescription?: string;
  simplifiedContent?: string;
  captions?: string;
  readingLevel?: number;
  triggerWarning?: string;
  processedAt?: Date;
}

export type AITask =
  | 'simplify_language'
  | 'generate_alt_text'
  | 'create_captions'
  | 'audio_description'
  | 'trigger_warning_check'
  | 'tts_synthesis'
  | 'stt_transcription';

export interface AIProcessingResult {
  task: AITask;
  output: string;
  confidence: number;
  model: string;
  latencyMs: number;
  tokensUsed?: number;
}

export interface SpannConfig {
  platform: Platform;
  botToken: string;
  appToken?: string;
  signingSecret?: string;
  groqApiKey: string;
  groqModel: string;
  supabaseUrl: string;
  supabaseKey: string;
  redisUrl?: string;
}

export interface ApiResponse<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;
