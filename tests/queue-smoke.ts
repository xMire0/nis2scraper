// Local DB integration test; external services are replaced. Run with the worker stopped.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { runAutomaticEnrichment } from "../src/lib/intelligence/automatic-enrichment";
import { scoreCompany } from "../src/lib/intelligence/scoring";
import { defaultConfig } from "../src/lib/intelligence/config";
import { prepareSalesMaterial } from "../src/lib/intelligence/sales-material";

async function main() {
  const c = await prisma.company.create({
    data: {
      cvr: `TEST-${randomUUID()}`,
      name: "DISPOSABLE_QUEUE_TEST",
      importSource: "TEST",
      status: "ACTIVE",
      addressCountry: "DK",
      advertisingProtected: false,
      employeeMin: 40,
      employeeMax: 40,
      employeeCount: 40,
      registryFetchedAt: new Date(),
      autoEnrichmentStep: "WEBSITE",
      autoEnrichmentQueuedAt: new Date(),
      autoEnrichmentNextAt: new Date(1),
      outreach: {
        create: {
          status: "MEETING_SET",
          notes: "Keep notes",
          nextAction: "Keep action",
        },
      },
    },
  });
  let blocked = false,
    analyses = 0;
  const services = {
    refreshCompany: async () => {
      throw new Error("Must not call register");
    },
    enrichFinancials: async () => {
      throw new Error("Must not call statements");
    },
    findWebsite: async () => {
      if (blocked)
        return {
          ok: true,
          verified: false,
          message: "STOP: adgang begrænset (HTTP 403)",
        };
      await prisma.company.update({
        where: { id: c.id },
        data: { website: "https://example.invalid" },
      });
      return { ok: true, verified: true, message: "Fixture CVR verified" };
    },
    analyzeCompany: async () => {
      analyses++;
      const run = await prisma.enrichmentRun.create({
        data: {
          companyId: c.id,
          config: {},
          status: "SUCCEEDED",
          finishedAt: new Date(),
        },
      });
      const e = await prisma.evidence.create({
        data: {
          companyId: c.id,
          runId: run.id,
          url: "https://example.invalid/cases",
          excerpt: "Vi leverer cloud til hospital.",
          signal: "services",
          keyword: "cloud",
          contentHash: "fixture",
        },
      });
      const result = scoreCompany(
        c,
        [{ ...e, fetchedAt: e.fetchedAt.toISOString() }],
        defaultConfig,
        "COMPLETE",
      );
      const score = await prisma.leadScore.create({
        data: { ...result, companyId: c.id, runId: run.id, configVersion: 0 },
      });
      return { ok: true, mode: "RULES", status: 200, scoreId: score.id };
    },
    prepareSalesMaterial,
  };
  const current = () =>
    prisma.company.findUniqueOrThrow({
      where: { id: c.id },
      include: { drafts: true, outreach: true },
    });
  try {
    await runAutomaticEnrichment(c.id, services);
    assert.equal((await current()).autoEnrichmentStep, "ANALYZE");
    await runAutomaticEnrichment(c.id, services);
    assert.equal((await current()).autoEnrichmentStep, "OUTREACH");
    await runAutomaticEnrichment(c.id, services);
    const complete = await current();
    assert.equal(complete.autoEnrichmentStep, "FINANCIAL");
    assert.equal(complete.autoEnrichmentStartedAt, null);
    assert.equal(complete.drafts.length, 4);
    assert.ok(
      complete.drafts.every(
        (d) => d.scoreId === complete.autoEnrichmentScoreId,
      ),
    );
    await prepareSalesMaterial(c.id, complete.autoEnrichmentScoreId);
    assert.equal((await current()).drafts.length, 4);
    assert.equal(complete.outreach?.notes, "Keep notes");
    assert.equal(complete.outreach?.nextAction, "Keep action");
    blocked = true;
    await prisma.company.update({
      where: { id: c.id },
      data: { autoEnrichmentStep: "WEBSITE", autoEnrichmentScoreId: null },
    });
    await runAutomaticEnrichment(c.id, services);
    const failed = await current();
    assert.equal(failed.autoEnrichmentStep, "FINANCIAL_REVIEW");
    assert.match(failed.autoEnrichmentNote ?? "", /HTTP 403/);
    assert.equal(analyses, 1);
    assert.equal(failed.drafts.length, 4);
    await assert.rejects(() => prepareSalesMaterial(c.id, null), /ny ICP/);
    console.log(
      "Queue DB smoke passed: website → ICP → 4 drafts → financial queue; no duplicate drafts; 403 keeps prior data and blocks fresh material; notes preserved. No external calls.",
    );
  } finally {
    await prisma.company.delete({ where: { id: c.id } });
    await prisma.$disconnect();
  }
}
void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
