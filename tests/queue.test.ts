import { test } from "node:test";
import assert from "node:assert/strict";
import { queueStatus, crawlExplanation } from "../src/lib/intelligence/queue";
import { scoreCompany } from "../src/lib/intelligence/scoring";
import { defaultConfig } from "../src/lib/intelligence/config";

test("queue distinguishes running, explicitly queued, paused automation and blocked work", () => {
  const c = {
    autoEnrichmentStep: "OUTREACH",
    autoEnrichmentStartedAt: null as string | null,
    autoEnrichmentQueuedAt: "2026-01-01",
    autoEnrichmentNextAt: "2026-01-01",
    autoEnrichmentError: null as string | null,
  };
  assert.equal(queueStatus(c, false), "I kø · bestilt manuelt");
  assert.equal(
    queueStatus(
      { ...c, autoEnrichmentStartedAt: new Date().toISOString() },
      false,
    ),
    "Kører nu",
  );
  assert.equal(
    queueStatus({ ...c, autoEnrichmentQueuedAt: null }, false),
    "Automatik pauset",
  );
  assert.equal(
    queueStatus({ ...c, autoEnrichmentError: "Budget" }, true),
    "Afventer · se årsag",
  );
  assert.match(
    crawlExplanation("STOP: adgang begrænset (HTTP 403)"),
    /ikke en OpenAI-fejl/,
  );
});
test("ICP requires size, services and actual customer evidence; missing crawl is unknown", () => {
  const company = { employeeMin: 40, employeeMax: 40, employeeCount: 40 };
  const findings = [
    {
      id: "1",
      signal: "services",
      keyword: "cloud",
      excerpt: "Vi leverer cloud til virksomheder.",
      url: "https://example.dk",
    },
    {
      id: "2",
      signal: "customers",
      keyword: "hospital",
      excerpt: "Vi leverer til hospital i Danmark.",
      url: "https://example.dk",
    },
  ];
  assert.equal(
    scoreCompany(company, findings, defaultConfig, "COMPLETE").icp.fit,
    "STRONG",
  );
  assert.equal(
    scoreCompany(company, [], defaultConfig, "PARTIAL").icp.fit,
    "UNKNOWN",
  );
  assert.notEqual(
    scoreCompany(
      { employeeMin: 1000, employeeMax: 1000, employeeCount: 1000 },
      findings,
      defaultConfig,
      "COMPLETE",
    ).icp.fit,
    "STRONG",
  );
});
