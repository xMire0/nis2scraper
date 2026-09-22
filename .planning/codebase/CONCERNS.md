# Codebase Concerns

**Analysis Date:** 2026-09-22

## Tech Debt

**Legacy pipeline and API surface:**
- Issue: The old lead and prospecting routes remain in the repository while middleware permanently returns `410`; `src/scripts/runPipeline.ts` also intentionally throws and tells users to use the dashboard. This leaves dead code and duplicated models/services that future changes can accidentally update inconsistently.
- Files: `src/middleware.ts`, `src/app/api/leads/route.ts`, `src/app/api/leads/[cvr]/route.ts`, `src/app/api/leads/[cvr]/status/route.ts`, `src/app/api/prospecting/run/route.ts`, `src/scripts/runPipeline.ts`, `src/services/pipeline.ts`
- Impact: Confusing operational surface, larger attack and maintenance surface, and no reliable indication which pipeline is supported.
- Fix approach: Remove or isolate retired routes/services after confirming no external caller depends on them; keep one documented entry path and one data model.

**Monolithic intelligence handler:**
- Issue: A single 600-line handler implements import, discovery, settings, deletion, crawling, scoring, suppression, outreach, and status mutation.
- Files: `src/app/api/intelligence/route.ts`
- Impact: Changes are hard to review and test; unrelated actions share error handling and transaction assumptions.
- Fix approach: Split actions into focused route modules/services with action-specific authorization, validation, and tests.

## Known Bugs

**Process-local login throttling:**
- Symptoms: Ten failed attempts are tracked only in one Node process under the constant key `"shared"`.
- Files: `src/app/api/session/route.ts`
- Trigger: Multiple instances, restarts, or an attacker distributing requests across workers reset or bypass the lockout.
- Workaround: Use a reverse proxy/WAF limit until throttling is backed by shared durable storage.

**Background pipeline can disappear:**
- Symptoms: `async: true` returns `202` while work is launched with `void runPipeline(...)` inside the request process.
- Files: `src/app/api/prospecting/run/route.ts`
- Trigger: Serverless/container shutdown immediately after the response.
- Workaround: Use synchronous mode or run the pipeline from a worker/cron until a durable queue exists.

## Security Considerations

**Sensitive source and enrichment data has broad retention:**
- Risk: Original imports are stored indefinitely in `ImportBatch.rawCsv`; provider responses containing personal data are persisted in `ContactPerson.enrichmentRaw`. Only public contacts receive expiry cleanup.
- Files: `prisma/schema.prisma`, `src/app/api/intelligence/route.ts`, `src/services/contactEnricher.ts`, `src/services/pipeline.ts`
- Current mitigation: Public contacts expire; suppression hashes are retained; company deletion cascades related rows.
- Recommendations: Define retention/deletion jobs for raw imports, provider payloads, evidence, and stale runs; minimize stored provider fields and audit access/deletion.

**Client-visible internal error details:**
- Risk: The catch-all in the intelligence route returns `e.message`, which can include upstream, parser, database, or URL details.
- Files: `src/app/api/intelligence/route.ts`, `src/lib/http.ts`, `src/lib/intelligence/crawler.ts`
- Current mitigation: Some GET paths return generic messages and logs are server-side.
- Recommendations: Return stable public error codes/messages and log detailed causes server-side; explicitly redact URLs, response bodies, and identifiers.

**Shared-password authentication is not a multi-user identity system:**
- Risk: One deterministic SHA-256 cookie token represents every user and there are no roles, CSRF token, audit actor identity, or session revocation store.
- Files: `src/lib/session.ts`, `src/app/api/session/route.ts`, `src/middleware.ts`, `src/app/api/intelligence/route.ts`
- Current mitigation: HttpOnly/SameSite cookie, same-origin mutation check, and production refusal without `APP_PASSWORD`.
- Recommendations: Use a real identity/session provider for shared hosting, add actor identity and authorization checks to destructive actions, and rotate/revoke sessions centrally.

## Performance Bottlenecks

**Oversized dashboard read:**
- Problem: Every intelligence GET loads up to 2,000 companies with nested scores, five runs, 120 evidence rows, all public contacts, drafts, and 20 outreach history rows.
- Files: `src/app/api/intelligence/route.ts`
- Cause: One snapshot query is used for the entire dashboard and returns large JSON graphs with no pagination or field selection for nested data.
- Improvement path: Paginate companies, select only visible fields, load drawer details on demand, and add measured indexes/query plans.

**Import is row-at-a-time inside a long transaction:**
- Problem: Import builds a full in-memory company set, then performs individual company lookups/creates and import-row inserts for every CSV row.
- Files: `src/app/api/intelligence/route.ts`, `src/lib/intelligence/csv.ts`
- Cause: Sequential Prisma operations and a 60-second transaction timeout.
- Improvement path: Bound batches, use bulk inserts/upserts, and make the import asynchronous with progress state.

**Discovery repeats per-company queries:**
- Problem: Each CVRbasen result performs a `findUnique` followed by updates and related deletions, all inside one transaction.
- Files: `src/lib/intelligence/discovery.ts`
- Cause: No prefetch/upsert batching for pages of up to 100 companies.
- Improvement path: Prefetch existing CVRs, batch writes, and measure lock duration under repeated pages.

## Fragile Areas

**Crawler network boundary:**
- Files: `src/lib/intelligence/crawler.ts`
- Why fragile: It manually combines DNS pinning, IP classification, redirects, robots policy, response-size limits, content parsing, and cooldown state. Small URL/DNS/redirect changes can reintroduce SSRF or crawl-policy regressions.
- Safe modification: Preserve the resolved-address pinning and same-host checks; add tests for DNS rebinding, IPv4-mapped IPv6, redirects, non-HTML responses, and timeout/error cleanup before changing transport code.
- Test coverage: Core happy paths and several private ranges are covered in `tests/intelligence.test.ts`; real DNS/TLS behavior and response-stream failures are not.

**Database retention/deletion semantics:**
- Files: `src/app/api/intelligence/route.ts`, `src/lib/intelligence/discovery.ts`, `prisma/schema.prisma`
- Why fragile: Deleting a company also deletes linked import batches based on any linked row, which may remove an entire batch containing other companies; suppression behavior differs between public contacts and `ContactPerson` records.
- Safe modification: Define ownership rules for batch/raw data, delete only rows exclusively owned by the target, and add transactional integration tests.
- Test coverage: No database-backed tests cover delete, suppression, cascade, or concurrent import behavior.

## Scaling Limits

**In-memory dashboard and browser state:**
- Current capacity: Intelligence import explicitly permits at most 2,000 companies; the dashboard fetches the full snapshot and renders it client-side.
- Limit: Payload size, browser render cost, and Prisma nested query cost grow with every company and evidence/contact history row.
- Scaling path: Server-side filtering/pagination, virtualized tables, and separate summary/detail endpoints.

**Single advisory-lock discovery worker:**
- Current capacity: One `DiscoveryState` lease and one CVRbasen page/request per run.
- Limit: A slow or abandoned lease blocks discovery for two minutes; provider budget is tracked in one database row and resets at UTC midnight.
- Scaling path: Durable job queue with lease heartbeats, retry state, and provider-specific quota accounting.

## Dependencies at Risk

**Provider and registry contracts:**
- Risk: CVRbasen, Virk distribution, Apollo/Hunter/Dropcontact, and website formats are external contracts with schema/rate-limit drift; provider raw response shapes are only TypeScript interfaces.
- Impact: Silent missing contacts, stale company fields, or failed discovery/enrichment when providers change.
- Migration plan: Add contract fixtures/contract tests, schema validation at each boundary, provider health metrics, and a clear fallback/disable state.

## Missing Critical Features

**Operational observability and durable job control:**
- Problem: Long crawl/discovery/enrichment work is request-bound, and there is no durable queue, cancellation, retry dashboard, alerting, or metrics for upstream failures and spend.
- Blocks: Reliable production scheduling and safe recovery from process restarts or partial runs.

**Audit-grade authorization:**
- Problem: Destructive actions and outreach drafts record `"Dashboard"`/no actor rather than an authenticated user identity.
- Blocks: Accountability, per-user permissions, and defensible GDPR/operational audit trails.

## Test Coverage Gaps

**API and persistence flows:**
- What's not tested: `/api/intelligence` actions, Prisma transactions, import batch deletion, retention cleanup, concurrent crawl locks, and error response redaction.
- Files: `src/app/api/intelligence/route.ts`, `prisma/schema.prisma`, `tests/api-smoke.mjs`
- Risk: Regressions can delete unrelated data, leave stale locks/runs, or expose internal errors without unit-test detection.
- Priority: High

**Authentication and legacy endpoint authorization:**
- What's not tested: Login rate limiting across workers, cookie invalidation/expiry, missing `PIPELINE_API_TOKEN` behavior, and direct route behavior behind/beyond middleware.
- Files: `src/app/api/session/route.ts`, `src/app/api/prospecting/run/route.ts`, `src/middleware.ts`, `tests/access.test.ts`
- Risk: Deployment-specific access-control failures and accidental exposure when middleware matchers or route wiring change.
- Priority: High

**External integrations and provider failures:**
- What's not tested: Apollo/Hunter/Dropcontact response validation, retries, malformed payloads, enrichment retention, and Virk/XBRL parser edge cases.
- Files: `src/services/contactEnricher.ts`, `src/services/cvrService.ts`, `src/services/xbrlParser.ts`, `src/lib/http.ts`
- Risk: Paid calls, PII corruption, and stale/incorrect lead data can fail silently.
- Priority: Medium

---

*Concerns audit: 2026-09-22*
