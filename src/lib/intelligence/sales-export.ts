import ExcelJS from "exceljs";
import {
  levelLabels,
  relevanceLabels,
  stages,
} from "@/lib/intelligence/config";
import {
  primaryWebsitePhone,
  salesFacingContacts,
} from "@/lib/intelligence/contacts";

/** Minimal company shape needed to build a salesperson workbook row. */
export interface ExportCompany {
  id: string;
  cvr: string;
  name: string;
  status: string;
  website: string | null;
  addressCity: string | null;
  db07Description: string | null;
  employeeCount: number | null;
  employeeMin: number | null;
  employeeMax: number | null;
  importedRevenue: { toString(): string } | string | null;
  scores: {
    value: number;
    priority: string;
    segment: string;
    relevance: string;
    directLevel: string;
    supplyLevel: string;
    coverage: string;
    explanation: string;
    angle: string;
    evidenceIds: string[];
    createdAt: Date | string;
    icp: {
      fit: string;
      segment: string;
      size: string;
      customers: string;
      summary: string;
    } | null;
  }[];
  evidence: {
    id: string;
    keyword: string;
    signal: string;
    excerpt: string;
    url: string;
  }[];
  publicContacts: {
    kind: string;
    name: string | null;
    title: string | null;
    value: string;
    sourceUrl: string;
  }[];
  drafts: { channel: string; body: string; createdAt: Date | string }[];
  outreach: {
    status: string;
    notes: string | null;
    nextAction: string | null;
    nextFollowUpAt: Date | string | null;
  } | null;
  financials: {
    year: number;
    revenue: { toString(): string } | string | null;
    grossProfit: { toString(): string } | string | null;
  }[];
}

export const exportColumns = [
  "Virksomhedsnavn",
  "CVR",
  "Registerstatus",
  "Salgsstatus",
  "Hjemmeside",
  "By",
  "Branche",
  "Ansatte",
  "Omsætning (DKK)",
  "Seneste regnskabsår",
  "Leadscore",
  "Prioritet",
  "Segment",
  "Relevans",
  "ICP-match",
  "ICP-størrelse",
  "ICP-kunder",
  "ICP-opsummering",
  "Direkte relevans",
  "Afledte kundekrav",
  "Datadækning",
  "Forklaring",
  "Anbefalet vinkel",
  "Signaler",
  "Telefon",
  "Kontakter",
  "Noter",
  "Næste handling",
  "Opfølgningsdato",
  "Udkast (oversigt)",
  "Analyse dato",
] as const;

export type ExportColumn = (typeof exportColumns)[number];
export type ExportRow = Record<ExportColumn, string | number | null>;

const registryStatus: Record<string, string> = {
  ACTIVE: "Aktiv",
  UNDER_BANKRUPTCY: "Under konkurs",
  UNDER_DISSOLUTION: "Under opløsning",
  DISSOLVED: "Opløst",
  UNKNOWN: "Ukendt",
};

const icpFit: Record<string, string> = {
  STRONG: "Stærkt",
  POSSIBLE: "Muligt",
  LOW: "Lavt",
  UNKNOWN: "Uafklaret",
};

const channelLabel: Record<string, string> = {
  EMAIL: "E-mail",
  PHONE: "Telefon",
  LINKEDIN: "LinkedIn",
  WEBINAR: "Webinar",
};

const coverageLabel: Record<string, string> = {
  COMPLETE: "Brugbart udsnit",
  PARTIAL: "Ufuldstændig",
  NONE: "Ingen",
};

function employees(c: ExportCompany): string {
  if (c.employeeCount !== null) return String(c.employeeCount);
  if (c.employeeMin !== null)
    return `${c.employeeMin}–${c.employeeMax ?? c.employeeMin}`;
  return "";
}

function money(value: { toString(): string } | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(typeof value === "string" ? value : value.toString());
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("da-DK", {
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function contactLine(c: ExportCompany["publicContacts"][number]): string {
  const role =
    c.kind === "ROLE"
      ? "Ledelsesrolle (CVR)"
      : c.kind === "PHONE"
        ? c.name
          ? [c.name, c.title].filter(Boolean).join(" · ") + " · hjemmeside"
          : "Telefon (hjemmeside)"
        : c.name
          ? [c.name, c.title].filter(Boolean).join(" · ")
          : "Fælles kontakt";
  return `${c.value} (${role})`;
}

function draftSummary(drafts: ExportCompany["drafts"]): string {
  if (!drafts.length) return "";
  return drafts
    .map((d) => {
      const label = channelLabel[d.channel] ?? d.channel;
      const preview = d.body.replace(/\s+/g, " ").trim().slice(0, 160);
      return `${label}: ${preview}${d.body.length > 160 ? "…" : ""}`;
    })
    .join("\n\n");
}

function signalSummary(c: ExportCompany, score: ExportCompany["scores"][0] | undefined): string {
  const ids = new Set(score?.evidenceIds ?? []);
  const rows = (ids.size
    ? c.evidence.filter((e) => ids.has(e.id))
    : c.evidence
  ).slice(0, 8);
  if (!rows.length) return "";
  return rows
    .map((e) => `${e.keyword}: “${e.excerpt.replace(/\s+/g, " ").trim().slice(0, 120)}”`)
    .join("\n");
}

/** Map one company to a Danish salesperson row. */
export function toExportRow(c: ExportCompany): ExportRow {
  const score = c.scores[0];
  const financial = c.financials[0];
  const revenue =
    c.importedRevenue !== null && c.importedRevenue !== undefined
      ? money(c.importedRevenue)
      : money(financial?.revenue) ||
        (financial?.grossProfit
          ? `Bruttofortjeneste ${money(financial.grossProfit)}`
          : "");

  return {
    Virksomhedsnavn: c.name,
    CVR: c.cvr,
    Registerstatus: registryStatus[c.status] ?? c.status,
    Salgsstatus: stages[c.outreach?.status ?? "NEW"] ?? c.outreach?.status ?? "Ny",
    Hjemmeside: c.website ?? "",
    By: c.addressCity ?? "",
    Branche: c.db07Description ?? "",
    Ansatte: employees(c),
    "Omsætning (DKK)": revenue,
    "Seneste regnskabsår": financial?.year ?? null,
    Leadscore: score?.value ?? null,
    Prioritet: score?.priority ?? "",
    Segment: score?.segment ?? "",
    Relevans: score ? (relevanceLabels[score.relevance] ?? score.relevance) : "",
    "ICP-match": score?.icp ? (icpFit[score.icp.fit] ?? score.icp.fit) : "",
    "ICP-størrelse": score?.icp?.size ?? "",
    "ICP-kunder": score?.icp?.customers ?? "",
    "ICP-opsummering": score?.icp?.summary ?? "",
    "Direkte relevans": score
      ? (levelLabels[score.directLevel] ?? score.directLevel)
      : "",
    "Afledte kundekrav": score
      ? (levelLabels[score.supplyLevel] ?? score.supplyLevel)
      : "",
    Datadækning: score
      ? (coverageLabel[score.coverage] ?? score.coverage)
      : "",
    Forklaring: score?.explanation ?? "",
    "Anbefalet vinkel": score?.angle ?? "",
    Signaler: signalSummary(c, score),
    Telefon: primaryWebsitePhone(c.publicContacts) ?? "",
    Kontakter: salesFacingContacts(c.publicContacts).map(contactLine).join("\n"),
    Noter: c.outreach?.notes ?? "",
    "Næste handling": c.outreach?.nextAction ?? "",
    Opfølgningsdato: formatDate(c.outreach?.nextFollowUpAt),
    "Udkast (oversigt)": draftSummary(c.drafts),
    "Analyse dato": formatDate(score?.createdAt),
  };
}

export interface ExportFilters {
  id?: string;
  search?: string;
  priority?: string;
  segment?: string;
  status?: string;
  relevance?: string;
}

/** Apply the same filter semantics as the dashboard company list. */
export function filterExportCompanies(
  companies: ExportCompany[],
  filters: ExportFilters,
): ExportCompany[] {
  if (filters.id) return companies.filter((c) => c.id === filters.id);
  const search = filters.search?.trim().toLowerCase() ?? "";
  return companies.filter((c) => {
    const s = c.scores[0];
    return (
      (!search ||
        `${c.name} ${c.cvr} ${c.website ?? ""}`
          .toLowerCase()
          .includes(search)) &&
      (!filters.priority || s?.priority === filters.priority) &&
      (!filters.segment || s?.segment === filters.segment) &&
      (!filters.status || (c.outreach?.status ?? "NEW") === filters.status) &&
      (!filters.relevance || (s?.relevance ?? "REVIEW") === filters.relevance)
    );
  });
}

export function sortExportCompanies(
  companies: ExportCompany[],
  sort: "score" | "name" | "recent" = "score",
): ExportCompany[] {
  return [...companies].sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name, "da")
      : sort === "recent"
        ? new Date(b.scores[0]?.createdAt ?? 0).getTime() -
          new Date(a.scores[0]?.createdAt ?? 0).getTime()
        : (b.scores[0]?.value ?? -1) - (a.scores[0]?.value ?? -1),
  );
}

export async function buildSalesWorkbook(
  companies: ExportCompany[],
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Northstar Lead Intelligence";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Leads", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = exportColumns.map((header) => ({
    header,
    key: header,
    width: Math.min(42, Math.max(12, header.length + 2)),
  }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF0F172A" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  header.alignment = { vertical: "middle", wrapText: true };

  for (const company of companies) {
    const row = toExportRow(company);
    const excelRow = sheet.addRow(exportColumns.map((col) => row[col]));
    excelRow.alignment = { vertical: "top", wrapText: true };
  }

  for (const col of ["Signaler", "Kontakter", "Noter", "Udkast (oversigt)", "Forklaring", "ICP-opsummering"]) {
    const column = sheet.getColumn(col);
    column.width = 36;
  }
  sheet.getColumn("Telefon").width = 16;
  sheet.getColumn("Hjemmeside").width = 28;
  sheet.getColumn("Virksomhedsnavn").width = 28;

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

export function exportFilename(filters: ExportFilters): string {
  const stamp = new Date().toISOString().slice(0, 10);
  if (filters.id) return `northstar-lead-${stamp}.xlsx`;
  return `northstar-leads-${stamp}.xlsx`;
}
