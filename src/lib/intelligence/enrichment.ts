import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma";
import { discoveryState } from "./discovery";
import {
  registryCompanySchema,
  discoveryConfigSchema,
  RegistryError,
  isActiveRegistry,
  latestEmployees,
} from "./cvrbasen";
import {
  getRegistryProvider,
  registryLookupReady,
  type RegistryProvider,
} from "./registry-provider";
import { emailDomain, websiteCandidates, verifiedWebsite } from "./website";
import { crawl } from "./crawler";
import type { Config } from "./config";
import { createHash } from "node:crypto";
import { searchCompanyWebsite, type WebsiteSearch } from "./openai-website";
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const hash = (v: string) =>
  createHash("sha256").update(v.toLowerCase().trim()).digest("hex");

type RegistryCall = (provider: RegistryProvider) => Promise<unknown>;

// One shared database lease and budget for discovery, refresh and statements.
async function budgetedRegistry(run: RegistryCall) {
  const provider = getRegistryProvider();
  if (!registryLookupReady(provider))
    throw new Error(
      provider.id === "cvrbasen"
        ? "CVRBASEN_API_KEY mangler på serveren"
        : `${provider.label} er ikke klar på serveren`,
    );
  await discoveryState();
  const lease = new Date(Date.now() + 60000);
  const config = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(714022)`;
    const s = await tx.discoveryState.findUniqueOrThrow({
      where: { id: "cvrbasen" },
    });
    const config = discoveryConfigSchema.parse(s.config);
    const day = new Date().toISOString().slice(0, 10);
    const used = s.budgetDay === day ? s.requestsToday : 0;
    if (s.leaseUntil && s.leaseUntil > new Date())
      throw new Error("Et registeropslag kører allerede");
    if (s.lastError && s.nextRunAt > new Date())
      throw new Error(
        `${provider.label} er på pause. Se Find virksomheder.`,
      );
    if (used >= config.maxRequestsPerDay)
      throw new Error(`Dagens loft over ${provider.label}-kald er nået`);
    await tx.discoveryState.update({
      where: { id: s.id },
      data: { requestsToday: used + 1, budgetDay: day, leaseUntil: lease },
    });
    return config;
  });
  try {
    const result = await run(provider);
    await prisma.discoveryState.updateMany({
      where: { id: "cvrbasen", leaseUntil: lease },
      data: { lastError: null },
    });
    return { result, provider };
  } catch (e) {
    await prisma.discoveryState.updateMany({
      where: { id: "cvrbasen", leaseUntil: lease },
      data: {
        lastError:
          e instanceof RegistryError ? e.message : "Registeropslag fejlede",
        nextRunAt: new Date(
          Date.now() + (e instanceof RegistryError ? e.retryMs : 3600000),
        ),
        ...(e instanceof RegistryError && e.stop
          ? { config: json({ ...config, enabled: false, autoEnrich: false }) }
          : {}),
      },
    });
    throw new Error(
      e instanceof RegistryError
        ? e.message
        : "Registeropslag fejlede; prøv senere",
    );
  } finally {
    await prisma.discoveryState.updateMany({
      where: { id: "cvrbasen", leaseUntil: lease },
      data: { leaseUntil: null },
    });
  }
}
const directorSchema = z.object({
  name: z.string().trim().min(3).max(150),
  role: z.string().max(150),
  active: z.boolean(),
  period: z.object({ to: z.string().nullable() }).optional(),
});
export const profileSchema = registryCompanySchema.extend({
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  executive_management: z.array(z.unknown()).optional(),
});
export function currentDirectors(rows: unknown[]) {
  return rows
    .flatMap((row) => {
      const p = directorSchema.safeParse(row);
      return p.success && p.data.active && !p.data.period?.to ? [p.data] : [];
    })
    .slice(0, 10);
}
export async function refreshCompany(id: string) {
  const company = await prisma.company.findUniqueOrThrow({ where: { id } });
  const { result, provider } = await budgetedRegistry((p) =>
    p.getCompany(company.cvr),
  );
  const source = provider.companySourceUrl(company.cvr);
  const { data: c } = z.object({ data: profileSchema }).parse(result);
  if (c.vat !== company.cvr)
    throw new Error(`${provider.label} returnerede et andet CVR-nummer`);
  const eligible =
    isActiveRegistry(c.status) &&
    !c.end_date &&
    c.country_code === "DK" &&
    c.protected === false;
  const employees = latestEmployees(c);
  await prisma.$transaction(async (tx) => {
    await tx.company.update({
      where: { id },
      data: {
        name: c.name,
        status:
          isActiveRegistry(c.status) && !c.end_date ? "ACTIVE" : "UNKNOWN",
        statusRaw: c.status,
        addressStreet: c.address ?? null,
        addressCity: c.city ?? null,
        addressPostalCode: c.zipcode == null ? null : String(c.zipcode),
        db07Code: c.industry_code,
        db07Description: c.industry_description ?? null,
        addressCountry: c.country_code,
        advertisingProtected: c.protected ?? null,
        registryFetchedAt: new Date(),
        registrySourceUrl: source,
        websiteHint: eligible ? emailDomain(c.email) : null,
        employeeCount: employees?.headcount ?? null,
        employeeMin: employees?.headcount ?? null,
        employeeMax: employees?.headcount ?? null,
        employeeCountSource: provider.employeeCountSource,
        employeeCountAsOf: employees
          ? new Date(Date.UTC(employees.year, employees.month - 1, 1))
          : null,
      },
    });
    if (!eligible) {
      await tx.publicContact.deleteMany({ where: { companyId: id } });
      await tx.outreachDraft.deleteMany({ where: { companyId: id } });
      return;
    }
    // Register roles are not a claim about purchasing authority or direct contact details.
    await tx.publicContact.deleteMany({
      where: { companyId: id, kind: "ROLE" },
    });
    for (const d of currentDirectors(c.executive_management ?? [])) {
      const value = `${d.name} · ${d.role}`;
      if (
        await tx.contactSuppression.findUnique({ where: { hash: hash(value) } })
      )
        continue;
      await tx.publicContact.upsert({
        where: { companyId_value: { companyId: id, value } },
        create: {
          companyId: id,
          value,
          name: d.name,
          title: d.role,
          kind: "ROLE",
          sourceUrl: source,
          expiresAt: new Date(Date.now() + 30 * 86400000),
        },
        update: {
          name: d.name,
          title: d.role,
          sourceUrl: source,
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 86400000),
        },
      });
    }
  });
  return { ok: true, eligible };
}
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
  );
const statementSchema = z.object({
  period: z.object({ from: dateOnly, to: dateOnly }).optional(),
  period_start: dateOnly.optional(),
  period_end: dateOnly.optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  revenue: z.number().finite().nullable().optional(),
  gross_profit: z.number().finite().nullable().optional(),
  profit: z.number().finite().nullable().optional(),
  equity: z.number().finite().nullable().optional(),
  published_at: z.string().datetime({ offset: true }),
  xml_url: z.string().url().nullable().optional(),
  pdf_url: z.string().url().nullable().optional(),
  html_url: z.string().url().nullable().optional(),
});
export function latestStatement(rows: unknown[]) {
  const valid = rows.flatMap((row) => {
    const p = statementSchema.safeParse(row);
    if (!p.success) return [];
    const d = p.data,
      from = d.period?.from ?? d.period_start,
      to = d.period?.to ?? d.period_end;
    return from &&
      to &&
      from <= to &&
      Date.parse(to) <= Date.now() &&
      Date.parse(d.published_at) <= Date.now()
      ? [{ ...d, from, to }]
      : [];
  });
  return valid.sort(
    (a, b) =>
      b.to.localeCompare(a.to) ||
      Date.parse(b.published_at) - Date.parse(a.published_at),
  )[0];
}
export async function enrichFinancials(id: string) {
  const c = await prisma.company.findUniqueOrThrow({ where: { id } });
  const active = getRegistryProvider();
  if (!active.supportsStatements)
    return {
      ok: true,
      message:
        "ApiCVR understøtter ikke regnskabsopslag. Skift til CVRbasen (CVR_REGISTRY_PROVIDER=cvrbasen), eller spring regnskabstrinnet over.",
    };
  const { result, provider } = await budgetedRegistry((p) =>
    p.getStatements(c.cvr),
  );
  const { data } = z
    .object({ data: z.array(z.unknown()).max(200) })
    .parse(result);
  const s = latestStatement(data);
  if (!s)
    return {
      ok: true,
      message: "Ingen brugbare regnskabstal med periode og valuta fundet",
    };
  const reportUrl =
    [s.html_url, s.xml_url, s.pdf_url].find(
      (url) => url && /^https?:\/\//.test(url),
    ) ?? null;
  const values = {
    periodStart: new Date(s.from),
    periodEnd: new Date(s.to),
    currency: s.currency,
    revenue: s.revenue ?? null,
    grossProfit: s.gross_profit ?? null,
    profitLoss: s.profit ?? null,
    equity: s.equity ?? null,
    revenueDkk: s.currency === "DKK" ? (s.revenue ?? null) : null,
    reportUrl,
    publishedAt: new Date(s.published_at),
    parseWarnings: [
      `Kilde: ${provider.statementsSourceUrl(c.cvr)}`,
      `Hentet: ${new Date().toISOString()}`,
    ],
  };
  await prisma.financialData.upsert({
    where: {
      companyId_year: { companyId: id, year: Number(s.to.slice(0, 4)) },
    },
    create: { companyId: id, year: Number(s.to.slice(0, 4)), ...values },
    update: values,
  });
  return { ok: true, message: `Regnskab til ${s.to} hentet` };
}
export async function findWebsite(id: string, config: Config) {
  const company = await prisma.company.findUniqueOrThrow({ where: { id } });
  const candidates = [
    ...new Set([
      ...(company.website ? [company.website] : []),
      ...websiteCandidates(company.name, company.websiteHint),
    ]),
  ];
  const attempts: {
    url: string;
    status: string;
    checkedAt: string;
    evidenceUrl?: string;
    excerpt?: string;
  }[] = [];
  let search: (WebsiteSearch & { cached: boolean }) | undefined;
  const audit = () =>
    json({
      candidates,
      attempts,
      search,
      mode: "OPENAI_SEARCH_CVR_VERIFICATION",
      checkedAt: new Date().toISOString(),
    });
  async function* candidateUrls() {
    yield* candidates;
    try {
      search = await searchCompanyWebsite(company);
      const found = search.candidates
        .map((c) => c.url)
        .filter((url) => !candidates.includes(url))
        .slice(0, 4 - candidates.length);
      candidates.push(...found);
      await prisma.company.update({
        where: { id },
        data: { websiteDiscovery: audit() },
      });
      yield* found;
    } catch (e) {
      await prisma.company.update({
        where: { id },
        data: {
          websiteDiscovery: json({
            candidates,
            attempts,
            search,
            mode: "OPENAI_SEARCH_CVR_VERIFICATION",
            checkedAt: new Date().toISOString(),
            searchError: e instanceof Error ? e.message : "Søgningen fejlede",
          }),
        },
      });
      throw e;
    }
  }
  for await (const url of candidateUrls()) {
    const domain = new URL(url).hostname;
    await prisma.crawlLock.deleteMany({
      where: { domain, expiresAt: { lt: new Date() } },
    });
    try {
      await prisma.crawlLock.create({
        data: { domain, expiresAt: new Date(Date.now() + 6 * 60000) },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        attempts.push({
          url,
          status: "Domænet afventer en anden kørsel eller pause",
          checkedAt: new Date().toISOString(),
        });
        continue;
      }
      throw e;
    }
    let cooldownMs = 30000;
    try {
      const result = await crawl(
        url,
        { ...config, maxPages: 4 },
        { identityOnly: true },
      );
      cooldownMs = result.cooldownMs;
      const match = verifiedWebsite(company.cvr, result.pages);
      attempts.push({
        url,
        status: match
          ? "CVR bekræftet"
          : (result.pages[0]?.error ?? "Intet entydigt CVR-bevis"),
        checkedAt: new Date().toISOString(),
        ...(match
          ? { evidenceUrl: match.url, excerpt: `CVR ${company.cvr}` }
          : {}),
      });
      if (match) {
        const website = url;
        const saved = await prisma.company.updateMany({
          where: { id, website: company.website },
          data: {
            website,
            domain: new URL(website).hostname,
            websiteDiscovery: audit(),
          },
        });
        return {
          ok: true,
          verified: saved.count > 0,
          message: saved.count
            ? "Hjemmesiden er bekræftet med CVR og gemt"
            : "En hjemmeside blev gemt i mellemtiden; den er bevaret",
        };
      }
    } finally {
      await prisma.crawlLock.updateMany({
        where: { domain },
        data: { expiresAt: new Date(Date.now() + cooldownMs) },
      });
    }
  }
  await prisma.company.update({
    where: { id },
    data: {
      websiteDiscovery: audit(),
    },
  });
  return {
    ok: true,
    verified: false,
    message:
      attempts.find((a) => /HTTP 403|HTTP 401|CAPTCHA/.test(a.status))
        ?.status ??
      "Ingen entydigt bekræftet hjemmeside fundet. Afklar den manuelt.",
  };
}
