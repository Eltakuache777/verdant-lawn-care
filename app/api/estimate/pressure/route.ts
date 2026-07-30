import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Per-sq-ft rates for each surface type — tune these to your real costs.
const SURFACE_RATES: Record<string, number> = {
  driveway: 0.12,
  siding: 0.18,
  patio: 0.15,
  fence_wash: 0.1,
};

export async function POST(req: NextRequest) {
  // body: { surfaces: [{ key: "driveway", sqft: 600 }, ...] }
  const { surfaces } = await req.json();
  if (!Array.isArray(surfaces) || surfaces.length === 0) {
    return NextResponse.json({ error: "Select at least one surface" }, { status: 400 });
  }

  const service = await prisma.service.findUnique({ where: { name: "Pressure Washing" } });
  const base = service?.basePrice ?? 90;

  const lineItems = surfaces.map((s: { key: string; sqft: number }) => {
    const rate = SURFACE_RATES[s.key] ?? 0.12;
    const cost = Math.round(s.sqft * rate);
    return { key: s.key, sqft: s.sqft, rate, cost };
  });

  const subtotal = lineItems.reduce((sum, l) => sum + l.cost, 0);
  const total = Math.max(subtotal, base);

  return NextResponse.json({ lineItems, subtotal, minimumPrice: base, total });
}
