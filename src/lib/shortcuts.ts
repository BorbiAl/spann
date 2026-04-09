// ─────────────────────────────────────────────────────────────────────────────
// Keyboard Shortcuts
// All shortcuts use "mod" which maps to Ctrl on Windows/Linux, Cmd on macOS.
// ─────────────────────────────────────────────────────────────────────────────

export const SHORTCUTS = {
  COMMAND_PALETTE:    'mod+k',
  TOGGLE_SIDEBAR:     'mod+\\',
  PREV_CHANNEL:       'mod+[',
  NEXT_CHANNEL:       'mod+]',
  OPEN_SETTINGS:      'mod+,',
  SEARCH:             'mod+f',
  EDIT_LAST_MESSAGE:  'mod+e',
  COPY_MESSAGE_LINK:  'mod+shift+c',
  VIEW_CHAT:          'mod+1',
  VIEW_MESH:          'mod+2',
  VIEW_CARBON:        'mod+3',
  VIEW_PULSE:         'mod+4',
  VIEW_ACCESSIBILITY: 'mod+5',
  VIEW_TRANSLATOR:    'mod+6',
  VIEW_SETTINGS:      'mod+7',
} as const

export type ShortcutKey = keyof typeof SHORTCUTS

// ─────────────────────────────────────────────────────────────────────────────
// Display labels (rendered in tooltips, command palette, settings)
// ─────────────────────────────────────────────────────────────────────────────

/** Maps each shortcut to a human-readable label and its display keys. */
export const ShortcutLabel: Record<
  ShortcutKey,
  { label: string; keys: string }
> = {
  COMMAND_PALETTE:    { label: 'Command Palette',       keys: 'Ctrl K' },
  TOGGLE_SIDEBAR:     { label: 'Toggle Sidebar',        keys: 'Ctrl \\' },
  PREV_CHANNEL:       { label: 'Previous Channel',      keys: 'Ctrl [' },
  NEXT_CHANNEL:       { label: 'Next Channel',          keys: 'Ctrl ]' },
  OPEN_SETTINGS:      { label: 'Open Settings',         keys: 'Ctrl ,' },
  SEARCH:             { label: 'Search',                keys: 'Ctrl F' },
  EDIT_LAST_MESSAGE:  { label: 'Edit Last Message',     keys: 'Ctrl E' },
  COPY_MESSAGE_LINK:  { label: 'Copy Message Link',     keys: 'Ctrl Shift C' },
  VIEW_CHAT:          { label: 'Go to Chat',            keys: 'Ctrl 1' },
  VIEW_MESH:          { label: 'Go to Mesh',            keys: 'Ctrl 2' },
  VIEW_CARBON:        { label: 'Go to Carbon',          keys: 'Ctrl 3' },
  VIEW_PULSE:         { label: 'Go to Pulse',           keys: 'Ctrl 4' },
  VIEW_ACCESSIBILITY: { label: 'Go to Accessibility',   keys: 'Ctrl 5' },
  VIEW_TRANSLATOR:    { label: 'Go to Translator',      keys: 'Ctrl 6' },
  VIEW_SETTINGS:      { label: 'Go to Settings',        keys: 'Ctrl 7' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: resolve "mod" to the platform modifier key
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the platform modifier: "⌘" on macOS, "Ctrl" elsewhere. */
export function getModKey(): string {
  return navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl'
}

/**
 * Expand a shortcut string for display.
 * "mod+k" → "⌘K" (macOS) or "Ctrl+K" (Windows/Linux)
 */
export function expandShortcut(shortcut: string): string {
  const mod = getModKey()
  return shortcut
    .replace('mod', mod)
    .split('+')
    .map((k) => k.charAt(0).toUpperCase() + k.slice(1))
    .join(mod === '⌘' ? '' : '+')
}
