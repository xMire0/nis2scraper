import {
  SIZE_EXEMPT_ESSENTIAL,
  SIZE_EXEMPT_SUBSECTORS,
  annexOf,
  type AnnexKey,
  type Nis2SectorKey,
} from "./sectors";
import type { RuleTrace, SizeClassKey } from "./thresholds";

export type Nis2StatusKey =
  | "ESSENTIAL"
  | "IMPORTANT"
  | "SUPPLY_CHAIN_TARGET"
  | "OUT_OF_SCOPE"
  | "NEEDS_REVIEW";

export interface ScopeDecisionInput {
  sector: Nis2SectorKey;
  subSector: string | null;
  sizeClass: SizeClassKey;
  meetsSizeCap: boolean;
  sizeUncertain: boolean;
  /** LLM verdict: does the company actually operate in the claimed sector? */
  operatesInSector: boolean;
  /** LLM verdict: supplies ICT/OT services to in-scope entities. */
  isSupplyChainDependency: boolean;
}

export interface ScopeDecision {
  status: Nis2StatusKey;
  annexType: AnnexKey;
  sizeExempt: boolean;
  rationale: string;
  rules: RuleTrace[];
}

/**
 * Article 3 in code.
 *
 *   art. 3(1)(a)  Annex I entity exceeding the medium ceilings        -> ESSENTIAL
 *   art. 3(1)(e)  qualified trust services, TLD registries, DNS       -> ESSENTIAL regardless of size
 *   art. 3(1)(f)  public electronic comms, medium-sized               -> ESSENTIAL
 *   art. 3(1)(g)  central government                                  -> ESSENTIAL
 *   art. 3(2)     everything else caught by art. 2                    -> IMPORTANT
 *
 * Anything below the size cap that supplies in-scope entities is not regulated
 * itself but is contractually squeezed through art. 21(2)(d) supply-chain
 * requirements — commercially the best segment there is, so it gets its own
 * status rather than being dropped.
 */
export function decideScope(input: ScopeDecisionInput): ScopeDecision {
  const rules: RuleTrace[] = [];
  const annex = annexOf(input.sector);

  if (input.sector === "NONE" || !input.operatesInSector) {
    rules.push({
      rule: "sector_membership",
      passed: false,
      detail: "No operational activity in any of the 18 NIS2 sectors",
    });
    if (input.isSupplyChainDependency) {
      return {
        status: "SUPPLY_CHAIN_TARGET",
        annexType: "NONE",
        sizeExempt: false,
        rationale:
          "Ikke direkte omfattet, men leverer ICT-/OT-ydelser til omfattede enheder og mødes derfor af leverandørkrav efter art. 21, stk. 2, litra d.",
        rules,
      };
    }
    return {
      status: "OUT_OF_SCOPE",
      annexType: "NONE",
      sizeExempt: false,
      rationale: "Hverken sektorbunden aktivitet eller leverandørafhængighed identificeret.",
      rules,
    };
  }

  rules.push({
    rule: "sector_membership",
    passed: true,
    detail: `${input.sector}${input.subSector ? ` / ${input.subSector}` : ""} (${annex})`,
  });

  const sizeExempt = input.subSector !== null && SIZE_EXEMPT_SUBSECTORS.has(input.subSector);
  rules.push({
    rule: "size_exempt_activity",
    passed: sizeExempt,
    detail: sizeExempt
      ? `Omfattet uanset størrelse (art. 2, stk. 2): ${input.subSector}`
      : "Almindelig størrelsestærskel gælder",
  });

  if (sizeExempt) {
    const essential =
      input.subSector !== null &&
      (SIZE_EXEMPT_ESSENTIAL.has(input.subSector) ||
        // Public electronic comms are essential once medium-sized, important below.
        (input.subSector.startsWith("Providers of public") && input.meetsSizeCap));
    return {
      status: essential ? "ESSENTIAL" : "IMPORTANT",
      annexType: annex,
      sizeExempt: true,
      rationale: essential
        ? `Særlig kritisk enhed (bilag 1) uanset størrelse: ${input.subSector}.`
        : `Vigtig enhed uanset størrelse: ${input.subSector}.`,
      rules,
    };
  }

  if (input.sizeUncertain) {
    rules.push({
      rule: "size_cap",
      passed: false,
      detail: "Størrelse kunne ikke afgøres — mangler regnskabstal eller ansatte",
    });
    return {
      status: "NEEDS_REVIEW",
      annexType: annex,
      sizeExempt: false,
      rationale:
        "Sektortilhør bekræftet, men størrelsesberegningen mangler tal. Hent seneste årsrapport eller bekræft antal ansatte manuelt.",
      rules,
    };
  }

  rules.push({
    rule: "size_cap",
    passed: input.meetsSizeCap,
    detail: `Størrelsesklasse: ${input.sizeClass}`,
  });

  if (!input.meetsSizeCap) {
    if (input.isSupplyChainDependency) {
      return {
        status: "SUPPLY_CHAIN_TARGET",
        annexType: annex,
        sizeExempt: false,
        rationale:
          "Under størrelsestærsklen og derfor ikke selv omfattet, men leverer til omfattede enheder og rammes af deres leverandørkrav.",
        rules,
      };
    }
    return {
      status: "OUT_OF_SCOPE",
      annexType: annex,
      sizeExempt: false,
      rationale: `Sektoren er omfattet, men virksomheden er ${input.sizeClass.toLowerCase()} og ligger under tærsklen for mellemstore virksomheder.`,
      rules,
    };
  }

  if (annex === "ANNEX_1") {
    const essential = input.sizeClass === "LARGE";
    return {
      status: essential ? "ESSENTIAL" : "IMPORTANT",
      annexType: "ANNEX_1",
      sizeExempt: false,
      rationale: essential
        ? "Bilag 1-sektor og over loftet for mellemstore virksomheder — særlig kritisk enhed med tilsyn på forhånd."
        : "Bilag 1-sektor som mellemstor virksomhed — vigtig enhed med tilsyn efterfølgende.",
      rules,
    };
  }

  return {
    status: "IMPORTANT",
    annexType: "ANNEX_2",
    sizeExempt: false,
    rationale: "Bilag 2-sektor på eller over tærsklen for mellemstore virksomheder — vigtig enhed.",
    rules,
  };
}
