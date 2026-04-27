import { apiClient } from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReadingLevel = 'simple' | 'standard'

/** The four reading/intelligence settings stored in accessibility_settings. */
export interface UserSettings {
  reading_level: ReadingLevel
  auto_simplify: boolean
  preferred_language: string
  tts_auto_play: boolean
}

export interface UserPreferencesPayload {
  locale: string
  coaching_enabled: boolean
  accessibility_settings: Record<string, unknown>
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const USER_SETTINGS_DEFAULTS: UserSettings = {
  reading_level: 'standard',
  auto_simplify: false,
  preferred_language: 'en',
  tts_auto_play: false,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Pull the 4 typed fields out of a raw accessibility_settings dict. */
export function extractUserSettings(a11y: Record<string, unknown>): UserSettings {
  return {
    reading_level:
      (a11y.reading_level as ReadingLevel | undefined) ?? USER_SETTINGS_DEFAULTS.reading_level,
    auto_simplify: Boolean(a11y.auto_simplify ?? USER_SETTINGS_DEFAULTS.auto_simplify),
    preferred_language: String(
      a11y.preferred_language ?? USER_SETTINGS_DEFAULTS.preferred_language,
    ),
    tts_auto_play: Boolean(a11y.tts_auto_play ?? USER_SETTINGS_DEFAULTS.tts_auto_play),
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const userSettingsApi = {
  /** GET /users/me/preferences */
  async getPreferences(): Promise<UserPreferencesPayload> {
    const { data } = await apiClient.get<{ data: UserPreferencesPayload }>(
      '/users/me/preferences',
    )
    return data.data
  },

  /** PATCH /users/me/preferences — merges; only supplied fields are changed. */
  async patchSettings(patch: Partial<UserSettings>): Promise<UserPreferencesPayload> {
    const { data } = await apiClient.patch<{ data: UserPreferencesPayload }>(
      '/users/me/preferences',
      patch,
    )
    return data.data
  },
}
