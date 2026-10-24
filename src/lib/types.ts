export type Nis2Status =
  | "ESSENTIAL"
  | "IMPORTANT"
  | "SUPPLY_CHAIN_TARGET"
  | "OUT_OF_SCOPE"
  | "NEEDS_REVIEW";

export type OutreachStatus =
  | "NEW"
  | "QUALIFIED"
  | "CONTACTED"
  | "MEETING_SET"
  | "CLOSED_WON"
  | "CLOSED_LOST"
  | "DISQUALIFIED";

export type EmailStatus = "UNVERIFIED" | "VERIFIED" | "ACCEPT_ALL" | "INVALID";

export interface LeadContact {
  id: string;
  name: string;
  title: string | null;
  directEmail: string | null;
  emailStatus: EmailStatus;
  linkedinUrl: string | null;
}

export interface Lead {
  cvr: string;
  name: string;
  domain: string | null;
  city: string | null;
  db07Code: string | null;
  db07Description: string | null;
  employeeCount: number | null;
  nis2: {
    status: Nis2Status;
    sector: string;
    subSector: string | null;
    annexType: "ANNEX_1" | "ANNEX_2" | "NONE";
    sizeClass: string;
    deterministicMatch: boolean;
    sizeExempt: boolean;
    confidence: number | null;
    conflict: boolean;
    auditHook: string | null;
    scopedAt: string;
  } | null;
  financials: {
    year: number;
    revenueDkk: string | null;
    balanceSheetDkk: string | null;
    grossProfit: string | null;
  } | null;
  outreach: { status: OutreachStatus; assignedTo: string | null; nextFollowUpAt: string | null };
  contacts: LeadContact[];
  contactCount: number;
  verifiedContactCount: number;
}

export interface LeadsResponse {
  leads: Lead[];
  kpis: {
    total: number;
    essential: number;
    important: number;
    supplyChain: number;
    needsReview: number;
    verifiedContacts: number;
  };
  pagination: { page: number; pageSize: number; total: number; pages: number };
}

export const STATUS_LABELS: Record<Nis2Status, string> = {
  ESSENTIAL: "Særlig kritisk",
  IMPORTANT: "Vigtig enhed",
  SUPPLY_CHAIN_TARGET: "Leverandørkæde",
  OUT_OF_SCOPE: "Ikke omfattet",
  NEEDS_REVIEW: "Til gennemgang",
};

export const OUTREACH_LABELS: Record<OutreachStatus, string> = {
  NEW: "Ny",
  QUALIFIED: "Kvalificeret",
  CONTACTED: "Kontaktet",
  MEETING_SET: "Møde booket",
  CLOSED_WON: "Vundet",
  CLOSED_LOST: "Tabt",
  DISQUALIFIED: "Diskvalificeret",
};

export const SECTOR_LABELS: Record<string, string> = {
  ENERGY: "Energi",
  TRANSPORT: "Transport",
  BANKING: "Bank",
  FINANCIAL_MARKET_INFRASTRUCTURE: "Finansiel infrastruktur",
  HEALTH: "Sundhed",
  DRINKING_WATER: "Drikkevand",
  WASTE_WATER: "Spildevand",
  DIGITAL_INFRASTRUCTURE: "Digital infrastruktur",
  ICT_SERVICE_MANAGEMENT: "IKT-tjenester (B2B)",
  PUBLIC_ADMINISTRATION: "Offentlig forvaltning",
  SPACE: "Rummet",
  POSTAL_AND_COURIER: "Post og kurer",
  WASTE_MANAGEMENT: "Affald",
  CHEMICALS: "Kemikalier",
  FOOD: "Fødevarer",
  MANUFACTURING: "Fremstilling",
  DIGITAL_PROVIDERS: "Digitale udbydere",
  RESEARCH: "Forskning",
  NONE: "Ingen",
};
