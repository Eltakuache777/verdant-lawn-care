import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendLoginCode } from "@/lib/loginCode";
import { z } from "zod";

// Admin-only (see middleware.ts): who currently has worker (read-only
// dashboard) access, and adding someone new by email.
export async function GET() {
  const workers = await prisma.worker.findMany({ orderBy: { addedAt: "desc" } });
  return NextResponse.json(workers);
}

const BodySchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();

  const worker = await prisma.worker.upsert({
    where: { email },
    update: { name: parsed.data.name },
    create: { email, name: parsed.data.name },
  });

  await sendLoginCode(email);

  return NextResponse.json(worker, { status: 201 });
}
