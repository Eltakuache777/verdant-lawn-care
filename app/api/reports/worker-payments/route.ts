import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/auth";
import { z } from "zod";

// Admin-only: log a payout made to an employee. Workers can see their own
// payments in Reports but shouldn't be able to log payroll entries.
const BodySchema = z.object({
  workerEmail: z.string().email(),
  amount: z.number().positive(),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { workerEmail, amount, note } = parsed.data;

  const worker = await prisma.worker.findUnique({ where: { email: workerEmail.toLowerCase() } });
  const workerName = worker?.name ?? workerEmail;

  const payment = await prisma.workerPayment.create({
    data: { workerEmail: workerEmail.toLowerCase(), workerName, amount, note },
  });
  return NextResponse.json(payment, { status: 201 });
}
