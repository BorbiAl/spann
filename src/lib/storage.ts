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

// Conditional import: electron-store only in Electron, localStorage fallback in browser
let store: any = null

// Try to load electron-store if in Electron context
if (typeof window === 'undefined' || (window as any).__ELECTRON__) {
  try {
    const Store = require('electron-store').default
    store = new Store<StoreSchema>({
      name: 'spann-prefs',
      defaults,
      // Encrypt sensitive fields at rest
      encryptionKey: 'spann-local-enc-key-v1',
      clearInvalidConfig: true,
    })
  } catch (e) {
    // electron-store not available, will use localStorage fallback
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Typed accessors
// ─────────────────────────────────────────────────────────────────────────────

export function get<K extends keyof StoreSchema>(key: K): StoreSchema[K] | undefined {
  if (store) {
    return store.get(key)
  }
  // Fallback to localStorage
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(`spann-${String(key)}`) : null
    if (raw === null) {
      return undefined
    }
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

export function set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
  if (store) {
    store.set(key, value)
  } else if (typeof window !== 'undefined') {
    // Fallback to localStorage
    try {
      localStorage.setItem(`spann-${String(key)}`, JSON.stringify(value))
    } catch {
      // localStorage may be unavailable in some contexts
    }
  }
}

export function delete_(key: keyof StoreSchema): void {
  if (store) {
    store.delete(key)
  } else if (typeof window !== 'undefined') {
    // Fallback to localStorage
    try {
      localStorage.removeItem(`spann-${String(key)}`)
    } catch {
      // localStorage may be unavailable in some contexts
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Clear all store data
// ─────────────────────────────────────────────────────────────────────────────

export function clear(): void {
  if (store) {
    store.clear()
  } else if (typeof window !== 'undefined') {
    // Clear all spann-* keys from localStorage
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('spann-')) {
          localStorage.removeItem(key)
        }
      })
    } catch {
      // localStorage may be unavailable in some contexts
    }
  }
}

export function deleteKey<K extends keyof StoreSchema>(key: K): void {
  delete_(key)
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
