import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { heicBufferToJpeg } from "@/lib/imageProcessing";

// Stores customer-attached photos/videos of a project idea under public/uploads,
// but they're served back out through /api/files/[filename] (see that route) rather
// than as a plain /uploads/... static path — Next.js's production static file
// serving only recognizes files that existed in /public at BUILD time, so anything
// written here at runtime would otherwise 404 even though it's genuinely on disk.
// Render's disk also isn't guaranteed persistent across deploys — fine for now, but
// if photos need to survive long-term, swap this for real cloud storage.

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB
const MAX_FILES = 15;

// Broad, permissive checks instead of an exact mime-type whitelist — phones report a
// huge variety of image/video mime types (HEIC on iPhone, 3gpp/x-matroska on Android,
// sometimes an empty string when the browser can't determine one), and rejecting
// anything not on a short list was silently blocking real photos/videos from uploading.
function isImage(mimeType: string) {
  return mimeType.startsWith("image/");
}
function isVideo(mimeType: string) {
  return mimeType.startsWith("video/");
}
function isHeic(mimeType: string, filename: string) {
  return mimeType === "image/heic" || mimeType === "image/heif" || /\.hei[cf]$/i.test(filename);
}

function extensionFor(mimeType: string, filename: string): string {
  const fromName = path.extname(filename);
  if (fromName) return fromName.toLowerCase();
  const guess: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "video/3gpp": ".3gp",
  };
  return guess[mimeType] ?? (isVideo(mimeType) ? ".mp4" : ".jpg");
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Attach at most ${MAX_FILES} files` }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  const urls: string[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `${file.name} is too large (max 25MB)` }, { status: 400 });
    }
    if (!isImage(file.type) && !isVideo(file.type) && !isHeic(file.type, file.name)) {
      return NextResponse.json({ error: `${file.name} isn't a supported photo or video` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Most browsers (everything but Safari) can't display HEIC inline, so try
    // converting to JPEG for wider compatibility — heicBufferToJpeg tries
    // sharp first, falls back to heic-convert for real photos that trip
    // sharp's libheif security limits, and only as a last resort do we store
    // the original file rather than failing the whole upload. A photo that
    // doesn't preview perfectly beats one that never sent.
    let filename: string;
    if (isHeic(file.type, file.name)) {
      try {
        const jpeg = await heicBufferToJpeg(buffer);
        filename = `${crypto.randomUUID()}.jpg`;
        await writeFile(path.join(uploadDir, filename), jpeg);
      } catch (err) {
        console.error(`HEIC conversion failed for ${file.name}, storing original:`, err);
        filename = `${crypto.randomUUID()}.heic`;
        await writeFile(path.join(uploadDir, filename), buffer);
      }
    } else {
      filename = `${crypto.randomUUID()}${extensionFor(file.type, file.name)}`;
      await writeFile(path.join(uploadDir, filename), buffer);
    }
    urls.push(`/api/files/${filename}`);
  }

  return NextResponse.json({ urls });
}
