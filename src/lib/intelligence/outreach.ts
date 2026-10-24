export function makeOutreach(
  channel: string,
  company: { name: string },
  score: { segment: string; angle: string } | null,
  sender: { senderName: string; senderCompany: string },
  evidence?: { excerpt: string; url: string },
) {
  const intro = evidence
    ? `På jeres hjemmeside beskriver I: “${evidence.excerpt.slice(0, 180)}${evidence.excerpt.length > 180 ? "…" : ""}”`
    : `Jeg kontakter jer for at undersøge, om kundekrav til cyber- og leverandørsikkerhed er relevante for ${company.name}.`;
  const offer =
    "Vi tilbyder en gratis scope-afklaring af, hvilke krav der realistisk rammer jer, og hvor I bør starte, så sikkerhed understøtter jeres kundeaftaler og omsætning.";
  const signature = `${sender.senderName}\n${sender.senderCompany}`;
  const context =
    score && score.segment !== "Øvrige / uafklaret"
      ? `Vi vil gerne drøfte, hvilke krav jeres kunder stiller til jer som leverandør inden for ${score.segment}.`
      : "Vi vil gerne afklare jeres faktiske kundekrav, før vi anbefaler konkrete tiltag.";
  if (channel === "PHONE")
    return `Åbning\nHej, det er ${sender.senderName} fra ${sender.senderCompany}. Hvem hos ${company.name} arbejder med kundernes sikkerhedskrav?\n\nBaggrund\n${intro}\n\nSpørgsmål\nMøder I krav om sikkerhedsdokumentation, beredskab eller styring af leverandøradgange? Hvor er det sværest at svare kunderne i dag?\n\nInvitation\n${offer} Vil en kort samtale give mening?\n\nHvis behovet er afklaret\nVi kan bagefter vurdere, om en betalt gap-analyse er relevant. Det afhænger af jeres behov.`;
  if (channel === "LINKEDIN")
    return `Hej ${company.name}, jeg arbejder med kundekrav til cybersikkerhed hos ${sender.senderCompany}. ${context} Kunne en gratis scope-afklaring være relevant?\n\n${signature}`;
  if (channel === "WEBINAR")
    return `Emne: Kundekrav til cybersikkerhed i ${score?.segment ?? "jeres branche"}\n\nHej ${company.name},\n\nVi inviterer til et webinar for ${score?.segment ?? "danske leverandører"} om sikkerhedsdokumentation, kundeforespørgsler og praktisk prioritering.\n\n${score?.angle ?? "Vi gennemgår, hvordan I kan afklare relevante kundekrav."}\n\nDato: [indsæt dato og tidspunkt]\nTilmelding: [indsæt link]\n\n${offer}\n\n${signature}`;
  return `Emne: Kundekrav og cybersikkerhed hos ${company.name}\n\nHej,\n\n${intro}\n\n${context} ${offer}\n\nGiver det mening at tage en kort samtale?\n\nBedste hilsner\n${signature}`;
}
