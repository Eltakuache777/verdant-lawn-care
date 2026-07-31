import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseWorkerAccounts } from "@/lib/workerAccounts";
import { z } from "zod";

// Admin-only (see middleware.ts): log a payout made to an employee.
const BodySchema = z.object({
  workerUsername: z.string().min(1),
  amount: z.number().positive(),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { workerUsername, amount, note } = parsed.data;

  const account = parseWorkerAccounts(process.env.WORKER_ACCOUNTS).find((a) => a.username === workerUsername);
  const workerName = account?.name ?? workerUsername;

  const payment = await prisma.workerPayment.create({
    data: { workerUsername, workerName, amount, note },
  });
  return NextResponse.json(payment, { status: 201 });
}
