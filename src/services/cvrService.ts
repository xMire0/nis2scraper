import { getCvrAuthHeader, getEnv } from "@/lib/env";
import { ConfigError, UpstreamError } from "@/lib/errors";
import { RateLimiter, fetchJson } from "@/lib/http";
import { createLogger } from "@/lib/logger";
import { db07PrefixesForSectors, normaliseDb07, type Nis2SectorKey } from "@/domain/nis2/sectors";

const log = createLogger("cvrService");

/**
 * Erhvervsstyrelsen's CVR distribution is a plain Elasticsearch endpoint behind
 * HTTP Basic. Credentials are issued per system; there is no public key.
 * Docs: Erhvervsstyrelsen "CVR-udtræk – system til system adgang".
 */

const env = () => getEnv();
let limiter: RateLimiter | null = null;
function cvrLimiter(): RateLimiter {
  if (!limiter) limiter = new RateLimiter(env().CVR_REQUESTS_PER_SECOND);
  return limiter;
}

function authHeaders(): Record<string, string> {
  const auth = getCvrAuthHeader();
  if (!auth) {
    throw new ConfigError(
      "No CVR credentials. Set CVR_API_USERNAME/CVR_API_PASSWORD or CVR_API_KEY (base64 user:pass).",
    );
  }
  return { Authorization: auth, "Content-Type": "application/json" };
}

// ---------------------------------------------------------------------------
// Domain shapes
// ---------------------------------------------------------------------------

export type CompanyStatusKey =
  | "ACTIVE"
  | "UNDER_BANKRUPTCY"
  | "UNDER_DISSOLUTION"
  | "DISSOLVED"
  | "UNKNOWN";

export interface CvrExecutive {
  cvrUnitNumber: string | null;
  name: string;
  /** Raw Danish function text, e.g. "ADM. DIR.", "BESTYRELSESFORMAND". */
  rawTitle: string | null;
  organisation: "DIREKTION" | "BESTYRELSE" | "REELLE_EJERE" | "OTHER";
  from: string | null;
  to: string | null;
}

export interface CvrCompany {
  cvr: string;
  name: string;
  legalForm: string | null;
  addressStreet: string | null;
  addressPostalCode: string | null;
  addressCity: string | null;
  addressMunicipality: string | null;
  db07Code: string | null;
  db07Description: string | null;
  secondaryDb07: string[];
  employeeCount: number | null;
  employeeCountSource: string | null;
  employeeCountAsOf: Date | null;
  officialEmail: string | null;
  officialPhone: string | null;
  domain: string | null;
  website: string | null;
  status: CompanyStatusKey;
  statusRaw: string | null;
  foundedAt: Date | null;
  cvrUpdatedAt: Date | null;
  executives: CvrExecutive[];
  /** Company purpose text when registered — extra signal for the classifier. */
  purpose: string | null;
}

// ---------------------------------------------------------------------------
// Elasticsearch helpers
// ---------------------------------------------------------------------------

interface EsHit<T> {
  _id: string;
  _source: T;
  sort?: Array<number | string>;
}
interface EsResponse<T> {
  hits: { total: { value: number } | number; hits: Array<EsHit<T>> };
}

function totalOf(hits: EsResponse<unknown>["hits"]): number {
  return typeof hits.total === "number" ? hits.total : hits.total.value;
}

async function esSearch<T>(path: string, body: unknown): Promise<EsResponse<T>> {
  const url = `${env().CVR_API_BASE}${path}`;
  return fetchJson<EsResponse<T>>(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    limiter: cvrLimiter(),
    service: "cvr",
    timeoutMs: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

function pickLatest<T extends { periode?: { gyldigFra?: string | null; gyldigTil?: string | null } } = any>(
  list: T[] | undefined,
): T | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const open = list.filter((x) => !x.periode?.gyldigTil);
  const pool = open.length ? open : list;
  return (
    pool
      .slice()
      .sort((a, b) => (a.periode?.gyldigFra ?? "").localeCompare(b.periode?.gyldigFra ?? ""))
      .pop() ?? null
  );
}

function mapStatus(raw: string | null | undefined): CompanyStatusKey {
  const s = (raw ?? "").toUpperCase().replace(/\s/g, "");
  if (s === "NORMAL" || s === "AKTIV") return "ACTIVE";
  if (s.includes("KONKURS")) return "UNDER_BANKRUPTCY";
  if (s.includes("TVANGSOPL") || s.includes("UNDEROPL") || s.includes("LIKVIDATION")) return "UNDER_DISSOLUTION";
  if (s.includes("OPLOEST") || s.includes("OPHØRT") || s.includes("OPHOERT")) return "DISSOLVED";
  return "UNKNOWN";
}

/** "https://www.example.dk/kontakt" -> "example.dk" */
export function normaliseDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  let v = value.trim().toLowerCase();
  if (!v) return null;
  v = v.replace(/^https?:\/\//, "").replace(/^www\./, "");
  v = v.split("/")[0] ?? v;
  v = v.split("?")[0] ?? v;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) return null;
  return v;
}

function extractContacts(source: any): { email: string | null; phone: string | null; website: string | null } {
  const out = { email: null as string | null, phone: null as string | null, website: null as string | null };
  const buckets = [
    source?.elektroniskPost,
    source?.telefonNummer,
    source?.hjemmeside,
    source?.obligatoriskEmail,
  ];
  for (const bucket of buckets) {
    if (!Array.isArray(bucket)) continue;
    const latest = pickLatest(bucket as any[]);
    const value: string | undefined = latest?.kontaktoplysning;
    if (!value) continue;
    if (value.includes("@") && !out.email) out.email = value.trim();
    else if (/^[\d +()-]{6,}$/.test(value) && !out.phone) out.phone = value.replace(/\s+/g, " ").trim();
    else if (/\./.test(value) && !value.includes("@") && !out.website) out.website = value.trim();
  }
  return out;
}

function extractEmployees(source: any): { count: number | null; source: string | null; asOf: Date | null } {
  // Monthly employment is the freshest; yearly is the most stable. Prefer the
  // newest monthly figure, fall back to the newest yearly interval.
  const monthly: any[] = source?.erstMaanedsbeskaeftigelse ?? source?.maanedsbeskaeftigelse ?? [];
  if (Array.isArray(monthly) && monthly.length) {
    const latest = monthly.slice().sort((a, b) => (a.aar * 100 + a.maaned) - (b.aar * 100 + b.maaned)).pop();
    const n = latest?.antalAnsatte ?? latest?.antalAarsvaerk;
    if (typeof n === "number") {
      return {
        count: n,
        source: "cvr_maanedsbeskaeftigelse",
        asOf: new Date(Date.UTC(latest.aar, (latest.maaned ?? 1) - 1, 1)),
      };
    }
  }
  const yearly: any[] = source?.aarsbeskaeftigelse ?? [];
  if (Array.isArray(yearly) && yearly.length) {
    const latest = yearly.slice().sort((a, b) => a.aar - b.aar).pop();
    const n = latest?.antalAnsatte ?? latest?.antalAarsvaerk;
    // The registry also publishes intervals ("50-99") when exact counts are withheld.
    const interval: string | undefined = latest?.intervalKodeAntalAnsatte;
    if (typeof n === "number") {
      return { count: n, source: "cvr_aarsbeskaeftigelse", asOf: new Date(Date.UTC(latest.aar, 11, 31)) };
    }
    if (interval) {
      const lower = Number(interval.match(/^\s*(\d+)(?:\s*[-–]\s*\d+|\+)?\s*$/)?.[1] ?? NaN);
      if (Number.isFinite(lower)) {
        return {
          count: lower,
          source: `cvr_interval:${interval}`,
          asOf: new Date(Date.UTC(latest.aar, 11, 31)),
        };
      }
    }
  }
  return { count: null, source: null, asOf: null };
}

function extractExecutives(source: any): CvrExecutive[] {
  const relations: any[] = source?.deltagerRelation ?? [];
  const out: CvrExecutive[] = [];

  for (const rel of relations) {
    const person = rel?.deltager;
    const name: string | undefined = pickLatest(person?.navne)?.navn ?? person?.navne?.[0]?.navn;
    if (!name) continue;
    if (person?.enhedstype && person.enhedstype !== "PERSON") continue; // skip holding companies

    for (const org of rel?.organisationer ?? []) {
      const hovedtype: string = (org?.hovedtype ?? "").toUpperCase();
      const orgKind: CvrExecutive["organisation"] =
        hovedtype === "DIREKTION"
          ? "DIREKTION"
          : hovedtype === "BESTYRELSE"
            ? "BESTYRELSE"
            : hovedtype.includes("EJER")
              ? "REELLE_EJERE"
              : "OTHER";
      if (orgKind === "OTHER") continue;

      for (const medlem of org?.medlemsData ?? []) {
        const attrs: any[] = medlem?.attributter ?? [];
        const funktion = attrs.find((a) => (a?.type ?? "").toUpperCase() === "FUNKTION");
        const val = pickLatest(funktion?.vaerdier);
        const active = !val?.periode?.gyldigTil;
        if (!active) continue;
        out.push({
          cvrUnitNumber: person?.enhedsNummer != null ? String(person.enhedsNummer) : null,
          name,
          rawTitle: val?.vaerdi ?? org?.organisationsNavn?.[0]?.navn ?? hovedtype,
          organisation: orgKind,
          from: val?.periode?.gyldigFra ?? null,
          to: val?.periode?.gyldigTil ?? null,
        });
      }
    }
  }

  // Deduplicate on name + organisation, preferring DIREKTION rows.
  const seen = new Map<string, CvrExecutive>();
  for (const e of out) {
    const key = `${e.name}|${e.organisation}`;
    if (!seen.has(key)) seen.set(key, e);
  }
  return [...seen.values()];
}

export function mapVrvirksomhed(source: any): CvrCompany | null {
  const v = source?.Vrvirksomhed ?? source;
  if (!v?.cvrNummer) return null;

  const meta = v.virksomhedMetadata ?? {};
  const name: string | null = meta?.nyesteNavn?.navn ?? pickLatest(v.navne)?.navn ?? null;
  if (!name) return null;

  const addr = meta?.nyesteBeliggenhedsadresse ?? pickLatest(v.beliggenhedsadresse) ?? {};
  const streetParts = [
    addr?.vejnavn,
    addr?.husnummerFra ? String(addr.husnummerFra) : null,
    addr?.bogstavFra ?? null,
    addr?.etage ? `${addr.etage}.` : null,
    addr?.sidedoer ?? null,
  ].filter(Boolean);

  const branche = meta?.nyesteHovedbranche ?? pickLatest(v.hovedbranche) ?? {};
  const bibrancher = [meta?.nyesteBibranche1, meta?.nyesteBibranche2, meta?.nyesteBibranche3]
    .map((b: any) => normaliseDb07(b?.branchekode))
    .filter((x): x is string => Boolean(x));

  const contacts = extractContacts(v);
  const employees = extractEmployees(v);
  const statusRaw: string | null =
    meta?.sammensatStatus ?? pickLatest(v.virksomhedsstatus)?.status ?? v?.livsforloeb?.slice(-1)?.[0]?.status ?? null;

  const website = contacts.website;
  const domain = normaliseDomain(website) ?? normaliseDomain(contacts.email?.split("@")[1] ?? null);

  return {
    cvr: String(v.cvrNummer).padStart(8, "0"),
    name,
    legalForm: meta?.nyesteVirksomhedsform?.langBeskrivelse ?? meta?.nyesteVirksomhedsform?.kortBeskrivelse ?? null,
    addressStreet: streetParts.length ? streetParts.join(" ") : null,
    addressPostalCode: addr?.postnummer ? String(addr.postnummer) : null,
    addressCity: addr?.postdistrikt ?? addr?.bynavn ?? null,
    addressMunicipality: addr?.kommune?.kommuneNavn ?? null,
    db07Code: normaliseDb07(branche?.branchekode),
    db07Description: branche?.branchetekst ?? null,
    secondaryDb07: bibrancher,
    employeeCount: employees.count,
    employeeCountSource: employees.source,
    employeeCountAsOf: employees.asOf,
    officialEmail: contacts.email,
    // CVR telefonNummer is often outdated; salesperson phone comes from website crawl.
    officialPhone: null,
    domain,
    website,
    status: mapStatus(statusRaw),
    statusRaw,
    foundedAt: v?.virksomhedMetadata?.stiftelsesDato ? new Date(v.virksomhedMetadata.stiftelsesDato) : null,
    cvrUpdatedAt: v?.sidstOpdateret ? new Date(v.sidstOpdateret) : null,
    executives: extractExecutives(v),
    purpose: pickLatest(v?.formaal)?.vaerdi ?? null,
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface DiscoverOptions {
  sectors?: Nis2SectorKey[];
  /** Explicit DB07 prefixes; overrides `sectors`. */
  db07Prefixes?: string[];
  /** Hard floor on registered headcount. Null keeps size-exempt small entities. */
  minEmployees?: number | null;
  /** Only ACTIVE companies by default — dissolved entities are not leads. */
  activeOnly?: boolean;
  maxResults?: number;
  pageSize?: number;
}

/**
 * DB07 prefixes are matched with a prefix query on `branchekode`, which is a
 * 6-digit string in the index. "26" therefore matches all of 26xxxx.
 */
function branchClause(prefixes: string[]) {
  return {
    bool: {
      should: prefixes.map((p) => ({
        prefix: { "Vrvirksomhed.virksomhedMetadata.nyesteHovedbranche.branchekode": p },
      })),
      minimum_should_match: 1,
    },
  };
}

export async function* discoverCompanies(
  options: DiscoverOptions = {},
): AsyncGenerator<CvrCompany, void, unknown> {
  const {
    sectors,
    db07Prefixes,
    minEmployees = null,
    activeOnly = true,
    maxResults = 5000,
    pageSize = 200,
  } = options;

  const prefixes = db07Prefixes?.length ? db07Prefixes : db07PrefixesForSectors(sectors);
  if (!prefixes.length) throw new ConfigError("No DB07 prefixes to search — check the sector filter.");

  const filters: unknown[] = [branchClause(prefixes)];
  if (activeOnly) {
    filters.push({ term: { "Vrvirksomhed.virksomhedMetadata.sammensatStatus": "NORMAL" } });
  }
  if (minEmployees !== null) {
    filters.push({
      range: {
        "Vrvirksomhed.virksomhedMetadata.nyesteAarsbeskaeftigelse.antalAnsatte": { gte: minEmployees },
      },
    });
  }

  let searchAfter: Array<number | string> | undefined;
  let fetched = 0;

  while (fetched < maxResults) {
    const size = Math.min(pageSize, maxResults - fetched);
    const body: Record<string, unknown> = {
      size,
      query: { bool: { filter: filters } },
      sort: [{ "Vrvirksomhed.cvrNummer": "asc" }],
      ...(searchAfter ? { search_after: searchAfter } : {}),
    };

    const res = await esSearch<any>("/virksomhed/_search", body);
    const hits = res.hits?.hits ?? [];
    if (!hits.length) return;

    log.info("cvr page", { received: hits.length, fetched, total: totalOf(res.hits) });

    for (const hit of hits) {
      const mapped = mapVrvirksomhed(hit._source);
      if (mapped) yield mapped;
    }

    fetched += hits.length;
    searchAfter = hits[hits.length - 1]?.sort;
    if (!searchAfter || hits.length < size) return;
  }
}

/** Single lookup by CVR number. */
export async function getCompanyByCvr(cvr: string): Promise<CvrCompany | null> {
  const clean = cvr.replace(/\D/g, "");
  if (clean.length !== 8) throw new UpstreamError(`Invalid CVR number: ${cvr}`, "cvr", 400);

  const res = await esSearch<any>("/virksomhed/_search", {
    size: 1,
    query: { term: { "Vrvirksomhed.cvrNummer": Number(clean) } },
  });
  const hit = res.hits?.hits?.[0];
  return hit ? mapVrvirksomhed(hit._source) : null;
}

export async function getCompaniesByCvr(cvrList: string[]): Promise<CvrCompany[]> {
  const clean = cvrList.map((c) => c.replace(/\D/g, "")).filter((c) => c.length === 8);
  if (!clean.length) return [];

  const out: CvrCompany[] = [];
  const CHUNK = 100;
  for (let i = 0; i < clean.length; i += CHUNK) {
    const chunk = clean.slice(i, i + CHUNK).map(Number);
    const res = await esSearch<any>("/virksomhed/_search", {
      size: chunk.length,
      query: { terms: { "Vrvirksomhed.cvrNummer": chunk } },
    });
    for (const hit of res.hits?.hits ?? []) {
      const mapped = mapVrvirksomhed(hit._source);
      if (mapped) out.push(mapped);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Regnskabs-API — published annual reports
// ---------------------------------------------------------------------------

export interface PublishedReport {
  cvr: string;
  publicationId: string;
  publishedAt: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  year: number | null;
  documents: Array<{ url: string; mimeType: string; type: string }>;
  /** Best XBRL/iXBRL document, if the filer published one. */
  xbrlUrl: string | null;
  pdfUrl: string | null;
}

function pickDocuments(docs: any[]): Pick<PublishedReport, "documents" | "xbrlUrl" | "pdfUrl"> {
  const documents = (docs ?? [])
    .map((d) => ({
      url: d?.dokumentUrl ?? "",
      mimeType: (d?.dokumentMimeType ?? "").toLowerCase(),
      type: d?.dokumentType ?? "",
    }))
    .filter((d) => d.url);

  const xbrl =
    documents.find((d) => d.mimeType.includes("xml") || /\.xml$/i.test(d.url))?.url ??
    documents.find((d) => d.mimeType.includes("xhtml") || /\.xhtml$/i.test(d.url))?.url ??
    null;
  const pdf = documents.find((d) => d.mimeType.includes("pdf") || /\.pdf$/i.test(d.url))?.url ?? null;

  return { documents, xbrlUrl: xbrl, pdfUrl: pdf };
}

/** Latest published annual reports for a CVR, newest first. */
export async function getPublishedReports(cvr: string, limit = 3): Promise<PublishedReport[]> {
  const clean = cvr.replace(/\D/g, "");
  const url = `${env().REGNSKAB_API_BASE}/_search`;

  const res = await fetchJson<EsResponse<any>>(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      size: limit,
      query: {
        bool: {
          must: [{ term: { cvrNummer: Number(clean) } }],
          filter: [{ term: { "offentliggoerelsestype": "regnskab" } }],
        },
      },
      sort: [{ "regnskab.regnskabsperiode.slutDato": { order: "desc" } }],
    }),
    limiter: cvrLimiter(),
    service: "regnskab",
    timeoutMs: 60_000,
  });

  return (res.hits?.hits ?? []).map((hit) => {
    const s = hit._source;
    const start = s?.regnskab?.regnskabsperiode?.startDato ? new Date(s.regnskab.regnskabsperiode.startDato) : null;
    const end = s?.regnskab?.regnskabsperiode?.slutDato ? new Date(s.regnskab.regnskabsperiode.slutDato) : null;
    return {
      cvr: String(s?.cvrNummer ?? clean).padStart(8, "0"),
      publicationId: String(s?.offentliggoerelsesId ?? hit._id),
      publishedAt: s?.offentliggoerelsesTidspunkt ? new Date(s.offentliggoerelsesTidspunkt) : null,
      periodStart: start,
      periodEnd: end,
      year: end ? end.getUTCFullYear() : null,
      ...pickDocuments(s?.dokumenter ?? []),
    };
  });
}

/** Fetch a report document as bytes. Public URLs — no auth needed. */
export async function fetchReportDocument(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const { fetchWithRetry } = await import("@/lib/http");
  const res = await fetchWithRetry(url, { service: "regnskab-doc", timeoutMs: 90_000, limiter: cvrLimiter() });
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType: res.headers.get("content-type") ?? "application/octet-stream" };
}
