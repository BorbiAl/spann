/**
 * Cross-platform path utilities for Electron main process
 * Provides safe __dirname alternative that works in all build contexts
 */

import path from 'path'
import { app } from 'electron'

/**
 * Get the directory containing the currently executing JavaScript file
 * Safe fallback for import.meta.url in ES modules
 */
export function getElectronDir(): string {
  // Try using app.getAppPath() first (most reliable in Electron)
  if (app.isReady()) {
    const appPath = app.getAppPath()
    if (appPath) {
      return path.join(appPath, 'dist-electron')
    }
  }

  // Fallback: calculate from current file location
  try {
    const url = new URL(import.meta.url)
    const pathname = url.pathname
    // Remove leading slash on Windows
    const cleanPath = process.platform === 'win32' ? pathname.slice(1) : pathname
    return path.dirname(cleanPath)
  } catch {
    // Last resort: use working directory
    return path.resolve(process.cwd(), 'dist-electron')
  }
}

/**
 * Construct an absolute path to a file in the electron distribution
 */
export function resolveElectronPath(...parts: string[]): string {
  return path.join(getElectronDir(), ...parts)
}
