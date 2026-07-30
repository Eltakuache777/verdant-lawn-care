import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Prices customers see everywhere else in the app now live in the database,
// not in the frontend. GET returns them; PUT is what the Admin page calls
// when you hit "Save prices."

const DEFAULTS = [
  { name: "Mowing", basePrice: 45 },
  { name: "Tree Trimming", basePrice: 120 },
  { name: "Landscaping Project", basePrice: 350 },
  { name: "Fence Building", basePrice: 500 },
  { name: "Pressure Washing", basePrice: 90 },
  { name: "Bin Cleaning", basePrice: 25 },
  { name: "Bush Trimming", basePrice: 60 },
];

export async function GET() {
  let services = await prisma.service.findMany();
  if (services.length === 0) {
    // First run: seed the defaults so the app isn't empty.
    await prisma.service.createMany({ data: DEFAULTS });
    services = await prisma.service.findMany();
  }
  return NextResponse.json(services);
}

export async function PUT(req: NextRequest) {
  // Auth is enforced by middleware.ts (requires ADMIN_PASSWORD via HTTP Basic Auth).
  const body = await req.json(); // expects: { updates: [{ name, basePrice }] }
  const updates: { name: string; basePrice: number }[] = body.updates;

  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: "Expected { updates: [...] }" }, { status: 400 });
  }

  const results = await Promise.all(
    updates.map((u) =>
      prisma.service.update({
        where: { name: u.name },
        data: { basePrice: u.basePrice },
      })
    )
  );

  return NextResponse.json(results);
}
