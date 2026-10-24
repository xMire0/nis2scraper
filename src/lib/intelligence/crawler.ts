import http from "node:http";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { createHash, randomUUID } from "node:crypto";
import ipaddr from "ipaddr.js";
import robotsParser from "robots-parser";
import * as cheerio from "cheerio";
import type { Config } from "./config";
import { containsKeyword, type Finding } from "./scoring";
import { visibleCvrs } from "./website";
import {
  staffContacts,
  labelledPhones,
  companyEmail,
  deduplicateContacts,
  type WebsiteContact,
} from "./contacts";
const AGENT = "NIS2LeadResearchBot";
const relevant =
  /om-os|about|reference|referenc|case|kunder|customer|sikkerhed|security|compliance|certific|karriere|career|jobs|kontakt|contact|ydelser|services|medarbejder|team|people|staff/i;
const excluded =
  /login|log-in|sign-in|auth|checkout|cart|kurv|search|søg|calendar|wp-admin/i;
export function publicIp(address: string) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export function allowedUrl(raw: string, hostname: string) {
  const url = new URL(raw);
  const base = (h: string) => h.replace(/^www\./, "").toLowerCase();
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.port ||
    base(url.hostname) !== base(hostname) ||
    excluded.test(url.pathname)
  )
    throw new Error("URL er uden for det tilladte offentlige domæne");
  return url;
}
export async function requestPublic(url: URL): Promise<{
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}> {
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !publicIp(a.address)))
    throw new Error("Privat eller reserveret netværksadresse er blokeret");
  const addr = addresses.find((a) => a.family === 4) ?? addresses[0]!;
  return new Promise((resolve, reject) => {
    const req = (url.protocol === "https:" ? https : http).request(
      url,
      {
        method: "GET",
        family: addr.family,
        lookup: (_host, _options, callback) =>
          callback(null, addr.address, addr.family),
        headers: {
          "User-Agent": `${AGENT}/1.0 (public website research)`,
          Accept: "text/html,text/plain;q=0.9",
          "Accept-Encoding": "identity",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        res.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 2_000_000) {
            res.destroy(new Error("Siden overstiger 2 MB"));
            req.destroy();
          } else chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    const timeout = setTimeout(
      () => req.destroy(new Error("Hjemmesiden svarede ikke inden 8 sekunder")),
      8000,
    );
    req.on("error", reject);
    req.on("close", () => clearTimeout(timeout));
    req.end();
  });
}
export function extractPage(html: string, url: string) {
  const $ = cheerio.load(html);
  $(
    'script,style,noscript,svg,template,iframe,form,[hidden],[aria-hidden="true"],[style*="display:none"],[style*="display: none"],[style*="visibility:hidden"],[style*="visibility: hidden"]',
  ).remove();
  const contacts: WebsiteContact[] = [];
  if (
    /kontakt|contact/.test(new URL(url).pathname) ||
    new URL(url).pathname === "/"
  ) {
    $('a[href^="mailto:"]').each((_i, el) => {
      const email = $(el)
        .attr("href")!
        .slice(7)
        .split("?")[0]!
        .trim()
        .toLowerCase();
      const host = new URL(url).hostname.replace(/^www\./, "");
      if (
        companyEmail(email, host, !!$(el).closest("footer").length) &&
        $(el).text().trim()
      )
        contacts.push({
          value: email,
          kind: "EMAIL",
          sourceUrl: url,
          name: null,
          title: null,
        });
    });
    $('a[href^="tel:"]').each((_i, el) => {
      const value = $(el)
        .attr("href")!
        .slice(4)
        .replace(/[\s()-]/g, "");
      const visible = $(el).text().replace(/\D/g, "");
      if (/^\+?\d{8,15}$/.test(value) && visible.length >= 8)
        if (
          $(el).closest("footer,nav,header").length ||
          !$(el).closest(
            'article,li,.team-member,.person,.employee,.staff-member,[itemtype="https://schema.org/Person"]',
          ).length
        )
          contacts.push({
            value,
            kind: "PHONE",
            sourceUrl: url,
            name: null,
            title: null,
          });
    });
  }
  const links: string[] = [];
  const staffLinks: string[] = [];
  $("a[href]").each((_i, el) => {
    try {
      const u = new URL($(el).attr("href")!, url);
      u.hash = "";
      u.search = "";
      if (
        /medarbejder|team|people|staff|kontakt|contact|om-os|about/i.test(
          new URL(url).pathname,
        ) &&
        /^[\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){1,4}$/u.test(
          $(el).text().trim(),
        ) &&
        $(el).closest("article,li,.team-member,.person,.employee,.staff-member")
          .length &&
        !$(el).closest("footer,nav,header").length &&
        !/\.(pdf|zip|xml|png|jpg)$/i.test(u.pathname)
      )
        staffLinks.push(u.toString());
      if (
        relevant.test(u.pathname) &&
        !excluded.test(u.pathname) &&
        !u.pathname.match(/\.(pdf|zip|xml|png|jpg)$/i)
      )
        links.push(u.toString());
    } catch {}
  });
  $("p,div,li,h1,h2,h3,h4,section,article,main,footer,header,nav,br").append(
    "\n",
  );
  const cvrs = visibleCvrs($("body").text());
  contacts.push(...staffContacts($.html(), url));
  // Only isolated, explicitly labelled phone text; never infer a phone from bare CVR digits.
  $("p,li,span,div").each((_i, el) => {
    const item = $(el);
    if (item.find("p,li,span,div").length || item.text().length > 160) return;
    const inPerson = item.closest(
      'article,.team-member,.person,.employee,.staff-member,[itemtype="https://schema.org/Person"]',
    ).length;
    if (inPerson && !item.closest("footer,nav,header").length) return;
    for (const value of labelledPhones(item.text()))
      contacts.push({
        value,
        kind: "PHONE",
        sourceUrl: url,
        name: null,
        title: null,
      });
  });
  $("nav,footer,header").remove();
  const root = $("main").length ? $("main") : $("body");
  root.find("p,div,li,h1,h2,h3,h4,section,article,br").append("\n");
  const text = root
    .text()
    .replace(/\s+/g, " ")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[arbejds-e-mail]")
    .trim()
    .slice(0, 40000);
  return {
    text,
    links: [...new Set(links)],
    staffLinks: [...new Set(staffLinks)].slice(0, 12),
    contacts,
    cvrs,
  };
}
export async function crawl(
  website: string,
  config: Config,
  testDependencies?: {
    request?: typeof requestPublic;
    pause?: (ms: number) => Promise<void>;
    identityOnly?: boolean;
  },
) {
  const transport = testDependencies?.request ?? requestPublic;
  const pause =
    testDependencies?.pause ??
    ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const first = new URL(website);
  allowedUrl(website, first.hostname);
  const robots = new Map<string, ReturnType<typeof robotsParser>>();
  let last = 0;
  let delay = config.delayMs;
  let cooldownMs = 30_000;
  const start = Date.now();
  const paced = async (url: URL) => {
    if (Date.now() - start > 180000)
      throw new Error("Analysen nåede tidsgrænsen");
    const wait = last + delay - Date.now();
    if (wait > 0) await pause(wait);
    last = Date.now();
    const response = await transport(url);
    const retryAfter = response.headers["retry-after"];
    if (retryAfter || response.status === 429) {
      const numeric = Number(retryAfter);
      const requested =
        retryAfter && Number.isFinite(numeric)
          ? numeric * 1000
          : retryAfter
            ? Date.parse(String(retryAfter)) - Date.now()
            : 60_000;
      cooldownMs = Math.max(
        cooldownMs,
        Number.isFinite(requested)
          ? Math.min(requested, 365 * 86400000)
          : 60_000,
      );
    }
    return response;
  };
  const policy = async (url: URL) => {
    if (robots.has(url.origin)) return robots.get(url.origin)!;
    let target = new URL("/robots.txt", url);
    let response;
    for (let i = 0; i < 4; i++) {
      response = await paced(target);
      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.location
      ) {
        target = allowedUrl(
          new URL(response.headers.location, target).toString(),
          first.hostname,
        );
        continue;
      }
      break;
    }
    if (!response || ![200, 404, 410].includes(response.status))
      throw new Error(
        `robots.txt kunne ikke kontrolleres (HTTP ${response?.status ?? 0})`,
      );
    const parser = robotsParser(
      new URL("/robots.txt", url).toString(),
      response.status === 200 ? response.body : "",
    );
    const crawlDelay = parser.getCrawlDelay(AGENT);
    if (crawlDelay && crawlDelay > 30)
      throw new Error(
        "Webstedets crawl-delay kræver en længere kørsel; manuel vurdering nødvendig",
      );
    delay = Math.max(delay, (crawlDelay ?? 0) * 1000);
    robots.set(url.origin, parser);
    return parser;
  };
  const fetchPage = async (raw: string) => {
    let url = allowedUrl(raw, first.hostname);
    for (let i = 0; i < 4; i++) {
      const parser = await policy(url);
      if (parser.isAllowed(url.toString(), AGENT) === false)
        throw new Error("Blokeret af robots.txt");
      const response = await paced(url);
      if ([401, 403, 429].includes(response.status))
        throw new Error(
          `STOP: adgang begrænset (HTTP ${response.status}); ingen yderligere hentning`,
        );
      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.location
      ) {
        url = allowedUrl(
          new URL(response.headers.location, url).toString(),
          first.hostname,
        );
        continue;
      }
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      if (!String(response.headers["content-type"] ?? "").includes("text/html"))
        throw new Error("Siden er ikke HTML");
      if (
        /cf-chl-|g-recaptcha|hcaptcha|verify you are human/i.test(response.body)
      )
        throw new Error("STOP: adgangskontrol eller CAPTCHA");
      return {
        url: url.toString(),
        ...extractPage(response.body, url.toString()),
      };
    }
    throw new Error("For mange redirects");
  };
  const queue = [first.toString()],
    visited = new Set<string>();
  const staffTargets = new Set<string>();
  let ordinaryPages = 0;
  const pages: {
    url: string;
    status: string;
    characters?: number;
    error?: string;
    fetchedAt: string;
    cvrs?: string[];
  }[] = [];
  const evidence: Finding[] = [];
  const contacts: WebsiteContact[] = [];
  while (queue.length && pages.length < config.maxPages + staffTargets.size) {
    const target = queue.shift()!;
    if (visited.has(target)) continue;
    if (!staffTargets.has(target)) {
      if (ordinaryPages >= config.maxPages) continue;
      ordinaryPages++;
    }
    visited.add(target);
    try {
      const page = await fetchPage(target);
      visited.add(page.url);
      const fetchedAt = new Date().toISOString();
      pages.push({
        url: page.url,
        status: page.text.length >= 200 ? "OK" : "EMPTY",
        characters: page.text.length,
        fetchedAt,
        cvrs: page.cvrs,
      });
      contacts.push(...page.contacts);
      if (!testDependencies?.identityOnly)
        for (const link of page.staffLinks) {
          try {
            allowedUrl(link, first.hostname);
            if (
              staffTargets.size < 12 &&
              !visited.has(link) &&
              !queue.includes(link)
            ) {
              staffTargets.add(link);
              queue.push(link);
            }
          } catch {}
        }
      const contentHash = createHash("sha256").update(page.text).digest("hex");
      for (const g of config.groups) {
        if (
          g.id === "jobs" &&
          !/karriere|career|jobs|stilling/.test(new URL(page.url).pathname)
        )
          continue;
        let found = 0;
        for (const keyword of g.keywords) {
          if (found >= 2) break;
          if (!containsKeyword(page.text, keyword)) continue;
          const at = page.text.toLowerCase().indexOf(keyword.toLowerCase());
          if (at < 0) continue;
          const excerpt = page.text.slice(
            Math.max(0, at - 110),
            Math.min(page.text.length, at + keyword.length + 180),
          );
          evidence.push({
            id: randomUUID(),
            url: page.url,
            excerpt,
            signal: g.id,
            keyword,
            fetchedAt,
            contentHash,
          });
          found++;
        }
      }
      for (const link of page.links.sort(
        (a, b) =>
          Number(
            (testDependencies?.identityOnly
              ? /kontakt|contact|om-os|about/
              : /case|referenc|kunder/
            ).test(b),
          ) -
          Number(
            (testDependencies?.identityOnly
              ? /kontakt|contact|om-os|about/
              : /case|referenc|kunder/
            ).test(a),
          ),
      )) {
        try {
          allowedUrl(link, first.hostname);
          if (!visited.has(link) && !queue.includes(link) && queue.length < 40)
            queue.push(link);
        } catch {}
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Hentning fejlede";
      pages.push({
        url: target,
        status: "BLOCKED",
        error: message,
        fetchedAt: new Date().toISOString(),
      });
      if (pages.length === 1 || message.startsWith("STOP:")) break;
    }
  }
  return {
    pages,
    evidence,
    contacts: deduplicateContacts(contacts),
    cooldownMs,
    coverage:
      pages.some((p) => p.status !== "OK") ||
      pages.filter((p) => p.status === "OK").length < 2
        ? ("PARTIAL" as const)
        : ("COMPLETE" as const),
  };
}
