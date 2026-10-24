// Run against local DB: node --env-file=.env --import tsx tests/openai-budget-smoke.ts
// No external requests: fetch is replaced before invoking the integration.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import {
  searchCompanyWebsite,
  websiteSearchSnapshot,
} from "../src/lib/intelligence/openai-website";

async function main() {
  const name = `DISPOSABLE_OPENAI_TEST_${randomUUID()}`;
  const company = {
    cvr: "24256790",
    name,
    addressCity: null,
    addressStreet: null,
  };
  const queryHash = createHash("sha256")
    .update(
      JSON.stringify(["v3", company.cvr, name, null, null, "gpt-4.1-mini"]),
    )
    .digest("hex");
  const fetchBefore = globalThis.fetch;
  const env = {
    key: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_WEBSITE_MODEL,
    limit: process.env.OPENAI_WEBSITE_MAX_REQUESTS_PER_DAY,
  };
  process.env.OPENAI_API_KEY = "mock-only";
  process.env.OPENAI_WEBSITE_MODEL = "gpt-4.1-mini";
  process.env.OPENAI_WEBSITE_MAX_REQUESTS_PER_DAY = "1000";
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  globalThis.fetch = async () => {
    calls++;
    started();
    await gate;
    return Response.json({
      id: "mock_response",
      model: "gpt-4.1-mini",
      status: "completed",
      usage: { input_tokens: 10, output_tokens: 5 },
      output: [
        {
          type: "web_search_call",
          status: "completed",
          action: { sources: [] },
        },
        {
          type: "message",
          content: [{ type: "output_text", text: '{"candidates":[]}' }],
        },
      ],
    });
  };
  try {
    const baseline = (await websiteSearchSnapshot()).requestsToday;
    const first = searchCompanyWebsite(company);
    await Promise.race([
      entered,
      first.then(() => {
        throw new Error("Expected mocked API entry");
      }),
    ]);
    await assert.rejects(() => searchCompanyWebsite(company), /kører allerede/);
    release();
    assert.equal((await first).cached, false);
    assert.equal((await searchCompanyWebsite(company)).cached, true);
    assert.equal(calls, 1);
    assert.equal((await websiteSearchSnapshot()).requestsToday, baseline + 1);
    process.env.OPENAI_WEBSITE_MAX_REQUESTS_PER_DAY = "0";
    await assert.rejects(
      () => searchCompanyWebsite({ ...company, name: name + "-other" }),
      /loft/,
    );
    assert.equal((await searchCompanyWebsite(company)).cached, true);
    assert.equal(calls, 1);
    console.log(
      "OpenAI DB smoke passed: atomic reservation, concurrent-call exclusion, durable budget, cached empty result and zero-budget pause. No external requests.",
    );
  } finally {
    release();
    globalThis.fetch = fetchBefore;
    for (const [key, value] of Object.entries({
      OPENAI_API_KEY: env.key,
      OPENAI_WEBSITE_MODEL: env.model,
      OPENAI_WEBSITE_MAX_REQUESTS_PER_DAY: env.limit,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await prisma.websiteSearchRun.deleteMany({ where: { queryHash } });
    await prisma.$disconnect();
  }
}
void main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
