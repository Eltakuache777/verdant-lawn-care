// Fallback tier for items the Wikipedia lead-image lookup missed --
// searches Wikimedia Commons directly (its own file search, not just "the
// one lead image on the matching Wikipedia article"), which has far more
// coverage. Still exclusively Commons-hosted files, so still public domain
// or free-licensed, same legitimacy as fetchCatalogImagesFromWikipedia.ts.
// Idempotent: only processes rows where imageUrl is still null.
// Run with: npx tsx scripts/fetchCatalogImagesFromCommonsSearch.ts
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();
const DELAY_MS = 2000;
const FETCH_ATTEMPTS = 3;
const UA = { "User-Agent": "VerdantLawnCare-CatalogBot/1.0 (contact: verdantlawn.care)" };

async function fetchWithRetry(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.ok) return res;
    } catch {
      // fall through to retry
    }
    if (attempt < FETCH_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
  }
  return null;
}

function searchTermFor(category: string, name: string): string {
  const base = name.replace(/\s*\(.+\)\s*/, "").trim(); // strip "(alt name)" parenthetical
  const noun = category === "Flowers" ? "flower" : category === "Trees" ? "tree" : "";
  return noun ? `${base} ${noun}` : base;
}

async function searchCommons(term: string): Promise<Buffer | null> {
  const searchUrl =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}` +
    `&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url|mime&format=json`;
  const res = await fetchWithRetry(searchUrl);
  if (!res) return null;
  const data = await res.json();
  const pages = Object.values(data.query?.pages ?? {}) as any[];
  const candidate = pages
    .map((p) => p.imageinfo?.[0])
    .find((info) => info?.url && /image\/(jpeg|png)/.test(info.mime ?? "") && !/\.svg/i.test(info.url));
  if (!candidate) return null;

  const imgRes = await fetchWithRetry(candidate.url);
  if (!imgRes) return null;
  return Buffer.from(await imgRes.arrayBuffer());
}

async function main() {
  const items = await prisma.materialCatalogItem.findMany({ where: { imageUrl: null }, orderBy: { name: "asc" } });
  console.log(`${items.length} items still need a photo (Commons search fallback).`);

  let done = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const raw = await searchCommons(searchTermFor(item.category, item.name));
      if (!raw) throw new Error("no result");
      const jpeg = await sharp(raw).resize(480, 480, { fit: "cover" }).jpeg({ quality: 78 }).toBuffer();
      const dataUri = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
      await prisma.materialCatalogItem.update({ where: { id: item.id }, data: { imageUrl: dataUri } });
      done++;
      console.log(`[${done + failed}/${items.length}] OK: ${item.name} (${Math.round(jpeg.length / 1024)}KB)`);
    } catch {
      failed++;
      console.error(`[${done + failed}/${items.length}] NO MATCH: ${item.name}`);
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  console.log(`Done. ${done} found, ${failed} not found (fall back to AI generation for those).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
