const freeMail = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.dk",
  "live.dk",
  "live.com",
  "yahoo.com",
  "yahoo.dk",
  "icloud.com",
  "mail.dk",
  "email.dk",
  "ofir.dk",
  "webspeed.dk",
  "jubii.dk",
]);
export function emailDomain(email: unknown) {
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+$/.test(email))
    return null;
  const domain = email.split("@")[1]!.toLowerCase();
  return /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain) &&
    !freeMail.has(domain)
    ? domain
    : null;
}
export function websiteCandidates(_name: string, hint: string | null) {
  return hint && emailDomain(`x@${hint}`) ? [`https://${hint}/`] : [];
}
export function visibleCvrs(text: string) {
  // Require the CVR label: an eight-digit phone number is never company identity.
  return [
    ...new Set(
      [
        ...text.matchAll(
          /\bcvr\s*(?:[-.]?\s*(?:nr|nummer))?\s*[.:#-]?\s*(?:DK\s*)?((?:\d[ -]?){7}\d)(?!\d)/gi,
        ),
      ].map((m) => m[1]!.replace(/\D/g, "")),
    ),
  ];
}
export function verifiedWebsite(
  cvr: string,
  pages: { url: string; cvrs?: string[] }[],
) {
  const ids = [...new Set(pages.flatMap((p) => p.cvrs ?? []))];
  return ids.length === 1 && ids[0] === cvr
    ? pages.find((p) => p.cvrs?.includes(cvr))
    : undefined;
}
