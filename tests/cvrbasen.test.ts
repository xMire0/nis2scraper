import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registryCompanySchema,
  latestEmployees,
  exclusionReason,
  defaultDiscoveryConfig,
  discoveryConfigSchema,
  searchRegistry,
  RegistryError,
} from "../src/lib/intelligence/cvrbasen";
const raw = {
  vat: 10000009,
  name: "TEST",
  country_code: "DK",
  status: "NORMAL",
  protected: false,
  industry_code: "620100",
  employees: [
    { year: 2025, month: 12, headcount: 55 },
    { year: 2024, month: 12, headcount: 5 },
  ],
};
test("registry uses newest headcount regardless of array order; unknown newest is not replaced by old data", () => {
  const c = registryCompanySchema.parse(raw);
  assert.equal(latestEmployees(c)?.headcount, 55);
  assert.equal(exclusionReason(c, defaultDiscoveryConfig), null);
  c.employees.push({ year: 2026, month: 1, headcount: null });
  assert.match(exclusionReason(c, defaultDiscoveryConfig)!, /mangler/);
});
test("registry excludes protected, unknown, inactive, foreign, wrong-size and wrong-industry companies", () => {
  for (const patch of [
    { protected: true },
    { protected: null },
    { protected: undefined },
    { country_code: "SE" },
    { status: "OPHØRT" },
    { end_date: "2026-01-01" },
    { industry_code: "999999" },
    { employees: [{ year: 2026, month: 1, headcount: 251 }] },
  ])
    assert.ok(
      exclusionReason(
        registryCompanySchema.parse({ ...raw, ...patch }),
        defaultDiscoveryConfig,
      ),
    );
  assert.equal(
    registryCompanySchema.safeParse({ ...raw, vat: 12345678 }).success,
    false,
  );
  assert.equal(
    registryCompanySchema.safeParse({
      ...raw,
      employees: [{ year: 2026, month: 13, headcount: 50 }],
    }).success,
    false,
  );
});
test("registry strips personal fields and never invents a website", () => {
  const c = registryCompanySchema.parse({
    ...raw,
    email: "person@example.dk",
    executive_management: [{ name: "Person" }],
  });
  assert.equal("email" in c, false);
  assert.equal("executive_management" in c, false);
  assert.equal("website" in c, false);
});
test("discovery settings bound API consumption and validate ranges", () => {
  for (const patch of [
    { maxRequestsPerDay: 0 },
    { maxRequestsPerDay: 101 },
    { intervalMinutes: 1 },
    { industryPrefixes: ["62%"] },
    { minEmployees: 251, maxEmployees: 20 },
  ])
    assert.equal(
      discoveryConfigSchema.safeParse({ ...defaultDiscoveryConfig, ...patch })
        .success,
      false,
    );
});
test("provider adapter uses documented request; redirects cannot leak key; auth and pagination failures stop", async () => {
  const old = process.env.CVRBASEN_API_KEY;
  process.env.CVRBASEN_API_KEY = "test-placeholder";
  try {
    await searchRegistry(defaultDiscoveryConfig, 2, async (url, init) => {
      assert.equal(url, "https://api.cvrbasen.dk/v1/companies/search");
      assert.equal(init?.redirect, "error");
      const q = JSON.parse(String(init?.body));
      assert.equal(q.page, 2);
      assert.equal(q.per_page, 100);
      assert.equal(q.sorts, "vat ASC");
      assert.equal("country_code_eq" in q.query, false);
      assert.equal(q.query.industry_code_start, "62");
      assert.equal("industry_code_matches_any" in q.query, false);
      return Response.json({ data: [raw], has_more: false, page: 2 });
    });
    await assert.rejects(
      () =>
        searchRegistry(
          defaultDiscoveryConfig,
          1,
          async () => new Response(null, { status: 401 }),
        ),
      (e: unknown) => e instanceof RegistryError && e.stop,
    );
    await assert.rejects(
      () =>
        searchRegistry(
          defaultDiscoveryConfig,
          1,
          async () =>
            new Response(null, {
              status: 429,
              headers: { "retry-after": "7200" },
            }),
        ),
      (e: unknown) => e instanceof RegistryError && e.retryMs === 7200000,
    );
    await assert.rejects(
      () =>
        searchRegistry(defaultDiscoveryConfig, 1, async () =>
          Response.json({ data: [], has_more: true, page: 1 }),
        ),
      /paginering/,
    );
    await assert.rejects(
      () =>
        searchRegistry(defaultDiscoveryConfig, 1, async () =>
          Response.json({ data: [raw], has_more: false, page: 2 }),
        ),
      /paginering/,
    );
  } finally {
    if (old === undefined) delete process.env.CVRBASEN_API_KEY;
    else process.env.CVRBASEN_API_KEY = old;
  }
});
