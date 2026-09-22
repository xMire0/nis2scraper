# Technology Stack

**Analysis Date:** 2026-09-22

## Languages

**Primary:**
- TypeScript 5.7 (`src/**/*.ts`, `src/**/*.tsx`) - application, API routes, domain rules, scripts, and UI
- CSS (`src/app/globals.css`, Tailwind classes) - presentation

**Secondary:**
- JavaScript (`next.config.js`, `postcss.config.js`) - build configuration
- SQL (`prisma/migrations/**/*.sql`) - PostgreSQL migrations

## Runtime

**Environment:**
- Node.js 22 (documented requirement in `README.md`)
- Browser runtime for React client components

**Package Manager:**
- npm (`package-lock.json`)
- Lockfile: present

## Frameworks

**Core:**
- Next.js 15.2 - App Router pages, server components, route handlers, and middleware (`src/app`, `src/middleware.ts`)
- React 19 - UI components and client interactions (`src/components`, `src/app`)
- TypeScript strict mode - type checking (`tsconfig.json`)

**Testing:**
- Node test runner with `tsx` TypeScript loader (`package.json`, `tests/*.test.ts`)

**Build/Dev:**
- Prisma 6.16 - schema, migrations, generated client (`prisma/schema.prisma`, `src/lib/prisma.ts`)
- Tailwind CSS 3.4, PostCSS, Autoprefixer - styling (`tailwind.config.ts`, `postcss.config.js`)
- Prettier 3.9 - formatting dependency
- Docker Compose - local PostgreSQL (`compose.yaml`)

## Key Dependencies

**Critical:**
- `@prisma/client` 6.16 - PostgreSQL access and transactions
- `zod` 3.24 - environment, API payload, CSV, and upstream response validation
- `next` 15.2, `react` 19 - web application runtime
- `cheerio` 1.2 - HTML parsing for website enrichment (`src/lib/intelligence/crawler.ts`)
- `fast-xml-parser` 5.11 - XBRL/iXBRL parsing (`src/services/xbrlParser.ts`)
- `pdf-parse` 1.1 - PDF annual-report fallback extraction
- `csv-parse` 7.0 - CSV import parsing

**Infrastructure:**
- `p-limit` - bounded concurrent work
- `robots-parser`, `ipaddr.js` - crawler policy and SSRF/private-address checks
- Radix UI packages, `@tanstack/react-table`, `lucide-react` - dashboard controls, tables, and icons
- `clsx`, `tailwind-merge`, `class-variance-authority` - class composition

## Configuration

**Environment:**
- Server configuration is parsed and cached by `src/lib/env.ts` using Zod.
- Required `DATABASE_URL`; optional CVR distribution, enrichment, and rate-limit settings are defined in `src/lib/env.ts`.
- Runtime authentication/discovery settings additionally read `APP_PASSWORD`, `PIPELINE_API_TOKEN`, and `CVRBASEN_API_KEY` in route/service code.
- `.env*` files may exist for local configuration; values are secret and are not documented here.

**Build:**
- `next.config.js` sets `.next-dev` for development and externalizes Prisma/XML/PDF packages.
- `tsconfig.json` enables strict checks and the `@/*` alias to `src/*`.
- `tailwind.config.ts`, `postcss.config.js` configure CSS processing.

## Platform Requirements

**Development:**
- Node.js 22, npm, and Docker Desktop/Compose; PostgreSQL 16 is supplied by `compose.yaml`.

**Production:**
- A persistent Node.js Next server with PostgreSQL and environment secrets. The minute-based discovery loop requires a persistent process; serverless deployment needs an external worker/scheduler (`README.md`, `src/lib/intelligence/discovery.ts`).

---

*Stack analysis: 2026-09-22*
