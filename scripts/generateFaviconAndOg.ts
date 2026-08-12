// Generates small favicon PNGs (browser tabs mostly show these, not the
// 192/512 PWA-install icons already in public/icons) and a 1200x630 Open
// Graph image (the thumbnail shown when a link to the site is shared on
// iMessage, WhatsApp, Slack, Facebook, etc. -- currently missing entirely,
// so shares show as bare text). Run with: npx tsx scripts/generateFaviconAndOg.ts
import sharp from "sharp";
import { mkdir } from "fs/promises";
import path from "path";

const PUBLIC_DIR = path.join(process.cwd(), "public");

function markSvg(size: number) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0a160f" />
    <polygon points="50,14 88,84 12,84" fill="none" stroke="#f4f6f2" stroke-width="7" />
    <polygon points="50,42 74,84 26,84" fill="#34d67f" />
  </svg>`;
}

// Same brand mark, scaled up and paired with the business name/tagline on a
// dark green field -- deliberately simple (no photo) since it has to read
// clearly at the tiny size link previews actually render at. The mark's
// own shapes (from markSvg's 0-100 viewBox) are wrapped in one transform
// group rather than recomputing each point's absolute position by hand.
function ogSvg() {
  const w = 1200;
  const h = 630;
  const markSize = 220;
  const markX = 130;
  const markY = (h - markSize) / 2;
  const scale = markSize / 100;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="#0a160f" />
    <g transform="translate(${markX},${markY}) scale(${scale})">
      <rect width="100" height="100" rx="20" fill="#132318" />
      <polygon points="50,14 88,84 12,84" fill="none" stroke="#f4f6f2" stroke-width="7" />
      <polygon points="50,42 74,84 26,84" fill="#34d67f" />
    </g>
    <text x="440" y="270" font-family="Arial, sans-serif" font-size="76" font-weight="700" fill="#f4f6f2">Verdant Lawn Care</text>
    <text x="440" y="330" font-family="Arial, sans-serif" font-size="34" fill="#9db3a6">Lawn Mowing &amp; Landscaping in Austin, TX</text>
    <text x="440" y="400" font-family="Arial, sans-serif" font-size="30" fill="#34d67f">verdantlawn.care</text>
  </svg>`;
}

async function main() {
  await mkdir(path.join(PUBLIC_DIR, "icons"), { recursive: true });

  for (const size of [16, 32, 48]) {
    const buffer = await sharp(Buffer.from(markSvg(size))).resize(size, size).png().toBuffer();
    const outPath = path.join(PUBLIC_DIR, "icons", `favicon-${size}.png`);
    await sharp(buffer).toFile(outPath);
    console.log(`Wrote ${outPath}`);
  }

  const ogBuffer = await sharp(Buffer.from(ogSvg())).resize(1200, 630).png().toBuffer();
  const ogPath = path.join(PUBLIC_DIR, "og-image.png");
  await sharp(ogBuffer).toFile(ogPath);
  console.log(`Wrote ${ogPath} (${ogBuffer.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
