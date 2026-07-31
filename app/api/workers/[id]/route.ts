import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Admin-only (see middleware.ts): revoke someone's worker access.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.worker.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
