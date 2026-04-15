import { keychain } from './keychain'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TokenClaims {
  sub: string          // user_id
  iat: number
  exp: number
  jti: string
  workspace_id: string
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory access token store
// Never written to disk — lives only for the lifetime of the process.
// ─────────────────────────────────────────────────────────────────────────────

let _accessToken: string | null = null
let _activeAccountEmail: string | null = null

// ─────────────────────────────────────────────────────────────────────────────
// JWT helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseJwtPayload(token: string): TokenClaims | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // base64url → base64 → JSON
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/') + '=='
    const json = atob(padded)
    return JSON.parse(json) as TokenClaims
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Token manager
// ─────────────────────────────────────────────────────────────────────────────

export const tokenManager = {
  // ── Access token (in-memory only) ──────────────────────────────────────

  getAccessToken(): string | null {
    return _accessToken
  },

  setAccessToken(token: string): void {
    _accessToken = token
  },

  clearAccessToken(): void {
    _accessToken = null
  },

  // ── Refresh token (OS keychain) ────────────────────────────────────────

  async saveRefreshToken(email: string, token: string): Promise<void> {
    this.setActiveAccountEmail(email)
    await keychain.saveRefreshToken(email, token)
  },

  async getRefreshToken(email: string): Promise<string | null> {
    return keychain.getRefreshToken(email)
  },

  async clearRefreshToken(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase()
    if (_activeAccountEmail === normalized) {
      _activeAccountEmail = null
    }
    await keychain.deleteRefreshToken(email)
  },

  // ── Active account hint (in-memory) ───────────────────────────────────

  setActiveAccountEmail(email: string): void {
    const normalized = email.trim().toLowerCase()
    _activeAccountEmail = normalized || null
  },

  getActiveAccountEmail(): string | null {
    return _activeAccountEmail
  },

  clearActiveAccountEmail(): void {
    _activeAccountEmail = null
  },

  // ── Token inspection ───────────────────────────────────────────────────

  /**
   * Returns true if the token is missing, malformed, or its `exp` claim
   * has already passed (with a 30-second safety buffer).
   */
  isTokenExpired(token: string): boolean {
    const claims = parseJwtPayload(token)
    if (!claims) return true
    const bufferSecs = 30
    return Date.now() / 1000 >= claims.exp - bufferSecs
  },

  /**
   * Decode and return the JWT payload.
   * Returns null if the token is malformed.
   */
  getTokenClaims(token: string): TokenClaims | null {
    return parseJwtPayload(token)
  },

  /**
   * Seconds until the token expires.
   * Returns 0 if already expired or malformed.
   */
  getTokenExpiresIn(token: string): number {
    const claims = parseJwtPayload(token)
    if (!claims) return 0
    const remaining = claims.exp - Date.now() / 1000
    return Math.max(0, Math.floor(remaining))
  },
}
