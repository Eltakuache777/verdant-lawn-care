import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Staff-only (see middleware.ts).
const PatchSchema = z.object({
  name: z.string().optional(),
  assignedWorkerEmail: z.string().email().nullable().optional(),
});

// Reassigning a territory also reassigns every house still at "not_knocked"
// in it -- houses someone already made progress on (booked, denied, etc.)
// keep whoever's already working them rather than getting silently
// reshuffled.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const territory = await prisma.canvassTerritory.update({
    where: { id: params.id },
    data: { name: parsed.data.name, assignedWorkerEmail: parsed.data.assignedWorkerEmail },
  });
  if (parsed.data.assignedWorkerEmail !== undefined) {
    await prisma.canvassHouse.updateMany({
      where: { territoryId: params.id, status: "not_knocked" },
      data: { assignedWorkerEmail: parsed.data.assignedWorkerEmail },
    });
  }
  return NextResponse.json(territory);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.canvassTerritory.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
