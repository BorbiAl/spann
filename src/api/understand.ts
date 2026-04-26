import { apiClient } from './client'
import { isDemoMode, getDemoUnderstandResult } from '../lib/demoMode'

export interface UnderstandRequest {
  message_text: string
  user_preferences?: {
    reading_level?: 'simple' | 'general' | 'advanced'
    language?: string
  }
  context?: {
    thread?: string | null
    channel_tone?: string | null
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
  translated: string
}

/** Deduplicates concurrent requests for the same content + settings */
const _inflight = new Map<string, Promise<UnderstandResult>>()

export const understandApi = {
  async understand(params: UnderstandRequest): Promise<UnderstandResult> {
    if (isDemoMode()) {
      return getDemoUnderstandResult(params.message_text)
    }

    const key = `${params.message_text}:${params.user_preferences?.reading_level ?? 'general'}:${params.user_preferences?.language ?? 'en'}`
    const existing = _inflight.get(key)
    if (existing) return existing

    const promise = apiClient
      .post<{ data: UnderstandResult }>('/understand', params)
      .then(({ data }) => data.data)
      .finally(() => _inflight.delete(key))

    _inflight.set(key, promise)
    return promise
  },
}
