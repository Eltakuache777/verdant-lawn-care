import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Auth enforced by middleware.ts (staff only) — lets admin/workers delete a
// message from the customer support chat. Deleting it here means it's simply
// gone from the DB, so the customer's own chat (which polls this same data)
// stops showing it too within one poll cycle.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.chatMessage.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
