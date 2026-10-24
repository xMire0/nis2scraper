import * as cheerio from "cheerio";
export interface WebsiteContact {
  value: string;
  kind: string;
  sourceUrl: string;
  name: string | null;
  title: string | null;
}
export function phoneNumber(raw: string) {
  const n = raw.replace(/[\s().-]/g, "").replace(/^0045/, "+45");
  return /^(?:\+45)?[2-9]\d{7}$/.test(n) ? `+45${n.slice(-8)}` : null;
}
export function labelledPhones(text: string) {
  return [
    ...new Set(
      [
        ...text.matchAll(
          /\b(?:tlf\.?|telefon|phone|mobil)\s*:?\s*((?:(?:\+45|0045)[ .-]*)?[2-9](?:[ .-]*\d){7})(?![ .-]*\d)/gi,
        ),
      ].flatMap((m) => {
        const value = phoneNumber(m[1]!);
        return value ? [value] : [];
      }),
    ),
  ];
}
export function companyEmail(value: string, host: string, inFooter = false) {
  const email = value.trim().toLowerCase();
  if (
    !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) ||
    /^(jobs?|career|karriere|noreply|no-reply|bogholder|accounting)([._+-]|@)/.test(
      email,
    )
  )
    return false;
  const [local, domain] = email.split("@");
  const shared =
    /^(info|kontakt|contact|salg|sales|support|office|hello|post|reception)$/.test(
      local!,
    );
  return (
    shared &&
    (domain === host ||
      (!inFooter &&
        [
          "gmail.com",
          "outlook.com",
          "hotmail.com",
          "hotmail.dk",
          "live.dk",
          "yahoo.com",
          "icloud.com",
        ].includes(domain!)))
  );
}
export function staffContacts(html: string, url: string): WebsiteContact[] {
  const $ = cheerio.load(html);
  $(
    'script,style,noscript,footer,nav,header,[hidden],[aria-hidden="true"],[style*="display:none"],[style*="display: none"],[style*="visibility:hidden"],[style*="visibility: hidden"]',
  ).remove();
  $("p,div,li,h1,h2,h3,h4,section,article,br").append("\n");
  const host = new URL(url).hostname.replace(/^www\./, "");
  const contacts: WebsiteContact[] = [];
  $(
    'article,li,.team-member,.person,.employee,.staff-member,[itemtype="https://schema.org/Person"]',
  ).each((_i, block) => {
    const item = $(block);
    if (item.text().length > 1200) return;
    const names = [
      ...new Set(
        item
          .find('h2,h3,h4,[itemprop="name"]')
          .toArray()
          .map((el) => $(el).text().trim())
          .filter((t) =>
            /^[\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){1,4}$/u.test(t),
          ),
      ),
    ];
    if (names.length !== 1) return;
    const title = item
      .text()
      .match(
        /\b(?:administrerende direktør|direktør|CEO|CTO|CFO|CISO|IT-chef|IT-direktør|sikkerhedschef|informationssikkerhedschef|Head of IT|Managing Director|advokat|statsautoriseret revisor)\b/i,
      )?.[0];
    if (!title) return;
    for (const value of labelledPhones(item.text()))
      contacts.push({
        value,
        kind: "PHONE",
        sourceUrl: url,
        name: names[0]!,
        title,
      });
    item.find('a[href^="mailto:"],a[href^="tel:"]').each((_j, el) => {
      if (!$(el).text().trim()) return;
      const href = $(el).attr("href")!;
      const kind = href.startsWith("mailto:") ? "EMAIL" : "PHONE";
      const raw = href
        .slice(kind === "EMAIL" ? 7 : 4)
        .split("?")[0]!
        .trim()
        .toLowerCase();
      const value =
        kind === "PHONE"
          ? phoneNumber(raw)
          : /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(raw) &&
              raw.endsWith(`@${host}`) &&
              !/^(jobs?|career|karriere|noreply|no-reply|bogholder|info|kontakt|support|salg|sales)@/.test(
                raw,
              )
            ? raw
            : null;
      if (value)
        contacts.push({ value, kind, sourceUrl: url, name: names[0]!, title });
    });
  });
  return contacts;
}
export function deduplicateContacts(contacts: WebsiteContact[]) {
  const grouped = new Map<string, WebsiteContact[]>();
  for (const c of contacts) {
    const value =
      c.kind === "PHONE" ? phoneNumber(c.value) : c.value.toLowerCase();
    if (value)
      grouped.set(value, [...(grouped.get(value) ?? []), { ...c, value }]);
  }
  return [...grouped.values()].map((items) => {
    const names = new Set(items.map((c) => c.name).filter(Boolean));
    // Shared/ambiguous values stay company contacts, never a person's direct line.
    return names.size !== 1 || items.some((c) => !c.name)
      ? { ...items[0]!, name: null, title: null }
      : items[0]!;
  });
}
