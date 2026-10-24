/**
 * The 18 NIS2 sectors and their mapping to Danish DB07 (NACE rev. 2) codes.
 *
 * IMPORTANT: this table is a *screening* aid, not a legal determination.
 * DB07 is self-reported at registration and routinely stale or wrong — a
 * managed security provider and a Word-template consultancy both sit under
 * 620200. The table decides who gets pulled in and what the LLM is asked to
 * verify; the LLM's operational read decides sector membership.
 */

export type Nis2SectorKey =
  // Annex I — sectors of high criticality (11)
  | "ENERGY"
  | "TRANSPORT"
  | "BANKING"
  | "FINANCIAL_MARKET_INFRASTRUCTURE"
  | "HEALTH"
  | "DRINKING_WATER"
  | "WASTE_WATER"
  | "DIGITAL_INFRASTRUCTURE"
  | "ICT_SERVICE_MANAGEMENT"
  | "PUBLIC_ADMINISTRATION"
  | "SPACE"
  // Annex II — other critical sectors (7)
  | "POSTAL_AND_COURIER"
  | "WASTE_MANAGEMENT"
  | "CHEMICALS"
  | "FOOD"
  | "MANUFACTURING"
  | "DIGITAL_PROVIDERS"
  | "RESEARCH"
  | "NONE";

export type AnnexKey = "ANNEX_1" | "ANNEX_2" | "NONE";

export interface SectorDefinition {
  key: Nis2SectorKey;
  annex: AnnexKey;
  /** Danish label — used verbatim in the UI and in outreach copy. */
  labelDa: string;
  labelEn: string;
  /** Sub-sectors as enumerated in the annexes; the LLM must pick one of these. */
  subSectors: string[];
}

export const SECTORS: Record<Exclude<Nis2SectorKey, "NONE">, SectorDefinition> = {
  ENERGY: {
    key: "ENERGY",
    annex: "ANNEX_1",
    labelDa: "Energi",
    labelEn: "Energy",
    subSectors: ["Electricity", "District heating and cooling", "Oil", "Gas", "Hydrogen"],
  },
  TRANSPORT: {
    key: "TRANSPORT",
    annex: "ANNEX_1",
    labelDa: "Transport",
    labelEn: "Transport",
    subSectors: ["Air", "Rail", "Water", "Road"],
  },
  BANKING: {
    key: "BANKING",
    annex: "ANNEX_1",
    labelDa: "Bankvirksomhed",
    labelEn: "Banking",
    subSectors: ["Credit institutions"],
  },
  FINANCIAL_MARKET_INFRASTRUCTURE: {
    key: "FINANCIAL_MARKET_INFRASTRUCTURE",
    annex: "ANNEX_1",
    labelDa: "Finansielle markedsinfrastrukturer",
    labelEn: "Financial market infrastructures",
    subSectors: ["Trading venues", "Central counterparties"],
  },
  HEALTH: {
    key: "HEALTH",
    annex: "ANNEX_1",
    labelDa: "Sundhedssektoren",
    labelEn: "Health",
    subSectors: [
      "Healthcare providers",
      "EU reference laboratories",
      "Pharmaceutical research and manufacturing",
      "Manufacture of critical medical devices",
      "Distribution of medicinal products",
    ],
  },
  DRINKING_WATER: {
    key: "DRINKING_WATER",
    annex: "ANNEX_1",
    labelDa: "Drikkevand",
    labelEn: "Drinking water",
    subSectors: ["Suppliers and distributors of water for human consumption"],
  },
  WASTE_WATER: {
    key: "WASTE_WATER",
    annex: "ANNEX_1",
    labelDa: "Spildevand",
    labelEn: "Waste water",
    subSectors: ["Collection, disposal or treatment of urban, domestic or industrial waste water"],
  },
  DIGITAL_INFRASTRUCTURE: {
    key: "DIGITAL_INFRASTRUCTURE",
    annex: "ANNEX_1",
    labelDa: "Digital infrastruktur",
    labelEn: "Digital infrastructure",
    subSectors: [
      "Internet exchange point providers",
      "DNS service providers",
      "TLD name registries",
      "Cloud computing service providers",
      "Data centre service providers",
      "Content delivery network providers",
      "Trust service providers",
      "Providers of public electronic communications networks",
      "Providers of publicly available electronic communications services",
    ],
  },
  ICT_SERVICE_MANAGEMENT: {
    key: "ICT_SERVICE_MANAGEMENT",
    annex: "ANNEX_1",
    labelDa: "Forvaltning af IKT-tjenester (business-to-business)",
    labelEn: "ICT service management (B2B)",
    subSectors: ["Managed service providers", "Managed security service providers"],
  },
  PUBLIC_ADMINISTRATION: {
    key: "PUBLIC_ADMINISTRATION",
    annex: "ANNEX_1",
    labelDa: "Offentlig forvaltning",
    labelEn: "Public administration",
    subSectors: ["Central government", "Regional government"],
  },
  SPACE: {
    key: "SPACE",
    annex: "ANNEX_1",
    labelDa: "Rummet",
    labelEn: "Space",
    subSectors: ["Operators of ground-based infrastructure supporting space-based services"],
  },
  POSTAL_AND_COURIER: {
    key: "POSTAL_AND_COURIER",
    annex: "ANNEX_2",
    labelDa: "Post- og kurertjenester",
    labelEn: "Postal and courier services",
    subSectors: ["Postal service providers", "Courier services"],
  },
  WASTE_MANAGEMENT: {
    key: "WASTE_MANAGEMENT",
    annex: "ANNEX_2",
    labelDa: "Affaldshåndtering",
    labelEn: "Waste management",
    subSectors: ["Waste management undertakings"],
  },
  CHEMICALS: {
    key: "CHEMICALS",
    annex: "ANNEX_2",
    labelDa: "Fremstilling, produktion og distribution af kemikalier",
    labelEn: "Manufacture, production and distribution of chemicals",
    subSectors: ["Manufacture, production and distribution of chemicals"],
  },
  FOOD: {
    key: "FOOD",
    annex: "ANNEX_2",
    labelDa: "Produktion, tilvirkning og distribution af fødevarer",
    labelEn: "Production, processing and distribution of food",
    subSectors: ["Wholesale distribution", "Industrial production and processing"],
  },
  MANUFACTURING: {
    key: "MANUFACTURING",
    annex: "ANNEX_2",
    labelDa: "Fremstilling",
    labelEn: "Manufacturing",
    subSectors: [
      "Manufacture of medical devices and in vitro diagnostic medical devices",
      "Manufacture of computer, electronic and optical products",
      "Manufacture of electrical equipment",
      "Manufacture of machinery and equipment n.e.c.",
      "Manufacture of motor vehicles, trailers and semi-trailers",
      "Manufacture of other transport equipment",
    ],
  },
  DIGITAL_PROVIDERS: {
    key: "DIGITAL_PROVIDERS",
    annex: "ANNEX_2",
    labelDa: "Digitale udbydere",
    labelEn: "Digital providers",
    subSectors: [
      "Providers of online marketplaces",
      "Providers of online search engines",
      "Providers of social networking services platforms",
    ],
  },
  RESEARCH: {
    key: "RESEARCH",
    annex: "ANNEX_2",
    labelDa: "Forskning",
    labelEn: "Research",
    subSectors: ["Research organisations"],
  },
};

export function annexOf(sector: Nis2SectorKey): AnnexKey {
  if (sector === "NONE") return "NONE";
  return SECTORS[sector].annex;
}

/**
 * Sub-sectors that are in scope regardless of size (NIS2 art. 2(2) and 3(1)).
 * A three-person DNS provider is an essential entity; a three-person bakery is not.
 */
export const SIZE_EXEMPT_SUBSECTORS = new Set<string>([
  "DNS service providers",
  "TLD name registries",
  "Trust service providers",
  "Providers of public electronic communications networks",
  "Providers of publicly available electronic communications services",
  "Central government",
  "Regional government",
]);

/** Size-exempt sub-sectors that land in ESSENTIAL rather than IMPORTANT. */
export const SIZE_EXEMPT_ESSENTIAL = new Set<string>([
  "DNS service providers",
  "TLD name registries",
  "Trust service providers",
  "Central government",
]);

export interface Db07Mapping {
  /** DB07 prefix, digits only (e.g. "6203"). Longest prefix wins. */
  prefix: string;
  sector: Exclude<Nis2SectorKey, "NONE">;
  subSector: string;
  /**
   * "certain"  — the code alone establishes the activity (36.00 water works).
   * "likely"   — usually in scope, LLM confirms.
   * "ambiguous"— the code contains both in- and out-of-scope businesses;
   *              the LLM decides and OUT_OF_SCOPE is a normal outcome.
   */
  confidence: "certain" | "likely" | "ambiguous";
  note?: string;
}

export const DB07_TO_NIS2: Db07Mapping[] = [
  // ---------------- Energy (Annex I) ----------------
  { prefix: "0610", sector: "ENERGY", subSector: "Oil", confidence: "certain" },
  { prefix: "0620", sector: "ENERGY", subSector: "Gas", confidence: "certain" },
  { prefix: "0910", sector: "ENERGY", subSector: "Oil", confidence: "likely" },
  { prefix: "1920", sector: "ENERGY", subSector: "Oil", confidence: "certain", note: "Refining" },
  { prefix: "3511", sector: "ENERGY", subSector: "Electricity", confidence: "certain", note: "Generation" },
  { prefix: "3512", sector: "ENERGY", subSector: "Electricity", confidence: "certain", note: "Transmission" },
  { prefix: "3513", sector: "ENERGY", subSector: "Electricity", confidence: "certain", note: "Distribution (netselskab)" },
  { prefix: "3514", sector: "ENERGY", subSector: "Electricity", confidence: "certain", note: "Supply / trading" },
  { prefix: "3521", sector: "ENERGY", subSector: "Gas", confidence: "certain" },
  { prefix: "3522", sector: "ENERGY", subSector: "Gas", confidence: "certain" },
  { prefix: "3523", sector: "ENERGY", subSector: "Gas", confidence: "certain" },
  { prefix: "3530", sector: "ENERGY", subSector: "District heating and cooling", confidence: "certain" },
  { prefix: "4950", sector: "ENERGY", subSector: "Oil", confidence: "certain", note: "Pipeline transport" },
  { prefix: "4671", sector: "ENERGY", subSector: "Oil", confidence: "likely", note: "Fuel wholesale / oil storage" },
  { prefix: "2011", sector: "ENERGY", subSector: "Hydrogen", confidence: "ambiguous", note: "Industrial gases — hydrogen only" },

  // ---------------- Transport (Annex I) ----------------
  { prefix: "4910", sector: "TRANSPORT", subSector: "Rail", confidence: "certain" },
  { prefix: "4920", sector: "TRANSPORT", subSector: "Rail", confidence: "certain" },
  { prefix: "4941", sector: "TRANSPORT", subSector: "Road", confidence: "ambiguous", note: "ITS operators, not hauliers" },
  { prefix: "5010", sector: "TRANSPORT", subSector: "Water", confidence: "certain" },
  { prefix: "5020", sector: "TRANSPORT", subSector: "Water", confidence: "certain" },
  { prefix: "5030", sector: "TRANSPORT", subSector: "Water", confidence: "certain" },
  { prefix: "5040", sector: "TRANSPORT", subSector: "Water", confidence: "certain" },
  { prefix: "5110", sector: "TRANSPORT", subSector: "Air", confidence: "certain" },
  { prefix: "5121", sector: "TRANSPORT", subSector: "Air", confidence: "certain" },
  { prefix: "5221", sector: "TRANSPORT", subSector: "Road", confidence: "likely", note: "Terminals, traffic management" },
  { prefix: "5222", sector: "TRANSPORT", subSector: "Water", confidence: "likely", note: "Port managing bodies" },
  { prefix: "5223", sector: "TRANSPORT", subSector: "Air", confidence: "certain", note: "Airport operators, ATM" },

  // ---------------- Banking & FMI (Annex I) ----------------
  { prefix: "6419", sector: "BANKING", subSector: "Credit institutions", confidence: "certain" },
  { prefix: "6492", sector: "BANKING", subSector: "Credit institutions", confidence: "ambiguous" },
  { prefix: "6611", sector: "FINANCIAL_MARKET_INFRASTRUCTURE", subSector: "Trading venues", confidence: "certain" },
  { prefix: "6619", sector: "FINANCIAL_MARKET_INFRASTRUCTURE", subSector: "Central counterparties", confidence: "ambiguous" },

  // ---------------- Health (Annex I) ----------------
  { prefix: "8610", sector: "HEALTH", subSector: "Healthcare providers", confidence: "certain" },
  { prefix: "8621", sector: "HEALTH", subSector: "Healthcare providers", confidence: "certain" },
  { prefix: "8622", sector: "HEALTH", subSector: "Healthcare providers", confidence: "certain" },
  { prefix: "8623", sector: "HEALTH", subSector: "Healthcare providers", confidence: "certain" },
  { prefix: "8690", sector: "HEALTH", subSector: "Healthcare providers", confidence: "likely" },
  { prefix: "2110", sector: "HEALTH", subSector: "Pharmaceutical research and manufacturing", confidence: "certain" },
  { prefix: "2120", sector: "HEALTH", subSector: "Pharmaceutical research and manufacturing", confidence: "certain" },
  { prefix: "4646", sector: "HEALTH", subSector: "Distribution of medicinal products", confidence: "certain" },
  { prefix: "7211", sector: "HEALTH", subSector: "EU reference laboratories", confidence: "ambiguous", note: "Also RESEARCH" },

  // ---------------- Water (Annex I) ----------------
  { prefix: "3600", sector: "DRINKING_WATER", subSector: "Suppliers and distributors of water for human consumption", confidence: "certain" },
  { prefix: "3700", sector: "WASTE_WATER", subSector: "Collection, disposal or treatment of urban, domestic or industrial waste water", confidence: "certain" },

  // ---------------- Digital infrastructure (Annex I) ----------------
  { prefix: "6110", sector: "DIGITAL_INFRASTRUCTURE", subSector: "Providers of public electronic communications networks", confidence: "certain" },
  { prefix: "6120", sector: "DIGITAL_INFRASTRUCTURE", subSector: "Providers of public electronic communications networks", confidence: "certain" },
  { prefix: "6130", sector: "DIGITAL_INFRASTRUCTURE", subSector: "Providers of public electronic communications networks", confidence: "certain", note: "Satellite — cross-check SPACE" },
  { prefix: "6190", sector: "DIGITAL_INFRASTRUCTURE", subSector: "Providers of publicly available electronic communications services", confidence: "likely" },
  { prefix: "6311", sector: "DIGITAL_INFRASTRUCTURE", subSector: "Data centre service providers", confidence: "ambiguous", note: "Hosting/cloud/DC vs. plain data processing" },

  // ---------------- ICT service management (Annex I) ----------------
  { prefix: "6202", sector: "ICT_SERVICE_MANAGEMENT", subSector: "Managed service providers", confidence: "ambiguous", note: "Consultancy vs. managed operations — LLM decides" },
  { prefix: "6203", sector: "ICT_SERVICE_MANAGEMENT", subSector: "Managed service providers", confidence: "likely", note: "Computer facilities management = classic MSP" },
  { prefix: "6209", sector: "ICT_SERVICE_MANAGEMENT", subSector: "Managed security service providers", confidence: "ambiguous" },
  { prefix: "8020", sector: "ICT_SERVICE_MANAGEMENT", subSector: "Managed security service providers", confidence: "ambiguous", note: "Security systems service" },

  // ---------------- Public administration & Space (Annex I) ----------------
  { prefix: "8411", sector: "PUBLIC_ADMINISTRATION", subSector: "Central government", confidence: "likely" },
  { prefix: "8412", sector: "PUBLIC_ADMINISTRATION", subSector: "Regional government", confidence: "likely" },
  { prefix: "8413", sector: "PUBLIC_ADMINISTRATION", subSector: "Central government", confidence: "likely" },
  { prefix: "5122", sector: "SPACE", subSector: "Operators of ground-based infrastructure supporting space-based services", confidence: "certain" },
  { prefix: "3030", sector: "SPACE", subSector: "Operators of ground-based infrastructure supporting space-based services", confidence: "ambiguous", note: "Also MANUFACTURING" },

  // ---------------- Postal & waste (Annex II) ----------------
  { prefix: "5310", sector: "POSTAL_AND_COURIER", subSector: "Postal service providers", confidence: "certain" },
  { prefix: "5320", sector: "POSTAL_AND_COURIER", subSector: "Courier services", confidence: "certain" },
  { prefix: "381", sector: "WASTE_MANAGEMENT", subSector: "Waste management undertakings", confidence: "certain" },
  { prefix: "382", sector: "WASTE_MANAGEMENT", subSector: "Waste management undertakings", confidence: "certain" },
  { prefix: "383", sector: "WASTE_MANAGEMENT", subSector: "Waste management undertakings", confidence: "certain" },
  { prefix: "3900", sector: "WASTE_MANAGEMENT", subSector: "Waste management undertakings", confidence: "certain" },

  // ---------------- Chemicals & food (Annex II) ----------------
  { prefix: "20", sector: "CHEMICALS", subSector: "Manufacture, production and distribution of chemicals", confidence: "likely" },
  { prefix: "4675", sector: "CHEMICALS", subSector: "Manufacture, production and distribution of chemicals", confidence: "certain" },
  { prefix: "10", sector: "FOOD", subSector: "Industrial production and processing", confidence: "likely" },
  { prefix: "11", sector: "FOOD", subSector: "Industrial production and processing", confidence: "likely" },
  { prefix: "463", sector: "FOOD", subSector: "Wholesale distribution", confidence: "likely" },

  // ---------------- Manufacturing (Annex II) ----------------
  { prefix: "3250", sector: "MANUFACTURING", subSector: "Manufacture of medical devices and in vitro diagnostic medical devices", confidence: "certain" },
  { prefix: "26", sector: "MANUFACTURING", subSector: "Manufacture of computer, electronic and optical products", confidence: "certain" },
  { prefix: "27", sector: "MANUFACTURING", subSector: "Manufacture of electrical equipment", confidence: "certain" },
  { prefix: "28", sector: "MANUFACTURING", subSector: "Manufacture of machinery and equipment n.e.c.", confidence: "certain" },
  { prefix: "29", sector: "MANUFACTURING", subSector: "Manufacture of motor vehicles, trailers and semi-trailers", confidence: "certain" },
  { prefix: "30", sector: "MANUFACTURING", subSector: "Manufacture of other transport equipment", confidence: "certain" },

  // ---------------- Digital providers & research (Annex II) ----------------
  { prefix: "6312", sector: "DIGITAL_PROVIDERS", subSector: "Providers of online search engines", confidence: "ambiguous", note: "Web portals: marketplace / search / social" },
  { prefix: "4791", sector: "DIGITAL_PROVIDERS", subSector: "Providers of online marketplaces", confidence: "ambiguous", note: "Own-stock e-commerce is out of scope" },
  { prefix: "7219", sector: "RESEARCH", subSector: "Research organisations", confidence: "likely" },
  { prefix: "7220", sector: "RESEARCH", subSector: "Research organisations", confidence: "ambiguous" },
  { prefix: "8542", sector: "RESEARCH", subSector: "Research organisations", confidence: "ambiguous", note: "Universities" },
];

/** "62.03", "620300", " 6203 " → "620300"-ish digits. */
export function normaliseDb07(code: string | null | undefined): string | null {
  if (!code) return null;
  const digits = code.replace(/\D/g, "");
  return digits.length ? digits : null;
}

/** Longest-prefix lookup. Returns null when the code is outside every sector. */
export function mapDb07(code: string | null | undefined): Db07Mapping | null {
  const digits = normaliseDb07(code);
  if (!digits) return null;
  let best: Db07Mapping | null = null;
  for (const entry of DB07_TO_NIS2) {
    if (digits.startsWith(entry.prefix) && (!best || entry.prefix.length > best.prefix.length)) {
      best = entry;
    }
  }
  return best;
}

/** Every DB07 prefix worth pulling from CVR — the ingestion filter. */
export function db07PrefixesForSectors(sectors: Nis2SectorKey[] | undefined): string[] {
  if (!sectors || sectors.length === 0) return DB07_TO_NIS2.map((e) => e.prefix);
  const wanted = new Set(sectors);
  return DB07_TO_NIS2.filter((e) => wanted.has(e.sector)).map((e) => e.prefix);
}
