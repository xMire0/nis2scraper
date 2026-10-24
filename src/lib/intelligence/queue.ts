export const enrichmentSteps: Record<string, string> = {
  PROFILE: "Hent CVR og ledelsesroller",
  WEBSITE: "Find og kontrollér hjemmeside",
  ANALYZE: "Find kontakter og vurder ICP",
  OUTREACH: "Tilpas salgsmateriale",
  FINANCIAL: "Hent regnskab",
  FINANCIAL_REVIEW: "Hent regnskab · hjemmeside uafklaret",
  DONE: "Færdig",
  NEEDS_REVIEW: "Kræver vurdering",
  SKIPPED: "Fravalgt af registerkontrol",
};
export const pendingSteps = [
  "PROFILE",
  "WEBSITE",
  "ANALYZE",
  "OUTREACH",
  "FINANCIAL",
  "FINANCIAL_REVIEW",
];
export function crawlExplanation(message: string) {
  if (/HTTP 403/.test(message))
    return "Hjemmesiden afviser automatisk adgang (HTTP 403). Det er ikke en OpenAI-fejl. Vi stopper hentningen; hjemmesidebaseret ICP og salgsmateriale kan ikke færdiggøres uden kildebeviser.";
  if (/HTTP 401|CAPTCHA/.test(message))
    return "Hjemmesiden kræver adgang eller en menneskelig kontrol. Automatisk hentning er stoppet.";
  return message;
}
export function queueStatus(
  c: {
    autoEnrichmentStep: string;
    autoEnrichmentStartedAt: string | null;
    autoEnrichmentNextAt: string;
    autoEnrichmentQueuedAt: string | null;
    autoEnrichmentError: string | null;
  },
  automatic: boolean,
  now = Date.now(),
) {
  if (
    c.autoEnrichmentStartedAt &&
    now - Date.parse(c.autoEnrichmentStartedAt) < 15 * 60000
  )
    return "Kører nu";
  if (!pendingSteps.includes(c.autoEnrichmentStep))
    return enrichmentSteps[c.autoEnrichmentStep] ?? c.autoEnrichmentStep;
  if (c.autoEnrichmentError) return "Afventer · se årsag";
  if (!automatic && !c.autoEnrichmentQueuedAt) return "Automatik pauset";
  if (Date.parse(c.autoEnrichmentNextAt) > now) return "Planlagt genforsøg";
  return c.autoEnrichmentQueuedAt
    ? "I kø · bestilt manuelt"
    : "I automatisk kø";
}
