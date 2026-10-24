import assert from "node:assert/strict";
import fs from "node:fs";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const csv = fs
  .readFileSync(new URL("./fixtures/import.csv", import.meta.url), "utf8")
  .replaceAll(".invalid", `-${Date.now()}.invalid`);
async function post(body) {
  const r = await fetch(base + "/api/intelligence", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  return { status: r.status, data };
}
let r = await post({ action: "preview", csv });
assert.equal(r.status, 200);
assert.equal(r.data.rows.length, 3);
assert.equal(r.data.rows[0].company.employeeMax, 99);
r = await post({
  action: "import",
  csv,
  source: "DISPOSABLE_MVP_SMOKE_TEST",
  filename: "integration-test.csv",
});
assert.equal(r.status, 200);
assert.equal(r.data.total, 3);
r = await post({
  action: "import",
  csv,
  source: "DISPOSABLE_MVP_SMOKE_TEST",
  filename: "integration-test-again.csv",
});
assert.equal(r.status, 200);
assert.equal(r.data.added, 0);
assert.equal(r.data.duplicates, 3);
let snapshot = await (await fetch(base + "/api/intelligence")).json();
const companies = snapshot.companies.filter(
  (c) => c.importSource === "DISPOSABLE_MVP_SMOKE_TEST",
);
assert.equal(companies.length, 3);
const company = companies[0];
r = await post({
  action: "update",
  id: company.id,
  status: "CLOSED_WON",
  notes: "Testnotat",
  nextAction: "Kontrollér dokumentation",
  nextFollowUpAt: "2026-10-01T12:00:00.000Z",
  website: company.website,
});
assert.equal(r.status, 200);
r = await post({
  action: "analyze",
  id: company.id,
  termsConfirmed: false,
  termsNote: "Test",
});
assert.equal(r.status, 400);
r = await post({
  action: "analyze",
  id: company.id,
  termsConfirmed: true,
  termsNote:
    "Reserved .invalid hostname used to verify failure logging; no external site",
});
assert.equal(r.status, 422);
snapshot = await (await fetch(base + "/api/intelligence")).json();
const after = snapshot.companies.find((c) => c.id === company.id);
assert.equal(after.outreach.status, "CLOSED_WON");
assert.equal(after.outreach.history.length, 1);
assert.equal(after.leadRuns[0].status, "FAILED");
assert.equal(after.scores.length, 0);
for (const channel of ["EMAIL", "PHONE", "LINKEDIN", "WEBINAR"]) {
  r = await post({ action: "outreach", id: company.id, channel });
  assert.equal(r.status, 200);
  assert.ok(r.data.body.length > 80);
  assert.ok(!r.data.body.includes("er omfattet"));
}
r = await post({ action: "settings", config: snapshot.config });
assert.equal(r.status, 200);
const noOrigin = await fetch(base + "/api/intelligence", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "settings", config: snapshot.config }),
});
assert.equal(noOrigin.status, 403);
const legacy = await fetch(base + "/api/leads");
assert.equal(legacy.status, 410);
r = await post({ action: "repopulate", id: company.id });
assert.equal(r.status, 200);
const queued = (
  await (await fetch(base + "/api/intelligence")).json()
).companies.find((c) => c.id === company.id);
assert.ok(queued.autoEnrichmentQueuedAt);
r = await post({ action: "repopulate", id: company.id });
assert.equal(r.status, 200);
const duplicate = (
  await (await fetch(base + "/api/intelligence")).json()
).companies.find((c) => c.id === company.id);
assert.equal(duplicate.autoEnrichmentQueuedAt, queued.autoEnrichmentQueuedAt);
assert.equal(duplicate.outreach.notes, "Testnotat");
assert.equal(duplicate.outreach.status, "CLOSED_WON");
console.log(
  "API smoke passed: import, duplicates, persistence, workflow, failed analysis, four drafts, settings, CSRF and disabled legacy endpoints.",
);
// Only delete the disposable companies created by this script, never user data.
for (const c of companies) {
  r = await post({ action: "delete", id: c.id });
  assert.equal(r.status, 200);
}
console.log(
  "Disposable smoke-test companies and associated raw imports removed.",
);
