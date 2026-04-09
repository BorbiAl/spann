import { apiClient } from './client'
import type { PulseSnapshot } from '../types/api'

export const pulseApi = {
  async get(channelId: string): Promise<PulseSnapshot> {
    const { data } = await apiClient.get<PulseSnapshot>(
      `/channels/${channelId}/pulse`,
    )
    return data
  },
}
