import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Real lawn-size estimation is the hardest "real" piece of this whole app.
 * Google Maps doesn't hand you "this address has a 3,200 sq ft lawn" —
 * there's no public API that segments grass from driveway from roof.
 *
 * The realistic, buildable approach (what most lawn-care apps actually do):
 *   1. Geocode the address to lat/lng (Google Geocoding API — this part IS real and easy).
 *   2. Show the satellite view centered there in the browser (Google Maps JS API).
 *   3. Let the customer trace their lawn boundary on the map with the Maps
 *      Drawing Library (a polygon they draw with clicks).
 *   4. Compute the polygon's area with google.maps.geometry.spherical.computeArea()
 *      — this happens in the BROWSER, then gets sent here to price it.
 *
 * This route handles step 1 (geocoding, so you at least center the map correctly)
 * and step 4 (pricing once the browser sends you a real polygon area).
 * If no polygon area is sent yet, it returns the geocoded location only,
 * so the frontend can render the map and let the customer trace their yard.
 */

// Overgrown-lawn pricing: no fee up to 6in, a $10-$25 sliding fee from 6-10in
// (scaled by how tall it is), and anything past 10in needs the owner's own
// manual quote rather than an automated price.
function overgrownFeeFor(grassHeightIn: number | undefined): { fee: number; needsManualQuote: boolean } {
  if (!grassHeightIn || grassHeightIn <= 6) return { fee: 0, needsManualQuote: false };
  if (grassHeightIn > 10) return { fee: 0, needsManualQuote: true };
  const fee = 10 + ((grassHeightIn - 6) / (10 - 6)) * (25 - 10);
  return { fee: Math.round(fee), needsManualQuote: false };
}

export async function POST(req: NextRequest) {
  const { address, polygonAreaSqFt, grassHeightIn } = await req.json();

  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  // Step 1: real geocoding call.
  const geoRes = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
  );
  const geo = await geoRes.json();

  if (geo.status !== "OK") {
    return NextResponse.json({ error: `Could not locate address: ${geo.status}` }, { status: 400 });
  }
  const location = geo.results[0].geometry.location; // { lat, lng }

  if (!polygonAreaSqFt) {
    // Frontend hasn't drawn the yard boundary yet — just return the map location.
    return NextResponse.json({ location, needsPolygon: true });
  }

  // Step 4: price it for real, using the current editable base price.
  const service = await prisma.service.findUnique({ where: { name: "Mowing" } });
  const base = service?.basePrice ?? 45;
  const sizeMultiplier = polygonAreaSqFt / 3000; // base price is calibrated to a ~3,000 sq ft lawn
  const { fee: overgrownFee, needsManualQuote } = overgrownFeeFor(grassHeightIn);
  const basePricePortion = Math.round(base * sizeMultiplier);
  const price = basePricePortion + overgrownFee;

  return NextResponse.json({
    location,
    sqft: Math.round(polygonAreaSqFt),
    basePricePortion,
    overgrownFee,
    needsManualQuote,
    total: needsManualQuote ? null : price,
  });
}
