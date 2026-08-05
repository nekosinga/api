import { Router } from 'express';
import { z } from 'zod';
import { elfa } from '../lib/elfa';
import { cached } from '../lib/redis';

const router = Router();

const TTL = {
  trending: 5 * 60,     // 5 minutes
  sentiment: 3 * 60,    // 3 minutes
  news: 5 * 60,         // 5 minutes
  trendingCAs: 5 * 60,  // 5 minutes
  smartStats: 10 * 60,  // 10 minutes
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

    const data = await cached(cacheKey, TTL.trending, () =>
      elfa.getTrendingTokens({ timeWindow: params.timeWindow, pageSize: params.pageSize })
    );

    res.json({ data });
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

    const data = await cached(cacheKey, TTL.sentiment, () =>
      elfa.getKeywordMentions({
        keywords: token,
        timeWindow: params.timeWindow,
        limit: params.limit,
      })
    );

    res.json({ data });
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

    const data = await cached(cacheKey, TTL.news, () =>
      elfa.getTokenNews({
        coinIds: params.coinIds,
        timeWindow: params.timeWindow,
        pageSize: params.pageSize,
        page: params.page,
      })
    );

    res.json({ data });
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

    const data = await cached(cacheKey, TTL.trendingCAs, () =>
      elfa.getTrendingCAsTwitter({
        timeWindow: params.timeWindow,
        pageSize: params.pageSize,
        page: params.page,
        minMentions: params.minMentions,
      })
    );

    res.json({ data });
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

    const data = await cached(cacheKey, TTL.smartStats, () =>
      elfa.getAccountSmartStats({ username })
    );

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
