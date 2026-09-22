# External Integrations

**Analysis Date:** 2026-09-22

## APIs & External Services

**Danish company registry:**
- Erhvervsstyrelsen CVR distribution/Elasticsearch - company, industry, status, address, employee, contact, and executive data (`src/services/cvrService.ts`)
  - SDK/Client: native `fetch` through `src/lib/http.ts`
  - Auth: `CVR_API_USERNAME` + `CVR_API_PASSWORD`, or `CVR_API_KEY`, assembled by `src/lib/env.ts`
  - Base URLs: `CVR_API_BASE` and `REGNSKAB_API_BASE`
- CVRbasen - paginated Danish company discovery (`src/lib/intelligence/cvrbasen.ts`)
  - SDK/Client: native `fetch`
  - Auth: `CVRBASEN_API_KEY` as Bearer token
  - Endpoint: `https://api.cvrbasen.dk/v1/companies/search`

**Contact enrichment (optional):**
- Apollo, Hunter, or Dropcontact, selected by `ENRICHMENT_PROVIDER` (`src/services/contactEnricher.ts`)
  - SDK/Client: native `fetch` via shared retry/rate-limit client
  - Auth: `ENRICHMENT_API_KEY`
  - Disabled by default when provider is `none` or key is absent; confidence and rate are configured by `ENRICHMENT_MIN_CONFIDENCE` and `ENRICHMENT_REQUESTS_PER_SECOND`.

**Target website crawling:**
- Public HTTP(S) company websites - HTML, robots.txt, and linked pages (`src/lib/intelligence/crawler.ts`)
  - SDK/Client: Node `fetch`, `cheerio`, `robots-parser`, `node:dns/promises`
  - Auth: none
  - DNS resolution, redirect checks, private-address blocking, response-size and timeout limits are enforced locally.

## Data Storage

**Databases:**
- PostgreSQL 16 (`compose.yaml`)
  - Connection: `DATABASE_URL`; Prisma also supports `DIRECT_URL` for migrations/direct access (`prisma/schema.prisma`)
  - Client: Prisma 6 generated client (`src/lib/prisma.ts`)
  - Schema/migrations: `prisma/schema.prisma`, `prisma/migrations/`

**File Storage:**
- Local PostgreSQL byte/text fields store raw import data and evidence; no object-storage integration detected.
- Uploaded/imported CSV is processed in the application request (`src/app/api/intelligence/route.ts`).

**Caching:**
- In-process module/global caches only: Prisma hot-reload singleton (`src/lib/prisma.ts`), environment cache (`src/lib/env.ts`), and crawler robots cache (`src/lib/intelligence/crawler.ts`). No Redis or hosted cache detected.

## Authentication & Identity

**Auth Provider:**
- Custom shared-password session (`src/app/api/session/route.ts`, `src/lib/session.ts`)
  - `APP_PASSWORD` is hashed into a deterministic SHA-256 HttpOnly/SameSite `nis2-session` cookie.
  - `src/middleware.ts` and route helpers protect application access; `PIPELINE_API_TOKEN` protects the legacy/API pipeline route.
  - No external identity provider, SSO, or user directory detected.

## Monitoring & Observability

**Error Tracking:**
- None detected.

**Logs:**
- Structured application logger in `src/lib/logger.ts`; `src/instrumentation.ts` initializes server instrumentation. Upstream retries/errors include service and status metadata (`src/lib/http.ts`).

## CI/CD & Deployment

**Hosting:**
- No hosting provider integration detected. The documented target is a persistent Node Next.js process plus PostgreSQL (`README.md`).

**CI Pipeline:**
- None detected in repository configuration. Verification is via npm scripts: `npm test`, `npm run typecheck`, and `npm run build` (`package.json`).

## Environment Configuration

**Required env vars:**
- `DATABASE_URL`
- `APP_PASSWORD` for non-local/external access (`src/app/api/session/route.ts`)
- `CVRBASEN_API_KEY` for CVRbasen discovery (`src/lib/intelligence/cvrbasen.ts`)
- CVR distribution credentials (`CVR_API_USERNAME`/`CVR_API_PASSWORD` or `CVR_API_KEY`) when the legacy CVR service is used
- `DIRECT_URL` when Prisma migration/direct connection configuration requires it

**Secrets location:**
- Local `.env` files and deployment environment configuration; secret file contents are intentionally excluded from this audit.

## Webhooks & Callbacks

**Incoming:**
- None detected. Route handlers are synchronous application APIs (`src/app/api/**/route.ts`).

**Outgoing:**
- Outbound HTTPS requests to CVRbasen, Erhvervsstyrelsen CVR/annual-report endpoints, optional enrichment providers, and crawled company websites. No webhook delivery or email sending integration detected; outreach remains drafts in PostgreSQL (`src/lib/intelligence/outreach.ts`).

---

*Integration audit: 2026-09-22*
