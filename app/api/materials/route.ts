import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Materials pricing you enter and maintain by hand — Lowe's/Home Depot don't
// offer a public API for real product prices, so this is the practical alternative.

const DEFAULTS = [
  { name: "Sod", unit: "sq ft", price: 0.6 },
  { name: "Mulch", unit: "cu yd", price: 45 },
  { name: "Small Tree", unit: "each", price: 120 },
  { name: "Large Tree", unit: "each", price: 350 },
  { name: "Shrub / Plant", unit: "each", price: 25 },
  { name: "River Rock / Gravel", unit: "ton", price: 65 },
  { name: "Pavers / Bricks", unit: "sq ft", price: 12 },
  { name: "Retaining Wall Block", unit: "each", price: 4 },
];

export async function GET() {
  let materials = await prisma.material.findMany({ orderBy: { name: "asc" } });
  if (materials.length === 0) {
    await prisma.material.createMany({ data: DEFAULTS });
    materials = await prisma.material.findMany({ orderBy: { name: "asc" } });
  }
  return NextResponse.json(materials);
}

export async function PUT(req: NextRequest) {
  // Auth is enforced by middleware.ts (requires ADMIN_PASSWORD via HTTP Basic Auth).
  const body = await req.json(); // expects: { updates: [{ name, price }] }
  const updates: { name: string; price: number }[] = body.updates;

  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: "Expected { updates: [...] }" }, { status: 400 });
  }

  const results = await Promise.all(
    updates.map((u) =>
      prisma.material.update({
        where: { name: u.name },
        data: { price: u.price },
      })
    )
  );

  return NextResponse.json(results);
}
