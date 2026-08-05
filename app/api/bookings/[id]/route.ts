import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest, isWorkerRequest } from "@/lib/auth";
import { sendReviewRequestEmail } from "@/lib/email";
import { z } from "zod";

// Marking a job "completed" and recording what was actually collected are both
// allowed for admin AND workers — whoever's on-site for the job is best
// placed to log the real payment amount right after finishing it.
const PatchSchema = z.object({
  status: z.literal("completed").optional(),
  amountPaid: z.number().min(0).optional(),
  assignedWorkerEmail: z.string().email().nullable().optional(),
  assignedWorkerName: z.string().nullable().optional(),
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
  const { status, amountPaid, assignedWorkerEmail, assignedWorkerName } = parsed.data;

  const data: {
    status?: string;
    completedAt?: Date;
    amountPaid?: number;
    assignedWorkerEmail?: string | null;
    assignedWorkerName?: string | null;
  } = {};
  if (status === "completed") {
    data.status = "completed";
    data.completedAt = new Date();
  }
  if (amountPaid !== undefined) {
    data.amountPaid = amountPaid;
  }
  if (assignedWorkerEmail !== undefined) {
    data.assignedWorkerEmail = assignedWorkerEmail;
    data.assignedWorkerName = assignedWorkerName ?? null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const booking = await prisma.booking.update({ where: { id: params.id }, data });

  if (status === "completed") {
    // Fire-and-forget: a failed review-request email shouldn't block the
    // job from being marked done.
    prisma.customer.findUnique({ where: { id: booking.customerId } }).then((customer) => {
      if (!customer) return;
      return sendReviewRequestEmail({
        customerName: customer.name,
        customerEmail: customer.email,
        services: booking.services,
      });
    }).catch((err) => console.error("Failed to send review request email:", err));
  }

  return NextResponse.json(booking);
}
