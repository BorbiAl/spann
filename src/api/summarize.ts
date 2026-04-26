import { apiClient } from './client'

export interface SummarizeResult {
  bullets: string[]
  decisions: string[]
  action_items: string[]
  message_count: number
  cached: boolean
}

export const summarizeApi = {
  async summarize(channelId: string): Promise<SummarizeResult> {
    const { data } = await apiClient.post<{ data: SummarizeResult }>(
      `/channels/${encodeURIComponent(channelId)}/summarize`,
    )
    return data.data
  },
}
