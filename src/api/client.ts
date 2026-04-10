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
const isFileProtocol =
  typeof window !== 'undefined' && window.location?.protocol === 'file:'
const isAndroid =
  typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent ?? '')
const nativeDefaultApiBase = isAndroid
  ? 'http://10.0.2.2:8000'
  : 'http://127.0.0.1:8000'
const fallbackApiBase = isFileProtocol ? nativeDefaultApiBase : '/api'
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
      let email = useAuthStore.getState().user?.email?.trim() ?? ''

      if (!email) {
        try {
          const { get: storeGet } = await import('../lib/storage')
          const lastEmail = storeGet('lastEmail')
          if (typeof lastEmail === 'string' && lastEmail.trim()) {
            email = lastEmail.trim()
          }
        } catch {
          // Ignore storage fallback failures and keep trying other fallbacks.
        }
      }

      if (!email && typeof localStorage !== 'undefined') {
        const lastEmail = localStorage.getItem('lastEmail')
        if (lastEmail?.trim()) {
          email = lastEmail.trim()
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
