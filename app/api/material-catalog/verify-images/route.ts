import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCatalogImageMatch } from "@/lib/gemini";

// One-off maintenance operation, not a public or staff-session route --
// guarded by the same shared-secret pattern as /api/reminders/run-due so it
// can be triggered from a local script without needing GEMINI_API_KEY (or a
// staff login session) on the machine running the script; the actual Gemini
// call happens here, server-side, using Render's already-configured key.
// Runs synchronously (same reasoning as /api/quote/generate: fine on
// Render's persistent server, would need a background job on a host with
// hard request timeouts).
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-internal-key");
  if (!process.env.SESSION_SECRET || key !== process.env.SESSION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.materialCatalogItem.findMany({
    where: { NOT: { imageUrl: null } },
    orderBy: { name: "asc" },
  });

  let ok = 0;
  let cleared = 0;
  let skipped = 0;
  const mismatches: { name: string; reason: string }[] = [];

  for (const item of items) {
    if (!item.imageUrl) continue;
    const result = await verifyCatalogImageMatch(item.imageUrl, item.name, item.description);
    if (result === null) {
      skipped++;
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

  return NextResponse.json({ checked: items.length, ok, cleared, skipped, mismatches });
}
