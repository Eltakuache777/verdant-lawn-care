import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/auth";

// middleware.ts only enforces "staff" (admin or worker) for this path --
// deleting catalog entries is admin-only, same as portfolio items and
// reviews, checked here.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  await prisma.materialCatalogItem.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
