import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
import { sessionToken } from "../src/lib/session";
test("shared workspace requires authentication when a password is configured", async () => {
  const prior = process.env.APP_PASSWORD;
  process.env.APP_PASSWORD = "disposable-test-password";
  try {
    assert.equal(
      (
        await middleware(
          new NextRequest("http://localhost:3000/api/intelligence"),
        )
      ).status,
      401,
    );
    const token = await sessionToken(process.env.APP_PASSWORD);
    const ok = await middleware(
      new NextRequest("http://localhost:3000/api/intelligence", {
        headers: { cookie: `nis2-session=${token}` },
      }),
    );
    assert.equal(ok.status, 200);
    const page = await middleware(
      new NextRequest("http://localhost:3000/dashboard"),
    );
    assert.equal(page.status, 307);
    assert.ok(page.headers.get("location")?.endsWith("/login"));
  } finally {
    if (prior === undefined) delete process.env.APP_PASSWORD;
    else process.env.APP_PASSWORD = prior;
  }
});
test("mutations reject missing, foreign and opaque origins", async () => {
  for (const origin of [undefined, "https://evil.example", "null"]) {
    const request = new NextRequest("http://localhost:3000/api/intelligence", {
      method: "POST",
      headers: { host: "localhost:3000", ...(origin ? { origin } : {}) },
    });
    assert.equal((await middleware(request)).status, 403);
  }
});
test("legacy legal-scoping endpoints are not callable", async () => {
  assert.equal(
    (
      await middleware(
        new NextRequest("http://localhost:3000/api/prospecting/run", {
          method: "POST",
        }),
      )
    ).status,
    410,
  );
});
