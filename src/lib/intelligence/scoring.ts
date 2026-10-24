import type { Config } from "./config";
export interface Finding {
  id: string;
  url: string;
  excerpt: string;
  signal: string;
  keyword: string;
  fetchedAt?: string;
  contentHash?: string;
}
export interface ScoreCompany {
  employeeMin: number | null;
  employeeMax: number | null;
  employeeCount: number | null;
}
export function containsKeyword(text: string, keyword: string) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
    "iu",
  ).test(text);
}
// Conservative sentence-level guard. These are text signals, never a legal verdict.
export function isAffirmativeFinding(e: Finding) {
  const sentences = e.excerpt
    .split(/[.!?;\n]+/)
    .filter((s) => containsKeyword(s, e.keyword));
  return sentences.some(
    (s) =>
      !/\b(ikke|ingen|aldrig|uden|not|never|no)\b|hypotetisk|eksempelvis|for eksempel/iu.test(
        s,
      ),
  );
}
export function scoreCompany(
  company: ScoreCompany,
  evidence: Finding[],
  config: Config,
  coverage: "COMPLETE" | "PARTIAL",
) {
  const accepted = evidence.filter(isAffirmativeFinding);
  const group = (id: string) => accepted.filter((e) => e.signal === id);
  const breakdown: { label: string; points: number; evidenceIds: string[] }[] =
    [];
  const customers = group("customers"),
    services = group("services");
  const concrete = customers.filter((e) =>
    /(?:vi|we).{0,60}(?:leverer|leveret|hjælper|hjulpet|drifter|deliver|serve)|leverer til|leveret til|kunde hos|samarbejde med/i.test(
      e.excerpt,
    ),
  );
  for (const g of config.groups) {
    const found = group(g.id);
    if (!found.length || g.id === "direct") continue;
    let points = g.weight;
    if (g.id === "customers" && !concrete.length)
      points = Math.round(points / 3);
    if (g.id === "b2c") {
      if (customers.length || services.length) continue;
      points = -points;
    }
    breakdown.push({
      label: g.label,
      points,
      evidenceIds: found.slice(0, 3).map((e) => e.id),
    });
  }
  const min = company.employeeMin ?? company.employeeCount,
    max = company.employeeMax ?? company.employeeCount;
  const sizeKnown = min !== null && max !== null;
  if (sizeKnown && min >= config.minEmployees && max <= config.maxEmployees)
    breakdown.push({
      label: "Størrelse i målgruppen",
      points: config.sizeWeight,
      evidenceIds: [],
    });
  if (sizeKnown && min > config.maxEmployees)
    breakdown.push({
      label: "Stor virksomhed",
      points: -config.enterprisePenalty,
      evidenceIds: [],
    });
  if (sizeKnown && max < config.minEmployees && !concrete.length)
    breakdown.push({
      label: "Lille virksomhed uden konkrete kundesignaler",
      points: -config.smallPenalty,
      evidenceIds: [],
    });
  if (!services.length && !customers.length && coverage === "COMPLETE")
    breakdown.push({
      label: "Ingen relevante ydelses- eller kundesignaler",
      points: -config.noSignalsPenalty,
      evidenceIds: [],
    });
  const value = Math.max(
    0,
    Math.min(
      100,
      breakdown.reduce((n, x) => n + x.points, 0),
    ),
  );
  let priority =
    value >= config.priorityA
      ? "A"
      : value >= config.priorityB
        ? "B"
        : value >= config.priorityC
          ? "C"
          : "D";
  if (sizeKnown && min > config.maxEmployees && ["A", "B"].includes(priority))
    priority = "C";
  const direct = group("direct").length > 0;
  const uncertain = coverage === "PARTIAL" || !sizeKnown;
  const relevance = uncertain
    ? "REVIEW"
    : direct
      ? "DIRECT"
      : concrete.length && services.length
        ? "SUPPLY"
        : services.length || customers.length
          ? "REVIEW"
          : "LOW";
  const text = accepted.map((e) => e.excerpt).join(" ");
  const segment = config.segments
    .map((s) => ({
      name: s.name,
      count: s.keywords.filter((k) => containsKeyword(text, k)).length,
    }))
    .sort((a, b) => b.count - a.count)[0];
  const ranked = [...breakdown]
    .filter((x) => x.points > 0 && x.evidenceIds.length)
    .sort((a, b) => b.points - a.points);
  const topIds = [
    ...new Set(
      ranked
        .flatMap((x) => x.evidenceIds.slice(0, 1))
        .concat(ranked.flatMap((x) => x.evidenceIds)),
    ),
  ].slice(0, 3);
  const explanation =
    concrete.length && services.length
      ? "Offentlige beskrivelser af relevante ydelser og kunder peger på et muligt behov for dokumenteret leverandørsikkerhed."
      : services.length
        ? "Relevante tekniske ydelser er identificeret. Kundernes sektorer og konkrete krav bør afklares manuelt."
        : "Der er endnu ikke tilstrækkelige konkrete signaler om relevante leverancer.";
  const sizeFit =
    sizeKnown && min >= config.minEmployees && max <= config.maxEmployees;
  const segmentName = segment?.count ? segment.name : "Øvrige / uafklaret";
  const fit =
    !sizeKnown ||
    (coverage === "PARTIAL" && !services.length && !concrete.length)
      ? "UNKNOWN"
      : sizeFit && segment?.count && concrete.length && services.length
        ? "STRONG"
        : services.length || concrete.length
          ? "POSSIBLE"
          : "LOW";
  return {
    icp: {
      fit,
      segment: segmentName,
      size: !sizeKnown
        ? "Antal ansatte ukendt"
        : sizeFit
          ? "Størrelse matcher målgruppen"
          : "Størrelse uden for målgruppen",
      customers: concrete.length
        ? "Konkrete leverancer til relevante kunder fundet"
        : "Relevante kunder er endnu ikke dokumenteret",
      summary: explanation,
    },
    value,
    priority,
    segment: segmentName,
    relevance,
    directLevel: direct ? "MEDIUM" : coverage === "PARTIAL" ? "UNKNOWN" : "LOW",
    supplyLevel:
      concrete.length && services.length
        ? "HIGH"
        : customers.length
          ? "MEDIUM"
          : coverage === "PARTIAL"
            ? "UNKNOWN"
            : "LOW",
    coverage,
    explanation:
      explanation +
      (uncertain
        ? " Datagrundlaget er ufuldstændigt; prioriteten er foreløbig."
        : ""),
    angle: group("security").length
      ? "Afklar kundekrav og dokumentationshuller med afsæt i de sikkerhedsinitiativer, virksomheden allerede omtaler."
      : "Tilbyd gratis scope-afklaring af relevante kundekrav og et konkret første skridt mod dokumenteret leverandørsikkerhed.",
    breakdown,
    evidenceIds: topIds,
  };
}
