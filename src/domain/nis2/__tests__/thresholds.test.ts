/**
 * Plain-node assertions — `npx tsx src/domain/nis2/__tests__/thresholds.test.ts`.
 * Deliberately dependency-free: these are the rules an auditor will ask about,
 * and they must be runnable without the rest of the stack booting.
 */
import assert from "node:assert/strict";

import { classifySize } from "../thresholds";
import { decideScope } from "../scopeRules";
import { mapDb07 } from "../sectors";

const RATE = 7.4604;
const M = (n: number) => n * 1_000_000;

// --- Size classification ----------------------------------------------------

// 300 employees: large regardless of financials.
assert.equal(classifySize({ employees: 300, turnoverDkk: M(10), balanceDkk: M(5) }, RATE).sizeClass, "LARGE");

// Above both medium ceilings (>373m turnover AND >321m balance) -> large.
assert.equal(classifySize({ employees: 120, turnoverDkk: M(500), balanceDkk: M(400) }, RATE).sizeClass, "LARGE");

// Above the turnover ceiling but under the balance ceiling -> still medium,
// because the financial test is an OR. This is the case naive rules get wrong.
assert.equal(classifySize({ employees: 120, turnoverDkk: M(500), balanceDkk: M(100) }, RATE).sizeClass, "MEDIUM");

// 60 employees, small figures -> medium (headcount alone lifts it out of small).
assert.equal(classifySize({ employees: 60, turnoverDkk: M(20), balanceDkk: M(15) }, RATE).sizeClass, "MEDIUM");

// 20 employees but well over both small ceilings -> medium, not small.
// A lean trading or holding company is in scope; headcount-only screening misses it.
assert.equal(classifySize({ employees: 20, turnoverDkk: M(300), balanceDkk: M(300) }, RATE).sizeClass, "MEDIUM");

// Genuinely small.
const small = classifySize({ employees: 30, turnoverDkk: M(40), balanceDkk: M(20) }, RATE);
assert.equal(small.sizeClass, "SMALL");
assert.equal(small.meetsNis2SizeCap, false);

// Missing financials, headcount below 50 -> undecidable, flagged rather than dropped.
const unknown = classifySize({ employees: 30, turnoverDkk: null, balanceDkk: null }, RATE);
assert.equal(unknown.sizeClass, "UNKNOWN");
assert.equal(unknown.uncertain, true);

// Missing financials but 80 employees -> decidable.
assert.equal(classifySize({ employees: 80, turnoverDkk: null, balanceDkk: null }, RATE).sizeClass, "MEDIUM");

// --- Scope decisions --------------------------------------------------------

const essential = decideScope({
  sector: "ENERGY",
  subSector: "Electricity",
  sizeClass: "LARGE",
  meetsSizeCap: true,
  sizeUncertain: false,
  operatesInSector: true,
  isSupplyChainDependency: false,
});
assert.equal(essential.status, "ESSENTIAL");
assert.equal(essential.annexType, "ANNEX_1");

// Annex I, medium -> important, not essential.
assert.equal(
  decideScope({
    sector: "HEALTH",
    subSector: "Healthcare providers",
    sizeClass: "MEDIUM",
    meetsSizeCap: true,
    sizeUncertain: false,
    operatesInSector: true,
    isSupplyChainDependency: false,
  }).status,
  "IMPORTANT",
);

// Annex II, large -> important (Annex II never yields ESSENTIAL on size alone).
assert.equal(
  decideScope({
    sector: "MANUFACTURING",
    subSector: "Manufacture of electrical equipment",
    sizeClass: "LARGE",
    meetsSizeCap: true,
    sizeUncertain: false,
    operatesInSector: true,
    isSupplyChainDependency: false,
  }).status,
  "IMPORTANT",
);

// Five-person DNS provider -> essential regardless of size.
const dns = decideScope({
  sector: "DIGITAL_INFRASTRUCTURE",
  subSector: "DNS service providers",
  sizeClass: "MICRO",
  meetsSizeCap: false,
  sizeUncertain: false,
  operatesInSector: true,
  isSupplyChainDependency: false,
});
assert.equal(dns.status, "ESSENTIAL");
assert.equal(dns.sizeExempt, true);

// Sub-threshold MSP that serves in-scope customers -> commercial target.
assert.equal(
  decideScope({
    sector: "ICT_SERVICE_MANAGEMENT",
    subSector: "Managed service providers",
    sizeClass: "SMALL",
    meetsSizeCap: false,
    sizeUncertain: false,
    operatesInSector: true,
    isSupplyChainDependency: true,
  }).status,
  "SUPPLY_CHAIN_TARGET",
);

// Right code, wrong business -> out of scope.
assert.equal(
  decideScope({
    sector: "ICT_SERVICE_MANAGEMENT",
    subSector: "Managed service providers",
    sizeClass: "LARGE",
    meetsSizeCap: true,
    sizeUncertain: false,
    operatesInSector: false,
    isSupplyChainDependency: false,
  }).status,
  "OUT_OF_SCOPE",
);

// --- DB07 mapping -----------------------------------------------------------

assert.equal(mapDb07("620300")?.sector, "ICT_SERVICE_MANAGEMENT");
assert.equal(mapDb07("62.03")?.sector, "ICT_SERVICE_MANAGEMENT");
assert.equal(mapDb07("351300")?.sector, "ENERGY");
assert.equal(mapDb07("360000")?.sector, "DRINKING_WATER");
assert.equal(mapDb07("325000")?.sector, "MANUFACTURING"); // longest prefix beats "32"
assert.equal(mapDb07("561010"), null); // restaurant: no NIS2 sector

console.log("thresholds + scope rules: all assertions passed");
