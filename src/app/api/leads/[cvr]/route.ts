import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { SECTORS, type Nis2SectorKey } from "@/domain/nis2/sectors";
import { describeCeilings } from "@/domain/nis2/thresholds";
import { buildTeaser } from "@/lib/teaser";
import { toErrorMessage } from "@/lib/errors";
import { primaryWebsitePhone } from "@/lib/intelligence/contacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  ESSENTIAL: "Særlig kritisk enhed",
  IMPORTANT: "Vigtig enhed",
  SUPPLY_CHAIN_TARGET: "Leverandør til omfattede enheder",
  OUT_OF_SCOPE: "Ikke omfattet",
  NEEDS_REVIEW: "Kræver manuel gennemgang",
};

const ANNEX_LABEL: Record<string, string> = {
  ANNEX_1: "Bilag 1",
  ANNEX_2: "Bilag 2",
  NONE: "Uden for bilagene",
};

export async function GET(request: Request, context: { params: Promise<{ cvr: string }> }) {
  try {
    const { cvr } = await context.params;
    const clean = cvr.replace(/\D/g, "");

    const company = await prisma.company.findUnique({
      where: { cvr: clean },
      include: {
        assessments: { orderBy: { scopedAt: "desc" }, take: 5 },
        financials: { orderBy: { year: "desc" }, take: 5 },
        contacts: { where: { suppressed: false }, orderBy: { seniorityScore: "desc" } },
        publicContacts: {
          where: { kind: "PHONE" },
          orderBy: { fetchedAt: "desc" },
        },
        outreach: { include: { history: { orderBy: { createdAt: "desc" }, take: 20 } } },
      },
    });

    if (!company) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const assessment = company.assessments[0] ?? null;
    const financial = company.financials[0] ?? null;
    const primary = company.contacts[0] ?? null;

    const sectorKey = (assessment?.sector ?? "NONE") as Nis2SectorKey;
    const sectorLabel = sectorKey !== "NONE" ? SECTORS[sectorKey].labelDa : "ukendt sektor";
    const effectiveStatus = assessment?.overrideStatus ?? assessment?.status ?? "OUT_OF_SCOPE";

    const url = new URL(request.url);
    const senderName = url.searchParams.get("senderName") ?? "[Dit navn]";
    const senderCompany = url.searchParams.get("senderCompany") ?? "[Dit firma]";

    const teaser = buildTeaser({
      companyName: company.name,
      cvr: company.cvr,
      contactName: primary?.name ?? null,
      contactTitle: primary?.title ?? null,
      sectorLabel,
      annexLabel: ANNEX_LABEL[assessment?.annexType ?? "NONE"] ?? "Bilag 2",
      statusLabel: STATUS_LABEL[effectiveStatus] ?? effectiveStatus,
      employeeCount: company.employeeCount,
      balanceSheetDkk: financial?.balanceSheetDkk ? Number(financial.balanceSheetDkk) : null,
      revenueDkkK: financial?.revenueDkk ? Number(financial.revenueDkk) : null,
      financialYear: financial?.year ?? null,
      auditHook: assessment?.auditHook ?? null,
      senderName,
      senderCompany,
    });

    return NextResponse.json({
      company: {
        cvr: company.cvr,
        name: company.name,
        legalForm: company.legalForm,
        address: [company.addressStreet, `${company.addressPostalCode ?? ""} ${company.addressCity ?? ""}`.trim()]
          .filter(Boolean)
          .join(", "),
        municipality: company.addressMunicipality,
        db07Code: company.db07Code,
        db07Description: company.db07Description,
        employeeCount: company.employeeCount,
        employeeCountSource: company.employeeCountSource,
        officialEmail: company.officialEmail,
        // Salesperson phone is website-crawled; never surface stale CVR as primary.
        websitePhone: primaryWebsitePhone(company.publicContacts),
        officialPhone: primaryWebsitePhone(company.publicContacts),
        domain: company.domain,
        website: company.website,
        status: company.status,
        foundedAt: company.foundedAt,
      },
      assessment: assessment
        ? {
            ...assessment,
            effectiveStatus,
            statusLabel: STATUS_LABEL[effectiveStatus],
            annexLabel: ANNEX_LABEL[assessment.annexType],
            sectorLabel,
            revenueDkkUsed: assessment.revenueDkkUsed?.toString() ?? null,
            balanceDkkUsed: assessment.balanceDkkUsed?.toString() ?? null,
          }
        : null,
      assessmentHistory: company.assessments.slice(1).map((a) => ({
        id: a.id,
        status: a.status,
        scopedAt: a.scopedAt,
        rulesetVersion: a.rulesetVersion,
      })),
      financials: company.financials.map((f) => ({
        year: f.year,
        currency: f.currency,
        revenue: f.revenue?.toString() ?? null,
        grossProfit: f.grossProfit?.toString() ?? null,
        balanceSheet: f.balanceSheet?.toString() ?? null,
        equity: f.equity?.toString() ?? null,
        profitLoss: f.profitLoss?.toString() ?? null,
        employeesAvg: f.employeesAvg,
        reportUrl: f.reportUrl,
        reportFormat: f.reportFormat,
        parseWarnings: f.parseWarnings,
      })),
      contacts: company.contacts.map((c) => ({
        id: c.id,
        name: c.name,
        title: c.title,
        rawTitle: c.rawTitle,
        seniorityScore: c.seniorityScore,
        isPrimary: c.isPrimary,
        directEmail: c.directEmail,
        emailStatus: c.emailStatus,
        emailConfidence: c.emailConfidence,
        directPhone: c.directPhone,
        linkedinUrl: c.linkedinUrl,
        source: c.source,
        enrichedAt: c.enrichedAt,
      })),
      outreach: company.outreach,
      teaser,
      meta: { ceilings: describeCeilings(getEnv().EUR_DKK_RATE) },
    });
  } catch (e) {
    return NextResponse.json({ error: toErrorMessage(e) }, { status: 500 });
  }
}
