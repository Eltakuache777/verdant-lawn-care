// Android's push notification "badge" (the small status-bar icon) must be a
// plain white silhouette on a transparent background -- Android applies its
// own tinting, so a full-color icon there renders wrong (this, plus sw.js
// using the un-rasterized brand SVG for both icon and badge, is why real
// notifications were showing a generic colored square instead of the logo).
// Run with: npx tsx scripts/generateNotificationBadge.ts
import sharp from "sharp";
import path from "path";

const OUT_DIR = path.join(process.cwd(), "public", "icons");

function badgeSvg(size: number) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <polygon points="50,14 88,84 12,84" fill="none" stroke="#ffffff" stroke-width="9" />
    <polygon points="50,42 74,84 26,84" fill="#ffffff" />
  </svg>`;
}

async function main() {
  const buffer = await sharp(Buffer.from(badgeSvg(96))).resize(96, 96).png().toBuffer();
  const outPath = path.join(OUT_DIR, "notification-badge.png");
  await sharp(buffer).toFile(outPath);
  console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
