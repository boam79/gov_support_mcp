/**
 * 공유 Core — 인메모리 캐시 (PRD §7.2)
 * MVP: Map 기반 TTL 캐시. 추후 Repository 인터페이스로 교체 가능.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export const CACHE_TTL = {
  announcements: 86_400_000,       // 1일
  announcementDetails: 43_200_000, // 12시간
  ventureStatus: 43_200_000,       // 12시간
} as const;

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}
