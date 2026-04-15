import { apiClient } from './client'
import { signMeshRequest } from '../lib/mesh-hmac'
import type { MeshNode, MeshSyncPayload } from '../types/api'

function unwrapData<T>(payload: unknown): T {
  const response = payload as { data?: T } | null
  return (response?.data ?? payload) as T
}

export const meshApi = {
  async register(nodeName: string): Promise<{ node_id: string; node_secret: string }> {
    const response = await apiClient.post('/mesh/register', { node_name: nodeName })
    return unwrapData<{ node_id: string; node_secret: string }>(response.data)
  },

  async listNodes(): Promise<MeshNode[]> {
    const response = await apiClient.get('/mesh/nodes')
    return unwrapData<MeshNode[]>(response.data) || []
  },

  async revokeNode(nodeId: string): Promise<{ node_id: string; revoked: boolean }> {
    const response = await apiClient.post(`/mesh/nodes/${encodeURIComponent(nodeId)}/revoke`)
    return unwrapData<{ node_id: string; revoked: boolean }>(response.data)
  },

  async sync(
    payload: MeshSyncPayload,
    nodeId: string,
    nodeSecret: string,
  ): Promise<void> {
    const body = JSON.stringify(payload)
    const headers = await signMeshRequest(nodeId, nodeSecret, body)

    await apiClient.post('/mesh/sync', body, {
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    })
  },
}
