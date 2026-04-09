// ─────────────────────────────────────────────────────────────────────────────
// Core Entities
// ─────────────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  timezone: string | null
  locale: string
  role: 'admin' | 'member' | 'guest'
  is_online: boolean
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  description: string | null
  icon_url: string | null
  owner_id: string
  plan: 'free' | 'pro' | 'enterprise'
  member_count: number
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  workspace_id: string
  user_id: string
  user: User
  role: 'owner' | 'admin' | 'member' | 'guest'
  joined_at: string
  display_name_override: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Channels & Messages
// ─────────────────────────────────────────────────────────────────────────────

export interface Channel {
  id: string
  workspace_id: string
  name: string
  description: string | null
  type: 'public' | 'private' | 'dm' | 'group_dm'
  dm_members: User[] | null
  is_archived: boolean
  is_muted: boolean
  unread_count: number
  last_message_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ReactionSummary {
  emoji: string
  count: number
  /** IDs of users who reacted with this emoji */
  user_ids: string[]
  /** Whether the current user has reacted */
  has_reacted: boolean
}

export interface MessageEdit {
  edited_at: string
  previous_content: string
}

export interface Message {
  id: string
  channel_id: string
  workspace_id: string
  sender_id: string
  sender: User
  content: string
  content_html: string | null
  attachments: MessageAttachment[]
  reactions: ReactionSummary[]
  edits: MessageEdit[]
  thread_count: number
  parent_id: string | null
  is_deleted: boolean
  is_pinned: boolean
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface MessageAttachment {
  id: string
  url: string
  filename: string
  content_type: string
  size_bytes: number
  width: number | null
  height: number | null
}

export interface MessagesPageResponse {
  items: Message[]
  next_cursor: string | null
  prev_cursor: string | null
  has_more: boolean
  total: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Translation
// ─────────────────────────────────────────────────────────────────────────────

export interface TranslationResult {
  original_text: string
  translated_text: string
  source_language: string
  target_language: string
  confidence: number
  cultural_notes: string | null
  model_used: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Carbon Tracker
// ─────────────────────────────────────────────────────────────────────────────

export interface CarbonLog {
  id: string
  user_id: string
  workspace_id: string
  activity_type: string
  description: string | null
  co2_kg: number
  offset_kg: number
  net_kg: number
  date: string
  created_at: string
}

export interface LeaderboardEntry {
  rank: number
  user_id: string
  user: Pick<User, 'id' | 'display_name' | 'avatar_url' | 'username'>
  total_co2_kg: number
  total_offset_kg: number
  net_kg: number
  badge: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Pulse (Presence / Activity)
// ─────────────────────────────────────────────────────────────────────────────

export interface PulseSnapshot {
  workspace_id: string
  total_members: number
  online_count: number
  active_count: number
  idle_count: number
  offline_count: number
  /** Members with presence data */
  members: PulseMember[]
  generated_at: string
}

export interface PulseMember {
  user_id: string
  user: Pick<User, 'id' | 'display_name' | 'avatar_url' | 'username'>
  status: 'online' | 'active' | 'idle' | 'offline'
  status_text: string | null
  last_active_at: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Mesh Network
// ─────────────────────────────────────────────────────────────────────────────

export type MeshTransport = 'bluetooth' | 'wifi_direct' | 'lan' | 'relay'

export interface MeshNode {
  node_id: string
  user_id: string
  user: Pick<User, 'id' | 'display_name' | 'avatar_url'>
  transport: MeshTransport
  signal_strength: number | null
  ip_address: string | null
  is_relay: boolean
  joined_at: string
  last_ping_at: string
}

export interface MeshSyncPayload {
  channel_id: string
  messages: Message[]
  node_count: number
  synced_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  expires_in: number
  user: User
  workspace: Workspace | null
}

export interface RefreshResponse {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  expires_in: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down'
  version: string
  services: {
    database: 'ok' | 'down'
    redis: 'ok' | 'down'
    mesh_relay: 'ok' | 'down'
  }
  uptime_seconds: number
  timestamp: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiError {
  error_code: string
  message: string
  details: Record<string, string[]> | null
  request_id: string | null
}

/** Type guard — narrows unknown axios error to ApiError */
export function isApiError(value: unknown): value is { data: ApiError } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    typeof (value as Record<string, unknown>).data === 'object'
  )
}
