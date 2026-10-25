import {
  RegistryError,
  searchRegistry,
  registryRequest,
} from "./cvrbasen";
import {
  apicvrConfigured,
  apicvrCompanyUrl,
  fetchApicvrCompany,
} from "./apicvr";

export const registryProviderIds = ["cvrbasen", "apicvr"] as const;
export type RegistryProviderId = (typeof registryProviderIds)[number];

export function resolveRegistryProviderId(
  env: NodeJS.ProcessEnv = process.env,
): RegistryProviderId {
  const raw = env.CVR_REGISTRY_PROVIDER?.trim().toLowerCase();
  if (!raw || raw === "cvrbasen") return "cvrbasen";
  if (raw === "apicvr") return "apicvr";
  throw new RegistryError(
    `CVR_REGISTRY_PROVIDER skal være cvrbasen eller apicvr (fik "${raw}")`,
    3600000,
    true,
  );
}

export type RegistryProvider = {
  id: RegistryProviderId;
  label: string;
  /** True when this provider can run Find virksomheder (industry search). */
  supportsSearch: boolean;
  /** True when statements/regnskab endpoint exists. */
  supportsStatements: boolean;
  /** Ready for the operations this provider supports. */
  configured: boolean;
  /** Short Danish status for the discovery pill. */
  configuredLabel: string;
  /** Longer Danish hint when not ready for discovery search. */
  discoveryHint: string;
  employeeCountSource: string;
  importSourceLabel: string;
  companySourceUrl: (cvr: string) => string;
  statementsSourceUrl: (cvr: string) => string;
  search: typeof searchRegistry;
  getCompany: (
    cvr: string,
    request?: typeof fetch,
  ) => Promise<{ data: unknown }>;
  getStatements: (
    cvr: string,
    request?: typeof fetch,
  ) => Promise<{ data: unknown }>;
};

function cvrbasenProvider(): RegistryProvider {
  const key = Boolean(process.env.CVRBASEN_API_KEY?.trim());
  return {
    id: "cvrbasen",
    label: "CVRbasen",
    supportsSearch: true,
    supportsStatements: true,
    configured: key,
    configuredLabel: key ? "API-nøgle konfigureret" : "API-nøgle mangler",
    discoveryHint: key
      ? ""
      : "Tilføj CVRBASEN_API_KEY i serverens .env, og genstart serveren. Nøglen opbevares kun på serveren. Et abonnement hos CVRbasen kan koste penge; vores regler bruger ingen AI-tokens.",
    employeeCountSource: "CVRbasen",
    importSourceLabel: "CVRbasen API",
    companySourceUrl: (cvr) => `https://api.cvrbasen.dk/v1/companies/${cvr}`,
    statementsSourceUrl: (cvr) =>
      `https://api.cvrbasen.dk/v1/companies/${cvr}/statements`,
    search: searchRegistry,
    getCompany: async (cvr, request = fetch) => {
      const body = await registryRequest(`/companies/${cvr}`, undefined, request);
      return body as { data: unknown };
    },
    getStatements: async (cvr, request = fetch) => {
      const body = await registryRequest(
        `/companies/${cvr}/statements`,
        undefined,
        request,
      );
      return body as { data: unknown };
    },
  };
}

function apicvrProvider(): RegistryProvider {
  const ready = apicvrConfigured();
  return {
    id: "apicvr",
    label: "ApiCVR",
    supportsSearch: false,
    supportsStatements: false,
    configured: ready,
    configuredLabel: process.env.APICVR_API_KEY?.trim()
      ? "API-nøgle konfigureret"
      : "ApiCVR aktiv (ingen nøgle påkrævet)",
    discoveryHint:
      "ApiCVR understøtter ikke branchesøgning (industry_code). Find virksomheder kræver CVRbasen (CVR_REGISTRY_PROVIDER=cvrbasen og CVRBASEN_API_KEY). Opdater CVR / registeropslag kan bruge ApiCVR.",
    employeeCountSource: "ApiCVR",
    importSourceLabel: "ApiCVR",
    companySourceUrl: apicvrCompanyUrl,
    statementsSourceUrl: () => "https://apicvr.dk/docs",
    search: async () => {
      throw new RegistryError(
        "ApiCVR har ingen søgning på branche/medarbejdertal/status. Brug CVRbasen til Find virksomheder (CVR_REGISTRY_PROVIDER=cvrbasen).",
        3600000,
        true,
      );
    },
    getCompany: async (cvr, request = fetch) => {
      const data = await fetchApicvrCompany(cvr, request);
      return { data };
    },
    getStatements: async () => {
      throw new RegistryError(
        "ApiCVR understøtter ikke regnskabsopslag (statements). Brug CVRbasen, eller spring regnskabstrinnet over.",
        3600000,
        true,
      );
    },
  };
}

export function getRegistryProvider(
  id: RegistryProviderId = resolveRegistryProviderId(),
): RegistryProvider {
  return id === "apicvr" ? apicvrProvider() : cvrbasenProvider();
}

/** True when company lookup / Opdater CVR can run. */
export function registryLookupReady(
  provider: RegistryProvider = getRegistryProvider(),
) {
  if (provider.id === "cvrbasen")
    return Boolean(process.env.CVRBASEN_API_KEY?.trim());
  return provider.configured;
}

/** True when Find virksomheder (industry search) can run. */
export function registrySearchReady(
  provider: RegistryProvider = getRegistryProvider(),
) {
  return provider.supportsSearch && provider.configured;
}
