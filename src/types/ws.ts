import type {
  Message,
  ReactionSummary,
  MeshNode,
  PulseMember,
} from './api'

// ─────────────────────────────────────────────────────────────────────────────
// Incoming Events (Server → Client)
// ─────────────────────────────────────────────────────────────────────────────

export interface WSMessageNew {
  type: 'message.new'
  channel_id: string
  message: Message
}

export interface WSMessageEdited {
  type: 'message.edited'
  channel_id: string
  message_id: string
  new_content: string
  new_content_html: string | null
  edited_at: string
  editor_id: string
}

export interface WSMessageDeleted {
  type: 'message.deleted'
  channel_id: string
  message_id: string
  deleted_at: string
}

export interface WSMessageReaction {
  type: 'message.reaction'
  channel_id: string
  message_id: string
  /** Updated reaction summary for this emoji */
  reaction: ReactionSummary
  /** User who triggered the reaction change */
  actor_id: string
  action: 'added' | 'removed'
}

export interface WSTypingUpdate {
  type: 'typing.update'
  channel_id: string
  user_id: string
  display_name: string
  is_typing: boolean
}

export interface WSPresenceUpdate {
  type: 'presence.update'
  user_id: string
  status: 'online' | 'active' | 'idle' | 'offline'
  status_text: string | null
  last_active_at: string | null
}

export interface WSPulseUpdate {
  type: 'pulse.update'
  workspace_id: string
  member: PulseMember
}

export interface WSCoachingNudge {
  type: 'coaching.nudge'
  user_id: string
  nudge_id: string
  category: 'tone' | 'clarity' | 'inclusion' | 'brevity'
  original_text: string
  suggestion: string
  confidence: number
}

export interface WSMeshNodeJoin {
  type: 'mesh.node_join'
  channel_id: string
  node: MeshNode
}

export interface WSMeshNodeLeave {
  type: 'mesh.node_leave'
  channel_id: string
  node_id: string
  reason: 'graceful' | 'timeout' | 'error'
}

export interface WSError {
  type: 'error'
  error_code: string
  message: string
  request_id: string | null
}

/** Discriminated union of every event the server can push */
export type WSIncomingEvent =
  | WSMessageNew
  | WSMessageEdited
  | WSMessageDeleted
  | WSMessageReaction
  | WSTypingUpdate
  | WSPresenceUpdate
  | WSPulseUpdate
  | WSCoachingNudge
  | WSMeshNodeJoin
  | WSMeshNodeLeave
  | WSError

// ─────────────────────────────────────────────────────────────────────────────
// Outgoing Events (Client → Server)
// ─────────────────────────────────────────────────────────────────────────────

export interface WSOutgoingJoin {
  type: 'join'
  channel_id: string
}

export interface WSOutgoingLeave {
  type: 'leave'
  channel_id: string
}

export interface WSOutgoingTyping {
  type: 'typing'
  channel_id: string
  is_typing: boolean
}

export interface WSOutgoingPresence {
  type: 'presence'
  status: 'online' | 'idle' | 'offline'
  status_text?: string
}

export interface WSOutgoingPing {
  type: 'ping'
  timestamp: number
}

/** Union of all events the client can send */
export type WSOutgoingEvent =
  | WSOutgoingJoin
  | WSOutgoingLeave
  | WSOutgoingTyping
  | WSOutgoingPresence
  | WSOutgoingPing
