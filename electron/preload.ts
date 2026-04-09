import { contextBridge, ipcRenderer } from 'electron'

// ─────────────────────────────────────────────────────────────────────────────
// Type: full API surface exposed to the renderer
// ─────────────────────────────────────────────────────────────────────────────

export interface ElectronAPI {
  // ── Window ──────────────────────────────────────────────────────────────
  minimize: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  onMaximizeChange: (cb: (isMaximized: boolean) => void) => void

  // ── Keychain (OS credential store) ──────────────────────────────────────
  getPassword: (service: string, account: string) => Promise<string | null>
  setPassword: (
    service: string,
    account: string,
    password: string,
  ) => Promise<void>
  deletePassword: (service: string, account: string) => Promise<boolean>

  // ── Notifications ────────────────────────────────────────────────────────
  showNotification: (
    title: string,
    body: string,
    channelId?: string,
  ) => Promise<void>

  // ── App info ─────────────────────────────────────────────────────────────
  getVersion: () => Promise<string>
  getPlatform: () => NodeJS.Platform
  getHostname: () => Promise<string>

  // ── Native theme ─────────────────────────────────────────────────────────
  onThemeChange: (cb: (theme: 'dark' | 'light') => void) => void
  getNativeTheme: () => Promise<'dark' | 'light'>

  // ── Tray ─────────────────────────────────────────────────────────────────
  setTrayUnreadCount: (count: number) => Promise<void>
  setTrayUserName: (name: string) => Promise<void>

  // ── Auto-updater ─────────────────────────────────────────────────────────
  onUpdateAvailable: (cb: (info: UpdateInfo) => void) => void
  onUpdateDownloaded: (cb: (info: UpdateInfo) => void) => void
  installUpdate: () => Promise<void>

  // ── Deep links ───────────────────────────────────────────────────────────
  onDeepLink: (cb: (url: string) => void) => void

  // ── Cleanup ──────────────────────────────────────────────────────────────
  removeAllListeners: (channel: string) => void
}

export interface UpdateInfo {
  version: string
  releaseNotes: string | null
  releaseDate: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

const electronAPI: ElectronAPI = {
  // ── Window ──────────────────────────────────────────────────────────────
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizeChange: (cb) =>
    ipcRenderer.on('window:maximizeChange', (_event, val: boolean) => cb(val)),

  // ── Keychain ─────────────────────────────────────────────────────────────
  getPassword: (service, account) =>
    ipcRenderer.invoke('keychain:get', service, account),
  setPassword: (service, account, password) =>
    ipcRenderer.invoke('keychain:set', service, account, password),
  deletePassword: (service, account) =>
    ipcRenderer.invoke('keychain:delete', service, account),

  // ── Notifications ────────────────────────────────────────────────────────
  showNotification: (title, body, channelId) =>
    ipcRenderer.invoke('notification:show', title, body, channelId),

  // ── App info ─────────────────────────────────────────────────────────────
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => process.platform,
  getHostname: () => ipcRenderer.invoke('app:hostname'),

  // ── Native theme ─────────────────────────────────────────────────────────
  onThemeChange: (cb) =>
    ipcRenderer.on('theme:change', (_event, theme: 'dark' | 'light') => cb(theme)),
  getNativeTheme: () => ipcRenderer.invoke('theme:getNative'),

  // ── Tray ─────────────────────────────────────────────────────────────────
  setTrayUnreadCount: (count) =>
    ipcRenderer.invoke('tray:setUnreadCount', count),
  setTrayUserName: (name) =>
    ipcRenderer.invoke('tray:setUserName', name),

  // ── Auto-updater ─────────────────────────────────────────────────────────
  onUpdateAvailable: (cb) =>
    ipcRenderer.on('update:available', (_event, info: UpdateInfo) => cb(info)),
  onUpdateDownloaded: (cb) =>
    ipcRenderer.on('update:downloaded', (_event, info: UpdateInfo) => cb(info)),
  installUpdate: () => ipcRenderer.invoke('update:install'),

  // ── Deep links ───────────────────────────────────────────────────────────
  onDeepLink: (cb) =>
    ipcRenderer.on('deeplink', (_event, url: string) => cb(url)),

  // ── Cleanup ──────────────────────────────────────────────────────────────
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// ─────────────────────────────────────────────────────────────────────────────
// Legacy: keep SPANN_API_BASE for backward compat with old preload consumers
// ─────────────────────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld(
  'SPANN_API_BASE',
  process.env.SPANN_API_BASE ?? '',
)

// ─────────────────────────────────────────────────────────────────────────────
// Global type augmentation (consumed by src/env.d.ts and throughout src/)
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    electronAPI: ElectronAPI
    SPANN_API_BASE: string
  }
}
