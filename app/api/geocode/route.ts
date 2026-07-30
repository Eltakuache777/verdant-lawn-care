import { NextRequest, NextResponse } from "next/server";

// Shared geocoding lookup used by the fence and pressure-washing map-measuring
// tools (the mowing estimator has its own copy of this since it's bundled with pricing there).
export async function POST(req: NextRequest) {
  const { address } = await req.json();
  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  const geoRes = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
  );
  const geo = await geoRes.json();

  if (geo.status !== "OK") {
    return NextResponse.json({ error: `Could not locate address: ${geo.status}` }, { status: 400 });
  }

  return NextResponse.json({ location: geo.results[0].geometry.location });
}
