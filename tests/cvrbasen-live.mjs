// Run manually: node --env-file=.env tests/cvrbasen-live.mjs
// Docs: https://cvrbasen.dk/docs. At most three calls; no database writes.
import { setTimeout as delay } from "node:timers/promises";

const key = process.env.CVRBASEN_API_KEY?.trim();
if (!key) throw new Error("CVRBASEN_API_KEY is missing");
const cases = [
  { name: "Documented company lookup", path: "/companies/24256790" },
  { name: "Minimal search", path: "/companies/search", body: { per_page: 1 } },
  {
    name: "Dashboard filters (one result)", path: "/companies/search",
    body: {
      query: { status_eq: "NORMAL", industry_code_start: "62" },
      method: "SELECT", page: 1, per_page: 1, sorts: "vat ASC",
    },
  },
];
for (const [index, example] of cases.entries()) {
  if (index) await delay(3000);
  const start = Date.now();
  try {
    const response = await fetch(`https://api.cvrbasen.dk/v1${example.path}`, {
      method: example.body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: example.body ? JSON.stringify(example.body) : undefined,
      redirect: "error", signal: AbortSignal.timeout(25000),
    });
    const raw = await response.text();
    let body;
    try { body = JSON.parse(raw); } catch { body = null; }
    console.log(JSON.stringify({
      test: example.name, method: example.body ? "POST" : "GET", path: example.path,
      status: response.status, statusText: response.statusText, elapsedMs: Date.now() - start,
      contentType: response.headers.get("content-type"), requestId: response.headers.get("x-request-id"),
      retryAfter: response.headers.get("retry-after"), responseBytes: Buffer.byteLength(raw),
      jsonKeys: body && typeof body === "object" ? Object.keys(body) : null,
      resultCount: Array.isArray(body?.data) ? body.data.length : body?.data ? 1 : 0,
      error: !response.ok ? String(body?.error ?? body?.message ?? (body ? "No error message in JSON" : "Non-JSON response")).replaceAll(key, "[REDACTED]").replace(/cb_sk_[a-zA-Z0-9]+/g, "[REDACTED]").slice(0, 400) : undefined,
    }, null, 2));
    if (!response.ok) process.exitCode = 1;
    if (response.status === 429 || response.headers.has("retry-after")) break;
  } catch (error) {
    console.log(JSON.stringify({ test: example.name, error: error.name, elapsedMs: Date.now() - start }));
    process.exitCode = 1;
    break;
  }
}
