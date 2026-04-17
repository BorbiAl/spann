/**
 * In-memory TTL cache for accessibility profiles and workspace ID mappings.
 *
 * Avoids a backend round-trip on every Slack message event.
 * Default TTL: 5 minutes.  Invalidated explicitly on profile save.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(private readonly defaultTtlMs: number = 5 * 60 * 1_000) {}

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry === undefined) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  /** Remove all expired entries (call periodically to prevent memory leaks). */
  evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

/** Profile cache key: `<workspaceId>:<platformUserId>` */
export function profileKey(workspaceId: string, platformUserId: string): string {
  return `${workspaceId}:${platformUserId}`;
}
