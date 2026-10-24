import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { toErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

const patchSchema = z.object({
  status: z
    .enum(["NEW", "QUALIFIED", "CONTACTED", "MEETING_SET", "CLOSED_WON", "CLOSED_LOST", "DISQUALIFIED"])
    .optional(),
  assignedTo: z.string().max(120).nullable().optional(),
  notes: z.string().max(10_000).nullable().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  nextFollowUpAt: z.coerce.date().nullable().optional(),
  meetingAt: z.coerce.date().nullable().optional(),
  closedReason: z.string().max(500).nullable().optional(),
  actor: z.string().max(120).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ cvr: string }> }) {
  try {
    const { cvr } = await context.params;
    const clean = cvr.replace(/\D/g, "");
    const body = patchSchema.parse(await request.json());

    const company = await prisma.company.findUnique({
      where: { cvr: clean },
      select: { id: true, outreach: { select: { id: true, status: true } } },
    });
    if (!company) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const fromStatus = company.outreach?.status ?? null;
    const statusChanged = body.status !== undefined && body.status !== fromStatus;

    // Status change + audit row in one transaction: an outreach log with holes
    // is worse than no log, because reps trust it.
    const updated = await prisma.$transaction(async (tx) => {
      const outreach = await tx.leadOutreachStatus.upsert({
        where: { companyId: company.id },
        create: {
          companyId: company.id,
          status: body.status ?? "NEW",
          assignedTo: body.assignedTo ?? null,
          notes: body.notes ?? null,
          priority: body.priority ?? 0,
          nextFollowUpAt: body.nextFollowUpAt ?? null,
          meetingAt: body.meetingAt ?? null,
          closedReason: body.closedReason ?? null,
          lastContactedAt: body.status === "CONTACTED" ? new Date() : null,
        },
        update: {
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.assignedTo !== undefined ? { assignedTo: body.assignedTo } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(body.priority !== undefined ? { priority: body.priority } : {}),
          ...(body.nextFollowUpAt !== undefined ? { nextFollowUpAt: body.nextFollowUpAt } : {}),
          ...(body.meetingAt !== undefined ? { meetingAt: body.meetingAt } : {}),
          ...(body.closedReason !== undefined ? { closedReason: body.closedReason } : {}),
          ...(body.status === "CONTACTED" ? { lastContactedAt: new Date() } : {}),
        },
      });

      if (statusChanged) {
        await tx.outreachEvent.create({
          data: {
            outreachId: outreach.id,
            fromStatus,
            toStatus: body.status!,
            note: body.notes ?? null,
            actor: body.actor ?? null,
          },
        });
      }
      return outreach;
    });

    return NextResponse.json({ outreach: updated, statusChanged });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid body", details: e.issues }, { status: 400 });
    }
    return NextResponse.json({ error: toErrorMessage(e) }, { status: 500 });
  }
}
