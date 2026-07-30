import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MATERIAL_RATES: Record<string, number> = {
  chain_link: 12,
  wood: 18,
  vinyl: 25,
};

export async function POST(req: NextRequest) {
  const { lengthFt, material } = await req.json();
  if (!lengthFt || !material) {
    return NextResponse.json({ error: "lengthFt and material are required" }, { status: 400 });
  }

  const service = await prisma.service.findUnique({ where: { name: "Fence Building" } });
  const base = service?.basePrice ?? 500;
  const rate = MATERIAL_RATES[material] ?? 18;
  const bySize = Math.round(lengthFt * rate);
  const total = Math.max(bySize, base);

  return NextResponse.json({ lengthFt, material, rate, bySize, minimumPrice: base, total });
}
