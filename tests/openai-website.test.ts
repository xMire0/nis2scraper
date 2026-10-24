import { test } from "node:test";
import assert from "node:assert/strict";
import { configSchema, defaultConfig } from "../src/lib/intelligence/config";
import { websiteSearchLimit } from "../src/lib/intelligence/openai-website";

test("saved OpenAI budget overrides environment immediately, including zero; invalid budgets are rejected", () => {
  assert.equal(
    websiteSearchLimit({ ...defaultConfig, openaiMaxRequestsPerDay: 20 }),
    20,
  );
  assert.equal(
    websiteSearchLimit({ ...defaultConfig, openaiMaxRequestsPerDay: 0 }),
    0,
  );
  for (const limit of [-1, 1.5, 1001, "20"]) {
    assert.equal(
      configSchema.safeParse({
        ...defaultConfig,
        openaiMaxRequestsPerDay: limit,
      }).success,
      false,
    );
  }
  const { openaiMaxRequestsPerDay: _old, ...legacy } = defaultConfig;
  assert.equal(configSchema.parse(legacy).openaiMaxRequestsPerDay, null);
});
import {
  parseWebsiteSearch,
  requestWebsiteSearch,
  websiteSearchSettings,
} from "../src/lib/intelligence/openai-website";

const company = {
  cvr: "24256790",
  name: "Eksempel A/S",
  addressCity: "Aarhus",
  addressStreet: "Testvej 1",
};
const candidate = {
  url: "https://example.com/da-dk",
  sourceUrl: "https://example.com/kontakt",
  reason: "CVR på kontaktside",
};
function response(candidates = [candidate], sources = [candidate.sourceUrl]) {
  return {
    id: "resp_test",
    model: "gpt-4.1-mini",
    status: "completed",
    usage: { input_tokens: 200, output_tokens: 100 },
    output: [
      {
        type: "web_search_call",
        status: "completed",
        action: {
          type: "search",
          sources: sources.map((url) => ({ type: "url", url })),
        },
      },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({ candidates }),
            annotations: [],
          },
        ],
      },
    ],
  };
}
test("AI candidates need real search sources on the same host and public crawlable URLs", () => {
  assert.equal(
    parseWebsiteSearch(
      response([candidate], [candidate.sourceUrl + "?utm_source=openai"]),
    ).candidates[0]?.url,
    candidate.url,
  );
  const prose = response();
  prose.output[1]!.content = [
    {
      type: "output_text",
      text: "Official website, from a live search.",
      annotations: [
        { type: "url_citation", url: candidate.url + "?utm_source=openai" },
      ] as never[],
    },
  ];
  assert.equal(parseWebsiteSearch(prose).candidates[0]?.url, candidate.url);
  assert.equal(
    parseWebsiteSearch(response()).candidates[0]?.url,
    candidate.url,
  );
  assert.deepEqual(
    parseWebsiteSearch(response([candidate], [])).candidates,
    [],
  );
  assert.deepEqual(
    parseWebsiteSearch(response([{ ...candidate, url: "https://invented.dk" }]))
      .candidates,
    [],
  );
  for (const url of [
    "http://127.0.0.1/",
    "https://proff.dk/company",
    "https://example.com/login",
    "https://secret@example.com/",
    "javascript:alert(1)",
  ]) {
    assert.deepEqual(
      parseWebsiteSearch(
        response([{ ...candidate, url, sourceUrl: url }], [url]),
      ).candidates,
      [],
    );
  }
  assert.equal(
    parseWebsiteSearch(response([candidate, candidate])).candidates.length,
    1,
  );
  const unfinished = response();
  unfinished.status = "incomplete";
  assert.throws(() => parseWebsiteSearch(unfinished));
  const noSearch = response();
  noSearch.output.shift();
  assert.throws(() => parseWebsiteSearch(noSearch), /ingen udført/);
});
test("Responses request requires web search, bounds spend, keeps key server-side and sanitizes failures", async () => {
  const before = process.env.OPENAI_API_KEY;
  const limit = process.env.OPENAI_WEBSITE_MAX_REQUESTS_PER_DAY;
  process.env.OPENAI_API_KEY = "test-secret-never-log";
  try {
    const result = await requestWebsiteSearch(company, async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.equal(init?.redirect, "error");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.store, false);
      assert.equal(body.tool_choice, "required");
      assert.equal(body.tools[0].type, "web_search");
      assert.equal(body.max_tool_calls, 3);
      assert.equal(body.max_output_tokens, 1800);
      assert.deepEqual(JSON.parse(body.input), {
        cvr: company.cvr,
        name: company.name,
        city: company.addressCity,
        address: company.addressStreet,
      });
      assert.ok(!String(init?.body).includes("test-secret"));
      return Response.json(response());
    });
    assert.equal(result.searchCalls, 1);
    await assert.rejects(
      () =>
        requestWebsiteSearch(
          company,
          async () => new Response("test-secret-never-log", { status: 401 }),
        ),
      (e) =>
        e instanceof Error &&
        /HTTP 401/.test(e.message) &&
        !e.message.includes("test-secret"),
    );
    await assert.rejects(
      () =>
        requestWebsiteSearch(
          company,
          async () =>
            new Response("{}", {
              status: 429,
              headers: { "Retry-After": "7200" },
            }),
        ),
      (e) =>
        Boolean(
          e && typeof e === "object" && "retryMs" in e && e.retryMs === 7200000,
        ),
    );
    await assert.rejects(
      () =>
        requestWebsiteSearch(company, async () =>
          Response.json({ status: "incomplete" }),
        ),
      /ugyldigt/,
    );
    process.env.OPENAI_WEBSITE_MAX_REQUESTS_PER_DAY = "invalid";
    assert.equal(websiteSearchSettings().maxRequestsPerDay, 0);
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(
      () =>
        requestWebsiteSearch(company, async () => {
          throw new Error("Must never call API");
        }),
      /OPENAI_API_KEY mangler/,
    );
  } finally {
    if (before === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = before;
    if (limit === undefined)
      delete process.env.OPENAI_WEBSITE_MAX_REQUESTS_PER_DAY;
    else process.env.OPENAI_WEBSITE_MAX_REQUESTS_PER_DAY = limit;
  }
});
