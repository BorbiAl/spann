import { app, BrowserWindow, Menu, MenuItem, Tray, nativeImage } from 'electron'
import path from 'path'

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────

let tray: Tray | null = null
let currentUserName = 'Spann User'
let currentUnreadCount = 0

// ─────────────────────────────────────────────────────────────────────────────
// Icon helpers
// ─────────────────────────────────────────────────────────────────────────────

function getTrayIcon(): Electron.NativeImage {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'tray-icon.png')
    : path.join(__dirname, '../public/tray-icon.png')

  try {
    const img = nativeImage.createFromPath(iconPath)
    // Resize to standard tray icon size (16x16 on Windows)
    return img.resize({ width: 16, height: 16 })
  } catch {
    // Fallback to empty image if icon file is missing during development
    return nativeImage.createEmpty()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context menu builder
// ─────────────────────────────────────────────────────────────────────────────

function buildContextMenu(win: BrowserWindow): Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Open Spann',
      click: () => {
        win.show()
        win.focus()
      },
    },
    { type: 'separator' },
    {
      label: currentUserName,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => {
        win.show()
        win.focus()
        win.webContents.send('deeplink', 'spann://settings')
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Spann',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

export function setupTray(win: BrowserWindow): void {
  tray = new Tray(getTrayIcon())
  tray.setToolTip('Spann')

  // Left click: toggle window visibility
  tray.on('click', () => {
    if (!win) return
    if (win.isVisible()) {
      win.hide()
    } else {
      win.show()
      win.focus()
    }
  })

  // Right click: context menu
  tray.on('right-click', () => {
    if (tray) {
      tray.popUpContextMenu(buildContextMenu(win))
    }
  })

  // Set initial context menu (also used on double-click)
  tray.setContextMenu(buildContextMenu(win))
}

// ─────────────────────────────────────────────────────────────────────────────
// Public updaters (called from IPC handlers in main.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update the Windows taskbar badge / overlay icon with unread count.
 * Electron does not have a native badge API on Windows, so we update the
 * tooltip text and, when count > 0, set the app user model ID overlay.
 */
export function setTrayUnreadCount(count: number): void {
  currentUnreadCount = count

  if (!tray) return

  const label = count > 0 ? `Spann (${count} unread)` : 'Spann'
  tray.setToolTip(label)

  // Windows: set flash frame to attract attention when count increases
  const wins = BrowserWindow.getAllWindows()
  const mainWin = wins[0]
  if (mainWin && count > 0 && !mainWin.isFocused()) {
    mainWin.flashFrame(true)
    mainWin.once('focus', () => mainWin.flashFrame(false))
  }
}

/**
 * Update the display name shown in the tray context menu.
 */
export function setTrayUserName(name: string): void {
  currentUserName = name

  if (!tray) return

  const wins = BrowserWindow.getAllWindows()
  const mainWin = wins[0]
  if (mainWin) {
    tray.setContextMenu(buildContextMenu(mainWin))
  }
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
