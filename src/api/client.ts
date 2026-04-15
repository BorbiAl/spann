import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios'
import { tokenManager } from '../lib/tokens'

type RuntimeWindow = Window & { SPANN_API_BASE?: string }

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface QueueEntry {
  resolve: (token: string) => void
  reject: (err: unknown) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Logout callback (injected by auth store to break circular dep)
// ─────────────────────────────────────────────────────────────────────────────

let _logoutCallback: (() => Promise<void>) | null = null

export function setLogoutCallback(fn: () => Promise<void>): void {
  _logoutCallback = fn
}

// ─────────────────────────────────────────────────────────────────────────────
// Refresh-queue state
// ─────────────────────────────────────────────────────────────────────────────

let isRefreshing = false
const pendingQueue: QueueEntry[] = []

function processQueue(error: unknown, token: string | null): void {
  for (const entry of pendingQueue) {
    if (error) {
      entry.reject(error)
    } else {
      entry.resolve(token!)
    }
  }
  pendingQueue.length = 0
}

function normalizeStoredEmail(raw: string | null | undefined): string {
  if (!raw) {
    return ''
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return ''
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    try {
      const parsed = JSON.parse(trimmed)
      if (typeof parsed === 'string') {
        return parsed.trim().toLowerCase()
      }
    } catch {
      return trimmed.slice(1, -1).trim().toLowerCase()
    }
  }

  return trimmed.toLowerCase()
}

// ─────────────────────────────────────────────────────────────────────────────
// UUID v4 (uses Web Crypto, available in Electron renderer)
// ─────────────────────────────────────────────────────────────────────────────

function uuidv4(): string {
  return crypto.randomUUID()
}

// ─────────────────────────────────────────────────────────────────────────────
// Axios instance
// ─────────────────────────────────────────────────────────────────────────────

const runtimeApiBase =
  typeof window !== 'undefined'
    ? (window as RuntimeWindow).SPANN_API_BASE ?? ''
    : ''
const envApiBase = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? ''
const envNativeApiBase = import.meta.env.VITE_NATIVE_API_BASE_URL ?? ''
const isFileProtocol =
  typeof window !== 'undefined' && window.location?.protocol === 'file:'
const nativeConfiguredApiBase = String(envNativeApiBase || runtimeApiBase || '').trim()
const fallbackApiBase = isFileProtocol ? nativeConfiguredApiBase : '/api'
const resolvedApiBase = String(runtimeApiBase || envApiBase || fallbackApiBase).replace(
  /\/+$/,
  '',
)

export const apiClient: AxiosInstance = axios.create({
  baseURL: resolvedApiBase,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// Request interceptor: attach auth header + request ID
// ─────────────────────────────────────────────────────────────────────────────

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenManager.getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    config.headers['X-Request-ID'] = uuidv4()
    return config
  },
  (error) => Promise.reject(error),
)

// ─────────────────────────────────────────────────────────────────────────────
// Response interceptor: 401 → token refresh → retry
// ─────────────────────────────────────────────────────────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    if (error.response?.status !== 401) {
      return Promise.reject(error)
    }

    // Never retry auth endpoints — avoids infinite loops
    const url = originalRequest.url ?? ''
    if (
      url.includes('/auth/refresh') ||
      url.includes('/auth/login') ||
      url.includes('/auth/register')
    ) {
      return Promise.reject(error)
    }

    // Already retried once — bail out
    if (originalRequest._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      // Queue this request until the ongoing refresh completes
      return new Promise<unknown>((resolve, reject) => {
        pendingQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(apiClient(originalRequest))
          },
          reject,
        })
      })
    }

    originalRequest._retry = true
    isRefreshing = true

    try {
      // Import refresh fn lazily to avoid circular dependency
      const { authApi } = await import('./auth')
      // Get email from store to look up refresh token
      const { useAuthStore } = await import('../store/auth')
      let email = normalizeStoredEmail(useAuthStore.getState().user?.email)

      if (!email) {
        const hintedEmail = tokenManager.getActiveAccountEmail()
        if (hintedEmail) {
          email = normalizeStoredEmail(hintedEmail)
        }
      }

      if (!email) {
        try {
          const { get: storeGet } = await import('../lib/storage')
          const lastEmail = storeGet('lastEmail')
          if (typeof lastEmail === 'string' && lastEmail.trim()) {
            email = normalizeStoredEmail(lastEmail)
          }
        } catch {
          // Ignore storage fallback failures and keep trying other fallbacks.
        }
      }

      if (!email && typeof localStorage !== 'undefined') {
        // Try both possible key formats (with and without spann- prefix)
        let lastEmail = localStorage.getItem('spann-lastEmail')
        if (!lastEmail) {
          lastEmail = localStorage.getItem('lastEmail')
        }
        if (lastEmail?.trim()) {
          email = normalizeStoredEmail(lastEmail)
        }
      }

      if (!email) {
        throw new Error('No account email available for refresh token lookup')
      }

      const storedRefresh = await tokenManager.getRefreshToken(email)

      if (!storedRefresh) {
        throw new Error('No refresh token available')
      }

      const refreshed = await authApi.refresh(storedRefresh)
      tokenManager.setAccessToken(refreshed.access_token)
      tokenManager.setActiveAccountEmail(email)

      // Persist new refresh token
      await tokenManager.saveRefreshToken(email, refreshed.refresh_token)

      processQueue(null, refreshed.access_token)

      originalRequest.headers.Authorization = `Bearer ${refreshed.access_token}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)

      // Force logout — clear tokens and redirect to login
      tokenManager.clearAccessToken()
      if (_logoutCallback) {
        _logoutCallback().catch(() => undefined)
      }

      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)
