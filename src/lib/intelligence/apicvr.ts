import { z } from "zod";
import { RegistryError } from "./cvrbasen";

/** Public hosted ApiCVR needs no key; optional bearer for self-hosted instances. */
export function apicvrBaseUrl() {
  const raw = process.env.APICVR_BASE_URL?.trim() || "https://apicvr.dk";
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:")
      throw new Error("bad protocol");
    return u.origin;
  } catch {
    throw new RegistryError(
      "APICVR_BASE_URL er ugyldig; brug fx https://apicvr.dk",
      3600000,
      true,
    );
  }
}

export function apicvrConfigured() {
  // Public ApiCVR has no auth. Optional APICVR_API_KEY is only for private instances.
  // Provider selection (CVR_REGISTRY_PROVIDER=apicvr) enables the client.
  return true;
}

const direktorSchema = z.object({
  name: z.string().nullable().optional(),
  role: z.string(),
  type: z.string(),
  startdate: z.string().nullable().optional(),
});

export const apicvrCompanySchema = z.object({
  vat: z.union([z.number().int(), z.string()]),
  name: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  zipcode: z.union([z.string(), z.number()]).nullable().optional(),
  city: z.string().nullable().optional(),
  protected: z.boolean().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  startdate: z.string().nullable().optional(),
  enddate: z.string().nullable().optional(),
  employees: z.number().int().nonnegative().nullable().optional(),
  industrycode: z.union([z.number().int(), z.string()]).nullable().optional(),
  industrydesc: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  direktion: z.array(direktorSchema).optional(),
});

export type ApicvrCompany = z.infer<typeof apicvrCompanySchema>;

/** Map ApiCVR's flat company shape onto the shared registry profile used by enrichment. */
export function mapApicvrCompany(raw: unknown) {
  const c = apicvrCompanySchema.parse(raw);
  const now = new Date();
  const headcount = c.employees ?? null;
  return {
    vat: String(c.vat),
    name: (c.name ?? "").trim() || `CVR ${c.vat}`,
    // ApiCVR only exposes the Danish CVR register; there is no country field.
    country_code: "DK",
    status: c.status ?? "UNKNOWN",
    protected: c.protected ?? null,
    end_date: c.enddate ?? null,
    employees:
      headcount == null
        ? []
        : [
            {
              year: now.getUTCFullYear(),
              month: now.getUTCMonth() + 1,
              headcount,
            },
          ],
    industry_code: c.industrycode == null ? "" : String(c.industrycode),
    industry_description: c.industrydesc ?? null,
    address: c.address ?? null,
    zipcode: c.zipcode ?? null,
    city: c.city ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    start_date: c.startdate ?? null,
    executive_management: (c.direktion ?? [])
      .filter((d) => d.type === "PERSON" && d.name && d.name.trim().length >= 3)
      .map((d) => ({
        name: d.name!.trim(),
        role: d.role,
        active: true,
        period: { to: null as string | null },
      })),
  };
}

export function apicvrCompanyUrl(cvr: string) {
  return `${apicvrBaseUrl()}/api/v1/${cvr}`;
}

export async function apicvrRequest(
  path: string,
  request: typeof fetch = fetch,
): Promise<unknown> {
  if (!/^\/api\/v1\/\d{8}(?:\/direktion-og-ansvarlig)?$/.test(path))
    throw new Error("Ugyldig ApiCVR-sti");
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const key = process.env.APICVR_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  const response = await request(`${apicvrBaseUrl()}${path}`, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(25000),
    headers,
  });
  if (!response.ok) {
    const h = response.headers.get("retry-after");
    const delay = h
      ? /^\d+$/.test(h)
        ? Number(h) * 1000
        : Date.parse(h) - Date.now()
      : 3600000;
    throw new RegistryError(
      `ApiCVR svarede HTTP ${response.status}. ${
        response.status === 401 || response.status === 403
          ? "Kontrollér APICVR_API_KEY / base-URL (kun relevant for privat instans)."
          : response.status === 404
            ? "Virksomheden blev ikke fundet i ApiCVR."
            : "Opslaget er sat på pause."
      }`,
      Number.isFinite(delay)
        ? Math.max(60000, Math.min(delay, 86400000))
        : 3600000,
      [400, 401, 403].includes(response.status),
    );
  }
  return response.json();
}

export async function fetchApicvrCompany(
  cvr: string,
  request: typeof fetch = fetch,
) {
  const clean = cvr.replace(/\D/g, "");
  if (clean.length !== 8) throw new RegistryError("Ugyldigt CVR-nummer", 0, true);
  const raw = await apicvrRequest(`/api/v1/${clean}`, request);
  return mapApicvrCompany(raw);
}
