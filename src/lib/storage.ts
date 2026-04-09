import Store from 'electron-store'
import type { TranslationResult } from '../types/api'

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

export interface StoreSchema {
  theme: 'dark' | 'light' | 'system'
  fontSize: number
  sidebarCollapsed: boolean
  lastEmail: string
  accessibility: {
    dyslexiaFont: boolean
    highContrast: boolean
    simplifiedLanguage: boolean
    tts: boolean
    colorBlindMode: 'normal' | 'deuteranopia' | 'protanopia' | 'tritanopia'
  }
  notifications: {
    enabled: boolean
    sound: boolean
    desktop: boolean
  }
  recentTranslations: Array<{
    phrase: string
    sourceCulture: string
    targetCulture: string
    result: TranslationResult
    timestamp: string
  }>
  offlineMessageQueue: Array<{
    id: string
    channelId: string
    text: string
    timestamp: string
  }>
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

const defaults: StoreSchema = {
  theme: 'dark',
  fontSize: 14,
  sidebarCollapsed: false,
  lastEmail: '',
  accessibility: {
    dyslexiaFont: false,
    highContrast: false,
    simplifiedLanguage: false,
    tts: false,
    colorBlindMode: 'normal',
  },
  notifications: {
    enabled: true,
    sound: true,
    desktop: true,
  },
  recentTranslations: [],
  offlineMessageQueue: [],
}

// ─────────────────────────────────────────────────────────────────────────────
// Store instance
// ─────────────────────────────────────────────────────────────────────────────

const store = new Store<StoreSchema>({
  name: 'spann-prefs',
  defaults,
  // Encrypt sensitive fields at rest
  encryptionKey: 'spann-local-enc-key-v1',
  clearInvalidConfig: true,
})

// ─────────────────────────────────────────────────────────────────────────────
// Typed accessors
// ─────────────────────────────────────────────────────────────────────────────

export function get<K extends keyof StoreSchema>(key: K): StoreSchema[K] {
  return store.get(key)
}

export function set<K extends keyof StoreSchema>(
  key: K,
  value: StoreSchema[K],
): void {
  store.set(key, value)
}

export function deleteKey<K extends keyof StoreSchema>(key: K): void {
  store.delete(key)
}

export function clear(): void {
  store.clear()
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: offline message queue helpers
// ─────────────────────────────────────────────────────────────────────────────

export function enqueueOfflineMessage(msg: StoreSchema['offlineMessageQueue'][number]): void {
  const queue = get('offlineMessageQueue')
  set('offlineMessageQueue', [...queue, msg])
}

export function dequeueOfflineMessages(): StoreSchema['offlineMessageQueue'] {
  const queue = get('offlineMessageQueue')
  set('offlineMessageQueue', [])
  return queue
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: recent translations (capped at 50)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RECENT_TRANSLATIONS = 50

export function addRecentTranslation(
  entry: StoreSchema['recentTranslations'][number],
): void {
  const existing = get('recentTranslations')
  const deduped = existing.filter((e) => e.phrase !== entry.phrase)
  const updated = [entry, ...deduped].slice(0, MAX_RECENT_TRANSLATIONS)
  set('recentTranslations', updated)
}

// ─────────────────────────────────────────────────────────────────────────────
// Export raw store for escape-hatch access
// ─────────────────────────────────────────────────────────────────────────────

export { store }
