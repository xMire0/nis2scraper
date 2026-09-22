# Codebase Structure

**Analysis Date:** 2026-09-22

## Directory Layout

```text
nis2-platform 2/
├── src/app/                 # App Router pages and API route handlers
├── src/components/          # Dashboard, lead and shared UI components
├── src/domain/nis2/         # Pure NIS2 sectors, thresholds and scope rules
├── src/lib/                 # Infrastructure, types, utilities and intelligence modules
├── src/services/             # CVR/report/scoping/enrichment pipeline services
├── src/scripts/              # CLI entry points
├── prisma/                  # Schema and database migrations
├── tests/                   # Node test files
├── public/                  # Static assets
├── docs/                    # Project documentation
├── compose.yaml             # Local PostgreSQL orchestration
├── next.config.js           # Next.js runtime/build configuration
└── package.json             # Scripts and dependencies
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router surface.
- Contains: `layout.tsx`, root/login/dashboard pages, and API route directories.
- Key files: `src/app/api/intelligence/route.ts`, `src/app/api/leads/route.ts`, `src/app/dashboard/page.tsx`.

**`src/components/`:**
- Purpose: Reusable browser UI.
- Contains: Intelligence feature components, lead workflow components, and primitives under `src/components/ui/`.
- Key files: `src/components/leads/lead-table.tsx`, `src/components/leads/lead-detail-drawer.tsx`, `src/components/intelligence-detail.tsx`.

**`src/domain/nis2/`:**
- Purpose: Framework-independent NIS2 classification logic.
- Contains: `sectors.ts`, `thresholds.ts`, `scopeRules.ts`, and colocated tests.
- Key files: `src/domain/nis2/scopeRules.ts`, `src/domain/nis2/thresholds.ts`.

**`src/lib/`:**
- Purpose: Shared application infrastructure and feature libraries.
- Contains: Prisma, environment/session/logging helpers, DTO types, and `src/lib/intelligence/` modules for CSV, discovery, crawling, scoring and outreach.
- Key files: `src/lib/prisma.ts`, `src/lib/env.ts`, `src/lib/intelligence/config.ts`.

**`src/services/`:**
- Purpose: External source clients and multi-stage data workflows.
- Contains: `cvrService.ts`, `xbrlParser.ts`, `nis2Scoper.ts`, `contactEnricher.ts`, and `pipeline.ts`.

**`prisma/`:**
- Purpose: Relational persistence contract.
- Contains: `schema.prisma` and timestamped migrations under `prisma/migrations/`.

## Key File Locations

**Entry Points:**
- `src/app/page.tsx`: Root redirect.
- `src/app/dashboard/page.tsx`: Main browser workspace.
- `src/app/api/intelligence/route.ts`: Intelligence API.
- `src/scripts/runPipeline.ts`: CLI pipeline entry point.

**Configuration:**
- `package.json`: Scripts and dependencies.
- `tsconfig.json`: Strict TypeScript settings and `@/*` alias.
- `next.config.js`: Next.js output/runtime settings.
- `src/lib/env.ts`: Validated server environment schema.
- `prisma/schema.prisma`: Database contract.

**Core Logic:**
- `src/domain/nis2/`: NIS2 decision rules.
- `src/lib/intelligence/`: Active discovery and lead intelligence workflow.
- `src/services/pipeline.ts`: Legacy/end-to-end CVR pipeline orchestration.

**Testing:**
- `src/domain/nis2/__tests__/thresholds.test.ts`: Colocated domain tests.
- `tests/`: Broader Node test files run by the `test` package script.

## Naming Conventions

**Files:**
- Use lowercase kebab-case for route/page and component modules, for example `lead-detail-drawer.tsx` and `runPipeline.ts` for the CLI exception.
- Use descriptive feature names grouped by directory (`src/components/leads/`, `src/lib/intelligence/`).

**Directories:**
- Next.js route segments use lowercase names and dynamic segments use bracket syntax, such as `src/app/api/leads/[cvr]/`.
- Domain tests are colocated in `__tests__` directories.

**Code symbols:**
- Functions and variables use camelCase; React components and types use PascalCase; constants use uppercase where they represent labels or enums.

## Where to Add New Code

**New Feature:**
- Primary page/API: add the route under `src/app/` and keep HTTP validation/mapping in its route handler.
- Domain/workflow: add focused modules under `src/domain/nis2/`, `src/lib/intelligence/`, or `src/services/` according to whether logic is pure rules, intelligence workflow, or external/persistent orchestration.
- Tests: colocate pure domain tests under `src/domain/nis2/__tests__/`; add integration-style Node tests under `tests/`.

**New Component/Module:**
- Implementation: use `src/components/<feature>/` for feature UI and `src/components/ui/` only for reusable primitives.

**Utilities:**
- Shared helpers: use `src/lib/` and keep server-only helpers such as Prisma, environment and session code out of client components.

## Special Directories

**`prisma/migrations/`:**
- Purpose: Applied PostgreSQL schema migrations.
- Generated: Prisma-generated migration content; committed: Yes.

**`.next/` and `.next-dev/`:**
- Purpose: Next.js build/development output.
- Generated: Yes; committed: No.

**`node_modules/`:**
- Purpose: Installed dependencies.
- Generated: Yes; committed: No.

**`.planning/codebase/`:**
- Purpose: GSD architecture, structure, quality and concern maps.
- Generated: By mapping workflow; committed: Intended project documentation.

---

*Structure analysis: 2026-09-22*
