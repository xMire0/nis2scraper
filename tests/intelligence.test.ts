import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readCsv,
  parseEmployees,
  parseRevenue,
  validCvr,
  websiteUrl,
} from "../src/lib/intelligence/csv";
import { defaultConfig, configSchema } from "../src/lib/intelligence/config";
import {
  scoreCompany,
  containsKeyword,
  type Finding,
} from "../src/lib/intelligence/scoring";
import {
  publicIp,
  allowedUrl,
  extractPage,
  crawl,
  type requestPublic,
} from "../src/lib/intelligence/crawler";
import { makeOutreach } from "../src/lib/intelligence/outreach";
const cvr = "10000009";
const company = { employeeCount: 70, employeeMin: 70, employeeMax: 70 };
const finding = (
  signal: string,
  excerpt: string,
  url = "https://example.dk/cases",
): Finding => ({
  id: signal,
  url,
  excerpt,
  signal,
  keyword:
    defaultConfig.groups
      .find((g) => g.id === signal)
      ?.keywords.find((k) => containsKeyword(excerpt, k)) ??
    excerpt.split(" ")[0]!,
});
test("CVR checksum and normalization reject invented or damaged identifiers", () => {
  assert.equal(validCvr(cvr), true);
  assert.equal(validCvr("00000000"), false);
  assert.equal(validCvr("12345678"), false);
  assert.equal(validCvr("1e700009"), false);
});
test("employee ranges preserve endpoints and Danish money preserves units", () => {
  assert.deepEqual(parseEmployees("50–99"), { min: 50, max: 99 });
  assert.equal(parseRevenue("12.500.000,50"), 12500000.5);
  assert.equal(parseRevenue(""), null);
  assert.throws(() => parseEmployees("99-50"));
  assert.throws(() => parseRevenue("12 mio."));
  assert.throws(() => parseRevenue("-100"));
});
test("CSV handles BOM, quoted delimiters, repeated CVRs and invalid rows", () => {
  const p = readCsv(
    `\ufeffCVR;Navn;Ansatte;Omsætning\n${cvr};"Eksempel; IT";50-99;12.500.000\n${cvr};Dublet;30;1\n12345678;Fejl;10;1`,
  );
  assert.equal(p.rows.length, 3);
  assert.equal(p.rows[0]?.company?.name, "Eksempel; IT");
  assert.equal(p.rows[0]?.company?.employeeMax, 99);
  assert.equal(p.rows[1]?.outcome, "DUPLICATE");
  assert.equal(p.rows[2]?.outcome, "INVALID");
});
test("column mapping and Danish target validation work", () => {
  const csv = `VAT,Company,Nation\n${cvr},Test,SE`;
  assert.equal(readCsv(csv).needsMapping, true);
  assert.equal(
    readCsv(csv, { cvr: "VAT", name: "Company", country: "Nation" }).rows[0]
      ?.outcome,
    "INVALID",
  );
  assert.throws(() => readCsv("CVR;CVR\n1;2"));
  assert.throws(() => websiteUrl("https://user:pass@example.com"));
});
test("keywords match whole words, not unrelated substrings", () => {
  assert.equal(containsKeyword("smart automation", "art"), false);
  assert.equal(containsKeyword("Vores cloud-løsning", "cloud"), true);
  assert.equal(containsKeyword("NIS2 og DORA", "NIS2"), true);
});
test("score uses evidence groups once; customer evidence and direct relevance stay separate", () => {
  const e = [
    finding("customers", "Vi leverer til hospitaler."),
    finding("services", "Softwareudvikling og ERP."),
  ];
  const a = scoreCompany(company, e, defaultConfig, "COMPLETE");
  const b = scoreCompany(company, [...e, ...e], defaultConfig, "COMPLETE");
  assert.equal(a.value, 75);
  assert.equal(a.value, b.value);
  assert.equal(a.priority, "A");
  assert.equal(a.relevance, "SUPPLY");
  assert.equal(a.directLevel, "LOW");
  assert.equal(a.supplyLevel, "HIGH");
  assert.ok(a.evidenceIds.length <= 3);
});
test("missing data never becomes a confident negative or legal scope verdict", () => {
  const s = scoreCompany(
    { employeeCount: null, employeeMin: null, employeeMax: null },
    [],
    defaultConfig,
    "PARTIAL",
  );
  assert.equal(s.relevance, "REVIEW");
  assert.equal(s.directLevel, "UNKNOWN");
  assert.equal(s.supplyLevel, "UNKNOWN");
  assert.equal(s.breakdown.length, 0);
});
test("large enterprises are capped at C; uncertified mentions do not become scope", () => {
  const e = [
    finding("customers", "Vi leverer til kommuner"),
    finding("services", "cloud"),
    finding("security", "ISO 27001"),
  ];
  const s = scoreCompany(
    { employeeCount: 500, employeeMin: 500, employeeMax: 500 },
    e,
    defaultConfig,
    "COMPLETE",
  );
  assert.ok(["C", "D"].includes(s.priority));
  assert.equal(s.directLevel, "LOW");
});
test("local rules reject negated and hypothetical claims without external qualification", () => {
  const e = [
    finding("customers", "Vi leverer ikke til hospitaler"),
    finding("services", "software"),
  ];
  const s = scoreCompany(company, e, defaultConfig, "COMPLETE");
  assert.equal(s.supplyLevel, "LOW");
  assert.equal(s.value, 45);
  assert.equal(
    scoreCompany(
      company,
      [finding("customers", "Hospitaler er et hypotetisk eksempel")],
      defaultConfig,
      "COMPLETE",
    ).supplyLevel,
    "LOW",
  );
});
test("unsafe IP ranges, mapped addresses and cross-domain redirects are denied", () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "192.168.1.2",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "0.0.0.0",
    "100.64.0.1",
  ])
    assert.equal(publicIp(ip), false, ip);
  assert.equal(publicIp("93.184.216.34"), true);
  assert.throws(() => allowedUrl("https://elsewhere.dk", "example.dk"));
  assert.throws(() => allowedUrl("file:///etc/passwd", "example.dk"));
  assert.throws(() => allowedUrl("https://example.dk/login", "example.dk"));
  assert.equal(
    allowedUrl("https://www.example.dk/cases", "example.dk").hostname,
    "www.example.dk",
  );
});
test("visible extraction keeps navigation links but excludes hidden text and personal mailboxes", () => {
  const page = extractPage(
    '<html><body><nav><a href="/referencer">Referencer</a></nav><main><p>Vi leverer cloud til kommuner.</p><p hidden>Secret</p><script>malicious()</script><a href="mailto:info@example.dk">info@example.dk</a><a href="mailto:anna@example.dk">Anna</a></main></body></html>',
    "https://example.dk/",
  );
  assert.deepEqual(page.links, ["https://example.dk/referencer"]);
  assert.equal(page.contacts.length, 1);
  assert.equal(page.contacts[0]?.value, "info@example.dk");
  assert.ok(!page.text.includes("Secret"));
  assert.ok(!page.text.includes("malicious"));
  assert.ok(!page.text.includes("info@example.dk"));
});
const html =
  '<html><body><nav><a href="/cases">Cases</a><a href="/kontakt">Kontakt</a></nav><main><p>' +
  "Vi leverer softwareudvikling og cloud til kommuner og hospitaler. ".repeat(
    8,
  ) +
  "</p></main></body></html>";
function fixture(
  responses: Record<
    string,
    { status: number; body: string; headers?: Record<string, string> }
  >,
) {
  const calls: string[] = [];
  const request: typeof requestPublic = async (u) => {
    calls.push(u.pathname);
    const r = responses[u.pathname];
    if (!r) throw new Error("Unexpected URL: " + u.pathname);
    return {
      status: r.status,
      body: r.body,
      headers: r.headers ?? { "content-type": "text/html" },
    };
  };
  return { calls, request };
}
test("robots disallow prevents requesting website content", async () => {
  const f = fixture({
    "/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /" },
  });
  const r = await crawl("https://example.dk/", defaultConfig, {
    request: f.request,
    pause: async () => {},
  });
  assert.deepEqual(f.calls, ["/robots.txt"]);
  assert.equal(r.pages[0]?.status, "BLOCKED");
  assert.equal(r.evidence.length, 0);
});
test("rate-limit response stops the crawl before remaining queued links", async () => {
  const f = fixture({
    "/robots.txt": { status: 404, body: "" },
    "/": { status: 200, body: html },
    "/cases": { status: 429, body: "" },
  });
  const r = await crawl("https://example.dk/", defaultConfig, {
    request: f.request,
    pause: async () => {},
  });
  assert.deepEqual(f.calls, ["/robots.txt", "/", "/cases"]);
  assert.equal(r.coverage, "PARTIAL");
});
test("successful bounded crawl creates source-backed findings", async () => {
  const f = fixture({
    "/robots.txt": { status: 404, body: "" },
    "/": { status: 200, body: html },
    "/cases": { status: 200, body: html },
    "/kontakt": { status: 200, body: html },
  });
  const r = await crawl(
    "https://example.dk/",
    { ...defaultConfig, maxPages: 2 },
    { request: f.request, pause: async () => {} },
  );
  assert.equal(r.pages.length, 2);
  assert.equal(r.coverage, "COMPLETE");
  assert.ok(r.evidence.length > 0);
  assert.ok(
    r.evidence.every((e) => e.url && e.excerpt && e.contentHash && e.fetchedAt),
  );
});
test("unavailable robots fails closed", async () => {
  const f = fixture({ "/robots.txt": { status: 503, body: "" } });
  const r = await crawl("https://example.dk/", defaultConfig, {
    request: f.request,
    pause: async () => {},
  });
  assert.equal(r.evidence.length, 0);
  assert.deepEqual(f.calls, ["/robots.txt"]);
});
test("all outreach formats avoid definitive scope claims and use sender configuration", () => {
  for (const channel of ["EMAIL", "PHONE", "LINKEDIN", "WEBINAR"]) {
    const text = makeOutreach(channel, { name: "Test ApS" }, null, {
      senderName: "Testperson",
      senderCompany: "Testkonsulent",
    });
    assert.ok(!text.includes("er omfattet"));
    assert.ok(!text.includes("falder efter min vurdering ind under NIS2"));
    assert.ok(text.includes("Testkonsulent"));
    assert.ok(/gratis/i.test(text));
  }
});
test("settings reject reversed boundaries and unsafe crawler limits", () => {
  assert.equal(configSchema.safeParse(defaultConfig).success, true);
  assert.equal(
    configSchema.safeParse({ ...defaultConfig, delayMs: 0 }).success,
    false,
  );
  assert.equal(
    configSchema.safeParse({ ...defaultConfig, priorityA: 20 }).success,
    false,
  );
});

test("Retry-After is carried forward as a persistent domain cooldown", async () => {
  const f = fixture({
    "/robots.txt": { status: 404, body: "" },
    "/": { status: 429, body: "", headers: { "retry-after": "120" } },
  });
  const result = await crawl("https://example.dk/", defaultConfig, {
    request: f.request,
    pause: async () => {},
  });
  assert.equal(result.cooldownMs, 120000);
});

test("HTML block boundaries preserve keyword boundaries", () => {
  const page = extractPage(
    "<html><body><main><h1>Cloud</h1><p>Software til virksomheder</p></main></body></html>",
    "https://example.dk/",
  );
  assert.ok(containsKeyword(page.text, "cloud"));
  assert.ok(containsKeyword(page.text, "software"));
});

test("staff profile crawl is same-domain and capped at twelve extra pages", async () => {
  const profiles = Array.from({ length: 15 }, (_, i) => `/person-${i}`);
  const team =
    profiles
      .map((path) => `<article><a href="${path}">Anna Jensen</a></article>`)
      .join("") +
    '<article><a href="https://foreign.dk/person">Peter Hansen</a></article>';
  const routes = Object.fromEntries(
    profiles.map((path) => [path, { status: 200, body: html }]),
  );
  const f = fixture({
    ...routes,
    "/robots.txt": { status: 404, body: "" },
    "/": { status: 200, body: '<main><a href="/team">Team</a></main>' },
    "/team": { status: 200, body: team },
  });
  const result = await crawl(
    "https://example.dk/",
    { ...defaultConfig, maxPages: 2 },
    { request: f.request, pause: async () => {} },
  );
  assert.equal(result.pages.length, 14);
  assert.equal(
    f.calls.filter((path) => path.startsWith("/person-")).length,
    12,
  );
  assert.ok(
    result.pages.every((page) => new URL(page.url).hostname === "example.dk"),
  );
});
