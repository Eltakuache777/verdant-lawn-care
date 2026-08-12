import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// Serves uploaded photos/videos. Next.js's production static file serving
// only recognizes files that existed in /public at BUILD time — anything
// written there at runtime (i.e. every real upload) 404s even though it's
// genuinely on disk, since dev mode's dynamic filesystem scan doesn't carry
// over to `next start`. This route reads the file directly instead, so
// uploads actually work in production.

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".3gp": "video/3gpp",
  ".weba": "audio/webm",
  ".m4a": "audio/mp4",
  ".oga": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

export async function GET(_req: NextRequest, { params }: { params: { filename: string } }) {
  // Filenames are always our own crypto.randomUUID() + extension — reject
  // anything else so this can't be used to read arbitrary files off disk.
  if (!/^[a-f0-9-]+\.[a-z0-9]+$/i.test(params.filename)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "public", "uploads", params.filename);
  try {
    const data = await readFile(filePath);
    const ext = path.extname(params.filename).toLowerCase();
    return new NextResponse(data, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
