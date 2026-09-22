# Testing Patterns

**Analysis Date:** 2026-09-22

## Test Framework

**Runner:**
- Node.js built-in test runner, launched through `tsx` so TypeScript tests can import source directly.
- Config: no Jest/Vitest configuration detected; the command is defined in `package.json`.

**Assertion Library:**
- `node:assert/strict` for equality, deep equality, throws, rejects, and predicate assertions.

**Run Commands:**
```bash
npm test                         # Run tests/*.test.ts
npx tsx src/domain/nis2/__tests__/thresholds.test.ts  # Run the dependency-light domain test
npm run typecheck                # Static TypeScript validation
node tests/api-smoke.mjs         # Run API smoke test against a running app
```

No watch-mode or coverage command is configured in `package.json`.

## Test File Organization

**Location:**
- Integration and service tests live in `tests/` (`tests/access.test.ts`, `tests/cvrbasen.test.ts`, `tests/intelligence.test.ts`).
- Domain tests are colocated under `src/domain/nis2/__tests__/thresholds.test.ts`.
- The end-to-end API smoke script is `tests/api-smoke.mjs`, with CSV input in `tests/fixtures/import.csv`.

**Naming:**
- TypeScript tests use `*.test.ts`; the executable smoke script uses `api-smoke.mjs`.

**Structure:**
```
tests/
├── access.test.ts
├── cvrbasen.test.ts
├── intelligence.test.ts
├── api-smoke.mjs
└── fixtures/import.csv
src/domain/nis2/__tests__/thresholds.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";

test("describes the behavior and security invariant", async () => {
  const result = await operation();
  assert.equal(result.status, "EXPECTED");
  assert.ok(result.items.length > 0);
});
```

**Patterns:**
- Use one behavior-focused `test(...)` per scenario, with descriptive assertions covering both happy paths and boundaries (`tests/intelligence.test.ts`).
- Build small local fixtures/helpers for repeated test inputs, such as `finding(...)` and `fixture(...)` in `tests/intelligence.test.ts`.
- Use `try/finally` to restore process environment mutations (`tests/access.test.ts`, `tests/cvrbasen.test.ts`).
- The domain threshold file is a plain assertion script without `test(...)`, intentionally runnable with minimal dependencies.

## Mocking

**Framework:** Node functions and dependency injection; no mocking library is configured.

**Patterns:**
```typescript
const f = fixture({
  "/robots.txt": { status: 200, body: "User-agent: *\\nDisallow: /" },
});
const result = await crawl(url, config, {
  request: f.request,
  pause: async () => {},
});
```

Tests inject request functions into `searchRegistry` and `crawl`, use `Response` objects for upstream responses, and call middleware with real `NextRequest` instances (`tests/cvrbasen.test.ts`, `tests/intelligence.test.ts`, `tests/access.test.ts`).

**What to Mock:**
- Mock network boundaries, timers/pauses, and environment values when testing retry, robots, rate-limit, and authentication behavior.

**What NOT to Mock:**
- Keep pure parsers, scoring, URL checks, and NIS2 rules real; use actual `zod` schemas and real `Response`/`NextRequest` objects.

## Fixtures and Factories

**Test Data:**
```typescript
const raw = {
  vat: 10000009,
  name: "TEST",
  country_code: "DK",
  status: "NORMAL",
  protected: false,
  industry_code: "620100",
  employees: [{ year: 2025, month: 12, headcount: 55 }],
};
```

**Location:**
- Inline fixtures are preferred for focused unit/service scenarios; reusable HTTP/import data is stored in `tests/fixtures/import.csv`.

## Coverage

**Requirements:** No coverage target or enforcement was detected.

**View Coverage:** No configured command. Use the test runner/tooling directly if a temporary coverage report is needed.

## Test Types

**Unit Tests:**
- Pure domain and parsing behavior: `src/domain/nis2/__tests__/thresholds.test.ts`, and parser/scoring/crawler assertions in `tests/intelligence.test.ts`.

**Integration Tests:**
- Middleware security and external adapter behavior with injected dependencies: `tests/access.test.ts`, `tests/cvrbasen.test.ts`.

**E2E Tests:**
- API smoke flow against a running Next.js server: `tests/api-smoke.mjs`. It verifies import, duplicate handling, persistence, update/analyze/outreach workflow, settings, CSRF, disabled legacy endpoints, and cleanup of disposable records.

## Common Patterns

**Async Testing:**
```typescript
await assert.rejects(
  () => searchRegistry(config, 1, async () => new Response(null, { status: 401 })),
  (e: unknown) => e instanceof RegistryError && e.stop,
);
```

Use `async` tests and `assert.rejects` for promises; use `assert.throws` for synchronous parsers and validators.

**Error Testing:**
- Assert typed error classes and flags (`RegistryError`, `retryMs`, `stop`) where callers depend on them.
- Assert fail-closed behavior for SSRF/private IPs, redirects, missing origins, invalid credentials, malformed CSV, and uncertain business data (`tests/access.test.ts`, `tests/cvrbasen.test.ts`, `tests/intelligence.test.ts`).
- Prefer checking stable status codes, result states, and security invariants over exact incidental error text.

---

*Testing analysis: 2026-09-22*
