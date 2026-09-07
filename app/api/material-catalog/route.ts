import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/auth";
import { z } from "zod";
import { CATALOG_CATEGORIES } from "@/lib/materialCatalog";

// Public: anyone can browse the reference catalog, optionally filtered to a
// category and/or a text search across name + description. Adding/removing
// entries is admin-only (see isAdminRequest).

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category");
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const countsOnly = req.nextUrl.searchParams.get("counts") === "1";

  if (countsOnly) {
    const grouped = await prisma.materialCatalogItem.groupBy({
      by: ["category"],
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const g of grouped) counts[g.category] = g._count._all;
    return NextResponse.json(counts);
  }

  const items = await prisma.materialCatalogItem.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(items);
}

const BodySchema = z.object({
  category: z.enum(CATALOG_CATEGORIES),
  name: z.string().min(1).max(120),
  description: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const item = await prisma.materialCatalogItem.create({ data: parsed.data });
  return NextResponse.json(item, { status: 201 });
}
