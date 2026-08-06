// Generates a representative product photo for every MaterialCatalogItem
// that doesn't have one yet, via Gemini text-to-image (never scraped from
// other sites -- avoids copyright issues entirely since these are freshly
// generated). Stored as a compact base64 JPEG data URI directly in the
// imageUrl column rather than a file on disk -- this script runs from a
// local machine, and Render's production disk isn't the same filesystem,
// so a file path here wouldn't resolve in production. The database is
// shared, so this works immediately with no deploy needed.
//
// Idempotent/resumable: only processes rows where imageUrl is still null,
// so if it fails partway through (rate limits, quota) just re-run it.
//
// Run with: npx tsx scripts/generateCatalogImages.ts
import { PrismaClient } from "@prisma/client";
import { generateStockPhoto } from "../lib/gemini";
import sharp from "sharp";

const prisma = new PrismaClient();
const DELAY_MS = 3000; // spread requests out, gentler on rate limits

function promptFor(category: string, name: string, description: string | null): string {
  const subject =
    category === "Flowers" || category === "Trees"
      ? `a ${name} plant, healthy and mature`
      : `${name}, a landscaping material`;
  return `A professional, photorealistic close-up product photo of ${subject} used in residential landscaping. ${description ?? ""} Natural outdoor lighting, simple uncluttered background, no text, no watermark, no people, no logos.`;
}

async function main() {
  const items = await prisma.materialCatalogItem.findMany({ where: { imageUrl: null } });
  console.log(`${items.length} items need images.`);

  let done = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const raw = await generateStockPhoto(promptFor(item.category, item.name, item.description));
      const jpeg = await sharp(raw)
        .resize(480, 480, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 78 })
        .toBuffer();
      const dataUri = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
      await prisma.materialCatalogItem.update({ where: { id: item.id }, data: { imageUrl: dataUri } });
      done++;
      console.log(`[${done + failed}/${items.length}] OK: ${item.category} / ${item.name} (${Math.round(jpeg.length / 1024)}KB)`);
    } catch (err) {
      failed++;
      console.error(`[${done + failed}/${items.length}] FAILED: ${item.category} / ${item.name}:`, err instanceof Error ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  console.log(`Done. ${done} succeeded, ${failed} failed (re-run this script to retry failed ones).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
