import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { createLogger } from "@/lib/logger";
import { toErrorMessage } from "@/lib/errors";
import type { Nis2SectorKey } from "@/domain/nis2/sectors";
import { discoverCompanies, getCompaniesByCvr, getPublishedReports, type CvrCompany } from "./cvrService";
import { parseReport, toDkk } from "./xbrlParser";
import { scopeCompany, RULESET_VERSION } from "./nis2Scoper";
import { enrichCompanyContacts } from "./contactEnricher";

const log = createLogger("pipeline");

export interface PipelineOptions {
  sectors?: Nis2SectorKey[];
  db07Prefixes?: string[];
  cvrList?: string[];
  minEmployees?: number | null;
  maxCompanies?: number;
  /** Skip companies scoped under the current ruleset within this many days. */
  skipIfScopedWithinDays?: number;
  enrichContacts?: boolean;
  trigger?: string;
}

export interface PipelineSummary {
  runId: string;
  companiesDiscovered: number;
  reportsParsed: number;
  companiesScoped: number;
  contactsEnriched: number;
  errorCount: number;
  status: "SUCCEEDED" | "PARTIAL" | "FAILED";
}

async function logEvent(
  runId: string,
  stage: string,
  level: "info" | "warn" | "error",
  message: string,
  companyId?: string | null,
  payload?: Prisma.InputJsonValue,
) {
  try {
    await prisma.pipelineEvent.create({
      data: { runId, stage, level, message, companyId: companyId ?? null, payload },
    });
  } catch (e) {
    log.error("failed to persist pipeline event", { error: toErrorMessage(e) });
  }
}

async function upsertCompany(c: CvrCompany) {
  return prisma.company.upsert({
    where: { cvr: c.cvr },
    create: {
      cvr: c.cvr,
      name: c.name,
      legalForm: c.legalForm,
      addressStreet: c.addressStreet,
      addressPostalCode: c.addressPostalCode,
      addressCity: c.addressCity,
      addressMunicipality: c.addressMunicipality,
      db07Code: c.db07Code,
      db07Description: c.db07Description,
      secondaryDb07: c.secondaryDb07,
      employeeCount: c.employeeCount,
      employeeCountSource: c.employeeCountSource,
      employeeCountAsOf: c.employeeCountAsOf,
      officialEmail: c.officialEmail,
      // Website crawl owns the salesperson phone; never seed from stale CVR.
      officialPhone: null,
      domain: c.domain,
      website: c.website,
      status: c.status,
      statusRaw: c.statusRaw,
      foundedAt: c.foundedAt,
      cvrUpdatedAt: c.cvrUpdatedAt,
      outreach: { create: {} },
    },
    update: {
      name: c.name,
      db07Code: c.db07Code,
      db07Description: c.db07Description,
      secondaryDb07: c.secondaryDb07,
      employeeCount: c.employeeCount,
      employeeCountSource: c.employeeCountSource,
      employeeCountAsOf: c.employeeCountAsOf,
      officialEmail: c.officialEmail,
      // Do not overwrite website phone with CVR registry phone.
      domain: c.domain,
      website: c.website,
      status: c.status,
      statusRaw: c.statusRaw,
      cvrUpdatedAt: c.cvrUpdatedAt,
    },
  });
}

/**
 * End-to-end run: discover -> financials -> scope -> enrich.
 *
 * Every stage is per-company and failure-isolated. One unparseable annual
 * report must not abort a 4000-company sweep, so errors are counted and
 * recorded against the company rather than thrown.
 */
export async function runPipeline(options: PipelineOptions = {}): Promise<PipelineSummary> {
  const env = getEnv();
  const {
    sectors,
    db07Prefixes,
    cvrList,
    minEmployees = null,
    maxCompanies = 500,
    skipIfScopedWithinDays = 30,
    enrichContacts = true,
    trigger = "api",
  } = options;

  const run = await prisma.pipelineRun.create({
    data: {
      status: "RUNNING",
      trigger,
      sectors: (sectors ?? []) as never,
      db07Codes: db07Prefixes ?? [],
      cvrList: cvrList ?? [],
    },
  });

  let discovered = 0;
  let reportsParsed = 0;
  let scoped = 0;
  let enriched = 0;
  let errors = 0;

  const staleBefore = new Date(Date.now() - skipIfScopedWithinDays * 86_400_000);

  const process = async (company: CvrCompany) => {
    discovered += 1;
    let dbCompany: Awaited<ReturnType<typeof upsertCompany>> | null = null;

    try {
      dbCompany = await upsertCompany(company);

      const recent = await prisma.nis2Assessment.findFirst({
        where: { companyId: dbCompany.id, rulesetVersion: RULESET_VERSION, scopedAt: { gte: staleBefore } },
        select: { id: true },
      });
      if (recent) {
        log.debug("skipping recently scoped company", { cvr: company.cvr });
        return;
      }

      // ---- Financials ----
      let turnoverDkk: number | null = null;
      let balanceDkk: number | null = null;
      let managementReview: string | null = null;
      let financialYear: number | null = null;

      try {
        const [latest] = await getPublishedReports(company.cvr, 1);
        if (latest) {
          const parsed = await parseReport(latest);
          reportsParsed += 1;

          const revenue = toDkk(parsed.revenue, parsed.currency, { DKK: 1, EUR: env.EUR_DKK_RATE });
          const balance = toDkk(parsed.balanceSheet, parsed.currency, { DKK: 1, EUR: env.EUR_DKK_RATE });
          turnoverDkk = revenue.value;
          balanceDkk = balance.value;
          managementReview = parsed.managementReview;
          financialYear = parsed.year;

          if (parsed.year !== null) {
            await prisma.financialData.upsert({
              where: { companyId_year: { companyId: dbCompany.id, year: parsed.year } },
              create: {
                companyId: dbCompany.id,
                year: parsed.year,
                periodStart: parsed.periodStart,
                periodEnd: parsed.periodEnd,
                currency: parsed.currency,
                revenue: parsed.revenue !== null ? new Prisma.Decimal(parsed.revenue) : null,
                grossProfit: parsed.grossProfit !== null ? new Prisma.Decimal(parsed.grossProfit) : null,
                balanceSheet: parsed.balanceSheet !== null ? new Prisma.Decimal(parsed.balanceSheet) : null,
                equity: parsed.equity !== null ? new Prisma.Decimal(parsed.equity) : null,
                profitLoss: parsed.profitLoss !== null ? new Prisma.Decimal(parsed.profitLoss) : null,
                employeesAvg: parsed.employeesAvg,
                revenueDkk: turnoverDkk !== null ? new Prisma.Decimal(turnoverDkk) : null,
                balanceSheetDkk: balanceDkk !== null ? new Prisma.Decimal(balanceDkk) : null,
                fxRateToDkk: revenue.rate ?? balance.rate,
                managementReview: parsed.managementReview,
                reportUrl: parsed.reportUrl,
                reportFormat: parsed.reportFormat ?? undefined,
                publicationId: parsed.publicationId,
                publishedAt: parsed.publishedAt,
                documentHash: parsed.documentHash,
                parseWarnings: parsed.warnings,
              },
              update: {
                revenueDkk: turnoverDkk !== null ? new Prisma.Decimal(turnoverDkk) : null,
                balanceSheetDkk: balanceDkk !== null ? new Prisma.Decimal(balanceDkk) : null,
                managementReview: parsed.managementReview,
                parseWarnings: parsed.warnings,
                documentHash: parsed.documentHash,
              },
            });
          }
          if (parsed.warnings.length) {
            await logEvent(run.id, "financials", "warn", parsed.warnings.join(" | "), dbCompany.id);
          }
        }
      } catch (e) {
        errors += 1;
        await logEvent(run.id, "financials", "error", toErrorMessage(e), dbCompany.id);
      }

      // Employee count from the report beats a stale registry figure.
      const employeeCount = company.employeeCount;

      // ---- Scoping ----
      const assessment = await scopeCompany({
        cvr: company.cvr,
        name: company.name,
        db07Code: company.db07Code,
        db07Description: company.db07Description,
        employeeCount,
        turnoverDkk,
        balanceDkk,
        financialYear,
        managementReview,
        companyPurpose: company.purpose,
      });

      await prisma.nis2Assessment.create({
        data: {
          companyId: dbCompany.id,
          status: assessment.status,
          sector: assessment.sector,
          subSector: assessment.subSector,
          annexType: assessment.annexType,
          sizeClass: assessment.size.sizeClass,
          deterministicMatch: assessment.deterministicMatch,
          sizeExempt: assessment.sizeExempt,
          employeeCountUsed: assessment.employeeCountUsed,
          revenueDkkUsed:
            assessment.revenueDkkUsed !== null ? new Prisma.Decimal(assessment.revenueDkkUsed) : null,
          balanceDkkUsed:
            assessment.balanceDkkUsed !== null ? new Prisma.Decimal(assessment.balanceDkkUsed) : null,
          financialYearUsed: assessment.financialYearUsed,
          deterministicRules: assessment.size.rules as unknown as Prisma.InputJsonValue,
          llmReasoning: assessment.llmReasoning,
          llmConfidence: assessment.llmConfidence,
          llmModel: assessment.llmModel,
          llmSectorEvidence: assessment.llmSectorEvidence,
          supplyChainSignals: assessment.supplyChainSignals,
          conflict: assessment.conflict,
          conflictNote: assessment.conflictNote,
          auditHook: assessment.auditHook,
          rulesetVersion: assessment.rulesetVersion,
          scopedAt: assessment.scopedAt,
        },
      });
      scoped += 1;

      // ---- Enrichment ----
      // Only for leads worth the credits: out-of-scope companies never get enriched.
      const worthEnriching =
        enrichContacts &&
        ["ESSENTIAL", "IMPORTANT", "SUPPLY_CHAIN_TARGET"].includes(assessment.status) &&
        company.executives.length > 0;

      if (worthEnriching) {
        try {
          const suppressedNames = new Set(
            (
              await prisma.contactPerson.findMany({
                where: { companyId: dbCompany.id, suppressed: true },
                select: { name: true },
              })
            ).map((c) => c.name),
          );

          const { contacts, enrichedCount, warnings } = await enrichCompanyContacts(
            { cvr: company.cvr, name: company.name, domain: company.domain },
            company.executives,
            { isSuppressed: (name) => suppressedNames.has(name) },
          );
          enriched += enrichedCount;

          for (const contact of contacts) {
            if (suppressedNames.has(contact.name)) continue;
            await prisma.contactPerson.upsert({
              where: {
                companyId_name_source: {
                  companyId: dbCompany.id,
                  name: contact.name,
                  source: contact.source,
                },
              },
              create: {
                companyId: dbCompany.id,
                cvrUnitNumber: contact.cvrUnitNumber,
                name: contact.name,
                rawTitle: contact.rawTitle,
                title: contact.title,
                seniorityScore: contact.seniorityScore,
                isPrimary: contact.isPrimary,
                directEmail: contact.directEmail,
                emailStatus: contact.emailStatus,
                emailConfidence: contact.emailConfidence,
                directPhone: contact.directPhone,
                linkedinUrl: contact.linkedinUrl,
                source: contact.source,
                enrichedAt: contact.enrichedAt,
                enrichmentRaw: (contact.enrichmentRaw ?? undefined) as Prisma.InputJsonValue,
              },
              update: {
                rawTitle: contact.rawTitle,
                title: contact.title,
                seniorityScore: contact.seniorityScore,
                isPrimary: contact.isPrimary,
                directEmail: contact.directEmail ?? undefined,
                emailStatus: contact.emailStatus,
                emailConfidence: contact.emailConfidence,
                directPhone: contact.directPhone ?? undefined,
                linkedinUrl: contact.linkedinUrl ?? undefined,
                enrichedAt: contact.enrichedAt,
              },
            });
          }

          if (warnings.length) {
            await logEvent(run.id, "enrichment", "warn", warnings.join(" | "), dbCompany.id);
          }
        } catch (e) {
          errors += 1;
          await logEvent(run.id, "enrichment", "error", toErrorMessage(e), dbCompany.id);
        }
      }

      // Auto-qualify: a scoped lead with a reachable decision-maker is ready to work.
      if (["ESSENTIAL", "IMPORTANT"].includes(assessment.status)) {
        await prisma.leadOutreachStatus.upsert({
          where: { companyId: dbCompany.id },
          create: { companyId: dbCompany.id, status: "QUALIFIED" },
          update: {},
        }).catch(() => undefined);
      }
    } catch (e) {
      errors += 1;
      log.error("company failed", { cvr: company.cvr, error: toErrorMessage(e) });
      await logEvent(run.id, "ingest", "error", toErrorMessage(e), dbCompany?.id ?? null);
    }
  };

  try {
    if (cvrList?.length) {
      const companies = await getCompaniesByCvr(cvrList);
      for (const company of companies) await process(company);
    } else {
      for await (const company of discoverCompanies({
        sectors,
        db07Prefixes,
        minEmployees,
        maxResults: maxCompanies,
      })) {
        await process(company);
        if (discovered >= maxCompanies) break;
      }
    }

    const status = errors === 0 ? "SUCCEEDED" : "PARTIAL";
    await prisma.pipelineRun.update({
      where: { id: run.id },
      data: {
        status,
        finishedAt: new Date(),
        companiesDiscovered: discovered,
        reportsParsed,
        companiesScoped: scoped,
        contactsEnriched: enriched,
        errorCount: errors,
      },
    });

    return {
      runId: run.id,
      companiesDiscovered: discovered,
      reportsParsed,
      companiesScoped: scoped,
      contactsEnriched: enriched,
      errorCount: errors,
      status,
    };
  } catch (e) {
    await prisma.pipelineRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), error: toErrorMessage(e), errorCount: errors + 1 },
    });
    throw e;
  }
}
