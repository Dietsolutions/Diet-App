interface CacheEntry {
  results: unknown;
  expiresAt: number;
}

// In-memory LRU cache with TTL.
// For 1000+ users on Vercel serverless, this provides warm-instance caching.
// Each serverless instance maintains its own cache (cross-instance sharing
// would require Redis — deferred for future).
const CACHE = new Map<string, CacheEntry>();
const MAX_ENTRIES = 500;
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getCachedSearch(query: string): unknown | null {
  const key = query.trim().toLowerCase();
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    CACHE.delete(key);
    return null;
  }
  // Move to end (most recently used) — basic LRU
  CACHE.delete(key);
  CACHE.set(key, entry);
  return entry.results;
}

export function setCachedSearch(query: string, results: unknown): void {
  const key = query.trim().toLowerCase();
  // Evict oldest if at capacity
  if (CACHE.size >= MAX_ENTRIES) {
    const oldest = CACHE.keys().next().value;
    if (oldest) CACHE.delete(oldest);
  }
  CACHE.set(key, { results, expiresAt: Date.now() + DEFAULT_TTL_MS });
}

export function clearSearchCache(): void {
  CACHE.clear();
}
