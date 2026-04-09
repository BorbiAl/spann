import { apiClient } from './client'
import type { Channel } from '../types/api'

export const channelsApi = {
  async list(workspaceId: string): Promise<Channel[]> {
    const { data } = await apiClient.get<Channel[]>('/channels', {
      params: { workspace_id: workspaceId },
    })
    return data
  },

  async create(name: string, workspaceId: string): Promise<Channel> {
    const { data } = await apiClient.post<Channel>('/channels', {
      name,
      workspace_id: workspaceId,
    })
    return data
  },
}
