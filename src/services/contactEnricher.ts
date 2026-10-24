import { getEnv } from "@/lib/env";
import { toErrorMessage } from "@/lib/errors";
import { RateLimiter, fetchJson } from "@/lib/http";
import { createLogger } from "@/lib/logger";
import type { CvrExecutive } from "./cvrService";

const log = createLogger("contactEnricher");

/**
 * Contact enrichment for Danish decision-makers.
 *
 * Two sources, in this order:
 *   1. CVR — registered management (direktion / bestyrelse). Public, authoritative,
 *      free, and legally safe: names and roles are published by the registry.
 *   2. A B2B provider (Apollo / Hunter / Dropcontact) — resolves the CVR name plus
 *      the company domain into a work e-mail, phone and LinkedIn URL.
 *
 * GDPR note, because this is the part that gets platforms in trouble: work
 * contact data for a named person is personal data. The lawful basis here is
 * legitimate interest (art. 6(1)(f)), which requires (a) a balancing test on
 * file, (b) an art. 14 notice in the first outreach e-mail, since the data was
 * not collected from the person, and (c) a working objection path. `suppressed`
 * on ContactPerson is that path — the pipeline must never re-enrich a
 * suppressed person, which is why every write goes through `isSuppressed`.
 */

// ---------------------------------------------------------------------------
// Title normalisation
// ---------------------------------------------------------------------------

export type NormalisedTitle =
  | "CEO"
  | "CFO"
  | "COO"
  | "CTO"
  | "CIO"
  | "CISO"
  | "IT_DIRECTOR"
  | "SECURITY_MANAGER"
  | "COMPLIANCE_OFFICER"
  | "DIRECTOR"
  | "BOARD_CHAIR"
  | "BOARD_MEMBER"
  | "OTHER";

interface TitleRule {
  pattern: RegExp;
  title: NormalisedTitle;
  /** 0-100. Drives who the outreach teaser is addressed to. */
  score: number;
}

/**
 * Ordered: first match wins. NIS2 makes the *management body* personally
 * accountable (art. 20), so the CEO and the board chair outrank the IT
 * function for this particular pitch — which is the opposite of a normal
 * security sale and the reason the ranking lives in code rather than in a
 * salesperson's head.
 */
const TITLE_RULES: TitleRule[] = [
  { pattern: /\b(ciso|chief information security)/i, title: "CISO", score: 95 },
  { pattern: /\b(adm\.?\s*dir|administrerende direkt|chief executive|^ceo$|\bceo\b)/i, title: "CEO", score: 100 },
  { pattern: /\b(bestyrelsesformand|chairman|formand for bestyrelsen)/i, title: "BOARD_CHAIR", score: 85 },
  { pattern: /\b(it-?chef|it-?direkt|head of it|chief information officer|\bcio\b)/i, title: "IT_DIRECTOR", score: 80 },
  { pattern: /\b(cto|teknisk direkt|chief technology)/i, title: "CTO", score: 75 },
  { pattern: /\b(sikkerhedschef|security manager|head of security|informationssikkerhed)/i, title: "SECURITY_MANAGER", score: 78 },
  { pattern: /\b(compliance|dpo|databeskyttelsesr[aå]dgiver|risk manager)/i, title: "COMPLIANCE_OFFICER", score: 65 },
  { pattern: /\b(cfo|finansdirekt|økonomidirekt|oekonomidirekt|chief financial)/i, title: "CFO", score: 70 },
  { pattern: /\b(coo|driftsdirekt|chief operating)/i, title: "COO", score: 68 },
  { pattern: /\b(direkt[oø]r|director|\bdir\.?\b)/i, title: "DIRECTOR", score: 60 },
  { pattern: /\b(bestyrelsesmedlem|board member)/i, title: "BOARD_MEMBER", score: 40 },
];

export function normaliseTitle(raw: string | null | undefined): { title: NormalisedTitle; score: number } {
  if (!raw) return { title: "OTHER", score: 10 };
  for (const rule of TITLE_RULES) {
    if (rule.pattern.test(raw)) return { title: rule.title, score: rule.score };
  }
  return { title: "OTHER", score: 15 };
}

// ---------------------------------------------------------------------------
// Provider abstraction
// ---------------------------------------------------------------------------

export type VerificationStatusKey = "UNVERIFIED" | "VERIFIED" | "ACCEPT_ALL" | "INVALID";

export interface EnrichmentQuery {
  firstName: string;
  lastName: string;
  fullName: string;
  domain: string;
  companyName: string;
}

export interface EnrichmentResult {
  email: string | null;
  emailStatus: VerificationStatusKey;
  emailConfidence: number | null;
  phone: string | null;
  linkedinUrl: string | null;
  title: string | null;
  raw: unknown;
}

export interface EnrichmentProvider {
  readonly name: "apollo" | "hunter" | "dropcontact" | "none";
  enrich(query: EnrichmentQuery): Promise<EnrichmentResult>;
}

const EMPTY_RESULT: EnrichmentResult = {
  email: null,
  emailStatus: "UNVERIFIED",
  emailConfidence: null,
  phone: null,
  linkedinUrl: null,
  title: null,
  raw: null,
};

let enrichmentLimiter: RateLimiter | null = null;
function limiter(): RateLimiter {
  if (!enrichmentLimiter) enrichmentLimiter = new RateLimiter(getEnv().ENRICHMENT_REQUESTS_PER_SECOND);
  return enrichmentLimiter;
}

// ---- Apollo.io ------------------------------------------------------------

interface ApolloResponse {
  person?: {
    email?: string | null;
    email_status?: string | null;
    linkedin_url?: string | null;
    title?: string | null;
    phone_numbers?: Array<{ raw_number?: string; sanitized_number?: string }>;
    organization?: { name?: string };
  };
}

class ApolloProvider implements EnrichmentProvider {
  readonly name = "apollo" as const;

  constructor(private readonly apiKey: string) {}

  async enrich(query: EnrichmentQuery): Promise<EnrichmentResult> {
    const res = await fetchJson<ApolloResponse>("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({
        first_name: query.firstName,
        last_name: query.lastName,
        domain: query.domain,
        organization_name: query.companyName,
        reveal_personal_emails: false, // work contacts only — personal e-mail is a different legal basis
        reveal_phone_number: true,
      }),
      limiter: limiter(),
      service: "apollo",
      retries: 3,
    });

    const p = res.person;
    if (!p) return EMPTY_RESULT;

    const status = (p.email_status ?? "").toLowerCase();
    const emailStatus: VerificationStatusKey =
      status === "verified"
        ? "VERIFIED"
        : status === "unavailable" || status === "invalid"
          ? "INVALID"
          : status.includes("accept")
            ? "ACCEPT_ALL"
            : "UNVERIFIED";

    return {
      email: p.email && !p.email.includes("email_not_unlocked") ? p.email : null,
      emailStatus,
      emailConfidence: emailStatus === "VERIFIED" ? 0.95 : emailStatus === "ACCEPT_ALL" ? 0.6 : 0.4,
      phone: p.phone_numbers?.[0]?.sanitized_number ?? p.phone_numbers?.[0]?.raw_number ?? null,
      linkedinUrl: p.linkedin_url ?? null,
      title: p.title ?? null,
      raw: res,
    };
  }
}

// ---- Hunter.io ------------------------------------------------------------

interface HunterResponse {
  data?: {
    email?: string | null;
    score?: number | null;
    verification?: { status?: string | null };
    position?: string | null;
    linkedin_url?: string | null;
    phone_number?: string | null;
  };
}

class HunterProvider implements EnrichmentProvider {
  readonly name = "hunter" as const;

  constructor(private readonly apiKey: string) {}

  async enrich(query: EnrichmentQuery): Promise<EnrichmentResult> {
    const url = new URL("https://api.hunter.io/v2/email-finder");
    url.searchParams.set("domain", query.domain);
    url.searchParams.set("first_name", query.firstName);
    url.searchParams.set("last_name", query.lastName);
    url.searchParams.set("api_key", this.apiKey);

    const res = await fetchJson<HunterResponse>(url.toString(), {
      limiter: limiter(),
      service: "hunter",
      retries: 3,
      // Hunter answers 404 for "no match found" — that is data, not a failure.
      retryOn: [],
    }).catch((e) => {
      if (toErrorMessage(e).includes("404")) return {} as HunterResponse;
      throw e;
    });

    const d = res.data;
    if (!d?.email) return EMPTY_RESULT;

    const v = (d.verification?.status ?? "").toLowerCase();
    const emailStatus: VerificationStatusKey =
      v === "valid" ? "VERIFIED" : v === "invalid" ? "INVALID" : v === "accept_all" ? "ACCEPT_ALL" : "UNVERIFIED";

    return {
      email: d.email,
      emailStatus,
      emailConfidence: typeof d.score === "number" ? d.score / 100 : null,
      phone: d.phone_number ?? null,
      linkedinUrl: d.linkedin_url ?? null,
      title: d.position ?? null,
      raw: res,
    };
  }
}

// ---- Dropcontact ----------------------------------------------------------

interface DropcontactResponse {
  data?: Array<{
    email?: Array<{ email: string; qualification?: string }>;
    linkedin?: string | null;
    phone?: string | null;
    job?: string | null;
  }>;
}

class DropcontactProvider implements EnrichmentProvider {
  readonly name = "dropcontact" as const;

  constructor(private readonly apiKey: string) {}

  async enrich(query: EnrichmentQuery): Promise<EnrichmentResult> {
    const res = await fetchJson<DropcontactResponse>("https://api.dropcontact.io/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Access-Token": this.apiKey },
      body: JSON.stringify({
        data: [{ first_name: query.firstName, last_name: query.lastName, website: query.domain }],
        siren: false,
        language: "en",
      }),
      limiter: limiter(),
      service: "dropcontact",
      retries: 3,
    });

    const row = res.data?.[0];
    const email = row?.email?.[0];
    if (!email?.email) return EMPTY_RESULT;

    const q = (email.qualification ?? "").toLowerCase();
    return {
      email: email.email,
      emailStatus: q.includes("nominative") ? "VERIFIED" : "UNVERIFIED",
      emailConfidence: q.includes("nominative") ? 0.9 : 0.5,
      phone: row?.phone ?? null,
      linkedinUrl: row?.linkedin ?? null,
      title: row?.job ?? null,
      raw: res,
    };
  }
}

class NoopProvider implements EnrichmentProvider {
  readonly name = "none" as const;
  async enrich(): Promise<EnrichmentResult> {
    return EMPTY_RESULT;
  }
}

export function getProvider(): EnrichmentProvider {
  const env = getEnv();
  if (env.ENRICHMENT_PROVIDER === "none" || !env.ENRICHMENT_API_KEY) {
    if (env.ENRICHMENT_PROVIDER !== "none") {
      log.warn("ENRICHMENT_PROVIDER set but ENRICHMENT_API_KEY empty — enrichment disabled");
    }
    return new NoopProvider();
  }
  switch (env.ENRICHMENT_PROVIDER) {
    case "apollo":
      return new ApolloProvider(env.ENRICHMENT_API_KEY);
    case "hunter":
      return new HunterProvider(env.ENRICHMENT_API_KEY);
    case "dropcontact":
      return new DropcontactProvider(env.ENRICHMENT_API_KEY);
    default:
      return new NoopProvider();
  }
}

// ---------------------------------------------------------------------------
// Name handling
// ---------------------------------------------------------------------------

/**
 * CVR stores "Anders Boe Hansen" as one string. Danish names routinely carry a
 * middle name that is not part of the surname, so naive last-token splitting
 * produces the wrong surname often enough to matter for e-mail matching.
 * Heuristic: everything after the first token is the surname candidate, and we
 * also try last-token-only as a second query when the first misses.
 */
export function splitName(fullName: string): { firstName: string; lastName: string; altLastName: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "", altLastName: null };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: parts[0]!, altLastName: null };
  const firstName = parts[0]!;
  const lastName = parts[parts.length - 1]!;
  const altLastName = parts.length > 2 ? parts.slice(1).join(" ") : null;
  return { firstName, lastName, altLastName };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export interface EnrichedContact {
  cvrUnitNumber: string | null;
  name: string;
  rawTitle: string | null;
  title: NormalisedTitle;
  seniorityScore: number;
  isPrimary: boolean;
  directEmail: string | null;
  emailStatus: VerificationStatusKey;
  emailConfidence: number | null;
  directPhone: string | null;
  linkedinUrl: string | null;
  source: "CVR_DIREKTION" | "CVR_BESTYRELSE" | "CVR_REELLE_EJERE" | "APOLLO" | "HUNTER" | "DROPCONTACT";
  enrichedAt: Date | null;
  enrichmentRaw: unknown;
}

export interface EnrichCompanyOptions {
  /** Cap paid lookups per company — enrichment credits are the main running cost. */
  maxEnrichedPerCompany?: number;
  /** Names already opted out. Checked before every outbound call. */
  isSuppressed?: (name: string) => boolean | Promise<boolean>;
  minConfidence?: number;
}

const SOURCE_BY_ORG = {
  DIREKTION: "CVR_DIREKTION",
  BESTYRELSE: "CVR_BESTYRELSE",
  REELLE_EJERE: "CVR_REELLE_EJERE",
  OTHER: "CVR_DIREKTION",
} as const;

/**
 * Enrich a company's registered management. Always returns every executive —
 * an un-enriched CEO name is still a usable lead — with contact details filled
 * in for as many as the budget allows, highest seniority first.
 */
export async function enrichCompanyContacts(
  company: { cvr: string; name: string; domain: string | null },
  executives: CvrExecutive[],
  options: EnrichCompanyOptions = {},
): Promise<{ contacts: EnrichedContact[]; enrichedCount: number; warnings: string[] }> {
  const env = getEnv();
  const {
    maxEnrichedPerCompany = 3,
    isSuppressed,
    minConfidence = env.ENRICHMENT_MIN_CONFIDENCE,
  } = options;

  const warnings: string[] = [];
  const provider = getProvider();

  const ranked: EnrichedContact[] = executives
    .map((exec) => {
      const { title, score } = normaliseTitle(exec.rawTitle);
      // A board seat is a weaker entry point than an executive role of equal title.
      const adjusted = exec.organisation === "BESTYRELSE" ? Math.round(score * 0.7) : score;
      return {
        cvrUnitNumber: exec.cvrUnitNumber,
        name: exec.name,
        rawTitle: exec.rawTitle,
        title,
        seniorityScore: adjusted,
        isPrimary: false,
        directEmail: null,
        emailStatus: "UNVERIFIED" as VerificationStatusKey,
        emailConfidence: null,
        directPhone: null,
        linkedinUrl: null,
        source: SOURCE_BY_ORG[exec.organisation],
        enrichedAt: null,
        enrichmentRaw: null,
      } satisfies EnrichedContact;
    })
    .sort((a, b) => b.seniorityScore - a.seniorityScore);

  if (ranked.length) ranked[0]!.isPrimary = true;

  if (!company.domain) {
    warnings.push("No company domain — provider lookup skipped. Resolve the website first.");
    return { contacts: ranked, enrichedCount: 0, warnings };
  }
  if (provider.name === "none") {
    warnings.push("Enrichment provider disabled — CVR names only.");
    return { contacts: ranked, enrichedCount: 0, warnings };
  }

  let enrichedCount = 0;

  for (const contact of ranked) {
    if (enrichedCount >= maxEnrichedPerCompany) break;

    if (isSuppressed && (await isSuppressed(contact.name))) {
      warnings.push(`${contact.name}: suppressed (GDPR objection) — not enriched.`);
      continue;
    }

    const { firstName, lastName, altLastName } = splitName(contact.name);
    if (!firstName || !lastName) continue;

    const attempts: EnrichmentQuery[] = [
      { firstName, lastName, fullName: contact.name, domain: company.domain, companyName: company.name },
    ];
    if (altLastName) {
      attempts.push({
        firstName,
        lastName: altLastName,
        fullName: contact.name,
        domain: company.domain,
        companyName: company.name,
      });
    }

    let result: EnrichmentResult = EMPTY_RESULT;
    for (const attempt of attempts) {
      try {
        result = await provider.enrich(attempt);
        if (result.email) break;
      } catch (e) {
        warnings.push(`${contact.name}: ${provider.name} lookup failed — ${toErrorMessage(e)}`);
        log.warn("enrichment call failed", { cvr: company.cvr, name: contact.name, error: toErrorMessage(e) });
      }
    }

    enrichedCount += 1;
    contact.enrichedAt = new Date();
    contact.enrichmentRaw = result.raw;

    const confident = result.emailConfidence === null || result.emailConfidence >= minConfidence;
    if (result.email && result.emailStatus !== "INVALID" && confident) {
      contact.directEmail = result.email.toLowerCase();
      contact.emailStatus = result.emailStatus;
      contact.emailConfidence = result.emailConfidence;
      contact.source = provider.name.toUpperCase() as EnrichedContact["source"];
    } else if (result.email) {
      warnings.push(
        `${contact.name}: e-mail discarded (status ${result.emailStatus}, confidence ${result.emailConfidence ?? "n/a"}).`,
      );
    }

    contact.directPhone = result.phone ?? contact.directPhone;
    contact.linkedinUrl = result.linkedinUrl ?? contact.linkedinUrl;
    // The provider's job title is fresher than the registry's function code.
    if (result.title) {
      const normalised = normaliseTitle(result.title);
      if (normalised.score > contact.seniorityScore) {
        contact.title = normalised.title;
        contact.seniorityScore = normalised.score;
        contact.rawTitle = result.title;
      }
    }
  }

  ranked.sort((a, b) => {
    const aHas = a.directEmail ? 1 : 0;
    const bHas = b.directEmail ? 1 : 0;
    if (aHas !== bHas) return bHas - aHas;
    return b.seniorityScore - a.seniorityScore;
  });
  ranked.forEach((c, i) => (c.isPrimary = i === 0));

  return { contacts: ranked, enrichedCount, warnings };
}
