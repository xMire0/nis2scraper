import { prisma } from "../prisma";
import { configSchema, defaultConfig } from "./config";
import { makeOutreach } from "./outreach";

export async function prepareSalesMaterial(
  companyId: string,
  scoreId: string | null,
) {
  if (!scoreId)
    throw new Error("En ny ICP-vurdering skal gennemføres før salgsmateriale");
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findUniqueOrThrow({
      where: { id: companyId },
    });
    if (
      company.advertisingProtected !== false ||
      company.status !== "ACTIVE" ||
      company.addressCountry !== "DK" ||
      !company.registryFetchedAt ||
      Date.now() - company.registryFetchedAt.getTime() > 7 * 86400000
    )
      throw new Error("Registerdata skal kontrolleres før salgsmateriale");
    const score = await tx.leadScore.findFirstOrThrow({
      where: { id: scoreId, companyId },
      include: { run: true },
    });
    if (!["SUCCEEDED", "PARTIAL"].includes(score.run.status))
      throw new Error("Analysen har ikke et brugbart resultat");
    const saved = await tx.scoringConfig.findFirst({ orderBy: { id: "desc" } });
    const config = saved ? configSchema.parse(saved.value) : defaultConfig;
    const evidence = score.evidenceIds[0]
      ? await tx.evidence.findFirst({
          where: { id: score.evidenceIds[0], companyId, runId: score.runId },
        })
      : null;
    for (const channel of ["EMAIL", "PHONE", "LINKEDIN", "WEBINAR"]) {
      if (
        await tx.outreachDraft.findFirst({
          where: { companyId, scoreId, channel },
        })
      )
        continue;
      await tx.outreachDraft.create({
        data: {
          companyId,
          scoreId,
          channel,
          body: makeOutreach(
            channel,
            company,
            score,
            config,
            evidence ?? undefined,
          ),
        },
      });
    }
  });
}
