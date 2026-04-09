import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ─────────────────────────────────────────────────────────────────────────────
// Styling
// ─────────────────────────────────────────────────────────────────────────────

/** Merge Tailwind class names safely, resolving conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ─────────────────────────────────────────────────────────────────────────────
// Date / Time
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a date for message timestamps.
 * - Same day  → "Today at 9:41 AM"
 * - Yesterday → "Yesterday at 9:41 AM"
 * - Older     → "Mon, Apr 7"
 */
export function formatDate(date: Date): string {
  const now = new Date()
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isSameDay) return `Today at ${timeStr}`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()

  if (isYesterday) return `Yesterday at ${timeStr}`

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Format a date as a relative human-readable string.
 * - < 60 s    → "just now"
 * - < 60 min  → "2m ago"
 * - < 24 h    → "1h ago"
 * - < 7 days  → "3d ago"
 * - Otherwise → formatDate()
 */
export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffS = Math.floor(diffMs / 1000)

  if (diffS < 60) return 'just now'
  if (diffS < 3600) return `${Math.floor(diffS / 60)}m ago`
  if (diffS < 86400) return `${Math.floor(diffS / 3600)}h ago`
  if (diffS < 604800) return `${Math.floor(diffS / 86400)}d ago`
  return formatDate(date)
}

// ─────────────────────────────────────────────────────────────────────────────
// User
// ─────────────────────────────────────────────────────────────────────────────

/** Return up-to-two uppercase initials from a display name. */
export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

const ACCENT_COLORS = [
  '#0A84FF', // blue
  '#BF5AF2', // purple
  '#30D158', // green
  '#FF9F0A', // orange
  '#FF453A', // red
  '#64D2FF', // cyan
]

/** Return a deterministic accent color based on userId. */
export function getUserColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  }
  return ACCENT_COLORS[hash % ACCENT_COLORS.length]
}

// ─────────────────────────────────────────────────────────────────────────────
// String
// ─────────────────────────────────────────────────────────────────────────────

/** Truncate a string to `max` characters, appending "…" if needed. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

// ─────────────────────────────────────────────────────────────────────────────
// Async
// ─────────────────────────────────────────────────────────────────────────────

/** Pause execution for `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────────────────────────────────────
// Function utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Debounce: delay `fn` until `delay` ms after the last call. */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/** Throttle: allow `fn` to fire at most once per `delay` ms. */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let last = 0
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - last >= delay) {
      last = now
      fn(...args)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true if `email` is a syntactically valid email address. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Score password strength. */
export function getPasswordStrength(password: string): 'weak' | 'fair' | 'strong' {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 2) return 'weak'
  if (score <= 3) return 'fair'
  return 'strong'
}

// ─────────────────────────────────────────────────────────────────────────────
// Encoding / Crypto
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decode a Base64 string to a UTF-8 string.
 * Works in both browser (atob) and Node (Buffer) contexts.
 */
export function base64Decode(str: string): string {
  if (typeof atob === 'function') {
    return decodeURIComponent(
      atob(str)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )
  }
  // Node / Electron main process fallback
  return Buffer.from(str, 'base64').toString('utf8')
}

/** Compute the SHA-256 hex digest of a UTF-8 string using the Web Crypto API. */
export async function sha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
