import { apiClient } from './client'
import { isDemoMode, DEMO_SUMMARIZE_RESULT } from '../lib/demoMode'

export interface SummarizeResult {
  bullets: string[]
  decisions: string[]
  action_items: string[]
  message_count: number
  cached: boolean
}

export const summarizeApi = {
  async summarize(channelId: string): Promise<SummarizeResult> {
    if (isDemoMode()) {
      return { ...DEMO_SUMMARIZE_RESULT }
    }

    const { data } = await apiClient.post<{ data: SummarizeResult }>(
      `/channels/${encodeURIComponent(channelId)}/summarize`,
    )
    return data.data
  },
}
