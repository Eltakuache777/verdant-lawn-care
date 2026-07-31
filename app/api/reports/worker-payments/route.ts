import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Admin-only (see middleware.ts): log a payout made to an employee.
const BodySchema = z.object({
  workerEmail: z.string().email(),
  amount: z.number().positive(),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
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
