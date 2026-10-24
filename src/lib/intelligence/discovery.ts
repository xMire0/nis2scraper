import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { emailDomain } from "./website";
import {
  defaultDiscoveryConfig,
  discoveryConfigSchema,
  registryCompanySchema,
  latestEmployees,
  exclusionReason,
  searchRegistry,
  RegistryError,
  activeStatuses,
  isActiveRegistry,
  type DiscoveryConfig,
} from "./cvrbasen";
const asJson = (x: unknown) =>
  JSON.parse(JSON.stringify(x)) as Prisma.InputJsonValue;
export async function discoveryState() {
  return prisma.discoveryState.upsert({
    where: { id: "cvrbasen" },
    create: { id: "cvrbasen", config: asJson(defaultDiscoveryConfig) },
    update: {},
  });
}
export async function discoverySnapshot() {
  const state = await discoveryState();
  const runs = await prisma.discoveryRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  });
  return {
    ...state,
    config: discoveryConfigSchema.parse(state.config),
    configured: Boolean(process.env.CVRBASEN_API_KEY?.trim()),
    runs,
  };
}
export async function saveDiscovery(config: DiscoveryConfig) {
  await discoveryState();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(714022)`;
    const current = await tx.discoveryState.findUniqueOrThrow({
      where: { id: "cvrbasen" },
    });
    if (current.leaseUntil && current.leaseUntil > new Date())
      throw new Error(
        "En søgning kører. Vent til den er færdig før indstillinger ændres.",
      );
    return tx.discoveryState.update({
      where: { id: "cvrbasen" },
      data: {
        config: asJson(config),
        page: 1,
        industryIndex: 0,
        statusIndex: 0,
        ...(current.lastError && current.nextRunAt > new Date()
          ? {}
          : { nextRunAt: new Date(), lastError: null }),
      },
    });
  });
}
export async function runDiscovery(manual = false, search = searchRegistry) {
  if (!process.env.CVRBASEN_API_KEY?.trim()) {
    if (manual)
      throw new Error(
        "Tilføj CVRBASEN_API_KEY i .env og genstart serveren først.",
      );
    return { skipped: true };
  }
  await discoveryState();
  const lease = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(714022)`;
    const state = await tx.discoveryState.findUniqueOrThrow({
      where: { id: "cvrbasen" },
    });
    const config = discoveryConfigSchema.parse(state.config);
    const now = new Date(),
      day = now.toISOString().slice(0, 10);
    const used = state.budgetDay === day ? state.requestsToday : 0;
    if (state.leaseUntil && state.leaseUntil > now)
      throw new Error("En CVR-søgning kører allerede.");
    if (used >= config.maxRequestsPerDay) {
      if (manual)
        throw new Error(
          "Dagens loft over CVRbasen-kald er nået (nulstilles kl. 00 UTC).",
        );
      return null;
    }
    // Manual runs may bypass the normal interval, never a provider backoff.
    if (state.nextRunAt > now && (!manual || state.lastError)) {
      if (manual)
        throw new Error(
          "CVRbasen er på pause indtil " + state.nextRunAt.toISOString(),
        );
      return null;
    }
    if (!manual && !config.enabled) return null;
    const leaseUntil = new Date(Date.now() + 120000);
    await tx.discoveryState.update({
      where: { id: state.id },
      data: { leaseUntil, requestsToday: used + 1, budgetDay: day },
    });
    await tx.discoveryRun.updateMany({
      where: {
        status: "RUNNING",
        startedAt: { lt: new Date(Date.now() - 120000) },
      },
      data: {
        status: "FAILED",
        finishedAt: now,
        error: "Kørslen blev afbrudt; siden prøves igen.",
      },
    });
    const run = await tx.discoveryRun.create({ data: { page: state.page } });
    return {
      config,
      page: state.page,
      industryIndex: state.industryIndex,
      statusIndex: state.statusIndex,
      leaseUntil,
      runId: run.id,
    };
  });
  if (!lease) return { skipped: true };
  const { config, page, industryIndex, statusIndex, runId, leaseUntil } = lease;
  try {
    const result = await search(
      {
        ...config,
        industryPrefixes: [config.industryPrefixes[industryIndex]!],
      },
      page,
      fetch,
      activeStatuses[statusIndex]!,
    );
    return await prisma.$transaction(
      async (tx) => {
        const current = await tx.discoveryState.findUniqueOrThrow({
          where: { id: "cvrbasen" },
        });
        if (current.leaseUntil?.getTime() !== leaseUntil.getTime())
          throw new Error("Søgelåsen er udløbet; resultatet blev ikke gemt.");
        let added = 0,
          updated = 0,
          skipped = 0;
        const reasons: Record<string, number> = {};
        for (const row of result.data) {
          const parsed = registryCompanySchema.safeParse(row);
          const reason = parsed.success
            ? exclusionReason(parsed.data, config)
            : "Ugyldige API-data";
          if (reason) {
            skipped++;
            reasons[reason] = (reasons[reason] ?? 0) + 1;
          }
          if (!parsed.success) continue;
          const c = parsed.data,
            existing = await tx.company.findUnique({ where: { cvr: c.vat } });
          // Record changed protection even when the company is no longer a lead.
          if (existing) {
            await tx.company.update({
              where: { id: existing.id },
              data: {
                advertisingProtected: c.protected ?? null,
                registryFetchedAt: new Date(),
                status:
                  isActiveRegistry(c.status) && !c.end_date
                    ? "ACTIVE"
                    : "UNKNOWN",
                statusRaw: c.status,
              },
            });
            if (c.protected !== false) {
              await tx.publicContact.deleteMany({
                where: { companyId: existing.id },
              });
              await tx.outreachDraft.deleteMany({
                where: { companyId: existing.id },
              });
            }
          }
          if (reason) continue;
          const employees = latestEmployees(c)!;
          const data = {
            websiteHint: emailDomain((row as { email?: unknown }).email),
            name: c.name,
            db07Code: c.industry_code,
            db07Description: c.industry_description ?? null,
            addressStreet: c.address ?? null,
            addressPostalCode: c.zipcode == null ? null : String(c.zipcode),
            addressCity: c.city ?? null,
            addressCountry: "DK",
            employeeCount: employees.headcount,
            employeeMin: employees.headcount,
            employeeMax: employees.headcount,
            employeeCountSource: "CVRbasen",
            employeeCountAsOf: new Date(
              Date.UTC(employees.year, employees.month - 1, 1),
            ),
            status: "ACTIVE" as const,
            statusRaw: c.status,
            advertisingProtected: false,
            registryFetchedAt: new Date(),
            registrySourceUrl: `https://api.cvrbasen.dk/v1/companies/${c.vat}`,
          };
          if (existing) {
            await tx.company.update({ where: { id: existing.id }, data });
            updated++;
          } else {
            await tx.company.create({
              data: {
                cvr: c.vat,
                ...data,
                importSource: "CVRbasen API",
                outreach: {
                  create: {
                    status: "NEW",
                    nextAction:
                      "Afklar virksomhedens officielle hjemmeside, og analysér den med regler.",
                  },
                },
              },
            });
            added++;
          }
        }
        await tx.discoveryRun.update({
          where: { id: runId },
          data: {
            status: "SUCCEEDED",
            finishedAt: new Date(),
            examined: result.data.length,
            added,
            updated,
            skipped,
            reasons: asJson(reasons),
          },
        });
        await tx.discoveryState.update({
          where: { id: "cvrbasen" },
          data: {
            page: result.has_more ? page + 1 : 1,
            industryIndex:
              result.has_more || statusIndex === 0
                ? industryIndex
                : (industryIndex + 1) % config.industryPrefixes.length,
            statusIndex: result.has_more
              ? statusIndex
              : (statusIndex + 1) % activeStatuses.length,
            leaseUntil: null,
            nextRunAt: new Date(Date.now() + config.intervalMinutes * 60000),
            lastError: null,
          },
        });
        return { added, updated, skipped, examined: result.data.length };
      },
      { timeout: 60000 },
    );
  } catch (e) {
    const error =
      e instanceof RegistryError
        ? e.message
        : "CVR-søgning fejlede. Kontrollér forbindelse og API-format; siden er bevaret til næste forsøg.";
    await prisma.$transaction(async (tx) => {
      await tx.discoveryRun.update({
        where: { id: runId },
        data: { status: "FAILED", finishedAt: new Date(), error },
      });
      await tx.discoveryState.updateMany({
        where: { id: "cvrbasen", leaseUntil },
        data: {
          leaseUntil: null,
          lastError: error,
          nextRunAt: new Date(
            Date.now() + (e instanceof RegistryError ? e.retryMs : 3600000),
          ),
          ...(e instanceof RegistryError && e.stop
            ? {
                config: asJson({
                  ...config,
                  enabled: false,
                  autoEnrich: false,
                }),
              }
            : {}),
        },
      });
    });
    throw new Error(error);
  }
}
