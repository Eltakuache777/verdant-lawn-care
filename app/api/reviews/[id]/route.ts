import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/auth";

// middleware.ts only enforces "staff" (admin or worker) for this path —
// deleting reviews is admin-only, same as portfolio items, checked here.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  await prisma.review.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
