import { apiClient } from './client'
import type { CarbonLog, LeaderboardEntry } from '../types/api'

export const carbonApi = {
  async log(
    transportType: string,
    kgCo2: number,
    workspaceId: string,
  ): Promise<CarbonLog> {
    const { data } = await apiClient.post<CarbonLog>('/carbon/log', {
      transport_type: transportType,
      kg_co2: kgCo2,
      workspace_id: workspaceId,
    })
    return data
  },

  async leaderboard(workspaceId: string): Promise<LeaderboardEntry[]> {
    const { data } = await apiClient.get<LeaderboardEntry[]>(
      '/carbon/leaderboard',
      { params: { workspace_id: workspaceId } },
    )
    return data
  },
}
