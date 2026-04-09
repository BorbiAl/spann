import { apiClient } from './client'
import type { TranslationResult } from '../types/api'

export interface TranslateParams {
  phrase: string
  source_locale: string
  target_locale: string
  source_culture: string
  target_culture: string
  workplace_tone: string
}

export const translateApi = {
  async translate(params: TranslateParams): Promise<TranslationResult> {
    const { data } = await apiClient.post<TranslationResult>(
      '/translate',
      params,
    )
    return data
  },
}
