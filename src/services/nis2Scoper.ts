import { classifySize, type SizeResult } from "@/domain/nis2/thresholds";
import type { Nis2SectorKey } from "@/domain/nis2/sectors";
import type { Nis2StatusKey, ScopeDecision } from "@/domain/nis2/scopeRules";
export interface ScopingInput {
  cvr: string;
  name: string;
  db07Code: string | null;
  db07Description: string | null;
  employeeCount: number | null;
  turnoverDkk: number | null;
  balanceDkk: number | null;
  financialYear: number | null;
  /** Ledelsesberetning from the annual report — the highest-signal free text. */
  managementReview: string | null;
  /** Optional extras: website copy, company purpose (formål) from CVR. */
  companyPurpose?: string | null;
  websiteSummary?: string | null;
}

export interface ScopingResult {
  cvr: string;
  status: Nis2StatusKey;
  sector: Nis2SectorKey;
  subSector: string | null;
  annexType: ScopeDecision["annexType"];
  sizeExempt: boolean;
  // Stage 1
  size: SizeResult;
  deterministicMatch: boolean;
  employeeCountUsed: number | null;
  revenueDkkUsed: number | null;
  balanceDkkUsed: number | null;
  financialYearUsed: number | null;
  // Stage 2
  llmReasoning: string | null;
  llmConfidence: number | null;
  llmModel: string | null;
  llmSectorEvidence: string[];
  supplyChainSignals: string[];
  conflict: boolean;
  conflictNote: string | null;
  auditHook: string | null;
  rulesetVersion: string;
  scopedAt: Date;
}

export const RULESET_VERSION = "retired-use-intelligence";
// Historical pipeline contract retained for stored records; execution is retired.
export async function scopeCompany(
  _input: ScopingInput,
): Promise<ScopingResult> {
  throw new Error(
    "Den gamle pipeline er lukket. Brug dashboardets lokale regelmotor.",
  );
}
export async function scopeCompanies(
  _inputs: ScopingInput[],
  _onResult?: (r: ScopingResult) => Promise<void> | void,
): Promise<{
  results: ScopingResult[];
  errors: Array<{ cvr: string; error: string }>;
}> {
  throw new Error(
    "Den gamle pipeline er lukket. Brug dashboardets lokale regelmotor.",
  );
}
