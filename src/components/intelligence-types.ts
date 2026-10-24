import type { Config } from "@/lib/intelligence/config";
export interface Score {
  icp: {
    fit: string;
    segment: string;
    size: string;
    customers: string;
    summary: string;
  } | null;
  id: string;
  value: number;
  priority: string;
  segment: string;
  relevance: string;
  directLevel: string;
  supplyLevel: string;
  coverage: string;
  explanation: string;
  angle: string;
  evidenceIds: string[];
  configVersion: number;
  createdAt: string;
  breakdown: { label: string; points: number; evidenceIds: string[] }[];
  runId: string;
}
export interface Evidence {
  id: string;
  url: string;
  excerpt: string;
  signal: string;
  keyword: string;
  fetchedAt: string;
  runId: string;
}
export interface Run {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  mode: string;
  model: string | null;
  error: string | null;
  pages: { url: string; status: string; error?: string; characters?: number }[];
}
export interface Company {
  id: string;
  cvr: string;
  name: string;
  website: string | null;
  websiteHint: string | null;
  autoEnrichmentStep: string;
  autoEnrichmentError: string | null;
  autoEnrichmentQueuedAt: string | null;
  autoEnrichmentStartedAt: string | null;
  autoEnrichmentNote: string | null;
  autoEnrichmentScoreId: string | null;
  createdAt: string;
  autoEnrichmentNextAt: string;
  websiteDiscovery: {
    searchError?: string;
    search?: {
      candidates: { url: string; sourceUrl: string; reason: string }[];
      model: string;
      cached: boolean;
      inputTokens: number;
      outputTokens: number;
    };
    attempts: {
      url: string;
      status: string;
      checkedAt: string;
      evidenceUrl?: string;
      excerpt?: string;
    }[];
  } | null;
  financials: {
    id: string;
    year: number;
    currency: string | null;
    periodEnd: string | null;
    revenue: string | null;
    grossProfit: string | null;
    profitLoss: string | null;
    equity: string | null;
    reportUrl: string | null;
    publishedAt: string | null;
  }[];
  addressCity: string | null;
  db07Description: string | null;
  employeeCount: number | null;
  employeeMin: number | null;
  employeeMax: number | null;
  importedRevenue: string | null;
  importSource: string | null;
  termsNote: string | null;
  termsCheckedAt: string | null;
  scores: Score[];
  evidence: Evidence[];
  leadRuns: Run[];
  publicContacts: {
    id: string;
    kind: string;
    name: string | null;
    title: string | null;
    value: string;
    sourceUrl: string;
    fetchedAt: string;
  }[];
  drafts: { id: string; channel: string; body: string; createdAt: string }[];
  outreach: {
    status: string;
    notes: string | null;
    nextAction: string | null;
    nextFollowUpAt: string | null;
    history: { id: string; toStatus: string; createdAt: string }[];
  } | null;
}
export interface Workspace {
  companies: Company[];
  imports: {
    id: string;
    filename: string;
    source: string;
    createdAt: string;
    result: {
      added: number;
      duplicates: number;
      invalid: number;
      total: number;
    };
  }[];
  config: Config;
  version: number;
  analysisMode: "RULES";
  websiteSearch: {
    configured: boolean;
    model: string;
    maxRequestsPerDay: number;
    requestsToday: number;
    error: string | null;
    retryAt: string | null;
  };
  discovery: import("./intelligence-discovery").Discovery;
}
export const date = (s: string | null | undefined) =>
  s
    ? new Intl.DateTimeFormat("da-DK", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(s))
    : "Ikke analyseret";
export const employees = (c: Company) =>
  c.employeeCount !== null
    ? String(c.employeeCount)
    : c.employeeMin !== null
      ? `${c.employeeMin}–${c.employeeMax}`
      : "Ukendt";
export const money = (n: string | null) =>
  n === null
    ? "Ikke oplyst"
    : new Intl.NumberFormat("da-DK", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(Number(n)) + " kr.";
export type Perform = (body: Record<string, unknown>) => Promise<any>;
