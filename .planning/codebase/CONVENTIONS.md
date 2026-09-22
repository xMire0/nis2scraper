# Coding Conventions

**Analysis Date:** 2026-09-22

## Naming Patterns

**Files:**
- Use lowercase kebab case for React components, for example `src/components/lead-detail-drawer.tsx`, and descriptive lowercase names for library modules such as `src/lib/intelligence/cvrbasen.ts`.
- Next.js route handlers follow the framework layout under `src/app/api/**/route.ts`; domain tests may be colocated under `__tests__`.

**Functions:**
- Use camelCase for functions and handlers (`fetchWithRetry`, `parseRevenue`, `scopeCompany`). Prefer named exports for reusable functions.
- React components use PascalCase (`Dashboard`, `LeadTable`) and event callbacks use verbs such as `perform`, `load`, and `choosePriority`.

**Variables:**
- Use camelCase for locals and parameters; constants use camelCase for local values and uppercase for exported fixed maps or rule constants (`CEILINGS`, `RULESET_VERSION`).
- Use short names only for narrow scopes (`e`, `c`, `r`, `tx`); use descriptive names at module boundaries.

**Types:**
- Use PascalCase for interfaces, type aliases, and domain models (`PipelineSummary`, `FetchJsonOptions`, `CsvCompany`).
- Use discriminated unions and literal unions for action/status values; schemas in `src/lib/intelligence/config.ts` and `src/app/api/intelligence/route.ts` define runtime boundaries.

## Code Style

**Formatting:**
- Prettier 3 is a dev dependency, but no repository Prettier config was detected. Match the existing two-space TypeScript style, trailing commas, and multiline formatting in `src/lib/http.ts` and `src/app/api/intelligence/route.ts`.
- Keep JSX props and long function signatures multiline when needed; use semicolons in TypeScript and JSX files.

**Linting:**
- No ESLint configuration or lint script was detected. TypeScript strict checking is the primary static check (`tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`, and `isolatedModules`).

## Import Organization

**Order:**
1. External packages (`zod`, `next/server`, React packages).
2. Node built-ins (`node:crypto`, `node:assert/strict`).
3. Internal aliases and relative modules (`@/lib/...`, then local `./...`).

**Path Aliases:**
- Use `@/*` for `src/*`, configured in `tsconfig.json`; use relative imports in colocated tests such as `tests/cvrbasen.test.ts`.

## Error Handling

**Patterns:**
- Validate external and request data with Zod schemas (`src/lib/env.ts`, `src/lib/intelligence/config.ts`, `src/app/api/intelligence/route.ts`).
- Throw typed application errors for upstream/config/parse failures via `src/lib/errors.ts`; preserve `cause` where an underlying error matters.
- Route handlers catch failures, log a safe message, and return a JSON error with an appropriate HTTP status (`src/app/api/intelligence/route.ts`).
- Use `toErrorMessage` for unknown caught values (`src/lib/errors.ts`) and fail closed for unsafe URLs, robots policies, and invalid input (`src/lib/intelligence/crawler.ts`, `src/lib/intelligence/csv.ts`).

## Logging

**Framework:** Structured console logging through `src/lib/logger.ts`.

**Patterns:**
- Create scoped loggers with `createLogger("scope")`; emit single-line JSON containing timestamp, level, scope, message, and metadata.
- Use `warn` for retryable upstream/network events in `src/lib/http.ts`; route-level failures may use `console.error` when no scoped logger is present.
- Never include credentials or raw secrets in log metadata; environment parsing is server-only in `src/lib/env.ts`.

## Comments

**When to Comment:**
- Comment security, regulatory, retry, and operational rationale, such as the SSRF guard in `src/lib/intelligence/crawler.ts` and the token-bucket rationale in `src/lib/http.ts`.
- Avoid comments that merely restate a statement; preserve concise section comments in rule-heavy modules.

**JSDoc/TSDoc:**
- Use short doc comments for exported infrastructure behavior and constraints (`src/lib/http.ts`, `src/lib/env.ts`). Most business functions rely on types and descriptive names rather than exhaustive JSDoc.

## Function Design

**Size:** Keep pure parsing/rule functions focused (`src/domain/nis2/thresholds.ts`, `src/lib/intelligence/csv.ts`). Route handlers may orchestrate multiple actions, but extract reusable behavior into `src/lib/intelligence/*`.

**Parameters:** Prefer typed object parameters for multi-field domain inputs and options (`FetchJsonOptions`, `ScopeDecisionInput`); use defaults for optional operational settings.

**Return Values:** Return explicit nullable values for absent data (`number | null`, `Company | null`) and structured result objects for partial/failed processing. Preserve status metadata such as `COMPLETE`, `PARTIAL`, and `UNKNOWN` instead of converting uncertainty into a boolean.

## Module Design

**Exports:** Prefer named exports. Keep constants, schemas, types, and functions close together in the module that owns them.

**Barrel Files:** No barrel-file pattern was detected; import directly from the owning module.

---

*Convention analysis: 2026-09-22*
