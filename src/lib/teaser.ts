/**
 * Outreach teaser generation.
 *
 * Deliberately deterministic and template-based rather than another LLM call:
 * the only genuinely bespoke sentence is the audit hook, which the scoping run
 * already produced. Regenerating whole e-mails per lead costs money, drifts in
 * tone, and produces the kind of uncanny copy that gets a domain blocklisted.
 */

export interface TeaserInput {
  companyName: string;
  cvr: string;
  contactName: string | null;
  contactTitle: string | null;
  sectorLabel: string;
  annexLabel: string;
  statusLabel: string;
  employeeCount: number | null;
  balanceSheetDkk: number | null;
  revenueDkkK: number | null;
  financialYear: number | null;
  auditHook: string | null;
  senderName: string;
  senderCompany: string;
}

const dkkM = (n: number | null) => (n === null ? null : `${(n / 1_000_000).toFixed(0)} mio. kr.`);

function firstName(full: string | null): string {
  if (!full) return "";
  return full.trim().split(/\s+/)[0] ?? "";
}

export function buildTeaserSubject(input: TeaserInput): string {
  return `Kundekrav og cybersikkerhed hos ${input.companyName}`;
}

export function buildTeaserBody(input: TeaserInput): string {
  return [
    input.contactName ? `Hej ${firstName(input.contactName)},` : "Hej,",
    "",
    `Vi vil gerne undersøge, om kundekrav til cyber- og leverandørsikkerhed er relevante for ${input.companyName}.`,
    "Vi tilbyder en gratis scope-afklaring af, hvilke krav der realistisk rammer jer, og hvor I med fordel kan starte.",
    "",
    "Giver det mening at tage en kort samtale?",
    "",
    input.senderName,
    input.senderCompany,
  ].join("\n");
}

/** Subject + body in one call, for the API and the UI copy button. */
export function buildTeaser(input: TeaserInput): { subject: string; body: string } {
  return { subject: buildTeaserSubject(input), body: buildTeaserBody(input) };
}
