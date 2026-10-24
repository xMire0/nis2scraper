import { z } from "zod";
import { validCvr } from "./csv";
export const activeStatuses = ["NORMAL", "Aktiv"] as const;
export const isActiveRegistry = (status: string) =>
  activeStatuses.some((s) => s === status);

export const discoveryConfigSchema = z
  .object({
    enabled: z.boolean(),
    autoEnrich: z.boolean().default(true),
    industryPrefixes: z
      .array(z.string().regex(/^\d{2,6}$/))
      .min(1)
      .max(20),
    minEmployees: z.number().int().min(1).max(100000),
    maxEmployees: z.number().int().min(1).max(100000),
    intervalMinutes: z.number().int().min(15).max(10080),
    maxRequestsPerDay: z.number().int().min(1).max(100),
  })
  .refine(
    (x) => x.minEmployees <= x.maxEmployees,
    "Minimum overstiger maksimum",
  );
export type DiscoveryConfig = z.infer<typeof discoveryConfigSchema>;
export const defaultDiscoveryConfig: DiscoveryConfig = {
  enabled: false,
  autoEnrich: true,
  industryPrefixes: ["62", "63", "58", "26", "33", "71"],
  minEmployees: 20,
  maxEmployees: 250,
  intervalMinutes: 60,
  maxRequestsPerDay: 10,
};
const employeeSchema = z.object({
  year: z.number().int().min(1900).max(2200),
  month: z.number().int().min(1).max(12),
  headcount: z.number().int().nonnegative().nullable(),
});
export const registryCompanySchema = z.object({
  vat: z
    .union([z.number().int(), z.string()])
    .transform(String)
    .refine(validCvr),
  name: z.string().trim().min(1).max(255),
  country_code: z.string(),
  status: z.string(),
  protected: z.boolean().nullable().optional(),
  end_date: z.string().nullable().optional(),
  employees: z.array(employeeSchema),
  industry_code: z.string(),
  industry_description: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  zipcode: z.union([z.string(), z.number()]).nullable().optional(),
  city: z.string().nullable().optional(),
});
export type RegistryCompany = z.infer<typeof registryCompanySchema>;
export function latestEmployees(company: RegistryCompany) {
  return [...company.employees].sort(
    (a, b) => b.year - a.year || b.month - a.month,
  )[0];
}
export function exclusionReason(
  company: RegistryCompany,
  config: DiscoveryConfig,
) {
  if (company.protected !== false)
    return "Reklamebeskyttelse eller ukendt beskyttelse";
  if (
    company.country_code !== "DK" ||
    !isActiveRegistry(company.status) ||
    company.end_date
  )
    return "Ikke aktiv dansk virksomhed";
  if (!config.industryPrefixes.some((p) => company.industry_code.startsWith(p)))
    return "Branche uden for søgningen";
  const n = latestEmployees(company)?.headcount;
  if (n == null) return "Medarbejdertal mangler";
  if (n < config.minEmployees || n > config.maxEmployees)
    return "Størrelse uden for målgruppen";
  return null;
}
export class RegistryError extends Error {
  constructor(
    message: string,
    public retryMs = 3600000,
    public stop = false,
  ) {
    super(message);
  }
}
export async function searchRegistry(
  config: DiscoveryConfig,
  page: number,
  request: typeof fetch = fetch,
  status: string = "NORMAL",
) {
  const result = await registryRequest(
    "/companies/search",
    {
      query: {
        status_eq: status,
        industry_code_start: config.industryPrefixes[0],
      },
      method: "SELECT",
      page,
      per_page: 100,
      sorts: "vat ASC",
    },
    request,
  );
  const body = z
    .object({
      data: z.array(z.unknown()).max(100),
      has_more: z.boolean(),
      page: z.number().int(),
    })
    .parse(result);
  if (body.page !== page || (body.has_more && body.data.length === 0))
    throw new RegistryError(
      "CVRbasen returnerede inkonsistent paginering",
      3600000,
      true,
    );
  return body;
}
export async function registryRequest(
  path: string,
  body?: unknown,
  request: typeof fetch = fetch,
): Promise<unknown> {
  if (!/^\/companies\/(?:search|\d{8}(?:\/statements)?)$/.test(path))
    throw new Error("Ugyldig CVRbasen-sti");
  const key = process.env.CVRBASEN_API_KEY?.trim();
  if (!key)
    throw new RegistryError(
      "CVRBASEN_API_KEY mangler på serveren",
      3600000,
      true,
    );
  const response = await request(`https://api.cvrbasen.dk/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    redirect: "error",
    signal: AbortSignal.timeout(25000),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const h = response.headers.get("retry-after");
    const delay = h
      ? /^\d+$/.test(h)
        ? Number(h) * 1000
        : Date.parse(h) - Date.now()
      : 3600000;
    throw new RegistryError(
      `CVRbasen svarede HTTP ${response.status}. ${response.status === 401 || response.status === 403 ? "Kontrollér API-nøgle og abonnement." : "Søgningen er sat på pause."}`,
      Number.isFinite(delay)
        ? Math.max(60000, Math.min(delay, 86400000))
        : 3600000,
      [400, 401, 403].includes(response.status),
    );
  }
  return response.json();
}
