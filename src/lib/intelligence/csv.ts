import { parse } from "csv-parse/sync";
import { type Field, type Mapping } from "./csv-fields";
const aliases: Record<Field, string[]> = {
  cvr: ["cvr", "cvrnummer", "cvrnr"],
  name: ["navn", "virksomhedsnavn", "firma", "name", "companyname"],
  website: ["hjemmeside", "website", "web", "url"],
  city: ["by", "city", "postdistrikt"],
  industry: ["branche", "branchetekst", "branchebeskrivelse", "industry"],
  employees: ["ansatte", "antalansatte", "employees", "medarbejdere"],
  revenue: [
    "omsætning",
    "omsaetning",
    "nettoomsætning",
    "revenue",
    "omsætningdkk",
  ],
  country: ["land", "country"],
};
export function validCvr(value: string) {
  return (
    /^[1-9]\d{7}$/.test(value) &&
    [...value].reduce(
      (sum, n, i) => sum + Number(n) * [2, 7, 6, 5, 4, 3, 2, 1][i]!,
      0,
    ) %
      11 ===
      0
  );
}
export function parseEmployees(value: string): {
  min: number | null;
  max: number | null;
} {
  if (!value.trim()) return { min: null, max: null };
  const s = value.trim().replace(/\s/g, "").replace(/–/g, "-");
  const m = s.match(/^(\d+)(?:-(\d+))?$/);
  if (!m)
    throw new Error("Ansatte skal være et heltal eller et interval, fx 50-99");
  const min = Number(m[1]),
    max = Number(m[2] ?? m[1]);
  if (min > max || max > 1000000)
    throw new Error("Ugyldigt medarbejderinterval");
  return { min, max };
}
export function parseRevenue(value: string): number | null {
  if (!value.trim()) return null;
  const s = value.trim().replace(/\s|DKK|kr\.?/gi, "");
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s))
    throw new Error(
      "Omsætning skal angives i DKK, fx 12.500.000 eller 12500000,50",
    );
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n > 1e15) throw new Error("Ugyldig omsætning");
  return n;
}
export function websiteUrl(value: string): string | null {
  if (!value.trim()) return null;
  const u = new URL(
    /^https?:\/\//i.test(value.trim())
      ? value.trim()
      : `https://${value.trim()}`,
  );
  if (
    !["https:", "http:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    !u.hostname.includes(".") ||
    u.port
  )
    throw new Error("Ugyldig offentlig hjemmeside");
  u.hash = "";
  return u.toString();
}
export interface CsvCompany {
  cvr: string;
  name: string;
  website: string | null;
  addressCity: string | null;
  db07Description: string | null;
  employeeCount: number | null;
  employeeMin: number | null;
  employeeMax: number | null;
  importedRevenue: number | null;
  addressCountry: string;
}
export function readCsv(csv: string, mapping?: Mapping) {
  if (Buffer.byteLength(csv) > 2_000_000)
    throw new Error("CSV-filen må højst være 2 MB");
  let table: string[][] = [];
  for (const delimiter of [";", ",", "\t"]) {
    try {
      const candidate = parse(csv, {
        delimiter,
        bom: true,
        skip_empty_lines: true,
        trim: true,
        max_record_size: 20000,
      }) as string[][];
      if ((candidate[0]?.length ?? 0) > (table[0]?.length ?? 0))
        table = candidate;
    } catch {
      /* try next delimiter */
    }
  }
  if (table.length < 2 || table.length > 1001)
    throw new Error("CSV skal have en overskrift og 1–1.000 datarækker");
  const headers = table.shift()!;
  if (new Set(headers).size !== headers.length)
    throw new Error("Kolonneoverskrifter skal være unikke");
  const norm = (s: string) => s.toLowerCase().replace(/[^a-zæøå0-9]/g, "");
  const detected: Mapping = {};
  for (const [key, names] of Object.entries(aliases))
    detected[key as Field] = headers.find((h) => names.includes(norm(h)));
  const chosen = mapping ?? detected;
  if (!chosen.cvr || !chosen.name)
    return { headers, mapping: chosen, rows: [], needsMapping: true };
  for (const h of Object.values(chosen))
    if (h && !headers.includes(h))
      throw new Error("En valgt kolonne findes ikke i filen");
  const seen = new Set<string>();
  const rows = table.map((values, i) => {
    const raw = Object.fromEntries(headers.map((h, j) => [h, values[j] ?? ""]));
    const get = (f: Field) => raw[chosen[f] ?? ""] ?? "";
    try {
      const cvr = get("cvr")
        .replace(/^DK\s*/i, "")
        .replace(/\s/g, "");
      if (!validCvr(cvr))
        throw new Error("CVR skal være 8 cifre med gyldigt kontrolciffer");
      const name = get("name").trim();
      if (!name || name.length > 200)
        throw new Error("Virksomhedsnavn mangler eller er for langt");
      const country = get("country").trim().toUpperCase();
      if (country && !["DK", "DANMARK", "DENMARK"].includes(country))
        throw new Error("MVP’et importerer kun danske virksomheder");
      const em = parseEmployees(get("employees"));
      const company: CsvCompany = {
        cvr,
        name,
        website: websiteUrl(get("website")),
        addressCity: get("city").slice(0, 120) || null,
        db07Description: get("industry").slice(0, 200) || null,
        employeeCount: em.min === em.max ? em.min : null,
        employeeMin: em.min,
        employeeMax: em.max,
        importedRevenue: parseRevenue(get("revenue")),
        addressCountry: "DK",
      };
      const duplicate = seen.has(cvr);
      seen.add(cvr);
      return {
        rowNumber: i + 2,
        raw,
        company,
        outcome: duplicate ? "DUPLICATE" : "VALID",
        message: duplicate ? "Dublet i filen" : null,
      };
    } catch (e) {
      return {
        rowNumber: i + 2,
        raw,
        company: null,
        outcome: "INVALID",
        message: e instanceof Error ? e.message : "Ugyldig række",
      };
    }
  });
  return { headers, mapping: chosen, rows, needsMapping: false };
}
