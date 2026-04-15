// ─────────────────────────────────────────────────────────────────────────────
// Keychain — OS credential store wrapper
//
// Routes through window.electronAPI (exposed by preload.ts via keytar).
// Falls back to sessionStorage for web / Capacitor builds where electronAPI
// is not available.
// ─────────────────────────────────────────────────────────────────────────────

const KEYCHAIN_SERVICE = 'spann-desktop'

// ─────────────────────────────────────────────────────────────────────────────
// Environment detection
// ─────────────────────────────────────────────────────────────────────────────

function isElectron(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.electronAPI !== 'undefined' &&
    typeof window.electronAPI.getPassword === 'function'
  )
}

function getElectronApi() {
  if (!isElectron()) {
    return null
  }
  return window.electronAPI
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback: sessionStorage (non-persistent, clears on tab close)
// Used in browser / Capacitor builds where keytar is unavailable.
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_KEY_PREFIX = '__spann_kc_'

const sessionFallback = {
  async get(account: string): Promise<string | null> {
    return sessionStorage.getItem(`${SESSION_KEY_PREFIX}${account}`)
  },
  async set(account: string, value: string): Promise<void> {
    sessionStorage.setItem(`${SESSION_KEY_PREFIX}${account}`, value)
  },
  async delete(account: string): Promise<void> {
    sessionStorage.removeItem(`${SESSION_KEY_PREFIX}${account}`)
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export const keychain = {
  /**
   * Persist a refresh token in the OS keychain.
   * The account key is the user's email so tokens are user-scoped.
   */
  async saveRefreshToken(email: string, token: string): Promise<void> {
    if (!email || !token) return

    try {
      const electronApi = getElectronApi()
      if (electronApi) {
        await electronApi.setPassword(KEYCHAIN_SERVICE, email, token)
      } else {
        await sessionFallback.set(email, token)
      }
    } catch (err) {
      console.warn('[keychain] saveRefreshToken failed:', err)
    }
  },

  /**
   * Retrieve the stored refresh token for a given email.
   * Returns null if not found or on any error.
   */
  async getRefreshToken(email: string): Promise<string | null> {
    if (!email) return null

    try {
      const electronApi = getElectronApi()
      if (electronApi) {
        const result = await electronApi.getPassword(
          KEYCHAIN_SERVICE,
          email,
        )
        // keytar returns null when not found; guard against undefined too
        return result ?? null
      } else {
        return await sessionFallback.get(email)
      }
    } catch (err) {
      console.warn('[keychain] getRefreshToken failed:', err)
      return null
    }
  },

  /**
   * Delete the stored refresh token for a given email.
   * Safe to call even if no token exists.
   */
  async deleteRefreshToken(email: string): Promise<void> {
    if (!email) return

    try {
      const electronApi = getElectronApi()
      if (electronApi) {
        await electronApi.deletePassword(KEYCHAIN_SERVICE, email)
      } else {
        await sessionFallback.delete(email)
      }
    } catch (err) {
      // Deletion failure is non-fatal — the token will simply expire
      console.warn('[keychain] deleteRefreshToken failed:', err)
    }
  },
}
