/**
 * TypeScript mirrors of the FastAPI Pydantic models.
 * Keep in sync with backend/api/models.py.
 */

export type Platform = 'slack' | 'teams' | 'discord';
export type Plan = 'free' | 'starter' | 'pro' | 'enterprise';
export type ToneIndicator = 'URGENT' | 'CASUAL' | 'FORMAL' | 'AGGRESSIVE' | 'SUPPORTIVE' | 'NEUTRAL';
export type DisabilityType = 'VISUAL' | 'DEAF' | 'MOTOR' | 'COGNITIVE' | 'DYSLEXIA' | 'ANXIETY';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'unpaid';

// ── Requests ─────────────────────────────────────────────────────────────────

export interface WorkspaceRegisterRequest {
  platform: Platform;
  platform_workspace_id: string;
  name: string;
  billing_email?: string;
}

export interface ProfileUpsertRequest {
  platform: Platform;
  workspace_id: string;
  display_name?: string;
  email?: string;
  disability_types: DisabilityType[];
  settings: ProfileSettings;
}

export interface MessageProcessRequest {
  platform_id: Platform;
  channel_id: string;
  author_id: string;
  raw_text: string;
  workspace_id: string;
  thread_id?: string;
}

export interface SummarizeThreadRequest {
  workspace_id: string;
  platform_id: Platform;
  messages: Array<{ author_id: string; text: string }>;
}

// ── Responses ─────────────────────────────────────────────────────────────────

export interface WorkspaceOut {
  id: string;
  platform: Platform;
  platform_workspace_id: string;
  name: string;
  plan: Plan;
  created_at: string;
}

export interface SubscriptionOut {
  id: string;
  workspace_id: string;
  plan: Plan;
  seats: number;
  status: SubscriptionStatus;
  current_period_end: string | null;
}

export interface WorkspaceRegisterResponse {
  workspace: WorkspaceOut;
  subscription: SubscriptionOut;
}

export interface AccessibilityProfile {
  id: string;
  user_id: string;
  disability_types: DisabilityType[];
  settings: ProfileSettings;
  updated_at: string;
}

export interface ProcessedMessage {
  message_id: string;
  original_text: string;
  simplified: string;
  tone_indicator: ToneIndicator;
  reading_level: number;
  processing_ms: number;
}

export interface SummarizeThreadResponse {
  summary: string;
  message_count: number;
}

export interface WorkspaceStats {
  workspace_id: string;
  plan: Plan;
  seats: number;
  total_messages_processed: number;
  messages_this_month: number;
  active_users_this_month: number;
  avg_processing_ms: number | null;
}

// ── Profile Settings ──────────────────────────────────────────────────────────

export interface ProfileSettings {
  visual?: {
    screenReaderEnabled?: boolean;
    highContrast?: boolean;
    fontSize?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    colorBlindMode?: 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';
    altTextVerbosity?: 'concise' | 'detailed';
  };
  deaf?: {
    captionsEnabled?: boolean;
    transcriptAutoGenerate?: boolean;
  };
  motor?: {
    keyboardNavOnly?: boolean;
    largeClickTargets?: boolean;
  };
  cognitive?: {
    simplifiedLanguage?: boolean;
    targetReadingLevel?: number;
    reduceMotion?: boolean;
    focusMode?: boolean;
  };
  dyslexia?: {
    dyslexicFont?: boolean;
    letterSpacing?: 'normal' | 'wide' | 'wider';
    lineHeight?: 'normal' | 'relaxed' | 'loose';
    bionicReading?: boolean;
  };
  anxiety?: {
    triggerWarnings?: boolean;
    toneAlerts?: boolean;
    aggressiveToneFilter?: boolean;
    notificationQuiet?: boolean;
  };
}

// ── API error ─────────────────────────────────────────────────────────────────

export class SpannApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(`SpannAPI ${statusCode}: ${message}`);
    this.name = 'SpannApiError';
  }
}
