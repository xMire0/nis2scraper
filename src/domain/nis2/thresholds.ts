/**
 * Size classification per Commission Recommendation 2003/361/EC, Annex art. 2 —
 * the gate that NIS2 art. 2(1) and art. 3 hang on.
 *
 *   micro  : < 10  staff AND (turnover <= EUR 2m  OR balance <= EUR 2m)
 *   small  : < 50  staff AND (turnover <= EUR 10m OR balance <= EUR 10m)
 *   medium : < 250 staff AND (turnover <= EUR 50m OR balance <= EUR 43m)
 *   large  : everything above the medium ceilings
 *
 * Two things people get wrong, and both change the verdict:
 *
 *  1. The financial test is an OR, not an AND. A 20-person trading house with
 *     DKK 300m turnover and DKK 300m balance is NOT small — it fails both
 *     financial ceilings — so it is a medium-sized enterprise and in scope.
 *     "Employees >= 50 AND turnover > threshold" under-collects badly.
 *  2. The medium ceiling uses two different figures: EUR 50m turnover but
 *     EUR 43m balance sheet. Using 50/50 mislabels Essential entities as
 *     Important, which is the difference between supervision ex ante and
 *     ex post, and between 10m EUR / 2% and 7m EUR / 1.4% fine caps.
 */

export interface EurCeilings {
  headcount: number;
  turnoverEur: number;
  balanceEur: number;
}

export const CEILINGS: Record<"micro" | "small" | "medium", EurCeilings> = {
  micro: { headcount: 10, turnoverEur: 2_000_000, balanceEur: 2_000_000 },
  small: { headcount: 50, turnoverEur: 10_000_000, balanceEur: 10_000_000 },
  medium: { headcount: 250, turnoverEur: 50_000_000, balanceEur: 43_000_000 },
};

export type SizeClassKey = "MICRO" | "SMALL" | "MEDIUM" | "LARGE" | "UNKNOWN";

export interface DkkCeilings {
  headcount: number;
  turnoverDkk: number;
  balanceDkk: number;
}

/** EUR ceilings expressed in DKK at the configured rate (default: ERM II central rate). */
export function ceilingsInDkk(rate: number): Record<"micro" | "small" | "medium", DkkCeilings> {
  const conv = (c: EurCeilings): DkkCeilings => ({
    headcount: c.headcount,
    turnoverDkk: Math.round(c.turnoverEur * rate),
    balanceDkk: Math.round(c.balanceEur * rate),
  });
  return { micro: conv(CEILINGS.micro), small: conv(CEILINGS.small), medium: conv(CEILINGS.medium) };
}

export interface SizeInput {
  employees: number | null;
  /** Turnover in DKK. Fall back to gross profit only as a lower bound. */
  turnoverDkk: number | null;
  balanceDkk: number | null;
}

export interface RuleTrace {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface SizeResult {
  sizeClass: SizeClassKey;
  /** True when the entity meets or exceeds the medium-sized threshold. */
  meetsNis2SizeCap: boolean;
  rules: RuleTrace[];
  /** Set when a missing figure could flip the verdict. */
  uncertain: boolean;
  uncertaintyReason?: string;
}

/**
 * Within a class you must satisfy the headcount ceiling AND at least one
 * financial ceiling. Missing financials are treated as "not known to be under
 * the ceiling" only when headcount alone cannot decide — see `uncertain`.
 */
export function classifySize(input: SizeInput, eurDkkRate: number): SizeResult {
  const c = ceilingsInDkk(eurDkkRate);
  const rules: RuleTrace[] = [];
  const { employees, turnoverDkk, balanceDkk } = input;

  const fmt = (n: number | null) => (n === null ? "ukendt" : `${(n / 1_000_000).toFixed(1)}m DKK`);

  if (employees === null && turnoverDkk === null && balanceDkk === null) {
    return {
      sizeClass: "UNKNOWN",
      meetsNis2SizeCap: false,
      rules: [{ rule: "data_available", passed: false, detail: "No headcount and no financial figures" }],
      uncertain: true,
      uncertaintyReason: "No size data at all — company cannot be screened.",
    };
  }

  const underFinancialCeiling = (turnCeil: number, balCeil: number): boolean | null => {
    const t = turnoverDkk !== null ? turnoverDkk <= turnCeil : null;
    const b = balanceDkk !== null ? balanceDkk <= balCeil : null;
    if (t === true || b === true) return true; // one is enough
    if (t === false && b === false) return false;
    return null; // undetermined — at least one figure missing
  };

  // ---- Large? (fails the medium ceiling) ----
  const headcountOverMedium = employees !== null && employees >= c.medium.headcount;
  const underMediumFinancials = underFinancialCeiling(c.medium.turnoverDkk, c.medium.balanceDkk);

  rules.push({
    rule: "headcount_lt_250",
    passed: employees !== null ? employees < c.medium.headcount : false,
    detail: `Ansatte: ${employees ?? "ukendt"} (loft 250)`,
  });
  rules.push({
    rule: "medium_financial_ceiling",
    passed: underMediumFinancials === true,
    detail: `Omsætning ${fmt(turnoverDkk)} <= ${fmt(c.medium.turnoverDkk)} ELLER balance ${fmt(balanceDkk)} <= ${fmt(c.medium.balanceDkk)}`,
  });

  if (headcountOverMedium || underMediumFinancials === false) {
    return {
      sizeClass: "LARGE",
      meetsNis2SizeCap: true,
      rules,
      uncertain: false,
    };
  }

  // ---- Small or below? ----
  const headcountUnderSmall = employees !== null ? employees < c.small.headcount : null;
  const underSmallFinancials = underFinancialCeiling(c.small.turnoverDkk, c.small.balanceDkk);

  rules.push({
    rule: "headcount_lt_50",
    passed: headcountUnderSmall === true,
    detail: `Ansatte: ${employees ?? "ukendt"} (loft 50)`,
  });
  rules.push({
    rule: "small_financial_ceiling",
    passed: underSmallFinancials === true,
    detail: `Omsætning ${fmt(turnoverDkk)} <= ${fmt(c.small.turnoverDkk)} ELLER balance ${fmt(balanceDkk)} <= ${fmt(c.small.balanceDkk)}`,
  });

  const isSmallOrBelow = headcountUnderSmall === true && underSmallFinancials === true;

  if (isSmallOrBelow) {
    const headcountUnderMicro = employees !== null && employees < c.micro.headcount;
    const underMicroFinancials = underFinancialCeiling(c.micro.turnoverDkk, c.micro.balanceDkk) === true;
    return {
      sizeClass: headcountUnderMicro && underMicroFinancials ? "MICRO" : "SMALL",
      meetsNis2SizeCap: false,
      rules,
      uncertain: false,
    };
  }

  // Undetermined small test with missing financials — headcount >= 50 still
  // settles it (a >=50-person company is never small).
  if (headcountUnderSmall === false) {
    return { sizeClass: "MEDIUM", meetsNis2SizeCap: true, rules, uncertain: false };
  }

  if (underSmallFinancials === null || headcountUnderSmall === null) {
    return {
      sizeClass: "UNKNOWN",
      meetsNis2SizeCap: false,
      rules,
      uncertain: true,
      uncertaintyReason:
        "Missing headcount or turnover/balance — cannot separate small from medium. Fetch the annual report or verify headcount before discarding.",
    };
  }

  return { sizeClass: "MEDIUM", meetsNis2SizeCap: true, rules, uncertain: false };
}

/** Human-readable ceiling summary for the UI, in DKK. */
export function describeCeilings(rate: number): string {
  const c = ceilingsInDkk(rate);
  const m = (n: number) => `${(n / 1_000_000).toFixed(1)} mio. DKK`;
  return [
    `Mellemstor: < 250 ansatte og (omsætning <= ${m(c.medium.turnoverDkk)} eller balance <= ${m(c.medium.balanceDkk)})`,
    `Lille: < 50 ansatte og (omsætning <= ${m(c.small.turnoverDkk)} eller balance <= ${m(c.small.balanceDkk)})`,
    `Kurs: 1 EUR = ${rate} DKK`,
  ].join(" · ");
}
