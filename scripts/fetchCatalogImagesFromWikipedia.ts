// Fills in imageUrl for MaterialCatalogItem rows that don't have one yet,
// using REAL photos from Wikipedia's public API rather than AI generation
// (per explicit request, switching approach mid-catalog -- the ~41 items
// already AI-generated are left alone).
//
// Wikipedia only serves images hosted on Wikimedia Commons for article
// thumbnails/lead images (verified by checking the URL path contains
// "/wikipedia/commons/", as opposed to "/wikipedia/en/" which is where
// non-free "fair use" local uploads live and are never used this way for
// plant/species articles) -- Commons requires every file to be public
// domain or under a free license (typically CC-BY-SA) as a condition of
// being hosted there at all. That makes this a legitimate, low-risk
// source, unlike pulling images from a random Google Images result or a
// competitor's product page.
//
// Idempotent/resumable: only processes rows where imageUrl is still null.
// Run with: npx tsx scripts/fetchCatalogImagesFromWikipedia.ts
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();
const DELAY_MS = 2500;
const FETCH_ATTEMPTS = 4;

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response | null> {
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      if (res.status === 404) return res; // real "doesn't exist", not worth retrying
    } catch {
      // network error -- fall through to retry
    }
    if (attempt < FETCH_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
  }
  return null;
}

function nameCandidates(name: string): string[] {
  const candidates = [name];
  const parenMatch = name.match(/^(.+?)\s*\((.+)\)$/);
  if (parenMatch) {
    candidates.push(parenMatch[1].trim()); // "Calibrachoa (Million Bells)" -> "Calibrachoa"
    candidates.push(parenMatch[2].trim()); // -> "Million Bells"
  }
  return candidates;
}

const UA = { "User-Agent": "VerdantLawnCare-CatalogBot/1.0 (contact: verdantlawn.care)" };

async function fetchCommonsImage(title: string): Promise<Buffer | null> {
  const res = await fetchWithRetry(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
    headers: UA,
  });
  if (!res || !res.ok) return null;
  const data = await res.json();
  const imageUrl: string | undefined = data.originalimage?.source ?? data.thumbnail?.source;
  if (!imageUrl || !imageUrl.includes("/wikipedia/commons/")) return null;

  const imgRes = await fetchWithRetry(imageUrl, { headers: UA });
  if (!imgRes || !imgRes.ok) return null;
  return Buffer.from(await imgRes.arrayBuffer());
}

async function main() {
  const items = await prisma.materialCatalogItem.findMany({ where: { imageUrl: null }, orderBy: { name: "asc" } });
  console.log(`${items.length} items still need a photo.`);

  let done = 0;
  let failed = 0;
  for (const item of items) {
    let found = false;
    for (const candidate of nameCandidates(item.name)) {
      try {
        const raw = await fetchCommonsImage(candidate);
        if (!raw) continue;
        const jpeg = await sharp(raw)
          .resize(480, 480, { fit: "cover" })
          .jpeg({ quality: 78 })
          .toBuffer();
        const dataUri = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
        await prisma.materialCatalogItem.update({ where: { id: item.id }, data: { imageUrl: dataUri } });
        found = true;
        done++;
        console.log(`[${done + failed}/${items.length}] OK: ${item.name} (matched "${candidate}", ${Math.round(jpeg.length / 1024)}KB)`);
        break;
      } catch (err) {
        // try next candidate
      }
    }
    if (!found) {
      failed++;
      console.error(`[${done + failed}/${items.length}] NO MATCH: ${item.name}`);
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  console.log(`Done. ${done} found, ${failed} not found (those will need a manual look or AI generation as fallback).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
