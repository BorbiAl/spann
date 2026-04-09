import { BrowserWindow, ipcMain } from 'electron'
import { autoUpdater, UpdateInfo } from 'electron-updater'
import type { Logger } from 'electron-log'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STARTUP_DELAY_MS = 60_000   // 1 minute after launch
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1_000  // every 4 hours

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

export function setupUpdater(win: BrowserWindow): void {
  // Attach electron-log if available (optional peer dep)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const log: Logger = require('electron-log')
    autoUpdater.logger = log
    ;(log as unknown as { transports: { file: { level: string } } }).transports.file.level = 'info'
  } catch {
    // electron-log not installed — use console as fallback
    autoUpdater.logger = {
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
      verbose: console.debug.bind(console),
      silly: console.debug.bind(console),
      scope: () => ({} as ReturnType<Logger['scope']>),
    } as unknown as Logger
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // ── Event forwarding to renderer ─────────────────────────────────────────

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    win.webContents.send('update:available', {
      version: info.version,
      releaseNotes: info.releaseNotes ?? null,
      releaseDate: info.releaseDate,
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    win.webContents.send('update:downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes ?? null,
      releaseDate: info.releaseDate,
    })
  })

  autoUpdater.on('error', (err: Error) => {
    // Log but never crash the app
    console.error('[updater] auto-updater error:', err.message)
  })

  // ── IPC: install ─────────────────────────────────────────────────────────

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(/* isSilent */ false, /* isForceRunAfter */ true)
  })

  // ── Scheduled checks ─────────────────────────────────────────────────────

  // Delay the first check so it does not compete with app startup
  const startupTimer = setTimeout(() => {
    checkForUpdates()
  }, STARTUP_DELAY_MS)

  // Subsequent checks every 4 hours
  const intervalTimer = setInterval(() => {
    checkForUpdates()
  }, CHECK_INTERVAL_MS)

  // Clean up timers when the window is closed
  win.on('closed', () => {
    clearTimeout(startupTimer)
    clearInterval(intervalTimer)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal
// ─────────────────────────────────────────────────────────────────────────────

function checkForUpdates(): void {
  try {
    autoUpdater.checkForUpdates().catch((err: Error) => {
      console.warn('[updater] checkForUpdates failed:', err.message)
    })
  } catch (err) {
    console.warn('[updater] checkForUpdates threw:', (err as Error).message)
  }
}
