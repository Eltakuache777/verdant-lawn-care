import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCatalogImageMatch } from "@/lib/gemini";

// One-off maintenance operation, not a public or staff-session route --
// guarded by the same shared-secret pattern as /api/reminders/run-due so it
// can be triggered from a local script without needing GEMINI_API_KEY (or a
// staff login session) on the machine running the script; the actual Gemini
// call happens here, server-side, using Render's already-configured key.
//
// Paginated via ?offset=N (over the full "NOT null" set, ordered by name)
// rather than one unbounded sweep -- the catalog grew past what a single
// request comfortably finishes within a client's timeout, so the caller
// pages through with offset += processed until processed === 0.
const BATCH_SIZE = 12;

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-internal-key");
  if (!process.env.SESSION_SECRET || key !== process.env.SESSION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10) || 0;

  const total = await prisma.materialCatalogItem.count({ where: { NOT: { imageUrl: null } } });
  const items = await prisma.materialCatalogItem.findMany({
    where: { NOT: { imageUrl: null } },
    orderBy: { name: "asc" },
    skip: offset,
    take: BATCH_SIZE,
  });

  let ok = 0;
  let cleared = 0;
  let skipped = 0;
  const mismatches: { name: string; reason: string }[] = [];
  const skipReasons: { name: string; reason: string }[] = [];

  for (const item of items) {
    if (!item.imageUrl) continue;
    const result = await verifyCatalogImageMatch(item.imageUrl, item.name, item.description);
    if (result.matches === null) {
      skipped++;
      skipReasons.push({ name: item.name, reason: result.skipReason });
      continue;
    }
    if (result.matches) {
      ok++;
    } else {
      cleared++;
      mismatches.push({ name: item.name, reason: result.reason });
      await prisma.materialCatalogItem.update({ where: { id: item.id }, data: { imageUrl: null } });
    }
  }

  const nextOffset = offset + items.length;
  return NextResponse.json({
    total,
    offset,
    processed: items.length,
    nextOffset,
    done: nextOffset >= total,
    ok,
    cleared,
    skipped,
    mismatches,
    skipReasons,
  });
}
