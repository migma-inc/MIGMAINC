/**
 * Simple in-memory cache for dashboard data
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL = 30000; // 30 seconds
const cache = new Map<string, CacheEntry<any>>();

export function getCachedData<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return entry.data as T;
}

export function setCachedData<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function invalidateCache(key: string): void {
  cache.delete(key);
}

export function invalidateAllCache(): void {
  cache.clear();
}

export function generateCacheKey(prefix: string, options: Record<string, any>): string {
  const optionsKey = JSON.stringify(options);
  return `${prefix}:${optionsKey}`;
}





























