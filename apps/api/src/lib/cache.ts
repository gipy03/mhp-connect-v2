const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class TTLCache<T = unknown> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs = DEFAULT_TTL_MS) {}

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T, ttlMs?: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.ttlMs),
    });
  }

  invalidate(key?: string): void {
    if (key !== undefined) {
      this.store.delete(key);
    } else {
      this.store.clear();
    }
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }
}
