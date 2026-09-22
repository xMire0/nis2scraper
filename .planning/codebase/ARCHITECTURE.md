<!-- refreshed: 2026-09-22 -->
# Architecture

**Analysis Date:** 2026-09-22

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│ Next.js App Router (`src/app`)                              │
│ Pages, client dashboard, and route handlers                  │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐  ┌───────────────────────────┐
│ Intelligence workflow         │  │ NIS2 lead/API workflow     │
│ `src/lib/intelligence`        │  │ `src/domain/nis2`          │
│ import/discover/crawl/score   │  │ `src/services`              │
└──────────────┬───────────────┘  └──────────────┬────────────┘
               │                                  │
               └──────────────┬───────────────────┘
                              ▼
                 ┌──────────────────────────────┐
                 │ Prisma data access            │
                 │ `src/lib/prisma.ts`            │
                 │ PostgreSQL schema/migrations   │
                 │ `prisma/schema.prisma`         │
                 └──────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App Router pages | Render login, dashboard, and root redirect | `src/app/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/login/page.tsx` |
| Intelligence API | CSV import, discovery, enrichment, scoring, outreach and workspace reads | `src/app/api/intelligence/route.ts` |
| Lead API | Filtered lead listing, detail and outreach status transitions | `src/app/api/leads/route.ts`, `src/app/api/leads/[cvr]/route.ts`, `src/app/api/leads/[cvr]/status/route.ts` |
| Intelligence libraries | Discovery, crawling, CSV handling, scoring and outreach domain workflow | `src/lib/intelligence/` |
| NIS2 domain | Sector, size and scope rules with auditable decisions | `src/domain/nis2/` |
| Pipeline services | CVR retrieval, report parsing, scoping and contact enrichment | `src/services/` |
| Persistence | Prisma singleton and relational model | `src/lib/prisma.ts`, `prisma/schema.prisma` |

## Pattern Overview

**Overall:** Next.js App Router application with route handlers acting as application services, shared TypeScript domain/library modules, and Prisma-backed PostgreSQL persistence.

**Key Characteristics:**
- Server route handlers validate input with Zod and perform database orchestration directly.
- Client UI components call JSON route handlers and hold dashboard/filter state in React hooks.
- Company records are the aggregate root for assessments, financials, contacts, enrichment runs, scores and outreach history.
- Long-running work is isolated per company in `src/services/pipeline.ts`, while the active dashboard intelligence flow is exposed by `src/app/api/intelligence/route.ts`.

## Layers

**Presentation:**
- Purpose: Browser pages and reusable UI.
- Location: `src/app/`, `src/components/`
- Contains: App Router pages, client dashboard, feature components, Radix-based UI primitives.
- Depends on: JSON APIs and shared display types.
- Used by: Browser users.

**HTTP/application layer:**
- Purpose: Authenticate requests, parse payloads, query Prisma, and map results to JSON.
- Location: `src/app/api/`
- Contains: Route handlers for intelligence, leads, sessions and prospecting runs.
- Depends on: `src/lib/`, `src/domain/`, `src/services/`, Prisma.
- Used by: Pages and external/manual API callers.

**Domain and workflow layer:**
- Purpose: Apply NIS2 rules and execute discovery/enrichment/scoring workflows.
- Location: `src/domain/nis2/`, `src/lib/intelligence/`, `src/services/`
- Contains: Pure rules, parsers, crawlers, CVR clients, pipeline orchestration and scoring.
- Depends on: Environment configuration, external HTTP/document formats and persistence where orchestration requires it.
- Used by: API handlers and `src/scripts/runPipeline.ts`.

**Persistence/infrastructure:**
- Purpose: Database client, schema and migrations.
- Location: `src/lib/prisma.ts`, `prisma/schema.prisma`, `prisma/migrations/`
- Contains: PostgreSQL models, indexes, relations and Prisma singleton.
- Depends on: `DATABASE_URL` and `DIRECT_URL` environment configuration.
- Used by: Route handlers and service workflows.

## Data Flow

### Dashboard Intelligence Flow

1. `src/app/dashboard/page.tsx` loads `/api/intelligence` and stores the workspace in React state.
2. `src/app/api/intelligence/route.ts` reads companies, enrichment runs, evidence, scores, imports and outreach relations through `src/lib/prisma.ts`.
3. User actions are discriminated by Zod (`discover`, `import`, `analyze`, `update`, `outreach`, `suppress`, etc.) and dispatch to `src/lib/intelligence/discovery.ts`, `crawler.ts`, `scoring.ts`, `outreach.ts`, or transactional Prisma writes.
4. The handler returns JSON and the dashboard reloads after mutating actions.

### Lead/NIS2 Flow

1. `src/app/api/leads/route.ts` parses query filters and builds Prisma relation filters.
2. The newest `Nis2Assessment`, latest `FinancialData`, outreach state and unsuppressed contacts are selected for each company.
3. `src/domain/nis2/thresholds.ts` and `src/domain/nis2/scopeRules.ts` provide deterministic classification primitives; `src/services/nis2Scoper.ts` coordinates assessment creation.
4. The API maps database records into lead and KPI JSON consumed by lead UI components under `src/components/leads/`.

### Prospecting Pipeline Flow

1. `src/app/api/prospecting/run/route.ts` or `src/scripts/runPipeline.ts` invokes `src/services/pipeline.ts`.
2. The service discovers companies through `src/services/cvrService.ts`, upserts `Company`, parses reports with `src/services/xbrlParser.ts`, scopes them, and optionally enriches contacts with `src/services/contactEnricher.ts`.
3. `PipelineRun` and `PipelineEvent` provide run and per-company observability.

**State Management:** React local state controls the dashboard; durable state is in PostgreSQL. Assessments, enrichment runs, evidence and outreach events are append-oriented, with explicit human overrides and suppression fields.

## Key Abstractions

**Company aggregate:** `Company` in `prisma/schema.prisma` links registry data, financials, assessments, contacts, scores and outreach.

**NIS2 assessment:** `Nis2Assessment` stores deterministic inputs/ruleset traces, LLM evidence, conflicts and human overrides.

**Enrichment run:** `EnrichmentRun`, `Evidence` and `LeadScore` model a crawl-and-score execution and its evidence.

**Environment boundary:** `src/lib/env.ts` validates server configuration once and exposes typed settings to services.

## Entry Points

**Web application:** `src/app/layout.tsx` and `src/app/page.tsx` establish the App Router shell and redirect to the dashboard.

**Dashboard:** `src/app/dashboard/page.tsx` is the primary client application.

**API:** Route handlers under `src/app/api/` are Next.js request entry points.

**CLI pipeline:** `src/scripts/runPipeline.ts` is the command entry point, though it currently throws a deactivation error before executing the legacy pipeline.

## Architectural Constraints

- **Runtime:** API routes that access Prisma or Node libraries declare `runtime = "nodejs"`; long-running routes use `maxDuration`.
- **Database lifecycle:** `src/lib/prisma.ts` caches the Prisma client on `globalThis` during development to avoid hot-reload connection exhaustion.
- **Type boundaries:** The `@/*` alias resolves to `src/*`; strict TypeScript and `noUncheckedIndexedAccess` are enabled in `tsconfig.json`.
- **Data integrity:** Company CVR is the natural unique key; relational writes use Prisma transactions for imports and status changes.
- **External I/O:** CVR, annual-report, website and enrichment calls are centralized in service/library modules rather than UI components.

## Anti-Patterns

### Route handlers as broad orchestration modules

**What happens:** `src/app/api/intelligence/route.ts` contains schema definitions, cleanup, imports, discovery and multiple mutation branches in one handler module.
**Why it's wrong:** Changes to one action can affect unrelated API behavior and make route-level testing harder.
**Do this instead:** Keep validation and HTTP mapping in the route and move multi-step actions into focused functions under `src/lib/intelligence/` or `src/services/`.

### Inactive CLI path

**What happens:** `src/scripts/runPipeline.ts` throws before invoking `runPipeline`.
**Why it's wrong:** The documented CLI entry point cannot execute its imported workflow.
**Do this instead:** Treat CSV/manual intelligence flow as the active entry point, or remove/reactivate the legacy command consistently with `src/services/pipeline.ts`.

## Error Handling

**Strategy:** Route handlers catch errors, convert them through `src/lib/errors.ts` where applicable, and return JSON status codes. Pipeline stages isolate per-company errors and persist warning/error events.

**Patterns:**
- Zod parsing produces `400` responses for malformed input.
- Missing records return `404`; database availability failures return `503` in the intelligence workspace route.
- `src/lib/logger.ts` provides structured service logging.

## Cross-Cutting Concerns

**Logging:** `src/lib/logger.ts` and persisted `PipelineEvent` records.
**Validation:** Zod schemas in route handlers and `src/lib/env.ts`.
**Authentication:** Password-derived session token helpers in `src/lib/session.ts`; session endpoint in `src/app/api/session/route.ts`.

---

*Architecture analysis: 2026-09-22*
