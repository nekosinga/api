# PRD: `nekosinga/api`

## 1. Overview

Backend API for the Neko Singa project. Responsible for auth, database, business logic, and proxying market/social data from the Elfa API. Consumed by the `app` and `web` repos.

**Deploy target:** Vercel (Serverless Functions)

**Elfa plan:** Free tier. See §6a for what this unlocks vs. what requires an upgrade.

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js + TypeScript | Language & type safety |
| Framework | Express | REST API |
| Database | PostgreSQL (Neon) | Data storage |
| Query Builder | Kysely | Type-safe SQL queries |
| Cache | Redis (Upstash) | Caching, rate limiting |
| Queue | Upstash QStash | Serverless-friendly replacement for BullMQ |
| Auth | JWT (jsonwebtoken) | User authentication |
| Crypto Data | `@elfa-ai/sdk` | Trending tokens, keyword mentions, token news, trending CAs, smart stats |
| Validation | Zod | Request body/query validation |
| Env Management | dotenv | Load environment variables |
| Deploy Adapter | `@vercel/node` | Run Express on Vercel Serverless |

---

## 3. Packages to Install

### Dependencies (production)

```bash
npm install express cors dotenv
npm install kysely pg
npm install jsonwebtoken bcryptjs
npm install zod
npm install @upstash/redis @upstash/qstash
npm install @elfa-ai/sdk
```

### Dev Dependencies

```bash
npm install -D typescript ts-node ts-node-dev
npm install -D @types/express @types/node @types/cors @types/jsonwebtoken @types/bcryptjs
npm install -D @vercel/node
```

### Init TypeScript

```bash
npx tsc --init
```

---

## 4. Folder Structure

```
api/
├── src/
│   ├── routes/
│   │   ├── health.ts
│   │   ├── market.ts        # proxy to @elfa-ai/sdk (trending, mentions, news, CAs, stats) + /icon/:symbol (CoinGecko)
│   │   └── auth.ts
│   │   # agent.ts removed — /api/agent/* requires Elfa Grow plan (§6a)
│   ├── db/
│   │   ├── schema.ts        # Kysely types
│   │   └── client.ts        # Neon connection
│   ├── lib/
│   │   ├── redis.ts         # cached() helper with stale-cache fallback (§6d)
│   │   ├── qstash.ts
│   │   └── elfa.ts          # ElfaSDK instance, shared across routes
│   ├── middleware/
│   │   └── auth.ts
│   └── index.ts
├── scripts/
│   ├── migrate.mjs
│   └── seed.mjs
├── .env.example
├── .gitignore
├── vercel.json
├── tsconfig.json
├── LICENSE
└── package.json
```

---

## 5. Environment Variables

```env
DATABASE_URL=
JWT_SECRET=
ELFA_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
QSTASH_TOKEN=
FRONTEND_URL=
```

---

## 6. Planned Endpoints (v1 — Free Tier Scope)

| Method | Endpoint | Purpose | Cache TTL |
|---|---|---|---|
| GET | `/api/health` | Server health check | No cache |
| GET | `/api/market/trending` | Trending tokens (`elfa.getTrendingTokens`) | **30 min (1800s)** |
| GET | `/api/market/sentiment/:token` | Keyword/social mentions (`elfa.getKeywordMentions`) | **15 min (900s)** |
| GET | `/api/market/news` | Token-related news mentions (`elfa.getTokenNews`) | **30 min (1800s)** |
| GET | `/api/market/trending-cas` | Trending contract addresses on Twitter (`elfa.getTrendingCAsTwitter`) | **30 min (1800s)** |
| GET | `/api/market/stats/:username` | Smart stats for a Twitter account (`elfa.getAccountSmartStats`) | **1 hour (3600s)** |
| GET | `/api/market/icon/:symbol` | Token icon URL, resolved via CoinGecko search. Returns `null` if not found — frontend falls back to initial badge. | **24 hours (86400s)** |
| POST | `/api/auth/login` | User login | No cache |

> TTLs updated based on testing: original 5-min TTL was too short — Elfa was being called every 7–8 min, burning credits unnecessarily. At 30-min TTL, estimated usage drops to ~10–15 credits/day (vs ~29/day previously), keeping 1,000 monthly credits comfortable for 2+ months of light testing.

### 6d. Caching Pattern (Required for All Elfa Routes)

All market routes must follow this pattern in `src/lib/redis.ts`:

```ts
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await redis.get<T>(key)
  if (cached !== null) return cached

  try {
    const fresh = await fetcher()
    await redis.set(key, fresh, { ex: ttlSeconds })
    await redis.set(`${key}:stale`, fresh, { ex: ttlSeconds * 10 }) // stale backup
    return fresh
  } catch (err) {
    const stale = await redis.get<T>(`${key}:stale`)
    if (stale !== null) return stale // Elfa down? return old data silently
    throw err
  }
}
```

The `:stale` key has 10x the TTL of the primary key — acts as a fallback if Elfa is down or returns an error, so the frontend never sees a "Failed to load" error just because of a temporary API issue.

### 6e. Response Format (Important for Frontend Compatibility)

All market routes must return a consistent structure — frontend unwraps `data.data`:

```ts
// ✅ Correct
res.json({ data: { success: true, data: payload } })

// ❌ Wrong — frontend can't unwrap this
res.json({ data: payload })
```

If `NEXT_PUBLIC_API_URL` is not set in Vercel dashboard for the `app` repo, frontend will fall back to `localhost:3000` and fail in production. Always verify this env var is set after every new deploy.

### 6a. Removed from Scope (require paid plan)

| Endpoint | Elfa Feature | Required Plan |
|---|---|---|
| ~~`/api/market/narratives`~~ | Trending narratives | Grow ($290/mo) |
| ~~`/api/agent/chat`~~ | AI Chat (Ask Elfa) | Grow ($290/mo) |
| ~~`/api/agent/chat/stream`~~ | Streaming AI Chat | Enterprise |

`src/routes/agent.ts` has been deleted and these routes are not mounted. If revisited later, re-add them as a v2 milestone after upgrading the Elfa plan — do not re-implement on the free key.

---

## 6b. Icon Endpoint — CoinGecko Rate Limit Note

`/api/market/icon/:symbol` calls CoinGecko's public API (no API key required for basic search/coin lookup). Free/demo tier is rate-limited (roughly 10–30 calls/min depending on current CoinGecko policy — check https://docs.coingecko.com/reference/setting-up-your-api-plan at implementation time). Redis caching (24h TTL, per §6) is required here, not optional — without it, a page rendering 20+ tokens at once would burn through the rate limit on a single page load.

---

## 6c. Free-Plan Compliance Summary

All third-party services this PRD depends on have a usable free tier — confirm before implementation, plans change over time:

| Service | Free Tier Covers | Risk |
|---|---|---|
| Elfa API | Trending, mentions, news, trending CAs, smart stats | Chat/narratives excluded (§6a) |
| Neon (Postgres) | Small hobby-scale DB, enough for this project | None expected at this scale |
| Upstash Redis | Free tier with request-count limit | Fine given low traffic (portfolio project) |
| Upstash QStash | Free tier with message-count limit | Only used if async jobs are added later — not required for v1 endpoints above |
| CoinGecko | Public API, no key needed, rate-limited | Mitigated via Redis caching (§6b) |
| Vercel | Serverless Functions on Hobby plan | Cold starts possible, acceptable for a demo |

---

## 7. Documentation Links

**Elfa**
- Elfa main site: https://www.elfa.ai/
- Elfa Dev Portal (API docs, key, plan/billing): https://dev.elfa.ai/
- Elfa SDK docs: https://docs.elfa.ai
- Elfa SDK JS (GitHub): https://github.com/elfa-ai/elfa-sdk-js
- Elfa SDK on npm: https://www.npmjs.com/package/@elfa-ai/sdk
- SDK usage examples: https://github.com/elfa-ai/elfa-sdk-js/tree/main/src/examples

**Core Stack**
- Express: https://expressjs.com/
- Kysely: https://kysely.dev/
- Neon (Postgres): https://neon.tech/docs
- Upstash Redis: https://upstash.com/docs/redis
- Upstash QStash: https://upstash.com/docs/qstash
- Zod: https://zod.dev/
- Vercel + Express (deploy guide): https://vercel.com/guides/using-express-with-vercel

**Auth**
- jsonwebtoken: https://github.com/auth0/node-jsonwebtoken
- bcryptjs: https://github.com/dcodeIO/bcrypt.js

---

## 8. Setup Order

1. `npm init -y` + install all dependencies listed above
2. Set up `tsconfig.json` + folder structure
3. Set up Neon connection + base Kysely schema (`users` table to start)
4. Build `/api/health` endpoint → test Vercel deploy before adding heavier features
5. Create `src/lib/elfa.ts` (shared `ElfaSDK` instance) → build `/api/market/*` endpoints (trending, sentiment, news, trending-cas, stats)
6. Implement Redis caching on every Elfa route using the pattern below — do this before adding more endpoints, not after:
   - Check Redis first → if hit, return cached data immediately (no Elfa call)
   - If miss → call Elfa SDK → store result in Redis with TTL from §6 → return to client
   - Also store a separate stale key (no TTL) as fallback: if Elfa call fails, return stale data with `{ stale: true }` flag instead of a 500 error
7. Add auth (JWT)
8. Build `/api/market/icon/:symbol` — CoinGecko proxy with 24h Redis cache (required, not optional — see §6b)
9. Harden: Zod validation on all input routes, consistent error format (forward Elfa's own status codes, e.g. 403 for plan-gated features, instead of a generic 500), startup env validation

---

## 9. Notes

- Elfa returns specific error responses for plan-gated endpoints (e.g. `403 ERR_FORBIDDEN` with a message like *"requires a Grow or Pay-as-you-go plan"*). Route handlers should forward Elfa's status code and message rather than collapsing everything into a generic `500 Internal server error`.
- If `/api/market/narratives` or similar Grow-tier endpoints unexpectedly return data on the free key, treat that as a temporary/trial behavior on Elfa's side, not a guarantee — don't build features that depend on it.