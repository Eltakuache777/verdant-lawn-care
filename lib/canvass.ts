// Auto-fills a drawn territory with the real houses inside it, the same
// "sketch a polygon, houses appear" behavior RepGrid offers -- via
// OpenStreetMap's free, keyless Overpass API rather than a paid parcel-data
// service. Queries every node/way tagged with a house number inside the
// polygon and returns one point per address.

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export type LatLng = { lat: number; lng: number };
export type FetchedHouse = { lat: number; lng: number; address: string };

function polygonFilter(polygon: LatLng[]): string {
  // Overpass wants "lat lng lat lng ..." — no separators between pairs.
  return polygon.map((p) => `${p.lat} ${p.lng}`).join(" ");
}

function addressFrom(tags: Record<string, string>): string {
  const parts = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean);
  const line1 = parts.join(" ");
  const rest = [tags["addr:city"], tags["addr:state"]].filter(Boolean).join(", ");
  return [line1, rest].filter(Boolean).join(", ") || "Unknown address";
}

export async function fetchHousesInPolygon(polygon: LatLng[]): Promise<FetchedHouse[]> {
  if (polygon.length < 3) throw new Error("A territory needs at least 3 points");
  const poly = polygonFilter(polygon);
  const query = `
    [out:json][timeout:25];
    (
      node["addr:housenumber"](poly:"${poly}");
      way["addr:housenumber"](poly:"${poly}");
    );
    out center;
  `;

  // Overpass's public instance 406s requests without a descriptive
  // User-Agent (Node's fetch doesn't send one by default, unlike curl or a
  // browser) -- their own usage guidelines ask for exactly this.
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "User-Agent": "VerdantLawnCare-CanvassBot/1.0 (contact: verdantlawn.care)",
    },
    body: query,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    throw new Error(`Overpass API error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const elements: any[] = data.elements ?? [];

  const houses: FetchedHouse[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const address = addressFrom(el.tags ?? {});
    const key = `${address}|${lat.toFixed(6)}|${lng.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    houses.push({ lat, lng, address });
  }
  return houses;
}
