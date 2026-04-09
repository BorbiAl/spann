import { BrowserWindow, Notification } from 'electron'

// ─────────────────────────────────────────────────────────────────────────────
// State: track one notification per channel to replace duplicates
// ─────────────────────────────────────────────────────────────────────────────

const activeNotifications = new Map<string, Notification>()

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the main window does NOT have focus — the usual condition
 * for showing a desktop notification.
 */
function shouldNotify(win: BrowserWindow | null): boolean {
  if (!win) return true
  return !win.isFocused()
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Show a native OS notification.
 *
 * - If the window is focused, the notification is suppressed (in-app banners
 *   handle that path).
 * - If a notification for the same `channelId` is already showing, it is
 *   closed and replaced so the OS notification center stays clean.
 * - Clicking the notification focuses the window and navigates to the channel
 *   via a deep-link IPC event.
 */
export function showNotification(
  win: BrowserWindow | null,
  title: string,
  body: string,
  channelId?: string,
): void {
  if (!shouldNotify(win)) return

  if (!Notification.isSupported()) return

  // Close any existing notification for this channel
  const groupKey = channelId ?? '__global__'
  const previous = activeNotifications.get(groupKey)
  if (previous) {
    previous.close()
    activeNotifications.delete(groupKey)
  }

  const notification = new Notification({
    title,
    body,
    silent: false,
    // Windows 10/11 app icon — uses the app's default icon
    icon: undefined,
  })

  notification.on('click', () => {
    if (!win) return

    // Bring window to front
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()

    // Navigate to the channel
    if (channelId) {
      win.webContents.send('deeplink', `spann://channel/${channelId}`)
    }

    activeNotifications.delete(groupKey)
  })

  notification.on('close', () => {
    activeNotifications.delete(groupKey)
  })

  notification.show()
  activeNotifications.set(groupKey, notification)
}

/**
 * Close all active notifications (e.g. when the user reads all messages).
 */
export function clearAllNotifications(): void {
  for (const n of activeNotifications.values()) {
    n.close()
  }
  activeNotifications.clear()
}
