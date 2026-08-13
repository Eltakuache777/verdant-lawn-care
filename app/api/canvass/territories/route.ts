import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffSessionFrom } from "@/lib/auth";
import { fetchHousesInPolygon } from "@/lib/canvass";
import { z } from "zod";

// Staff-only (see middleware.ts).
export async function GET() {
  const territories = await prisma.canvassTerritory.findMany({
    orderBy: { createdAt: "desc" },
    include: { houses: true },
  });
  return NextResponse.json(territories);
}

const PointSchema = z.object({ lat: z.number(), lng: z.number() });
const BodySchema = z.object({
  name: z.string().optional(),
  polygon: z.array(PointSchema).min(3),
  assignedWorkerEmail: z.string().email().optional(),
  services: z.array(z.string()).optional(),
});

// Draws a territory and immediately auto-fills it with every real address
// inside the polygon (see lib/canvass.ts) -- the core "sketch it, houses
// appear" behavior, no manual pin-dropping.
export async function POST(req: NextRequest) {
  const session = await staffSessionFrom(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let houses;
  try {
    houses = await fetchHousesInPolygon(parsed.data.polygon);
  } catch (err: any) {
    return NextResponse.json({ error: `Could not look up houses: ${err.message}` }, { status: 502 });
  }
  if (houses.length === 0) {
    return NextResponse.json({ error: "No addresses found in that area — try drawing a larger area." }, { status: 400 });
  }

  const services = parsed.data.services ?? [];
  const territory = await prisma.canvassTerritory.create({
    data: {
      name: parsed.data.name,
      polygon: parsed.data.polygon,
      services,
      assignedWorkerEmail: parsed.data.assignedWorkerEmail,
      createdByEmail: session.email,
      houses: {
        create: houses.map((h) => ({
          lat: h.lat,
          lng: h.lng,
          address: h.address,
          services,
          assignedWorkerEmail: parsed.data.assignedWorkerEmail,
        })),
      },
    },
    include: { houses: true },
  });

  return NextResponse.json(territory, { status: 201 });
}
