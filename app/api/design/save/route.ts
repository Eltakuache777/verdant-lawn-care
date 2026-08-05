import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { z } from "zod";

// Lets anyone logged in — customer or staff, doesn't matter which — save an
// individual photo/video from an AI Design batch instead of keeping the
// whole 5/15/50-concept dump. ownerEmail is just whoever's logged in.

const BodySchema = z.object({
  quoteRequestId: z.string().min(1),
  mediaUrl: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.savedDesignItem.findMany({
    where: { ownerEmail: session.email },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await prisma.savedDesignItem.upsert({
    where: { ownerEmail_mediaUrl: { ownerEmail: session.email, mediaUrl: parsed.data.mediaUrl } },
    update: {},
    create: {
      ownerEmail: session.email,
      quoteRequestId: parsed.data.quoteRequestId,
      mediaUrl: parsed.data.mediaUrl,
    },
  });
  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { mediaUrl } = await req.json();
  if (!mediaUrl) return NextResponse.json({ error: "mediaUrl is required" }, { status: 400 });

  await prisma.savedDesignItem
    .delete({ where: { ownerEmail_mediaUrl: { ownerEmail: session.email, mediaUrl } } })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}
