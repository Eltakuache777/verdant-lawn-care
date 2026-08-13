import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffSessionFrom } from "@/lib/auth";
import { z } from "zod";

const STATUSES = [
  "not_knocked",
  "booked",
  "completed",
  "denied",
  "warm_lead",
  "no_answer",
  "revisit_am",
  "revisit_pm",
] as const;

const PatchSchema = z.object({
  status: z.enum(STATUSES).optional(),
  notes: z.string().max(1000).optional(),
  assignedWorkerEmail: z.string().email().nullable().optional(),
  services: z.array(z.string()).optional(),
});

// Staff-only (see middleware.ts). Every status change is logged as its own
// CanvassStatusEvent (timestamped + attributed to whoever made it) -- that
// history is what the leaderboard and per-house timeline are built from,
// matching RepGrid's "every change is timestamped and attributed".
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await staffSessionFrom(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const house = await prisma.canvassHouse.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      ...(parsed.data.assignedWorkerEmail !== undefined ? { assignedWorkerEmail: parsed.data.assignedWorkerEmail } : {}),
      ...(parsed.data.services !== undefined ? { services: parsed.data.services } : {}),
      updatedByEmail: session.email,
    },
  });

  if (parsed.data.status) {
    await prisma.canvassStatusEvent.create({
      data: {
        houseId: house.id,
        status: parsed.data.status,
        workerEmail: session.email,
        workerName: session.name,
      },
    });
  }

  return NextResponse.json(house);
}
