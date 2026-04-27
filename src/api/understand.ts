import { apiClient } from './client'
import { isDemoMode, getDemoUnderstandResult } from '../lib/demoMode'

export interface UnderstandRequest {
  message_text: string
  user_preferences?: {
    reading_level?: string
    language?: string
  }
}

export interface IdiomEntry {
  phrase: string
  meaning: string
  localized_equivalent: string
}

export interface UnderstandResult {
  simplified: string
  explanation: string
  idioms: IdiomEntry[]
  tone_hint: string
  translated?: string
}

const TIMEOUT_MS = 2000

/** Deduplicates concurrent requests for the same content + settings */
const _inflight = new Map<string, Promise<UnderstandResult>>()

function _isValidResult(data: unknown): data is UnderstandResult {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return typeof d.simplified === 'string' && typeof d.explanation === 'string'
}

function _withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return promise.finally(() => clearTimeout(timer))
}

export const understandApi = {
  async understand(params: UnderstandRequest): Promise<UnderstandResult> {
    if (isDemoMode()) {
      return getDemoUnderstandResult(params.message_text)
    }

    const key = `${params.message_text}:${params.user_preferences?.reading_level ?? 'standard'}:${params.user_preferences?.language ?? 'en'}`
    const existing = _inflight.get(key)
    if (existing) return existing

    const promise = _withTimeout(
      apiClient
        .post<{ data: UnderstandResult }>('/understand', params, {
          timeout: TIMEOUT_MS,
        })
        .then(({ data }) => {
          const result = data.data
          if (!_isValidResult(result)) {
            throw new Error('invalid_response')
          }
          return result
        }),
      TIMEOUT_MS + 200,
    ).finally(() => _inflight.delete(key))

    _inflight.set(key, promise)
    return promise
  },
}
