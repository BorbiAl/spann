import { apiRequest } from '../data/constants'
import { signMeshRequest } from '../lib/mesh-hmac'
import type { MeshNode, MeshSyncPayload } from '../types/api'

function unwrapData<T>(payload: unknown): T {
  const response = payload as { data?: T } | null
  return (response?.data ?? payload) as T
}

export const meshApi = {
  async register(nodeName: string): Promise<{ node_id: string; node_secret: string }> {
    const payload = await apiRequest('/mesh/register', {
      method: 'POST',
      body: JSON.stringify({ node_name: nodeName }),
    })
    return unwrapData<{ node_id: string; node_secret: string }>(payload)
  },

  async listNodes(): Promise<MeshNode[]> {
    const payload = await apiRequest('/mesh/nodes')
    return unwrapData<MeshNode[]>(payload) || []
  },

  async revokeNode(nodeId: string): Promise<{ node_id: string; revoked: boolean }> {
    const payload = await apiRequest(`/mesh/nodes/${encodeURIComponent(nodeId)}/revoke`, {
      method: 'POST',
    })
    return unwrapData<{ node_id: string; revoked: boolean }>(payload)
  },

  async sync(
    payload: MeshSyncPayload,
    nodeId: string,
    nodeSecret: string,
  ): Promise<void> {
    const body = JSON.stringify(payload)
    const headers = await signMeshRequest(nodeId, nodeSecret, body)

    await apiRequest('/mesh/sync', {
      method: 'POST',
      headers,
      body,
    })
  },
}
