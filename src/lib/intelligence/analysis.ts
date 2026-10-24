import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "../prisma";
import { configSchema, defaultConfig } from "./config";
import { crawl } from "./crawler";
import { scoreCompany } from "./scoring";
import { crawlExplanation } from "./queue";
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const hash = (v: string) =>
  createHash("sha256").update(v.toLowerCase().trim()).digest("hex");
export async function analyzeCompany(id: string) {
  const company = await prisma.company.findUniqueOrThrow({ where: { id } });
  if (!company.website) throw new Error("Tilføj en hjemmeside før analyse");
  if (
    company.registryFetchedAt &&
    (company.status !== "ACTIVE" ||
      company.addressCountry !== "DK" ||
      company.advertisingProtected !== false ||
      Date.now() - company.registryFetchedAt.getTime() > 7 * 86400000)
  )
    throw new Error("Registerdata skal opdateres før analyse");
  const saved = await prisma.scoringConfig.findFirst({
    orderBy: { id: "desc" },
  });
  const config = saved ? configSchema.parse(saved.value) : defaultConfig;
  const version = saved?.id ?? 0;
  const domain = new URL(company.website).hostname.replace(/^www\./, "");
  const expiresAt = new Date(Date.now() + 6 * 60000);
  await prisma.crawlLock.deleteMany({
    where: { domain, expiresAt: { lt: new Date() } },
  });
  try {
    await prisma.crawlLock.create({ data: { domain, expiresAt } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return {
        error:
          "Domænet analyseres eller afventer en rate-limit-pause. Prøv igen senere.",
        status: 409,
      };
    throw e;
  }
  let runId: string | undefined;
  let cooldownMs = 30_000;
  try {
    const run = await prisma.enrichmentRun.create({
      data: { companyId: company.id, config: json({ version, ...config }) },
    });
    runId = run.id;
    const crawled = await crawl(company.website, config);
    cooldownMs = crawled.cooldownMs;
    if (!crawled.pages.some((p) => p.status === "OK")) {
      await prisma.enrichmentRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          pages: json(crawled.pages),
          error:
            crawled.pages[0]?.error ?? "For lidt synlig tekst til en analyse",
        },
      });
      return {
        error: crawlExplanation(
          crawled.pages[0]?.error ??
            "Hjemmesiden kunne ikke analyseres. En tidligere score er bevaret.",
        ),
        status: 422,
      };
    }
    const score = scoreCompany(
      company,
      crawled.evidence,
      config,
      crawled.coverage,
    );
    const savedScore = await prisma.$transaction(async (tx) => {
      if (crawled.evidence.length)
        await tx.evidence.createMany({
          data: crawled.evidence.map((e) => ({
            id: e.id,
            companyId: company.id,
            runId: run.id,
            url: e.url,
            excerpt: e.excerpt,
            signal: e.signal,
            keyword: e.keyword,
            contentHash: e.contentHash!,
            fetchedAt: new Date(e.fetchedAt!),
          })),
        });
      const savedScore = await tx.leadScore.create({
        data: {
          ...score,
          companyId: company.id,
          runId: run.id,
          breakdown: json(score.breakdown),
          configVersion: version,
        },
      });
      for (const contact of crawled.contacts) {
        if (
          await tx.contactSuppression.findUnique({
            where: { hash: hash(contact.value) },
          })
        )
          continue;
        const data = {
          ...contact,
          fetchedAt: new Date(),
          expiresAt: new Date(Date.now() + config.retentionDays * 86400000),
        };
        await tx.publicContact.upsert({
          where: {
            companyId_value: { companyId: company.id, value: contact.value },
          },
          create: { companyId: company.id, ...data },
          update: data,
        });
      }
      await tx.enrichmentRun.update({
        where: { id: run.id },
        data: {
          status: crawled.coverage === "COMPLETE" ? "SUCCEEDED" : "PARTIAL",
          finishedAt: new Date(),
          pages: json(crawled.pages),
          mode: "RULES",
          model: null,
          error: null,
        },
      });
      return savedScore;
    });
    return { ok: true, mode: "RULES", status: 200, scoreId: savedScore.id };
  } catch (e) {
    if (runId)
      await prisma.enrichmentRun
        .update({
          where: { id: runId },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            error: e instanceof Error ? e.message : "Analyse fejlede",
          },
        })
        .catch(() => {});
    throw e;
  } finally {
    await prisma.crawlLock.updateMany({
      where: { domain, expiresAt },
      data: { expiresAt: new Date(Date.now() + cooldownMs) },
    });
  }
}
