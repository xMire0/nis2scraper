import { test } from "node:test";
import { automaticSteps } from "../src/lib/intelligence/automatic-enrichment";
import assert from "node:assert/strict";
import { labelledPhones, companyEmail } from "../src/lib/intelligence/contacts";

test("labelled phones exclude CVR and malformed numbers; shared mail stays on company or approved mail domains", () => {
  assert.deepEqual(labelledPhones("CVR 24256790 · Tlf: +45 23 45 67 89"), [
    "+4523456789",
  ]);
  assert.deepEqual(labelledPhones("Telefon 234567890"), []);
  assert.ok(companyEmail("info@gmail.com", "example.dk"));
  assert.ok(!companyEmail("info@gmail.com", "example.dk", true));
  assert.ok(!companyEmail("jobs@example.dk", "example.dk"));
  assert.ok(!companyEmail("info@webbureau.dk", "example.dk", true));
  const page = extractPage(
    '<main><article><h3>Anna Jensen</h3><p>CEO</p><p>Tlf: 23456789</p><a href="/anna">Anna Jensen</a></article></main><footer><p>Tlf: 23456789</p></footer>',
    "https://example.dk/team",
  );
  assert.deepEqual(page.staffLinks, ["https://example.dk/anna"]);
  assert.equal(deduplicateContacts(page.contacts)[0]?.name, null);
});

test("automatic enrichment defers register calls on budget, provider pause and lease while local steps remain available", () => {
  const now = new Date("2026-09-22T12:00:00Z");
  const state = {
    budgetDay: "2026-09-22",
    requestsToday: 10,
    leaseUntil: null,
    lastError: null,
    nextRunAt: now,
  };
  assert.deepEqual(automaticSteps(state, 10, now), [
    "WEBSITE",
    "ANALYZE",
    "OUTREACH",
  ]);
  assert.ok(
    automaticSteps({ ...state, budgetDay: "2026-09-21" }, 10, now).includes(
      "FINANCIAL",
    ),
  );
  assert.deepEqual(
    automaticSteps(
      {
        ...state,
        requestsToday: 0,
        lastError: "HTTP 429",
        nextRunAt: new Date("2026-09-22T13:00:00Z"),
      },
      10,
      now,
    ),
    ["WEBSITE", "ANALYZE", "OUTREACH"],
  );
  assert.deepEqual(
    automaticSteps(
      {
        ...state,
        requestsToday: 0,
        leaseUntil: new Date("2026-09-22T13:00:00Z"),
      },
      10,
      now,
    ),
    ["WEBSITE", "ANALYZE", "OUTREACH"],
  );
});
import {
  emailDomain,
  websiteCandidates,
  visibleCvrs,
  verifiedWebsite,
} from "../src/lib/intelligence/website";
import {
  staffContacts,
  deduplicateContacts,
  phoneNumber,
} from "../src/lib/intelligence/contacts";
import { extractPage } from "../src/lib/intelligence/crawler";
import {
  currentDirectors,
  latestStatement,
} from "../src/lib/intelligence/enrichment";
import {
  isActiveRegistry,
  registryRequest,
  searchRegistry,
  defaultDiscoveryConfig,
} from "../src/lib/intelligence/cvrbasen";

test("website candidates are hints and identity needs one visible labelled CVR", () => {
  assert.equal(emailDomain("name@gmail.com"), null);
  assert.equal(emailDomain("contact@example.dk"), "example.dk");
  assert.equal(emailDomain("name@localhost"), null);
  assert.deepEqual(websiteCandidates("Blå Ø IT A/S", "example.dk"), [
    "https://example.dk/",
  ]);
  assert.deepEqual(websiteCandidates("Blå Ø IT A/S", null), []);
  assert.deepEqual(visibleCvrs("Telefon 24256790"), []);
  assert.deepEqual(visibleCvrs("CVR nr. DK 24 25 67 90"), ["24256790"]);
  const p = extractPage(
    "<body><main>Tekst</main><footer>CVR: 24256790</footer><div hidden>CVR 10000009</div></body>",
    "https://example.dk/",
  );
  assert.equal(
    verifiedWebsite("24256790", [{ url: "https://example.dk/", cvrs: p.cvrs }])
      ?.url,
    "https://example.dk/",
  );
  assert.equal(
    verifiedWebsite("24256790", [
      { url: "https://wrong.dk", cvrs: ["10000009"] },
    ]),
    undefined,
  );
  assert.equal(
    verifiedWebsite("24256790", [
      { url: "https://group.dk", cvrs: ["24256790", "10000009"] },
    ]),
    undefined,
  );
});
test("named contacts require one nearby name, role and contact; shared phones stay anonymous", () => {
  const person = (name: string) =>
    `<article><h3>${name}</h3><p>Direktør</p><a href="tel:+4512345678">12345678</a><a href="tel:+4523456789">23456789</a><a href="mailto:anna@example.dk">anna@example.dk</a></article>`;
  const one = staffContacts(person("Anna Jensen"), "https://example.dk/team");
  assert.equal(one.length, 2);
  assert.equal(one[0]?.name, "Anna Jensen");
  const two = staffContacts(
    person("Anna Jensen") + person("Peter Hansen"),
    "https://example.dk/team",
  );
  assert.ok(deduplicateContacts(two).every((c) => c.name === null));
  assert.equal(
    deduplicateContacts([...one, { ...one[0]!, name: null, title: null }])[0]
      ?.name,
    null,
  );
  assert.equal(
    staffContacts(
      '<article><h3>Anna Jensen</h3><h3>Peter Hansen</h3>CEO<a href="tel:23456789">23456789</a></article>',
      "https://example.dk/",
    ).length,
    0,
  );
  assert.equal(
    staffContacts(
      '<article hidden><h3>Anna Jensen</h3>CEO<a href="tel:23456789">23456789</a></article>',
      "https://example.dk/",
    ).length,
    0,
  );
  assert.equal(phoneNumber("CVR 24256790"), null);
});
test("statements preserve missing revenue and reject invalid dates; roles must be current", () => {
  const statement = {
    period: { from: "2024-01-01", to: "2024-12-31" },
    published_at: "2025-03-01T00:00:00Z",
    currency: "DKK",
    revenue: null,
    gross_profit: 500000,
    profit: -10000,
  };
  assert.equal(latestStatement([statement])?.revenue, null);
  assert.equal(latestStatement([statement])?.profit, -10000);
  assert.equal(
    latestStatement([{ ...statement, currency: undefined }]),
    undefined,
  );
  assert.equal(
    latestStatement([
      { ...statement, period: { from: "2024-02-30", to: "2024-12-31" } },
    ]),
    undefined,
  );
  assert.equal(
    currentDirectors([
      {
        name: "Anna Jensen",
        role: "Direktør",
        active: true,
        period: { to: null },
      },
      {
        name: "Peter Hansen",
        role: "Direktør",
        active: true,
        period: { to: "2020-01-01" },
      },
    ]).length,
    1,
  );
});
test("both active statuses and documented GET/POST shapes are supported without redirecting secrets", async () => {
  assert.ok(isActiveRegistry("Aktiv"));
  assert.ok(isActiveRegistry("NORMAL"));
  assert.ok(!isActiveRegistry("OPLØST"));
  const previous = process.env.CVRBASEN_API_KEY;
  process.env.CVRBASEN_API_KEY = "test-only";
  try {
    await registryRequest(
      "/companies/24256790/statements",
      undefined,
      async (url, init) => {
        assert.equal(
          String(url),
          "https://api.cvrbasen.dk/v1/companies/24256790/statements",
        );
        assert.equal(init?.method, "GET");
        assert.equal(init?.body, undefined);
        assert.equal(init?.redirect, "error");
        return Response.json({ data: [] });
      },
    );
    await searchRegistry(
      defaultDiscoveryConfig,
      1,
      async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.query.status_eq, "Aktiv");
        assert.equal(body.sorts, "vat ASC");
        return Response.json({ data: [], has_more: false, page: 1 });
      },
      "Aktiv",
    );
    await assert.rejects(() => registryRequest("/people/123"), /Ugyldig/);
  } finally {
    if (previous === undefined) delete process.env.CVRBASEN_API_KEY;
    else process.env.CVRBASEN_API_KEY = previous;
  }
});
