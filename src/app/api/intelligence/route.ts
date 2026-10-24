import {
  websiteSearchSnapshot,
  websiteSearchLimit,
} from "@/lib/intelligence/openai-website";
import {
  discoverySnapshot,
  runDiscovery,
  saveDiscovery,
} from "@/lib/intelligence/discovery";
import { discoveryConfigSchema } from "@/lib/intelligence/cvrbasen";
import { NextResponse } from "next/server";
import { pendingSteps } from "@/lib/intelligence/queue";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { configSchema, defaultConfig, stages } from "@/lib/intelligence/config";
import { readCsv, websiteUrl } from "@/lib/intelligence/csv";
import { analyzeCompany } from "@/lib/intelligence/analysis";
import {
  refreshCompany,
  enrichFinancials,
  findWebsite,
} from "@/lib/intelligence/enrichment";

import { makeOutreach } from "@/lib/intelligence/outreach";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const hash = (v: string) =>
  createHash("sha256").update(v.toLowerCase().trim()).digest("hex");
const ids = z.string().min(1).max(100);
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("repopulate"), id: ids }),
  z.object({ action: z.literal("refreshRegistry"), id: ids }),
  z.object({ action: z.literal("financials"), id: ids }),
  z.object({
    action: z.literal("findWebsite"),
    id: ids,
  }),
  z.object({ action: z.literal("discover") }),
  z.object({
    action: z.literal("discoverySettings"),
    config: discoveryConfigSchema,
  }),
  z.object({
    action: z.literal("preview"),
    csv: z.string().max(2_000_000),
    mapping: z.record(z.string()).optional(),
  }),
  z.object({
    action: z.literal("import"),
    csv: z.string().max(2_000_000),
    mapping: z.record(z.string()).optional(),
    source: z.string().trim().min(1).max(150),
    filename: z.string().max(200),
  }),
  z.object({ action: z.literal("settings"), config: configSchema }),
  z.object({
    action: z.literal("analyze"),
    id: ids,
    termsConfirmed: z.boolean(),
    termsNote: z.string().trim().min(1).max(500),
  }),
  z.object({
    action: z.literal("update"),
    id: ids,
    status: z.enum(Object.keys(stages) as [string, ...string[]]),
    notes: z.string().max(5000),
    nextAction: z.string().max(500),
    nextFollowUpAt: z.string().datetime().nullable(),
    website: z.string().max(500),
  }),
  z.object({
    action: z.literal("outreach"),
    id: ids,
    channel: z.enum(["EMAIL", "PHONE", "LINKEDIN", "WEBINAR"]),
  }),
  z.object({ action: z.literal("suppress"), id: ids }),
  z.object({ action: z.literal("delete"), id: ids }),
  z.object({ action: z.literal("deleteImport"), id: ids }),
]);
async function getConfig() {
  const saved = await prisma.scoringConfig.findFirst({
    orderBy: { id: "desc" },
  });
  return {
    version: saved?.id ?? 0,
    config: saved ? configSchema.parse(saved.value) : defaultConfig,
  };
}
export async function GET(request: Request) {
  try {
    const importId = new URL(request.url).searchParams.get("importId");
    if (importId) {
      const batch = await prisma.importBatch.findUnique({
        where: { id: importId },
      });
      if (!batch)
        return NextResponse.json(
          { error: "Importen findes ikke" },
          { status: 404 },
        );
      return new Response(batch.rawCsv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="original-import.csv"',
          "Cache-Control": "no-store",
        },
      });
    }
    await prisma.enrichmentRun.updateMany({
      where: {
        status: "RUNNING",
        startedAt: { lt: new Date(Date.now() - 10 * 60000) },
      },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: "Kørslen blev afbrudt. Start en ny manuel analyse.",
      },
    });
    await prisma.publicContact.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    const [companies, imports, settings] = await Promise.all([
      prisma.company.findMany({
        take: 2000,
        orderBy: { createdAt: "desc" },
        include: {
          scores: { orderBy: { createdAt: "desc" }, take: 1 },
          leadRuns: { orderBy: { startedAt: "desc" }, take: 5 },
          evidence: { orderBy: { fetchedAt: "desc" }, take: 120 },
          publicContacts: true,
          financials: { orderBy: { year: "desc" }, take: 2 },
          drafts: { orderBy: { createdAt: "desc" }, take: 8 },
          outreach: {
            include: { history: { orderBy: { createdAt: "desc" }, take: 20 } },
          },
        },
      }),
      prisma.importBatch.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          filename: true,
          source: true,
          result: true,
          createdAt: true,
        },
      }),
      getConfig(),
    ]);
    return NextResponse.json(
      {
        companies,
        imports,
        ...settings,
        analysisMode: "RULES",
        websiteSearch: await websiteSearchSnapshot(),
        discovery: await discoverySnapshot(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("Workspace read failed", e instanceof Error ? e.message : e);
    return NextResponse.json(
      {
        error:
          "Databasen kunne ikke læses. Kontrollér at PostgreSQL er startet, og at migrationer er kørt.",
      },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 3_000_000)
      return NextResponse.json(
        { error: "Forespørgslen er for stor" },
        { status: 413 },
      );
    const b = bodySchema.parse(JSON.parse(raw));
    if (b.action === "discover")
      return NextResponse.json(await runDiscovery(true));
    if (b.action === "discoverySettings") {
      await saveDiscovery(b.config);
      return NextResponse.json({ ok: true });
    }

    if (b.action === "preview" || b.action === "import") {
      const parsed = readCsv(b.csv, b.mapping);
      if (parsed.needsMapping)
        return b.action === "preview"
          ? NextResponse.json(parsed)
          : NextResponse.json(
              { error: "Vælg kolonner til CVR og virksomhedsnavn før import" },
              { status: 400 },
            );
      if (b.action === "preview") {
        const existing = new Set(
          (
            await prisma.company.findMany({
              where: {
                cvr: {
                  in: parsed.rows.flatMap((r) =>
                    r.company ? [r.company.cvr] : [],
                  ),
                },
              },
              select: { cvr: true },
            })
          ).map((c) => c.cvr),
        );
        return NextResponse.json({
          ...parsed,
          rows: parsed.rows.map((r) =>
            r.company && existing.has(r.company.cvr)
              ? {
                  ...r,
                  outcome: "DUPLICATE",
                  message: "Findes allerede i databasen",
                }
              : r,
          ),
        });
      }
      const result = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(714021)`;
          const existing = new Set(
            (await tx.company.findMany({ select: { cvr: true } })).map(
              (c) => c.cvr,
            ),
          );
          if (
            existing.size +
              parsed.rows.filter(
                (r) => r.outcome === "VALID" && !existing.has(r.company!.cvr),
              ).length >
            2000
          )
            throw new Error("Denne MVP understøtter højst 2.000 virksomheder");
          const batch = await tx.importBatch.create({
            data: {
              source: b.source,
              filename: b.filename,
              rawCsv: b.csv,
              hash: hash(b.csv),
              result: {},
            },
          });
          let added = 0,
            duplicates = 0,
            invalid = 0;
          for (const row of parsed.rows) {
            let companyId: string | undefined;
            let outcome = row.outcome;
            let message = row.message;
            if (
              row.company &&
              row.outcome === "VALID" &&
              !existing.has(row.company.cvr)
            ) {
              const company = await tx.company.create({
                data: {
                  ...row.company,
                  domain: row.company.website
                    ? new URL(row.company.website).hostname
                    : null,
                  importSource: b.source,
                  employeeCountSource: "CSV",
                  employeeCountAsOf: new Date(),
                  outreach: { create: {} },
                },
              });
              companyId = company.id;
              existing.add(company.cvr);
              added++;
            } else if (row.company) {
              outcome = "DUPLICATE";
              message = "CVR findes allerede; eksisterende data er bevaret";
              duplicates++;
              companyId = (
                await tx.company.findUnique({
                  where: { cvr: row.company.cvr },
                  select: { id: true },
                })
              )?.id;
            } else invalid++;
            await tx.importRow.create({
              data: {
                importId: batch.id,
                companyId,
                rowNumber: row.rowNumber,
                raw: json(row.raw),
                outcome,
                message,
              },
            });
          }
          const summary = {
            added,
            duplicates,
            invalid,
            total: parsed.rows.length,
          };
          await tx.importBatch.update({
            where: { id: batch.id },
            data: { result: summary },
          });
          return summary;
        },
        { timeout: 60000 },
      );
      return NextResponse.json(result);
    }
    if (b.action === "settings") {
      const saved = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(714024)`;
        const previous = await tx.scoringConfig.findFirst({
          orderBy: { id: "desc" },
        });
        const saved = await tx.scoringConfig.create({
          data: { value: json(b.config) },
        });
        if (
          websiteSearchLimit(b.config) > websiteSearchLimit(previous?.value)
        ) {
          await tx.company.updateMany({
            where: {
              autoEnrichmentStep: "WEBSITE",
              autoEnrichmentError: "Dagens loft over OpenAI-søgninger er nået",
            },
            data: {
              autoEnrichmentError: null,
              autoEnrichmentNextAt: new Date(1),
            },
          });
        }
        return saved;
      });
      return NextResponse.json({ version: saved.id });
    }
    if (b.action === "deleteImport") {
      await prisma.importBatch.delete({ where: { id: b.id } });
      return NextResponse.json({ ok: true });
    }
    if (b.action === "suppress") {
      await prisma.$transaction(async (tx) => {
        const contact = await tx.publicContact.findUniqueOrThrow({
          where: { id: b.id },
        });
        await tx.contactSuppression.upsert({
          where: { hash: hash(contact.value) },
          create: { hash: hash(contact.value) },
          update: {},
        });
        await tx.publicContact.deleteMany({ where: { value: contact.value } });
      });
      return NextResponse.json({ ok: true });
    }
    const company = await prisma.company.findUnique({
      where: { id: b.id },
      include: {
        scores: { orderBy: { createdAt: "desc" }, take: 1 },
        outreach: true,
      },
    });
    if (!company)
      return NextResponse.json(
        { error: "Virksomheden findes ikke" },
        { status: 404 },
      );
    if (b.action === "repopulate") {
      const saved = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(714023)`;
        const current = await tx.company.findUniqueOrThrow({
          where: { id: company.id },
        });
        if (
          (current.autoEnrichmentStartedAt &&
            Date.now() - current.autoEnrichmentStartedAt.getTime() <
              15 * 60000) ||
          (current.autoEnrichmentQueuedAt &&
            pendingSteps.includes(current.autoEnrichmentStep))
        )
          return false;
        await tx.company.update({
          where: { id: current.id },
          data: {
            autoEnrichmentStep:
              current.registryFetchedAt &&
              Date.now() - current.registryFetchedAt.getTime() < 7 * 86400000
                ? "WEBSITE"
                : "PROFILE",
            autoEnrichmentNextAt: new Date(1),
            autoEnrichmentError: null,
            autoEnrichmentQueuedAt: new Date(),
            autoEnrichmentStartedAt: null,
            autoEnrichmentNote: null,
            autoEnrichmentScoreId: null,
          },
        });
        return true;
      });
      return NextResponse.json({
        ok: true,
        message: saved
          ? "Hele forløbet er bestilt. Følg hjemmeside, data, ICP og salgsmateriale i Kø. Starter normalt inden for ét minut."
          : "Virksomheden er allerede i kø eller under behandling. Følg status i Kø.",
      });
    }
    if (b.action === "refreshRegistry")
      return NextResponse.json(await refreshCompany(company.id));
    if (
      ["analyze", "outreach", "findWebsite", "financials"].includes(b.action) &&
      company.registryFetchedAt &&
      (company.status !== "ACTIVE" ||
        company.addressCountry !== "DK" ||
        company.advertisingProtected !== false ||
        Date.now() - company.registryFetchedAt.getTime() > 7 * 86400000)
    )
      return NextResponse.json(
        {
          error:
            "CVR-oplysningerne er beskyttede eller skal opdateres. Brug Opdater CVR før berigelse eller outreach.",
        },
        { status: 409 },
      );
    if (b.action === "delete") {
      await prisma.$transaction(async (tx) => {
        for (const contact of await tx.publicContact.findMany({
          where: { companyId: b.id },
        }))
          await tx.contactSuppression.upsert({
            where: { hash: hash(contact.value) },
            create: { hash: hash(contact.value) },
            update: {},
          });
        // Raw batches may contain company/person information; delete linked originals too.
        const rows = await tx.importRow.findMany({
          where: { companyId: b.id },
          select: { importId: true },
        });
        await tx.importBatch.deleteMany({
          where: { id: { in: rows.map((r) => r.importId) } },
        });
        await tx.company.delete({ where: { id: b.id } });
      });
      return NextResponse.json({ ok: true });
    }
    if (b.action === "update") {
      const website = websiteUrl(b.website);
      await prisma.$transaction(async (tx) => {
        await tx.company.update({
          where: { id: b.id },
          data: {
            website,
            domain: website ? new URL(website).hostname : null,
            ...(website !== company.website
              ? {
                  termsCheckedAt: null,
                  termsNote: null,
                  websiteDiscovery: Prisma.DbNull,
                  ...(website
                    ? {
                        autoEnrichmentStep: "WEBSITE",
                        autoEnrichmentNextAt: new Date(1),
                        autoEnrichmentError: null,
                      }
                    : {}),
                }
              : {}),
          },
        });
        const old = await tx.leadOutreachStatus.findUnique({
          where: { companyId: b.id },
        });
        const status =
          b.status as Prisma.LeadOutreachStatusCreateInput["status"];
        const data = {
          status,
          notes: b.notes,
          nextAction: b.nextAction,
          nextFollowUpAt: b.nextFollowUpAt ? new Date(b.nextFollowUpAt) : null,
          ...(b.status === "CONTACTED" && old?.status !== "CONTACTED"
            ? { lastContactedAt: new Date() }
            : {}),
        };
        const out = await tx.leadOutreachStatus.upsert({
          where: { companyId: b.id },
          create: { companyId: b.id, ...data },
          update: data,
        });
        if (old?.status !== status)
          await tx.outreachEvent.create({
            data: {
              outreachId: out.id,
              fromStatus: old?.status,
              toStatus: out.status,
              note: b.notes,
              actor: "Dashboard",
            },
          });
      });
      return NextResponse.json({ ok: true });
    }
    const { config, version } = await getConfig();
    if (b.action === "financials")
      return NextResponse.json(await enrichFinancials(company.id));
    if (b.action === "findWebsite") {
      const result = await findWebsite(company.id, config);
      if (result.verified)
        await prisma.company.update({
          where: { id: company.id },
          data: {
            autoEnrichmentStep: "ANALYZE",
            autoEnrichmentNextAt: new Date(1),
            autoEnrichmentError: null,
          },
        });
      return NextResponse.json(result);
    }
    if (b.action === "outreach") {
      const score = company.scores[0] ?? null;
      const e = score?.evidenceIds[0]
        ? await prisma.evidence.findUnique({
            where: { id: score.evidenceIds[0] },
          })
        : undefined;
      const draft = await prisma.outreachDraft.create({
        data: {
          companyId: company.id,
          channel: b.channel,
          body: makeOutreach(b.channel, company, score, config, e ?? undefined),
          scoreId: score?.id,
        },
      });
      return NextResponse.json(draft);
    }
    if (!company.website) throw new Error("Tilføj en hjemmeside før analyse");
    if (!b.termsConfirmed)
      throw new Error(
        "Bekræft først, at hjemmesidens brugsvilkår er gennemgået",
      );
    await prisma.company.update({
      where: { id: company.id },
      data: { termsCheckedAt: new Date(), termsNote: b.termsNote },
    });
    const result = await analyzeCompany(company.id);
    return NextResponse.json(result, { status: result.status });
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json(
        {
          error: e.issues
            .map((x) => `${x.path.join(".")}: ${x.message}`)
            .join("; "),
        },
        { status: 400 },
      );
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(e.code);
      return NextResponse.json(
        { error: "Data kunne ikke gemmes. Genindlæs siden og prøv igen." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Handlingen fejlede" },
      { status: 400 },
    );
  }
}
