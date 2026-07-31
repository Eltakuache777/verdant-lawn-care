import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest, isWorkerRequest } from "@/lib/auth";
import { z } from "zod";

// Marking a job "completed" and recording what was actually collected are both
// allowed for admin AND workers — whoever's on-site for the job is best
// placed to log the real payment amount right after finishing it.
const PatchSchema = z.object({
  status: z.literal("completed").optional(),
  amountPaid: z.number().min(0).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await isAdminRequest(req);
  const worker = await isWorkerRequest(req);
  if (!admin && !worker) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { status, amountPaid } = parsed.data;

  const data: { status?: string; completedAt?: Date; amountPaid?: number } = {};
  if (status === "completed") {
    data.status = "completed";
    data.completedAt = new Date();
  }
  if (amountPaid !== undefined) {
    data.amountPaid = amountPaid;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const booking = await prisma.booking.update({ where: { id: params.id }, data });
  return NextResponse.json(booking);
}
