import { create } from 'zustand'
import {
  userSettingsApi,
  extractUserSettings,
  USER_SETTINGS_DEFAULTS,
} from '../api/userSettings'
import type { UserSettings } from '../api/userSettings'

// ─── Local-storage persistence ────────────────────────────────────────────────

const LS_KEY = 'spann-user-settings'

function loadFromLS(): UserSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null
    if (!raw) return { ...USER_SETTINGS_DEFAULTS }
    return { ...USER_SETTINGS_DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...USER_SETTINGS_DEFAULTS }
  }
}

function saveToLS(s: UserSettings): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_KEY, JSON.stringify(s))
    }
  } catch { /* quota exceeded or private mode — ignore */ }
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface UserSettingsStore {
  /** Current effective settings (localStorage until API responds). */
  settings: UserSettings
  /** True once the first API fetch completes (success or failure). */
  isLoaded: boolean
  /** True while an API PATCH is in-flight. */
  isSaving: boolean

  /**
   * Fetch settings from the API and merge with local state.
   * Safe to call multiple times — subsequent calls after the first still refresh.
   * Must be called once the user is authenticated (e.g. in App/Layout on mount).
   */
  initialize: () => Promise<void>

  /**
   * Optimistically update one setting, persist to localStorage immediately,
   * then sync to the API. Rolls back on API failure.
   */
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>
}

export const useUserSettingsStore = create<UserSettingsStore>((set, get) => ({
  settings: loadFromLS(),
  isLoaded: false,
  isSaving: false,

  async initialize() {
    try {
      const prefs = await userSettingsApi.getPreferences()
      const settings = extractUserSettings((prefs.accessibility_settings as Record<string, unknown>) ?? {})
      set({ settings, isLoaded: true })
      saveToLS(settings)
    } catch {
      // Network unavailable or unauthenticated — keep localStorage values
      set({ isLoaded: true })
    }
  },

  async updateSetting(key, value) {
    const prev = get().settings
    const next: UserSettings = { ...prev, [key]: value }

    // 1. Optimistic local update
    set({ settings: next, isSaving: true })
    saveToLS(next)

    try {
      // 2. Sync to server
      const prefs = await userSettingsApi.patchSettings({ [key]: value } as Partial<UserSettings>)
      const confirmed = extractUserSettings(
        (prefs.accessibility_settings as Record<string, unknown>) ?? {},
      )
      set({ settings: confirmed })
      saveToLS(confirmed)
    } catch {
      // 3. Roll back on failure
      set({ settings: prev })
      saveToLS(prev)
    } finally {
      set({ isSaving: false })
    }
  },
}))
