import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme,
  protocol,
  shell,
} from 'electron'
import path from 'path'
import os from 'os'
import { createMainWindow } from './window'
import { setupTray, setTrayUnreadCount, setTrayUserName } from './tray'
import { setupUpdater } from './updater'
import { handleDeepLink, registerDeepLinkProtocol } from './deeplink'
import { showNotification } from './notifications'
import keytar from 'keytar'

// ─────────────────────────────────────────────────────────────────────────────
// Globals
// ─────────────────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null
const isDev = !app.isPackaged

// ─────────────────────────────────────────────────────────────────────────────
// Single instance lock
// ─────────────────────────────────────────────────────────────────────────────

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', (_event, argv) => {
  // Focus existing window
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
  // Handle deep link passed to second instance (Windows)
  const deepLinkUrl = argv.find((arg) => arg.startsWith('spann://'))
  if (deepLinkUrl) {
    handleDeepLink(mainWindow, deepLinkUrl)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Protocol registration (must happen before app is ready)
// ─────────────────────────────────────────────────────────────────────────────

registerDeepLinkProtocol()

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Window controls
// ─────────────────────────────────────────────────────────────────────────────

function registerWindowIpc(): void {
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  ipcMain.handle('window:close', () => {
    mainWindow?.close()
  })

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() ?? false
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Keychain (OS credential store via keytar)
// ─────────────────────────────────────────────────────────────────────────────

function registerKeychainIpc(): void {
  ipcMain.handle(
    'keychain:get',
    async (_event, service: string, account: string) => {
      try {
        return await keytar.getPassword(service, account)
      } catch {
        return null
      }
    },
  )

  ipcMain.handle(
    'keychain:set',
    async (
      _event,
      service: string,
      account: string,
      password: string,
    ) => {
      await keytar.setPassword(service, account, password)
    },
  )

  ipcMain.handle(
    'keychain:delete',
    async (_event, service: string, account: string) => {
      return await keytar.deletePassword(service, account)
    },
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Notifications
// ─────────────────────────────────────────────────────────────────────────────

function registerNotificationIpc(): void {
  ipcMain.handle(
    'notification:show',
    (_event, title: string, body: string, channelId?: string) => {
      showNotification(mainWindow, title, body, channelId)
    },
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC: App info
// ─────────────────────────────────────────────────────────────────────────────

function registerAppIpc(): void {
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:hostname', () => os.hostname())
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Native theme
// ─────────────────────────────────────────────────────────────────────────────

function registerThemeIpc(): void {
  ipcMain.handle('theme:getNative', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light')

  nativeTheme.on('updated', () => {
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    mainWindow?.webContents.send('theme:change', theme)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Tray helpers
// ─────────────────────────────────────────────────────────────────────────────

function registerTrayIpc(): void {
  ipcMain.handle('tray:setUnreadCount', (_event, count: number) => {
    setTrayUnreadCount(count)
  })

  ipcMain.handle('tray:setUserName', (_event, name: string) => {
    setTrayUserName(name)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────────────────────

app.on('ready', async () => {
  // Register custom protocol for file serving in production
  if (!isDev) {
    protocol.registerFileProtocol('spann-file', (request, callback) => {
      const filePath = request.url.replace('spann-file://', '')
      callback({ path: path.normalize(filePath) })
    })
  }

  // Register all IPC handlers before creating the window
  registerWindowIpc()
  registerKeychainIpc()
  registerNotificationIpc()
  registerAppIpc()
  registerThemeIpc()
  registerTrayIpc()

  // Create the main window
  mainWindow = createMainWindow()

  // System tray
  setupTray(mainWindow)

  // Auto-updater (only in production)
  if (!isDev) {
    setupUpdater(mainWindow)
  }

  // Handle deep links passed at launch (macOS / Linux)
  const launchDeepLink = process.argv.find((arg) => arg.startsWith('spann://'))
  if (launchDeepLink) {
    mainWindow.once('ready-to-show', () => {
      handleDeepLink(mainWindow, launchDeepLink)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// macOS: re-create window when dock icon is clicked
// ─────────────────────────────────────────────────────────────────────────────

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow()
  } else {
    mainWindow?.show()
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// macOS deep link via open-url
// ─────────────────────────────────────────────────────────────────────────────

app.on('open-url', (_event, url) => {
  handleDeepLink(mainWindow, url)
})

// ─────────────────────────────────────────────────────────────────────────────
// Graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────

app.on('window-all-closed', () => {
  // On Windows/Linux quit when all windows are closed.
  // On macOS the app stays active until the user quits explicitly.
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // Mark as intentional quit so the close handler doesn't minimize to tray
  app.isQuitting = true
})

// ─────────────────────────────────────────────────────────────────────────────
// Security: restrict navigation and new windows
// ─────────────────────────────────────────────────────────────────────────────

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'https://spann.app',
    ]
    const { origin } = new URL(url)
    if (!allowedOrigins.includes(origin)) {
      event.preventDefault()
    }
  })

  contents.setWindowOpenHandler(({ url }) => {
    // Open external links in the default browser
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
})

// Extend Electron App interface for custom property
declare module 'electron' {
  interface App {
    isQuitting: boolean
  }
}

app.isQuitting = false
