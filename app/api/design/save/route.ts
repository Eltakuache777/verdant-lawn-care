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

  // Fold in each item's materials list (same one shown on /design/success)
  // by matching its mediaUrl back to the concept/video index it came from.
  const quotes = await prisma.quoteRequest.findMany({
    where: { id: { in: Array.from(new Set(items.map((i) => i.quoteRequestId))) } },
    select: { id: true, conceptUrls: true, conceptVideoUrls: true, conceptMaterials: true },
  });
  const quoteById = new Map(quotes.map((q) => [q.id, q]));

  const withMaterials = items.map((item) => {
    const quote = quoteById.get(item.quoteRequestId);
    const index = quote ? quote.conceptUrls.indexOf(item.mediaUrl) : -1;
    const videoIndex = index === -1 && quote ? quote.conceptVideoUrls.indexOf(item.mediaUrl) : -1;
    const materials = quote ? quote.conceptMaterials[index !== -1 ? index : videoIndex] || null : null;
    return { ...item, materials };
  });

  return NextResponse.json(withMaterials);
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
