import type {
  User,
  Workspace,
  WorkspaceMember,
  Channel,
  Message,
  MeshNode,
  CarbonLog,
  LeaderboardEntry,
  PulseMember,
} from './api'

// ─────────────────────────────────────────────────────────────────────────────
// Auth Store
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthState {
  /** Authenticated user, or null when logged out */
  user: User | null
  /** Active workspace */
  workspace: Workspace | null
  /** JWT access token */
  accessToken: string | null
  /** JWT refresh token (stored in keytar on desktop) */
  refreshToken: string | null
  /** True while a login / token-refresh request is in flight */
  isLoading: boolean
  /** True once auth state has been rehydrated from storage */
  isHydrated: boolean

  setUser: (user: User | null) => void
  setWorkspace: (workspace: Workspace | null) => void
  setTokens: (access: string, refresh: string) => void
  clearTokens: () => void
  logout: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Store
// ─────────────────────────────────────────────────────────────────────────────

export type AppView =
  | 'chat'
  | 'mesh'
  | 'carbon'
  | 'pulse'
  | 'accessibility'
  | 'translator'
  | 'settings'
  | 'call'

export interface UIState {
  /** Currently active top-level view */
  activeView: AppView
  /** Currently selected channel ID */
  activeChannelId: string | null
  /** Whether the sidebar is collapsed */
  isSidebarCollapsed: boolean
  /** Whether the command palette is open */
  isCommandPaletteOpen: boolean
  /** Theme mode */
  theme: 'dark' | 'light' | 'system'
  /** Message being replied to */
  replyToMessageId: string | null
  /** Message being edited */
  editingMessageId: string | null

  setActiveView: (view: AppView) => void
  setActiveChannel: (channelId: string | null) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  setTheme: (theme: UIState['theme']) => void
  setReplyTo: (messageId: string | null) => void
  setEditingMessage: (messageId: string | null) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Messages Store
// ─────────────────────────────────────────────────────────────────────────────

export interface MessagesState {
  /** Map of channelId → array of messages (newest last) */
  messagesByChannel: Record<string, Message[]>
  /** Map of channelId → whether more pages exist */
  hasMoreByChannel: Record<string, boolean>
  /** Map of channelId → next cursor for pagination */
  cursorByChannel: Record<string, string | null>
  /** Set of channelIds currently loading */
  loadingChannels: Set<string>
  /** Map of messageId → optimistic placeholder flag */
  optimisticIds: Set<string>

  addMessage: (channelId: string, message: Message) => void
  updateMessage: (channelId: string, messageId: string, patch: Partial<Message>) => void
  deleteMessage: (channelId: string, messageId: string) => void
  prependMessages: (channelId: string, messages: Message[], nextCursor: string | null) => void
  setLoading: (channelId: string, loading: boolean) => void
  addOptimistic: (messageId: string) => void
  resolveOptimistic: (tempId: string, real: Message) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Presence Store
// ─────────────────────────────────────────────────────────────────────────────

export interface PresenceEntry {
  userId: string
  status: 'online' | 'active' | 'idle' | 'offline'
  statusText: string | null
  lastActiveAt: string | null
}

export interface PresenceState {
  /** Map of userId → presence */
  presence: Record<string, PresenceEntry>
  /** Map of channelId → Set of userIds currently typing */
  typingByChannel: Record<string, Set<string>>

  setPresence: (userId: string, entry: Partial<PresenceEntry>) => void
  setTyping: (channelId: string, userId: string, isTyping: boolean) => void
  getStatus: (userId: string) => PresenceEntry['status']
}

// ─────────────────────────────────────────────────────────────────────────────
// Mesh Store
// ─────────────────────────────────────────────────────────────────────────────

export interface MeshState {
  /** Nodes currently visible on the mesh */
  nodes: MeshNode[]
  /** Whether the local mesh daemon is running */
  isDaemonRunning: boolean
  /** Whether this device is acting as a relay */
  isRelay: boolean

  addNode: (node: MeshNode) => void
  removeNode: (nodeId: string) => void
  setNodes: (nodes: MeshNode[]) => void
  setDaemonStatus: (running: boolean) => void
  setRelayMode: (relay: boolean) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Carbon Store
// ─────────────────────────────────────────────────────────────────────────────

export interface CarbonState {
  logs: CarbonLog[]
  leaderboard: LeaderboardEntry[]
  totalNetKg: number
  isLoading: boolean

  setLogs: (logs: CarbonLog[]) => void
  addLog: (log: CarbonLog) => void
  setLeaderboard: (entries: LeaderboardEntry[]) => void
  setLoading: (loading: boolean) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications Store
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType = 'message' | 'mention' | 'reaction' | 'system' | 'coaching'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  channelId: string | null
  messageId: string | null
  senderId: string | null
  isRead: boolean
  createdAt: string
}

export interface NotificationsState {
  notifications: AppNotification[]
  unreadCount: number
  isMuted: boolean

  addNotification: (n: AppNotification) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clearAll: () => void
  setMuted: (muted: boolean) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-export for convenience
// ─────────────────────────────────────────────────────────────────────────────

export type { User, Workspace, WorkspaceMember, Channel, Message, MeshNode, PulseMember }
