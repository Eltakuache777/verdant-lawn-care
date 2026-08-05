import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffSessionFrom } from "@/lib/auth";

// A staff member's own free-tool AI design history — each admin/worker sees
// only what they personally generated, not a shared pool.
export async function GET(req: NextRequest) {
  const session = await staffSessionFrom(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const designs = await prisma.quoteRequest.findMany({
    where: { createdByStaffEmail: session.email, status: "generated" },
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { name: true, email: true } } },
  });
  return NextResponse.json(designs);
}
