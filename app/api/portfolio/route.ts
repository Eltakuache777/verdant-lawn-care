import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffSessionFrom } from "@/lib/auth";
import { z } from "zod";

// Public: anyone can browse the "Our Work" gallery, optionally filtered to
// one service. Uploading is staff-only (enforced by middleware.ts).

export async function GET(req: NextRequest) {
  const service = req.nextUrl.searchParams.get("service");
  const items = await prisma.portfolioItem.findMany({
    where: service ? { service } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

const BodySchema = z.object({
  service: z.string().min(1),
  mediaUrl: z.string().min(1),
  caption: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const session = await staffSessionFrom(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await prisma.portfolioItem.create({
    data: {
      service: parsed.data.service,
      mediaUrl: parsed.data.mediaUrl,
      caption: parsed.data.caption,
      uploadedByEmail: session.email,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
