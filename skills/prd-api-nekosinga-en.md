# PRD: `nekosinga/api`

## 1. Overview

Backend API for the Neko Singa project. Responsible for auth, database, business logic, and proxying market/social data from the Elfa API. Consumed by the `app` and `web` repos.

**Deploy target:** Vercel (Serverless Functions)

> **Plan note:** Currently on Elfa Free tier (1,000 credits/mo, 60 RPM). AI Chat and Trending Narratives require Grow ($290/mo) — excluded from this scope.

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Node.js + TypeScript | Language & type safety |
| Framework | Express | REST API |
| Database | PostgreSQL (Neon) | Data storage |
| Query Builder | Kysely | Type-safe SQL queries |
| Cache | Redis (Upstash) | Caching, rate limiting |
| Queue | Upstash QStash | Serverless-friendly queue |
| Auth | JWT (jsonwebtoken) | User authentication |
| Crypto Data | `@elfa-ai/sdk` | Trending tokens, mentions, token news, CAs, smart stats |
| Validation | Zod | Request body/query validation |
| Env Management | dotenv | Load environment variables |
| Deploy Adapter | `@vercel/node` | Run Express on Vercel Serverless |

---

## 3. Packages Installed

### Dependencies (production)
- `express`, `cors`, `dotenv`
- `kysely`, `pg`
- `jsonwebtoken`, `bcryptjs`
- `zod`
- `@upstash/redis`, `@upstash/qstash`
- `@elfa-ai/sdk`

### Dev Dependencies
- `typescript`, `tsx`
- `@types/express`, `@types/node`, `@types/cors`, `@types/jsonwebtoken`, `@types/bcryptjs`, `@types/pg`
- `@vercel/node`

---

## 4. Folder Structure

```
api/
├── src/
│   ├── routes/
│   │   ├── health.ts
│   │   ├── market.ts        # proxy to @elfa-ai/sdk (free tier endpoints)
│   │   └── auth.ts
│   ├── db/
│   │   ├── schema.ts        # Kysely types
│   │   └── client.ts        # Neon connection
│   ├── lib/
│   │   ├── redis.ts         # Upstash Redis + cache-aside helper
│   │   ├── qstash.ts
│   │   └── elfa.ts          # ElfaSDK singleton
│   ├── middleware/
│   │   └── auth.ts          # JWT verification
│   └── index.ts
├── scripts/
│   ├── migrate.mjs          # Create DB tables
│   └── seed.mjs             # Seed test user
├── .env
├── .env.example
├── .gitignore
├── vercel.json
├── tsconfig.json
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
QSTASH_URL=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
FRONTEND_URL=
```

---

## 6. Endpoints (v1)

### Available now (Free tier)

| Method | Endpoint | Elfa SDK method | Status |
|---|---|---|---|
| GET | `/api/health` | — | ✅ Live |
| POST | `/api/auth/login` | — | ✅ Live |
| GET | `/api/market/trending` | `getTrendingTokens` | ✅ Live |
| GET | `/api/market/sentiment/:token` | `getKeywordMentions` | ✅ Live |
| GET | `/api/market/news` | `getTokenNews` | 🔲 To build |
| GET | `/api/market/trending-cas` | `getTrendingCAsTwitter` | 🔲 To build |
| GET | `/api/market/stats/:username` | `getAccountSmartStats` | 🔲 To build |

### Requires Grow plan ($290/mo)

| Method | Endpoint | Reason |
|---|---|---|
| GET | `/api/market/narratives` | Trending narratives — Grow only |
| POST | `/api/agent/chat` | AI Chat — Grow only |
| GET | `/api/agent/chat/stream` | Streaming AI Chat — Enterprise only |

---

## 7. Caching Strategy (Upstash Redis)

| Endpoint | TTL |
|---|---|
| `/api/market/trending` | 5 min |
| `/api/market/sentiment/:token` | 3 min |
| `/api/market/news` | 5 min |
| `/api/market/trending-cas` | 5 min |
| `/api/market/stats/:username` | 10 min |

---

## 8. Documentation Links

**Elfa**
- Elfa Dev Portal: https://dev.elfa.ai/
- Elfa SDK docs: https://docs.elfa.ai
- Elfa SDK JS (GitHub): https://github.com/elfa-ai/elfa-sdk-js

**Core Stack**
- Express: https://expressjs.com/
- Kysely: https://kysely.dev/
- Neon (Postgres): https://neon.tech/docs
- Upstash Redis: https://upstash.com/docs/redis
- Upstash QStash: https://upstash.com/docs/qstash
- Vercel + Express: https://vercel.com/guides/using-express-with-vercel

---

## 9. Next Steps

1. Build remaining free-tier endpoints: `/api/market/news`, `/api/market/trending-cas`, `/api/market/stats/:username`
2. Remove or stub out `src/routes/agent.ts` and `src/routes/market.ts` narratives endpoint
3. Deploy to Vercel
4. Upgrade to Grow when AI chat feature is needed
