import { sha256 } from './utils'

// ─────────────────────────────────────────────────────────────────────────────
// HMAC-SHA256 signing for Mesh sync requests
// Uses the Web Crypto API — available in Electron renderer and modern browsers.
// ─────────────────────────────────────────────────────────────────────────────

async function hmacSha256Hex(
  secret: string,
  message: string,
): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    keyMaterial,
    enc.encode(message),
  )
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: sign a mesh request and return the required headers
// ─────────────────────────────────────────────────────────────────────────────

export interface MeshAuthHeaders {
  'X-Mesh-Node-ID': string
  'X-Mesh-Timestamp': string
  'X-Mesh-Nonce': string
  'X-Mesh-Signature': string
}

/**
 * Sign a mesh sync request body and return HMAC auth headers.
 *
 * Signing scheme:
 *   body_hash = SHA-256(body) as hex
 *   message   = `${nodeId}:${timestamp}:${nonce}:${body_hash}`
 *   signature = HMAC-SHA256(nodeSecret, message) as hex
 */
export async function signMeshRequest(
  nodeId: string,
  nodeSecret: string,
  body: string,
): Promise<MeshAuthHeaders> {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const bodyHash = await sha256(body)
  const message = `${nodeId}:${timestamp}:${nonce}:${bodyHash}`
  const signature = await hmacSha256Hex(nodeSecret, message)

  return {
    'X-Mesh-Node-ID': nodeId,
    'X-Mesh-Timestamp': timestamp,
    'X-Mesh-Nonce': nonce,
    'X-Mesh-Signature': signature,
  }
}
