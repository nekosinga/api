import { Router } from 'express';
import { z } from 'zod';
import { elfa } from '../lib/elfa';
import { cached, redis } from '../lib/redis';

const router = Router();

// TTLs per §6 (updated: longer TTLs to conserve Elfa credits)
const TTL = {
  trending: 30 * 60,    // 30 minutes (1800s)
  sentiment: 15 * 60,   // 15 minutes (900s)
  news: 30 * 60,        // 30 minutes (1800s)
  trendingCAs: 30 * 60, // 30 minutes (1800s)
  smartStats: 60 * 60,  // 1 hour (3600s)
  icon: 24 * 60 * 60,   // 24 hours (86400s)
};

// GET /api/market/trending
router.get('/trending', async (req, res, next) => {
  try {
    const schema = z.object({
      timeWindow: z.enum(['1h', '4h', '12h', '24h']).default('24h'),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    });

    const params = schema.parse(req.query);
    const cacheKey = `market:trending:${params.timeWindow}:${params.pageSize}`;

    const payload = await cached(cacheKey, TTL.trending, () =>
      elfa.getTrendingTokens({ timeWindow: params.timeWindow, pageSize: params.pageSize })
    );

    res.json({ data: { success: true, data: payload } });
  } catch (err) {
    next(err);
  }
});

// GET /api/market/sentiment/:token
router.get('/sentiment/:token', async (req, res, next) => {
  try {
    const schema = z.object({
      timeWindow: z.enum(['1h', '4h', '12h', '24h']).default('24h'),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    });

    const { token } = req.params;
    const params = schema.parse(req.query);
    const cacheKey = `market:sentiment:${token}:${params.timeWindow}`;

    const payload = await cached(cacheKey, TTL.sentiment, () =>
      elfa.getKeywordMentions({
        keywords: token,
        timeWindow: params.timeWindow,
        limit: params.limit,
      })
    );

    res.json({ data: { success: true, data: payload } });
  } catch (err) {
    next(err);
  }
});

// GET /api/market/news
// Optional query: coinIds (comma-separated), timeWindow, pageSize, page
router.get('/news', async (req, res, next) => {
  try {
    const schema = z.object({
      coinIds: z.string().optional(),
      timeWindow: z.enum(['1h', '4h', '12h', '24h']).optional(),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      page: z.coerce.number().int().min(1).default(1),
    });

    const params = schema.parse(req.query);
    const cacheKey = `market:news:${params.coinIds ?? 'all'}:${params.timeWindow ?? 'default'}:${params.page}:${params.pageSize}`;

    const payload = await cached(cacheKey, TTL.news, () =>
      elfa.getTokenNews({
        coinIds: params.coinIds,
        timeWindow: params.timeWindow,
        pageSize: params.pageSize,
        page: params.page,
      })
    );

    res.json({ data: { success: true, data: payload } });
  } catch (err) {
    next(err);
  }
});

// GET /api/market/trending-cas
// Trending contract addresses from Twitter
router.get('/trending-cas', async (req, res, next) => {
  try {
    const schema = z.object({
      timeWindow: z.enum(['1h', '4h', '12h', '24h']).default('24h'),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      page: z.coerce.number().int().min(1).default(1),
      minMentions: z.coerce.number().int().min(1).optional(),
    });

    const params = schema.parse(req.query);
    const cacheKey = `market:trending-cas:${params.timeWindow}:${params.page}:${params.pageSize}:${params.minMentions ?? 0}`;

    const payload = await cached(cacheKey, TTL.trendingCAs, () =>
      elfa.getTrendingCAsTwitter({
        timeWindow: params.timeWindow,
        pageSize: params.pageSize,
        page: params.page,
        minMentions: params.minMentions,
      })
    );

    res.json({ data: { success: true, data: payload } });
  } catch (err) {
    next(err);
  }
});

// GET /api/market/stats/:username
// Smart stats for a Twitter/X account
router.get('/stats/:username', async (req, res, next) => {
  try {
    const { username } = req.params;
    const cacheKey = `market:stats:${username}`;

    const payload = await cached(cacheKey, TTL.smartStats, () =>
      elfa.getAccountSmartStats({ username })
    );

    res.json({ data: { success: true, data: payload } });
  } catch (err) {
    next(err);
  }
});

// GET /api/market/icon/:symbol
// Resolves token icon URL via CoinGecko search. Returns null if not found.
// Cache: 24h (§6b — required, not optional; CoinGecko rate limit ~10–30 req/min)
router.get('/icon/:symbol', async (req, res, next) => {
  try {
    const { symbol } = req.params;
    const cacheKey = `market:icon:${symbol.toLowerCase()}`;

    // Check cache first (manual — CoinGecko is not an Elfa call, no stale needed)
    const cached_icon = await redis.get<string | null>(cacheKey);
    if (cached_icon !== undefined) {
      res.json({ data: { success: true, data: cached_icon } });
      return;
    }

    let iconUrl: string | null = null;

    try {
      // CoinGecko public search — no API key required for this endpoint
      const searchRes = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(symbol)}`
      );

      if (searchRes.ok) {
        const body = (await searchRes.json()) as {
          coins?: Array<{ symbol: string; thumb: string }>;
        };

        // Find exact symbol match (case-insensitive), fall back to first result
        const match =
          body.coins?.find(
            (c) => c.symbol.toLowerCase() === symbol.toLowerCase()
          ) ?? body.coins?.[0];

        iconUrl = match?.thumb ?? null;
      }
    } catch {
      // CoinGecko unreachable — return null gracefully, frontend falls back to initial badge
      iconUrl = null;
    }

    // Cache the result (even null — prevents hammering CoinGecko for unknown tokens)
    await redis.set(cacheKey, iconUrl, { ex: TTL.icon });

    res.json({ data: { success: true, data: iconUrl } });
  } catch (err) {
    next(err);
  }
});

export default router;
