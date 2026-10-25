import { prisma } from "../prisma";
import { discoveryState } from "./discovery";
import { discoveryConfigSchema } from "./cvrbasen";
import { configSchema, defaultConfig } from "./config";
import { refreshCompany, enrichFinancials, findWebsite } from "./enrichment";
import { analyzeCompany } from "./analysis";
import { prepareSalesMaterial } from "./sales-material";
import { crawlExplanation } from "./queue";

export function automaticSteps(
  state: {
    budgetDay: string;
    requestsToday: number;
    leaseUntil: Date | null;
    lastError: string | null;
    nextRunAt: Date;
  },
  limit: number,
  now = new Date(),
) {
  const used =
    state.budgetDay === now.toISOString().slice(0, 10)
      ? state.requestsToday
      : 0;
  return used >= limit ||
    (state.leaseUntil && state.leaseUntil > now) ||
    (state.lastError && state.nextRunAt > now)
    ? ["WEBSITE", "ANALYZE", "OUTREACH"]
    : [
        "PROFILE",
        "WEBSITE",
        "FINANCIAL",
        "FINANCIAL_REVIEW",
        "ANALYZE",
        "OUTREACH",
      ];
}

export async function runAutomaticEnrichment(
  targetId?: string,
  services = {
    refreshCompany,
    enrichFinancials,
    findWebsite,
    analyzeCompany,
    prepareSalesMaterial,
  },
) {
  const state = await discoveryState();
  const settings = discoveryConfigSchema.parse(state.config);
  // ponytail: one company at a time; replace with per-job leases only if throughput requires it.
  const domain = "automatic-enrichment",
    expiresAt = new Date(Date.now() + 15 * 60000);
  const locked = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(714023)`;
    await tx.crawlLock.deleteMany({
      where: { domain, expiresAt: { lt: new Date() } },
    });
    if (await tx.crawlLock.findUnique({ where: { domain } })) return false;
    await tx.crawlLock.create({ data: { domain, expiresAt } });
    return true;
  });
  if (!locked) return;
  try {
    const c = await prisma.company.findFirst({
      where: {
        ...(targetId ? { id: targetId } : {}),
        AND: [
          {
            OR: [
              ...(settings.autoEnrich
                ? [
                    { importSource: "CVRbasen API" },
                    { importSource: "ApiCVR" },
                  ]
                : []),
              { autoEnrichmentQueuedAt: { not: null } },
            ],
          },
        ],
        OR: [
          {
            autoEnrichmentStep: {
              in: automaticSteps(state, settings.maxRequestsPerDay),
            },
          },
          {
            autoEnrichmentStep: "PROFILE",
            registryFetchedAt: { gte: new Date(Date.now() - 7 * 86400000) },
          },
          {
            autoEnrichmentStep: "FINANCIAL",
            website: { not: null },
            scores: { none: {} },
          },
        ],
        autoEnrichmentNextAt: { lte: new Date() },
      },
      orderBy: [
        { autoEnrichmentNextAt: "asc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });
    if (!c) return;
    const unchanged = {
      id: c.id,
      autoEnrichmentStep: c.autoEnrichmentStep,
      autoEnrichmentNextAt: c.autoEnrichmentNextAt,
      autoEnrichmentQueuedAt: c.autoEnrichmentQueuedAt,
    };
    const startedAt = new Date();
    const claimed = await prisma.company.updateMany({
      where: unchanged,
      data: { autoEnrichmentStartedAt: startedAt },
    });
    if (!claimed.count) return;
    try {
      let next = "DONE";
      let note = c.autoEnrichmentNote;
      let scoreId = c.autoEnrichmentScoreId;
      if (c.autoEnrichmentStep === "PROFILE") {
        if (
          c.registryFetchedAt &&
          Date.now() - c.registryFetchedAt.getTime() < 7 * 86400000
        )
          next = "WEBSITE";
        else {
          const result = await services.refreshCompany(c.id);
          next = result.eligible ? "WEBSITE" : "SKIPPED";
        }
      } else if (
        c.status !== "ACTIVE" ||
        c.advertisingProtected !== false ||
        c.addressCountry !== "DK"
      ) {
        next = "SKIPPED";
      } else if (
        !c.registryFetchedAt ||
        Date.now() - c.registryFetchedAt.getTime() > 7 * 86400000
      ) {
        next = "PROFILE";
      } else if (c.autoEnrichmentStep === "WEBSITE") {
        {
          const saved = await prisma.scoringConfig.findFirst({
            orderBy: { id: "desc" },
          });
          const result = await services.findWebsite(
            c.id,
            saved ? configSchema.parse(saved.value) : defaultConfig,
          );
          next = result.verified ? "ANALYZE" : "FINANCIAL_REVIEW";
          note = result.verified ? null : crawlExplanation(result.message);
        }
      } else if (c.autoEnrichmentStep === "OUTREACH") {
        await services.prepareSalesMaterial(c.id, c.autoEnrichmentScoreId);
        next = "FINANCIAL";
      } else if (
        ["FINANCIAL", "FINANCIAL_REVIEW"].includes(c.autoEnrichmentStep)
      ) {
        const score = await prisma.leadScore.findFirst({
          where: { companyId: c.id },
        });
        if (c.autoEnrichmentStep === "FINANCIAL" && c.website && !score)
          next = "WEBSITE";
        else {
          await services.enrichFinancials(c.id);
          next =
            c.autoEnrichmentStep === "FINANCIAL_REVIEW"
              ? "NEEDS_REVIEW"
              : "DONE";
        }
      } else if (!c.website) {
        next = "NEEDS_REVIEW";
      } else {
        const result = await services.analyzeCompany(c.id);
        next = "OUTREACH";
        if (result.error) {
          if (result.status === 409) throw new Error(result.error);
          next = "FINANCIAL_REVIEW";
          note = result.error;
          scoreId = null;
        } else scoreId = result.scoreId ?? null;
      }
      if (
        ["DONE", "NEEDS_REVIEW", "FINANCIAL", "FINANCIAL_REVIEW"].includes(next)
      ) {
        await prisma.leadOutreachStatus.updateMany({
          where: {
            companyId: c.id,
            status: "NEW",
            OR: [
              { nextAction: null },
              { nextAction: "" },
              {
                nextAction:
                  "Afklar virksomhedens officielle hjemmeside, og analysér den med regler.",
              },
            ],
          },
          data: {
            nextAction: ["DONE", "FINANCIAL"].includes(next)
              ? "Gennemgå score, kildebeviser og kontaktgrundlag før første samtale."
              : "Afklar hjemmeside eller manglende datadækning manuelt; se kørselsloggen.",
          },
        });
      }
      await prisma.company.updateMany({
        where: unchanged,
        data: {
          autoEnrichmentStep: next,
          autoEnrichmentScoreId: scoreId,
          autoEnrichmentNote: note,
          autoEnrichmentError: null,
          autoEnrichmentNextAt: c.autoEnrichmentNextAt,
        },
      });
    } catch (e) {
      await prisma.company.updateMany({
        where: unchanged,
        data: {
          autoEnrichmentError:
            e instanceof Error ? e.message : "Automatisk berigelse fejlede",
          autoEnrichmentNextAt: new Date(Date.now() + 3600000),
        },
      });
    } finally {
      await prisma.company.updateMany({
        where: { id: c.id, autoEnrichmentStartedAt: startedAt },
        data: { autoEnrichmentStartedAt: null },
      });
    }
  } finally {
    await prisma.crawlLock.deleteMany({ where: { domain, expiresAt } });
  }
}
