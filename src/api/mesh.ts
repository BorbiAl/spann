import { apiClient } from './client'
import { signMeshRequest } from '../lib/mesh-hmac'
import type { MeshSyncPayload } from '../types/api'

export const meshApi = {
  async register(
    workspaceId: string,
  ): Promise<{ node_id: string; node_secret: string }> {
    const { data } = await apiClient.post<{
      node_id: string
      node_secret: string
    }>('/mesh/register', { workspace_id: workspaceId })
    return data
  },

  async sync(
    payload: MeshSyncPayload,
    nodeId: string,
    nodeSecret: string,
  ): Promise<void> {
    const body = JSON.stringify(payload)
    const headers = await signMeshRequest(nodeId, nodeSecret, body)

    await apiClient.post('/mesh/sync', payload, { headers })
  },
}
