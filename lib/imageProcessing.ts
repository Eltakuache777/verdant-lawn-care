import sharp from "sharp";
import heicConvert from "heic-convert";

// sharp's bundled libvips enforces a strict libheif "security limit" on how
// many item properties a HEIC file's ipma box may define, which real modern
// phone photos routinely exceed — sharp then throws "Invalid input: Security
// limit exceeded" even on a completely legitimate photo. heic-convert uses a
// separate, more permissive HEIC decoder and succeeds where sharp can't, so
// it's tried as a fallback rather than a replacement (sharp is faster and
// handles the common case fine).
export async function heicBufferToJpeg(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer).rotate().jpeg({ quality: 85 }).toBuffer();
  } catch (sharpErr) {
    const converted = await heicConvert({ buffer, format: "JPEG", quality: 0.85 });
    return Buffer.from(converted);
  }
}

// Resize/re-encode an already-uploaded photo before sending it to an external
// API — falls back through the same HEIC path as heicBufferToJpeg if sharp
// can't decode the file directly (covers older files that were stored as raw
// .heic before the upload route had the heic-convert fallback).
export async function resizeForApi(
  buffer: Buffer,
  maxDimension: number
): Promise<Buffer> {
  try {
    return await sharp(buffer).resize(maxDimension, maxDimension, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  } catch (sharpErr) {
    const jpeg = await heicBufferToJpeg(buffer);
    return sharp(jpeg).resize(maxDimension, maxDimension, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  }
}
