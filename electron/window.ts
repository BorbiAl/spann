import { BrowserWindow, ipcMain, app } from 'electron'
import path from 'path'
import { resolveElectronPath } from './path-utils'

const isDev = !app.isPackaged

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#111113',
    fullscreen: true,
    show: false, // show after ready-to-show to avoid flash
    webPreferences: {
      preload: resolveElectronPath('preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // ── Load URL ─────────────────────────────────────────────────────────────

  if (isDev) {
    const devUrl =
      process.env.ELECTRON_START_URL ?? 'http://localhost:5173'
    win.loadURL(devUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(resolveElectronPath('../dist/index.html'))
  }

  // ── Show when ready ───────────────────────────────────────────────────────

  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  // ── Maximize / unmaximize events ─────────────────────────────────────────

  win.on('maximize', () => {
    win.webContents.send('window:maximizeChange', true)
  })

  win.on('unmaximize', () => {
    win.webContents.send('window:maximizeChange', false)
  })

  win.on('restore', () => {
    win.webContents.send('window:maximizeChange', false)
  })

  // ── Close: minimize to tray instead of quitting ───────────────────────────

  win.on('close', (event) => {
    // If app.isQuitting is true (set in main.ts before-quit), allow close
    if (!app.isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })

  return win
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC handlers for window controls
// These are registered once and resolve against the focused window so they
// keep working after window re-creation.
// ─────────────────────────────────────────────────────────────────────────────

export function registerWindowHandlers(): void {
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    win.isMaximized() ? win.unmaximize() : win.maximize()
  })

  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('window:isMaximized', (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })
}
