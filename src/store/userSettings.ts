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
  settings: UserSettings
  isLoaded: boolean
  isSaving: boolean

  initialize: () => Promise<void>
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
      set({ isLoaded: true })
    }
  },

  async updateSetting(key, value) {
    const prev = get().settings
    const next: UserSettings = { ...prev, [key]: value }

    set({ settings: next, isSaving: true })
    saveToLS(next)

    try {
      const prefs = await userSettingsApi.patchSettings({ [key]: value } as Partial<UserSettings>)
      const confirmed = extractUserSettings(
        (prefs.accessibility_settings as Record<string, unknown>) ?? {},
      )
      set({ settings: confirmed })
      saveToLS(confirmed)
    } catch {
      set({ settings: prev })
      saveToLS(prev)
    } finally {
      set({ isSaving: false })
    }
  },
}))
