import { apiClient } from './client'
import { signMeshRequest } from '../lib/mesh-hmac'
import type { MeshNode, MeshSyncPayload } from '../types/api'

export const meshApi = {
  async register(nodeName: string): Promise<{ node_id: string; node_secret: string }> {
    const { data } = await apiClient.post<{
      node_id: string
      node_secret: string
    }>('/mesh/register', { node_name: nodeName })
    return data
  },

  async listNodes(): Promise<MeshNode[]> {
    const { data } = await apiClient.get<{ data: MeshNode[] }>('/mesh/nodes')
    return data.data || []
  },

  async revokeNode(nodeId: string): Promise<{ node_id: string; revoked: boolean }> {
    const { data } = await apiClient.post<{ node_id: string; revoked: boolean }>(
      `/mesh/nodes/${encodeURIComponent(nodeId)}/revoke`,
    )
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
