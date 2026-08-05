import { Redis } from '@upstash/redis';

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required');
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Cache-aside helper with stale fallback (§6d).
 *
 * - Checks primary key first (TTL = ttlSeconds)
 * - On miss: calls fetcher, stores result in primary + stale key (TTL = ttlSeconds * 10)
 * - If fetcher throws and stale key exists, returns stale data silently
 * - Stale fallback prevents 500 errors when Elfa is temporarily down
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const hit = await redis.get<T>(key);
  if (hit !== null) return hit;

  try {
    const fresh = await fetcher();
    await redis.set(key, fresh, { ex: ttlSeconds });
    await redis.set(`${key}:stale`, fresh, { ex: ttlSeconds * 10 }); // stale backup
    return fresh;
  } catch (err) {
    const stale = await redis.get<T>(`${key}:stale`);
    if (stale !== null) return stale; // Elfa down? return old data silently
    throw err;
  }
}
