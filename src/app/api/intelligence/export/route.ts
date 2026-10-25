import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  buildSalesWorkbook,
  exportFilename,
  filterExportCompanies,
  sortExportCompanies,
  type ExportCompany,
  type ExportFilters,
} from "@/lib/intelligence/sales-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  id: z.string().min(1).max(100).optional(),
  search: z.string().max(200).optional(),
  priority: z.string().max(8).optional(),
  segment: z.string().max(120).optional(),
  status: z.string().max(40).optional(),
  relevance: z.string().max(40).optional(),
  sort: z.enum(["score", "name", "recent"]).default("score"),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = querySchema.parse(Object.fromEntries(url.searchParams));
    const filters: ExportFilters = {
      id: q.id,
      search: q.search,
      priority: q.priority,
      segment: q.segment,
      status: q.status,
      relevance: q.relevance,
    };

    const include = {
      scores: { orderBy: { createdAt: "desc" as const }, take: 1 },
      evidence: { orderBy: { fetchedAt: "desc" as const }, take: 40 },
      publicContacts: true,
      financials: { orderBy: { year: "desc" as const }, take: 1 },
      drafts: { orderBy: { createdAt: "desc" as const }, take: 8 },
      outreach: true,
    };
    const companies = (await prisma.company.findMany({
      where: q.id ? { id: q.id } : undefined,
      take: q.id ? undefined : 2000,
      orderBy: { createdAt: "desc" },
      include,
    })) as unknown as ExportCompany[];

    if (q.id && !companies.length) {
      return NextResponse.json(
        { error: "Virksomheden findes ikke" },
        { status: 404 },
      );
    }

    const rows = sortExportCompanies(
      filterExportCompanies(companies, filters),
      q.sort,
    );

    if (!rows.length) {
      return NextResponse.json(
        { error: "Ingen virksomheder matcher eksporten" },
        { status: 404 },
      );
    }

    const buffer = await buildSalesWorkbook(rows);
    const filename = exportFilename(filters);
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Export-Count": String(rows.length),
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ugyldige eksportparametre" },
        { status: 400 },
      );
    }
    console.error("Sales export failed", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Eksporten kunne ikke oprettes" },
      { status: 503 },
    );
  }
}
