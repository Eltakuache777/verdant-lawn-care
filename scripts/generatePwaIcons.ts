// Generates the PNG icon set needed for a real installable PWA (Android
// "Add to Home Screen" / Google Play TWA wrapping both need these).
// Run with: npx tsx scripts/generatePwaIcons.ts
import sharp from "sharp";
import { mkdir } from "fs/promises";
import path from "path";

const OUT_DIR = path.join(process.cwd(), "public", "icons");

// Full-bleed square version (no rounded corners baked in -- the OS applies
// its own mask shape for adaptive/maskable icons) of the brand mark.
function regularSvg(size: number) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0a160f" />
    <polygon points="50,14 88,84 12,84" fill="none" stroke="#f4f6f2" stroke-width="7" />
    <polygon points="50,42 74,84 26,84" fill="#34d67f" />
  </svg>`;
}

// Maskable version: background fills the full canvas edge-to-edge (no
// rounded corners -- the OS masks the shape), logo scaled down to sit
// within the ~80% center "safe zone" so it survives circle/squircle crops.
function maskableSvg(size: number) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" fill="#0a160f" />
    <g transform="translate(50,50) scale(0.72) translate(-50,-50)">
      <polygon points="50,14 88,84 12,84" fill="none" stroke="#f4f6f2" stroke-width="7" />
      <polygon points="50,42 74,84 26,84" fill="#34d67f" />
    </g>
  </svg>`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const jobs: { name: string; svg: string; size: number }[] = [
    { name: "icon-192.png", svg: regularSvg(192), size: 192 },
    { name: "icon-512.png", svg: regularSvg(512), size: 512 },
    { name: "icon-maskable-192.png", svg: maskableSvg(192), size: 192 },
    { name: "icon-maskable-512.png", svg: maskableSvg(512), size: 512 },
    { name: "apple-touch-icon.png", svg: regularSvg(180), size: 180 },
  ];

  for (const job of jobs) {
    const buffer = await sharp(Buffer.from(job.svg)).resize(job.size, job.size).png().toBuffer();
    const outPath = path.join(OUT_DIR, job.name);
    await sharp(buffer).toFile(outPath);
    console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
