import { NextResponse } from "next/server";
import { z } from "zod";

import { runPipeline } from "@/services/pipeline";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { toErrorMessage } from "@/lib/errors";
import { SECTORS } from "@/domain/nis2/sectors";

export const runtime = "nodejs";
export const maxDuration = 300; // a sweep outlives the default serverless budget

const log = createLogger("api:prospecting/run");

const bodySchema = z
  .object({
    sectors: z.array(z.enum(Object.keys(SECTORS) as [string, ...string[]])).optional(),
    db07Prefixes: z.array(z.string().regex(/^\d{2,6}$/)).optional(),
    cvrList: z.array(z.string().regex(/^\d{8}$/)).max(500).optional(),
    minEmployees: z.number().int().min(0).nullable().optional(),
    maxCompanies: z.number().int().min(1).max(5000).default(200),
    skipIfScopedWithinDays: z.number().int().min(0).default(30),
    enrichContacts: z.boolean().default(true),
    /** Return immediately and let the run continue in the background. */
    async: z.boolean().default(false),
  })
  .refine((b) => b.sectors?.length || b.db07Prefixes?.length || b.cvrList?.length, {
    message: "Provide at least one of: sectors, db07Prefixes, cvrList",
  });

function authorised(request: Request): boolean {
  const expected = process.env.PIPELINE_API_TOKEN;
  if (!expected) return true; // no token configured: local dev
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid request body", details: e instanceof z.ZodError ? e.issues : toErrorMessage(e) },
      { status: 400 },
    );
  }

  const options = {
    sectors: parsed.sectors as never,
    db07Prefixes: parsed.db07Prefixes,
    cvrList: parsed.cvrList,
    minEmployees: parsed.minEmployees ?? null,
    maxCompanies: parsed.maxCompanies,
    skipIfScopedWithinDays: parsed.skipIfScopedWithinDays,
    enrichContacts: parsed.enrichContacts,
    trigger: "api",
  };

  if (parsed.async) {
    // Fire and forget. In production put this behind a queue (Inngest, QStash,
    // Supabase cron) — a serverless function will be reclaimed mid-sweep.
    void runPipeline(options).catch((e) => log.error("background run failed", { error: toErrorMessage(e) }));
    return NextResponse.json({ accepted: true, mode: "async" }, { status: 202 });
  }

  try {
    const summary = await runPipeline(options);
    return NextResponse.json(summary, { status: summary.status === "FAILED" ? 500 : 200 });
  } catch (e) {
    log.error("pipeline failed", { error: toErrorMessage(e) });
    return NextResponse.json({ error: toErrorMessage(e) }, { status: 500 });
  }
}

/** Recent runs, for the dashboard's run history. */
export async function GET() {
  const runs = await prisma.pipelineRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 });
  return NextResponse.json({ runs });
}
