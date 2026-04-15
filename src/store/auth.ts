import { create } from 'zustand'
import { authApi } from '../api/auth'
import { setLogoutCallback } from '../api/client'
import { tokenManager } from '../lib/tokens'
import { get as storeGet, set as storeSet } from '../lib/storage'
import type { User } from '../types/api'

// ─────────────────────────────────────────────────────────────────────────────
// Error code → human-readable messages
// ─────────────────────────────────────────────────────────────────────────────

function friendlyError(errorCode: string, fallback: string): string {
  const normalizedCode = errorCode.toLowerCase()
  const map: Record<string, string> = {
    invalid_credentials: 'Incorrect email or password. Please try again.',
    email_already_exists: 'An account with this email already exists.',
    register_failed:
      'We could not create your account right now. Please try again later, or use Sign In / Forgot password if you already have an account.',
    account_disabled: 'Your account has been disabled. Contact support.',
    too_many_requests: 'Too many attempts. Please wait a moment and try again.',
    passwords_do_not_match: 'Passwords do not match. Please re-enter them.',
    token_expired: 'Your session expired. Please sign in again.',
    token_invalid: 'Invalid session. Please sign in again.',
  }
  return map[normalizedCode] ?? fallback
}

function extractErrorCode(err: unknown): { code: string; message: string } {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err
  ) {
    const resp = (err as { response?: { data?: { detail?: { error_code?: string; message?: string } } } }).response
    const detail = resp?.data?.detail
    if (detail?.error_code) {
      return {
        code: detail.error_code,
        message: detail.message ?? 'An error occurred.',
      }
    }
  }
  return { code: 'unknown', message: 'An unexpected error occurred.' }
}

// ─────────────────────────────────────────────────────────────────────────────
// State interface
// ─────────────────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null
  accessToken: string | null
  workspaceId: string | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitializing: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    password: string,
    name: string,
    companyName?: string,
  ) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<boolean>
  initialize: () => Promise<void>
  clearError: () => void
  setAccessToken: (token: string) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set, get) => {
  // Keep axios refresh-failure handling and store state in sync.
  setLogoutCallback(async () => {
    const lastEmail = storeGet('lastEmail')
    tokenManager.clearAccessToken()
    tokenManager.clearActiveAccountEmail()
    if (lastEmail) {
      await tokenManager.clearRefreshToken(lastEmail)
    }
    set({
      user: null,
      accessToken: null,
      workspaceId: null,
      isAuthenticated: false,
      error: null,
    })
  })

  return {
  user: null,
  accessToken: null,
  workspaceId: null,
  isAuthenticated: false,
  isLoading: false,
  isInitializing: true,
  error: null,

  // ── initialize ─────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    set({ isInitializing: true })

    try {
      const lastEmail = storeGet('lastEmail')
      if (!lastEmail) {
        set({ isInitializing: false, isAuthenticated: false })
        return
      }

      const refreshToken = await tokenManager.getRefreshToken(lastEmail)
      if (!refreshToken) {
        set({ isInitializing: false, isAuthenticated: false })
        return
      }

      tokenManager.setActiveAccountEmail(lastEmail)

      const success = await get().refreshSession()
      set({ isInitializing: false, isAuthenticated: success })
    } catch {
      set({ isInitializing: false, isAuthenticated: false })
    }
  },

  // ── login ──────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<void> {
    set({ isLoading: true, error: null })

    try {
      // Use hostname as device hint when running in Electron
      let deviceHint: string | undefined
      try {
        const getHostname = window.electronAPI?.getHostname
        if (typeof getHostname === 'function') {
          deviceHint = await getHostname()
        }
      } catch {
        deviceHint = undefined
      }

      const response = await authApi.login(email, password, deviceHint)

      tokenManager.setAccessToken(response.access_token)
      tokenManager.setActiveAccountEmail(email)
      await tokenManager.saveRefreshToken(email, response.refresh_token)
      storeSet('lastEmail', email)

      // Build a minimal User object from the token claims until /me is called
      const claims = tokenManager.getTokenClaims(response.access_token)

      set({
        accessToken: response.access_token,
        workspaceId: response.workspace_id ?? claims?.workspace_id ?? null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        // user will be populated by /users/me query in the app shell
        user: null,
      })
    } catch (err) {
      const { code, message } = extractErrorCode(err)
      set({
        isLoading: false,
        isAuthenticated: false,
        error: friendlyError(code.toLowerCase(), message),
      })
      throw err
    }
  },

  // ── register ───────────────────────────────────────────────────────────

  async register(
    email: string,
    password: string,
    name: string,
    companyName?: string,
  ): Promise<void> {
    set({ isLoading: true, error: null })

    try {
      const response = await authApi.register(email, password, name, companyName)

      tokenManager.setAccessToken(response.access_token)
      tokenManager.setActiveAccountEmail(email)
      await tokenManager.saveRefreshToken(email, response.refresh_token)
      storeSet('lastEmail', email)

      const claims = tokenManager.getTokenClaims(response.access_token)

      set({
        accessToken: response.access_token,
        workspaceId: response.workspace_id ?? claims?.workspace_id ?? null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        user: null,
      })
    } catch (err) {
      const { code, message } = extractErrorCode(err)
      set({
        isLoading: false,
        isAuthenticated: false,
        error: friendlyError(code.toLowerCase(), message),
      })
      throw err
    }
  },

  // ── logout ─────────────────────────────────────────────────────────────

  async logout(): Promise<void> {
    const lastEmail = storeGet('lastEmail')
    const refreshToken = lastEmail
      ? await tokenManager.getRefreshToken(lastEmail)
      : null

    try {
      if (refreshToken) {
        await authApi.logout(refreshToken)
      }
    } catch {
      // Logout errors are non-fatal — always clear local state
    } finally {
      tokenManager.clearAccessToken()
      tokenManager.clearActiveAccountEmail()
      if (lastEmail) {
        await tokenManager.clearRefreshToken(lastEmail)
      }
      set({
        user: null,
        accessToken: null,
        workspaceId: null,
        isAuthenticated: false,
        error: null,
      })
    }
  },

  // ── refreshSession ─────────────────────────────────────────────────────

  async refreshSession(): Promise<boolean> {
    const lastEmail = storeGet('lastEmail')
    if (!lastEmail) return false

    const storedRefresh = await tokenManager.getRefreshToken(lastEmail)
    if (!storedRefresh) return false

    try {
      const response = await authApi.refresh(storedRefresh)

      tokenManager.setAccessToken(response.access_token)
      tokenManager.setActiveAccountEmail(lastEmail)
      await tokenManager.saveRefreshToken(lastEmail, response.refresh_token)

      const claims = tokenManager.getTokenClaims(response.access_token)

      set({
        accessToken: response.access_token,
        workspaceId: claims?.workspace_id ?? null,
        isAuthenticated: true,
      })

      return true
    } catch {
      tokenManager.clearAccessToken()
      set({
        accessToken: null,
        workspaceId: null,
        isAuthenticated: false,
      })
      return false
    }
  },

  // ── helpers ────────────────────────────────────────────────────────────

  clearError(): void {
    set({ error: null })
  },

  setAccessToken(token: string): void {
    tokenManager.setAccessToken(token)
    set({ accessToken: token })
  },
  }
})
