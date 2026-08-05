# Neko Singa — API

Backend API for the Neko Singa portfolio project. Built as a direct response to the [Full-Stack Engineer (Frontend-Leaning)](https://www.elfa.ai/careers/full-stack-engineer) role at Elfa AI — the goal wasn't just to show I can code, but to show stack alignment and decision-making that matches what the role actually needs.

**Live:** [api-nekosinga.vercel.app](https://api-nekosinga.vercel.app/)

---

## Why This Project Is Built the Way It Is

The job posting calls out several specifics, and every technical decision in this repo is aimed at demonstrating those:

| Requirement from the Job Posting | How It's Addressed Here |
|---|---|
| *"Node/TypeScript backend experience: Express, REST APIs, Postgres (we use Kysely), Redis, queues"* | This backend uses Express + TypeScript, Postgres via Neon, and Kysely as the query builder — the exact stack they mention |
| *"Appreciation for financial markets & trading"* | Real crypto data integration (trending tokens, sentiment, market news) via the Elfa SDK, not mock data |
| *"Work AI-first"* | Originally designed to use Elfa SDK's AI Chat feature as part of the product flow (see note below) |
| *"Own features end-to-end, from UX/interaction design through frontend, API, and release"* | This repo is the backend half of a polyrepo system (`web`, `app`, `api`, `docs`) built and deployed from scratch to live |

Queues (BullMQ/RabbitMQ in their production stack) are replaced here with **Upstash QStash**, since the entire backend is deployed as serverless functions on Vercel — BullMQ/RabbitMQ need a long-running process, which doesn't fit the serverless model. This is a deliberate architectural adaptation, not unfamiliarity with the concept.

---

## A Real Constraint: Elfa Free Plan

This section is intentionally written transparently, because I think this part of the process is worth showing, not hiding.

The original plan was to build `/api/agent/chat` using `elfa.chat()` from `@elfa-ai/sdk` — Elfa's built-in AI Chat feature. On testing, the request came back with:

```json
{
  "error": "ERR_FORBIDDEN",
  "message": "The AI Chat (Ask Elfa) endpoint requires a Grow or Pay-as-you-go plan."
}
```

That feature (along with Trending Narratives) turned out to be gated behind the **Grow plan ($290/mo)**, not included in the **Free tier** I was using for development/testing.

### The Decision I Made

Rather than ship a feature I couldn't actually test end-to-end — and risk it being unreliable for anyone trying to demo this — I chose to:

1. **Focus on what's available on the Free tier** and make sure it works solidly: trending tokens, keyword mentions, token news, trending contract addresses, and account smart stats.
2. **Fix the error handling** — the 403 from Elfa was originally collapsing into a generic `500 Internal Server Error` on my side. I fixed this so Elfa's actual status code and message get forwarded, instead of being masked.
3. **Document the scope** in the PRD (`/docs`), including which features were intentionally excluded and why, so there's no confusion for anyone reviewing this later.

AI Chat and Trending Narratives remain planned as a **v2 milestone** — the architecture (routes, request/response types, integration point) is already scaffolded, ready to enable if the plan gets upgraded.

---

## Available Endpoints (Free Tier)

| Method | Endpoint | Data Source |
|---|---|---|
| GET | `/api/health` | — |
| GET | `/api/market/trending` | `elfa.getTrendingTokens` |
| GET | `/api/market/sentiment/:token` | `elfa.getKeywordMentions` |
| GET | `/api/market/news` | `elfa.getTokenNews` |
| GET | `/api/market/trending-cas` | `elfa.getTrendingCAsTwitter` |
| GET | `/api/market/stats/:username` | `elfa.getAccountSmartStats` |
| POST | `/api/auth/login` | — |

---

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express
- **Database:** PostgreSQL (Neon) + Kysely
- **Cache:** Redis (Upstash)
- **Queue:** Upstash QStash (serverless-friendly alternative to BullMQ)
- **Auth:** JWT
- **Data Source:** [`@elfa-ai/sdk`](https://github.com/elfa-ai/elfa-sdk-js)
- **Deploy:** Vercel (Serverless Functions)

---

## Related Repos

Part of the `nekosinga` polyrepo:
- [`web`](https://github.com/nekosinga/web) — landing page
- [`app`](https://github.com/nekosinga/app) — main dashboard/product
- [`docs`](https://github.com/nekosinga/docs) — documentation
