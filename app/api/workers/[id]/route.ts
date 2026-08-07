import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Admin-only (see middleware.ts): revoke someone's worker access.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.worker.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

const PatchSchema = z.object({ freeAiDesign: z.boolean() });

// Admin-only (see middleware.ts): grant/revoke free AI Design use for a
// specific staff member. Separate from POST /api/workers (which also
// re-sends a login code) so flipping this doesn't email the worker.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const worker = await prisma.worker.update({
    where: { id: params.id },
    data: { freeAiDesign: parsed.data.freeAiDesign },
    select: { id: true, email: true, name: true, isAdmin: true, freeAiDesign: true, addedAt: true },
  });
  return NextResponse.json(worker);
}
