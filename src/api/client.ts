import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios'
import { tokenManager } from '../lib/tokens'

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

export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
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
    if (url.includes('/auth/refresh') || url.includes('/auth/login')) {
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
      const email = useAuthStore.getState().user?.email ?? ''
      const storedRefresh = await tokenManager.getRefreshToken(email)

      if (!storedRefresh) {
        throw new Error('No refresh token available')
      }

      const refreshed = await authApi.refresh(storedRefresh)
      tokenManager.setAccessToken(refreshed.access_token)

      // Persist new refresh token
      if (email) {
        await tokenManager.saveRefreshToken(email, refreshed.refresh_token)
      }

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
