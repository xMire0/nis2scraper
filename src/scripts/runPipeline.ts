/**
 * CLI entry point: `pnpm pipeline -- --sectors ICT_SERVICE_MANAGEMENT,ENERGY --max 500`
 *
 * Use this rather than the HTTP route for large sweeps — a serverless function
 * will be reclaimed long before a 4000-company run finishes.
 */
import { runPipeline } from "@/services/pipeline";
import type { Nis2SectorKey } from "@/domain/nis2/sectors";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  throw new Error("Den tidligere scoping-pipeline er deaktiveret. Brug CSV-import og manuel analyse i dashboardet.");
  const sectors = arg("sectors")?.split(",").map((s) => s.trim()) as Nis2SectorKey[] | undefined;
  const cvrList = arg("cvr")?.split(",").map((s) => s.trim());
  const max = Number(arg("max") ?? 200);
  const noEnrich = process.argv.includes("--no-enrich");

  const summary = await runPipeline({
    sectors,
    cvrList,
    maxCompanies: max,
    enrichContacts: !noEnrich,
    minEmployees: arg("min-employees") ? Number(arg("min-employees")) : null,
    trigger: "cli",
  });

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.status === "FAILED" ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
