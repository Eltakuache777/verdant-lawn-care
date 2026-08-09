// Free alternative to generateCatalogImages.ts -- uses Pollinations.ai
// (https://pollinations.ai) instead of Gemini. No API key, no signup, no
// cost: it's a public, unauthenticated image endpoint built on the
// Apache-2.0-licensed Flux Schnell model, which is fine for commercial use
// (unlike Flux Dev, which is non-commercial-only -- Pollinations' free/
// anonymous tier uses Schnell). Slower than Gemini (~30s per image) and
// rate-limited to roughly one request per 15s without an account, so a full
// run over hundreds of items takes hours, not minutes -- that trade-off
// (free but slow) is the whole point of this script existing alongside the
// paid one.
// Idempotent/resumable: only processes rows where imageUrl is still null.
// Run with: npx tsx scripts/generateCatalogImagesFree.ts [--limit=N]
import fs from "fs";
if (!process.env.DATABASE_URL && fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();
const DELAY_MS = 17000; // stay under the ~1-per-15s anonymous rate limit
const FETCH_ATTEMPTS = 3;

function promptFor(category: string, name: string, description: string | null): string {
  const subject =
    category === "Flowers" || category === "Trees"
      ? `a single ${name} plant, isolated, healthy and mature`
      : category === "Soil" || category === "Mulch"
        ? `a scoop or small pile of ${name}, a bagged garden soil/growing-medium product -- show the loose granular material itself, NOT the plant(s) it's named after or used for`
        : `${name}, a single landscaping material sample`;
  return `Professional close-up product photo of ${subject} used in residential landscaping, shot against a plain neutral background, studio-style lighting, centered, no scenery, no people, no text, no watermark, no logos. ${description ?? ""}`;
}

async function fetchImage(prompt: string): Promise<Buffer | null> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&model=flux&seed=${Math.floor(Math.random() * 1e9)}`;
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > 1000) return buf; // guard against tiny error/placeholder responses
      }
    } catch {
      // fall through to retry
    }
    if (attempt < FETCH_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
  return null;
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : undefined;

  const items = await prisma.materialCatalogItem.findMany({
    where: { imageUrl: null },
    orderBy: { name: "asc" },
    ...(limit ? { take: limit } : {}),
  });
  console.log(`${items.length} items to generate (free, Pollinations.ai).`);

  let done = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const raw = await fetchImage(promptFor(item.category, item.name, item.description));
      if (!raw) throw new Error("no image returned after retries");
      const jpeg = await sharp(raw)
        .resize(480, 480, { fit: "cover" })
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
