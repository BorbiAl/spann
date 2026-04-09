import { app, BrowserWindow } from 'electron'

// ─────────────────────────────────────────────────────────────────────────────
// Protocol registration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register `spann://` as the default protocol handler for this app.
 * Must be called before `app.ready`.
 *
 * On Windows the current executable is registered in the registry.
 * On macOS this is declared in the plist (no runtime registration needed,
 * but setAsDefaultProtocolClient is still safe to call).
 */
export function registerDeepLinkProtocol(): void {
  if (!app.isDefaultProtocolClient('spann')) {
    app.setAsDefaultProtocolClient('spann')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// URL parser
// ─────────────────────────────────────────────────────────────────────────────

export type DeepLinkRoute =
  | { kind: 'channel'; channelId: string }
  | { kind: 'settings' }
  | { kind: 'unknown'; raw: string }

export function parseDeepLink(url: string): DeepLinkRoute {
  try {
    const parsed = new URL(url)

    // spann://channel/{channelId}
    const channelMatch = parsed.pathname.match(/^\/channel\/([^/]+)$/)
    if (channelMatch) {
      return { kind: 'channel', channelId: channelMatch[1] }
    }

    // spann://settings
    if (parsed.host === 'settings' || parsed.pathname === '/settings') {
      return { kind: 'settings' }
    }

    return { kind: 'unknown', raw: url }
  } catch {
    return { kind: 'unknown', raw: url }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process an incoming deep-link URL and forward it to the renderer.
 *
 * The renderer listens on `window.electronAPI.onDeepLink(cb)` and handles
 * navigation internally via React Router.
 */
export function handleDeepLink(
  win: BrowserWindow | null,
  url: string,
): void {
  if (!win) return

  const route = parseDeepLink(url)

  // Bring window to front
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()

  // Wait for the renderer to be ready before sending
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => {
      dispatchRouteToRenderer(win, route, url)
    })
  } else {
    dispatchRouteToRenderer(win, route, url)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal
// ─────────────────────────────────────────────────────────────────────────────

function dispatchRouteToRenderer(
  win: BrowserWindow,
  route: DeepLinkRoute,
  rawUrl: string,
): void {
  switch (route.kind) {
    case 'channel':
      win.webContents.send('deeplink', `spann://channel/${route.channelId}`)
      break
    case 'settings':
      win.webContents.send('deeplink', 'spann://settings')
      break
    default:
      // Unknown — still forward raw URL so the renderer can decide
      win.webContents.send('deeplink', rawUrl)
  }
}
