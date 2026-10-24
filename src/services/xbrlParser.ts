import crypto from "node:crypto";
import { XMLParser } from "fast-xml-parser";

import { ParseError, toErrorMessage } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { fetchReportDocument, type PublishedReport } from "./cvrService";

const log = createLogger("xbrlParser");

/**
 * Danish annual reports are filed against the "Årsregnskabsloven" XBRL taxonomy
 * (namespace prefix `fsa`). Two shapes turn up:
 *
 *   - .xml   plain XBRL instance      -> facts are elements
 *   - .xhtml iXBRL (inline)           -> facts are ix:nonFraction / ix:nonNumeric
 *
 * Both are handled here. PDF-only filings fall back to text extraction, which
 * is lossy — every value it produces is flagged in `warnings`.
 */

export interface ParsedFinancials {
  year: number | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  currency: string;
  revenue: number | null;
  grossProfit: number | null;
  balanceSheet: number | null;
  equity: number | null;
  profitLoss: number | null;
  employeesAvg: number | null;
  managementReview: string | null;
  reportUrl: string | null;
  reportFormat: "XBRL" | "IXBRL" | "PDF" | null;
  publicationId: string | null;
  publishedAt: Date | null;
  documentHash: string | null;
  warnings: string[];
}

// Local element names, in priority order. First hit wins.
const TAGS = {
  revenue: ["Revenue", "NetTurnover", "Nettoomsaetning"],
  grossProfit: ["GrossProfitLoss", "GrossResult", "GrossProfit"],
  balanceSheet: ["Assets", "AssetsTotal", "LiabilitiesAndEquity", "BalanceSheetTotal"],
  equity: ["Equity", "EquityTotal"],
  profitLoss: ["ProfitLoss", "ProfitLossFromOrdinaryActivitiesAfterTax"],
  employees: [
    "AverageNumberOfEmployees",
    "EmployeesNumberAverageNumberOfEmployees",
    "AverageNumberOfFullTimeEmployees",
  ],
  managementReview: [
    "ManagementsReview",
    "ManagementCommentary",
    "DescriptionOfPrincipalActivitiesOfEntity",
    "DescriptionOfEntityPrincipalActivities",
    "InformationOnUnusualCircumstancesAffectingRecognitionOrMeasurement",
  ],
} as const;

interface Fact {
  localName: string;
  contextRef: string | null;
  unitRef: string | null;
  decimals: string | null;
  scale: number;
  sign: number;
  value: string;
}

interface ContextInfo {
  id: string;
  instant: string | null;
  startDate: string | null;
  endDate: string | null;
  /** Contexts carrying explicit dimensions describe segments/prior years — skipped. */
  hasDimensions: boolean;
}

const localName = (tag: string) => (tag.includes(":") ? tag.split(":").pop()! : tag);

function parseNumber(raw: string, scale: number, sign: number): number | null {
  // Danish filings use "." thousands separators and "," decimals in iXBRL text.
  const cleaned = raw
    .replace(/\s| /g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".")
    .replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n * 10 ** scale * sign;
}

function walk(node: unknown, visit: (tag: string, value: any) => void, tag = ""): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit, tag);
    return;
  }
  if (typeof node !== "object") return;

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key.startsWith("@_") || key === "#text") continue;
    visit(key, value);
    walk(value, visit, key);
  }
}

function collect(doc: unknown): { facts: Fact[]; contexts: Map<string, ContextInfo> } {
  const facts: Fact[] = [];
  const contexts = new Map<string, ContextInfo>();

  const handleContext = (value: any) => {
    const entries = Array.isArray(value) ? value : [value];
    for (const ctx of entries) {
      const id = ctx?.["@_id"];
      if (!id) continue;
      const period = ctx?.period ?? ctx?.["xbrli:period"] ?? {};
      const entity = ctx?.entity ?? ctx?.["xbrli:entity"] ?? {};
      const segment = entity?.segment ?? entity?.["xbrli:segment"] ?? null;
      const scenario = ctx?.scenario ?? ctx?.["xbrli:scenario"] ?? null;
      contexts.set(String(id), {
        id: String(id),
        instant: period?.instant ?? period?.["xbrli:instant"] ?? null,
        startDate: period?.startDate ?? period?.["xbrli:startDate"] ?? null,
        endDate: period?.endDate ?? period?.["xbrli:endDate"] ?? null,
        hasDimensions: Boolean(segment || scenario),
      });
    }
  };

  const handleFact = (tag: string, value: any) => {
    const entries = Array.isArray(value) ? value : [value];
    for (const entry of entries) {
      if (entry === null || entry === undefined) continue;
      const isObject = typeof entry === "object";
      const text = isObject ? entry["#text"] : entry;
      const attrs = isObject ? entry : {};
      // iXBRL wraps facts: the real element name lives in @_name.
      const name = attrs["@_name"] ? localName(String(attrs["@_name"])) : localName(tag);
      if (text === undefined || text === null || String(text).trim() === "") continue;
      facts.push({
        localName: name,
        contextRef: attrs["@_contextRef"] ?? null,
        unitRef: attrs["@_unitRef"] ?? null,
        decimals: attrs["@_decimals"] ?? null,
        scale: Number(attrs["@_scale"] ?? 0) || 0,
        sign: attrs["@_sign"] === "-" ? -1 : 1,
        value: String(text),
      });
    }
  };

  walk(doc, (tag, value) => {
    const name = localName(tag);
    if (name === "context") handleContext(value);
    else if (typeof value !== "object" || value === null || "#text" in (value as object) || "@_name" in (value as object)) {
      handleFact(tag, value);
    } else if (Array.isArray(value)) {
      handleFact(tag, value);
    }
  });

  return { facts, contexts };
}

/** The reporting period: the longest dimension-free duration ending latest. */
function primaryContexts(contexts: Map<string, ContextInfo>): { duration: ContextInfo | null; instant: ContextInfo | null } {
  const clean = [...contexts.values()].filter((c) => !c.hasDimensions);
  const durations = clean.filter((c) => c.startDate && c.endDate);
  const instants = clean.filter((c) => c.instant);

  const duration =
    durations
      .slice()
      .sort((a, b) => {
        const endCmp = (a.endDate ?? "").localeCompare(b.endDate ?? "");
        if (endCmp !== 0) return endCmp;
        const spanA = Date.parse(a.endDate!) - Date.parse(a.startDate!);
        const spanB = Date.parse(b.endDate!) - Date.parse(b.startDate!);
        return spanA - spanB;
      })
      .pop() ?? null;

  const instant =
    instants.slice().sort((a, b) => (a.instant ?? "").localeCompare(b.instant ?? "")).pop() ?? null;

  return { duration, instant };
}

function factValue(
  facts: Fact[],
  names: readonly string[],
  allowedContexts: Set<string>,
): { value: number | null; raw: Fact | null } {
  for (const name of names) {
    const candidates = facts.filter(
      (f) => f.localName === name && (f.contextRef === null || allowedContexts.has(f.contextRef)),
    );
    for (const f of candidates) {
      const n = parseNumber(f.value, f.scale, f.sign);
      if (n !== null) return { value: n, raw: f };
    }
  }
  return { value: null, raw: null };
}

function textValue(facts: Fact[], names: readonly string[]): string | null {
  const chunks: string[] = [];
  for (const name of names) {
    for (const f of facts.filter((x) => x.localName === name)) {
      const cleaned = f.value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (cleaned.length > 40 && !chunks.includes(cleaned)) chunks.push(cleaned);
    }
  }
  return chunks.length ? chunks.join("\n\n") : null;
}

function detectCurrency(facts: Fact[]): string {
  const withUnit = facts.find((f) => f.unitRef);
  const unit = withUnit?.unitRef?.toUpperCase() ?? "";
  if (unit.includes("EUR")) return "EUR";
  if (unit.includes("USD")) return "USD";
  return "DKK";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseXbrl(xml: string, format: "XBRL" | "IXBRL"): Omit<ParsedFinancials, "reportUrl" | "publicationId" | "publishedAt" | "documentHash"> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false,
    removeNSPrefix: false,
    isArray: (name) => localName(name) === "context",
  });

  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch (e) {
    throw new ParseError(`XBRL document is not well-formed XML: ${toErrorMessage(e)}`, e);
  }

  const { facts, contexts } = collect(doc);
  if (!facts.length) throw new ParseError("No XBRL facts found in document");

  const { duration, instant } = primaryContexts(contexts);
  const warnings: string[] = [];
  if (!duration) warnings.push("No dimension-free duration context — period figures may come from a comparison year.");

  const durationIds = new Set(
    [...contexts.values()].filter((c) => !c.hasDimensions && c.endDate === duration?.endDate).map((c) => c.id),
  );
  const instantIds = new Set(
    [...contexts.values()].filter((c) => !c.hasDimensions && c.instant === instant?.instant).map((c) => c.id),
  );

  const revenue = factValue(facts, TAGS.revenue, durationIds).value;
  const grossProfit = factValue(facts, TAGS.grossProfit, durationIds).value;
  const balanceSheet = factValue(facts, TAGS.balanceSheet, instantIds).value;

  if (revenue === null && grossProfit !== null) {
    // Accounting class B may omit turnover entirely (ÅRL §32). Gross profit is
    // a lower bound, never a substitute — the size test must know the difference.
    warnings.push("Nettoomsætning not disclosed (regnskabsklasse B) — only bruttofortjeneste available.");
  }
  if (balanceSheet === null) warnings.push("Balancesum not found in the instance document.");

  const endDate = duration?.endDate ?? instant?.instant ?? null;

  return {
    year: endDate ? new Date(endDate).getUTCFullYear() : null,
    periodStart: duration?.startDate ? new Date(duration.startDate) : null,
    periodEnd: endDate ? new Date(endDate) : null,
    currency: detectCurrency(facts),
    revenue,
    grossProfit,
    balanceSheet,
    equity: factValue(facts, TAGS.equity, instantIds).value,
    profitLoss: factValue(facts, TAGS.profitLoss, durationIds).value,
    employeesAvg: (() => {
      const n = factValue(facts, TAGS.employees, durationIds).value;
      return n === null ? null : Math.round(n);
    })(),
    managementReview: textValue(facts, TAGS.managementReview),
    reportFormat: format,
    warnings,
  };
}

/** Last-resort extraction from a PDF-only filing. Everything it finds is flagged. */
export async function parsePdfReport(buffer: Buffer): Promise<Partial<ParsedFinancials> & { warnings: string[] }> {
  const warnings = ["Figures extracted from PDF text — verify before acting on them."];
  try {
    const { default: pdfParse } = (await import("pdf-parse")) as unknown as {
      default: (b: Buffer) => Promise<{ text: string }>;
    };
    const { text } = await pdfParse(buffer);

    const grab = (labels: string[]): number | null => {
      for (const label of labels) {
        const re = new RegExp(`${label}[^\\d\\-]{0,40}(-?[\\d.\\s]{3,20}(?:,\\d+)?)`, "i");
        const m = text.match(re);
        if (m?.[1]) {
          const n = parseNumber(m[1], 0, 1);
          if (n !== null) return n;
        }
      }
      return null;
    };

    // Management review sections are titled consistently enough to slice out.
    const reviewMatch = text.match(
      /(Ledelsesberetning|Ledelsesberetning\s*\n)([\s\S]{200,20000}?)(?=\n\s*(Anvendt regnskabspraksis|Resultatopgørelse|Balance|Den uafhængige revisors))/i,
    );

    return {
      revenue: grab(["Nettoomsætning", "Omsætning"]),
      grossProfit: grab(["Bruttofortjeneste", "Bruttoresultat"]),
      balanceSheet: grab(["Balancesum", "Aktiver i alt", "Passiver i alt"]),
      equity: grab(["Egenkapital i alt", "Egenkapital"]),
      profitLoss: grab(["Årets resultat"]),
      managementReview: reviewMatch?.[2]?.replace(/\s+/g, " ").trim() ?? null,
      reportFormat: "PDF",
      warnings,
    };
  } catch (e) {
    warnings.push(`PDF extraction failed: ${toErrorMessage(e)}`);
    return { warnings, reportFormat: "PDF" };
  }
}

const EMPTY: ParsedFinancials = {
  year: null,
  periodStart: null,
  periodEnd: null,
  currency: "DKK",
  revenue: null,
  grossProfit: null,
  balanceSheet: null,
  equity: null,
  profitLoss: null,
  employeesAvg: null,
  managementReview: null,
  reportUrl: null,
  reportFormat: null,
  publicationId: null,
  publishedAt: null,
  documentHash: null,
  warnings: [],
};

/** Download + parse one published report, preferring XBRL over PDF. */
export async function parseReport(report: PublishedReport): Promise<ParsedFinancials> {
  const target = report.xbrlUrl ?? report.pdfUrl;
  if (!target) {
    return { ...EMPTY, publicationId: report.publicationId, publishedAt: report.publishedAt, warnings: ["Publication contains no usable document."] };
  }

  const { buffer, contentType } = await fetchReportDocument(target);
  const documentHash = crypto.createHash("sha256").update(buffer).digest("hex");

  const isPdf = contentType.includes("pdf") || /\.pdf$/i.test(target);
  if (isPdf) {
    const parsed = await parsePdfReport(buffer);
    return {
      ...EMPTY,
      ...parsed,
      year: report.year,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      reportUrl: target,
      publicationId: report.publicationId,
      publishedAt: report.publishedAt,
      documentHash,
      warnings: parsed.warnings ?? [],
    };
  }

  const xml = buffer.toString("utf8");
  const format: "XBRL" | "IXBRL" = /<[a-z]*:?html/i.test(xml.slice(0, 2000)) ? "IXBRL" : "XBRL";

  try {
    const parsed = parseXbrl(xml, format);
    return {
      ...parsed,
      year: parsed.year ?? report.year,
      periodStart: parsed.periodStart ?? report.periodStart,
      periodEnd: parsed.periodEnd ?? report.periodEnd,
      reportUrl: target,
      publicationId: report.publicationId,
      publishedAt: report.publishedAt,
      documentHash,
    };
  } catch (e) {
    log.warn("XBRL parse failed, trying the PDF sibling", { url: target, error: toErrorMessage(e) });
    if (report.pdfUrl && report.pdfUrl !== target) {
      const pdf = await fetchReportDocument(report.pdfUrl);
      const parsed = await parsePdfReport(pdf.buffer);
      return {
        ...EMPTY,
        ...parsed,
        year: report.year,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        reportUrl: report.pdfUrl,
        publicationId: report.publicationId,
        publishedAt: report.publishedAt,
        documentHash,
        warnings: [...(parsed.warnings ?? []), `XBRL unparseable: ${toErrorMessage(e)}`],
      };
    }
    throw e;
  }
}

/** Convert to DKK for the size test. Rates are injected, never fetched inline. */
export function toDkk(
  value: number | null,
  currency: string,
  rates: Record<string, number> = { DKK: 1, EUR: 7.4604 },
): { value: number | null; rate: number | null } {
  if (value === null) return { value: null, rate: null };
  const rate = rates[currency.toUpperCase()];
  if (!rate) return { value: null, rate: null };
  return { value: value * rate, rate };
}
