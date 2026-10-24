import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { toErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  status: z.string().optional(),          // comma-separated Nis2Status
  sector: z.string().optional(),          // comma-separated Nis2Sector
  annex: z.string().optional(),           // ANNEX_1 | ANNEX_2
  outreachStatus: z.string().optional(),
  minEmployees: z.coerce.number().int().optional(),
  maxEmployees: z.coerce.number().int().optional(),
  minTurnover: z.coerce.number().optional(),
  minBalance: z.coerce.number().optional(),
  hasVerifiedContact: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["name", "employeeCount", "balance", "scopedAt"]).default("scopedAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

const split = (v: string | undefined) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = querySchema.parse(Object.fromEntries(url.searchParams));

    const statuses = split(q.status);
    const sectors = split(q.sector);
    const outreach = split(q.outreachStatus);

    // Assessments are append-only; "the" assessment is the newest row per company.
    const assessmentFilter: Prisma.Nis2AssessmentWhereInput = {
      ...(statuses ? { status: { in: statuses as never } } : {}),
      ...(sectors ? { sector: { in: sectors as never } } : {}),
      ...(q.annex ? { annexType: q.annex as never } : {}),
    };

    const where: Prisma.CompanyWhereInput = {
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" } },
              { cvr: { contains: q.search.replace(/\D/g, "") } },
              { domain: { contains: q.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(q.minEmployees !== undefined || q.maxEmployees !== undefined
        ? {
            employeeCount: {
              ...(q.minEmployees !== undefined ? { gte: q.minEmployees } : {}),
              ...(q.maxEmployees !== undefined ? { lte: q.maxEmployees } : {}),
            },
          }
        : {}),
      ...(Object.keys(assessmentFilter).length ? { assessments: { some: assessmentFilter } } : {}),
      ...(outreach ? { outreach: { status: { in: outreach as never } } } : {}),
      ...(q.hasVerifiedContact === "true"
        ? { contacts: { some: { emailStatus: "VERIFIED", suppressed: false } } }
        : {}),
      ...(q.minTurnover !== undefined || q.minBalance !== undefined
        ? {
            financials: {
              some: {
                ...(q.minTurnover !== undefined ? { revenueDkk: { gte: new Prisma.Decimal(q.minTurnover) } } : {}),
                ...(q.minBalance !== undefined ? { balanceSheetDkk: { gte: new Prisma.Decimal(q.minBalance) } } : {}),
              },
            },
          }
        : {}),
    };

    const orderBy: Prisma.CompanyOrderByWithRelationInput =
      q.sortBy === "name"
        ? { name: q.sortDir }
        : q.sortBy === "employeeCount"
          ? { employeeCount: q.sortDir }
          : { updatedAt: q.sortDir };

    const [total, companies] = await Promise.all([
      prisma.company.count({ where }),
      prisma.company.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          assessments: { orderBy: { scopedAt: "desc" }, take: 1 },
          financials: { orderBy: { year: "desc" }, take: 1 },
          outreach: true,
          contacts: {
            where: { suppressed: false },
            orderBy: { seniorityScore: "desc" },
            take: 4,
            select: {
              id: true,
              name: true,
              title: true,
              directEmail: true,
              emailStatus: true,
              linkedinUrl: true,
            },
          },
          _count: { select: { contacts: true } },
        },
      }),
    ]);

    const leads = companies.map((c) => {
      const a = c.assessments[0];
      const f = c.financials[0];
      return {
        cvr: c.cvr,
        name: c.name,
        domain: c.domain,
        city: c.addressCity,
        db07Code: c.db07Code,
        db07Description: c.db07Description,
        employeeCount: c.employeeCount,
        status: c.status,
        nis2: a
          ? {
              status: a.overrideStatus ?? a.status,
              sector: a.sector,
              subSector: a.subSector,
              annexType: a.annexType,
              sizeClass: a.sizeClass,
              deterministicMatch: a.deterministicMatch,
              sizeExempt: a.sizeExempt,
              confidence: a.llmConfidence,
              conflict: a.conflict,
              auditHook: a.auditHook,
              scopedAt: a.scopedAt,
            }
          : null,
        financials: f
          ? {
              year: f.year,
              revenueDkk: f.revenueDkk?.toString() ?? null,
              balanceSheetDkk: f.balanceSheetDkk?.toString() ?? null,
              grossProfit: f.grossProfit?.toString() ?? null,
            }
          : null,
        outreach: c.outreach
          ? { status: c.outreach.status, assignedTo: c.outreach.assignedTo, nextFollowUpAt: c.outreach.nextFollowUpAt }
          : { status: "NEW", assignedTo: null, nextFollowUpAt: null },
        contacts: c.contacts,
        contactCount: c._count.contacts,
        verifiedContactCount: c.contacts.filter((x) => x.emailStatus === "VERIFIED").length,
      };
    });

    // KPI bar — computed over the same filter so the numbers match the table.
    const kpiGroups = await prisma.nis2Assessment.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { company: where },
    });
    const kpis = {
      total,
      essential: kpiGroups.find((g) => g.status === "ESSENTIAL")?._count._all ?? 0,
      important: kpiGroups.find((g) => g.status === "IMPORTANT")?._count._all ?? 0,
      supplyChain: kpiGroups.find((g) => g.status === "SUPPLY_CHAIN_TARGET")?._count._all ?? 0,
      needsReview: kpiGroups.find((g) => g.status === "NEEDS_REVIEW")?._count._all ?? 0,
      verifiedContacts: await prisma.contactPerson.count({
        where: { emailStatus: "VERIFIED", suppressed: false, company: where },
      }),
    };

    return NextResponse.json({
      leads,
      kpis,
      pagination: { page: q.page, pageSize: q.pageSize, total, pages: Math.ceil(total / q.pageSize) },
    });
  } catch (e) {
    return NextResponse.json({ error: toErrorMessage(e) }, { status: 400 });
  }
}
