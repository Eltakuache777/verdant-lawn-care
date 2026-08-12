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

const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25MB
// The Render instance this runs on has 512MB total RAM, and each file gets
// fully buffered in memory (Buffer.from(await file.arrayBuffer())) before
// it's written to disk — a 300MB video buffer plus Next.js's own baseline
// memory use blew past that and got OOM-killed by the OS (crash loop, no
// error logged, since a SIGKILL gives the process no chance to log anything).
// 75MB comfortably covers a 20-30 second phone clip while leaving real
// headroom. Raise this only alongside a real RAM increase on the hosting plan.
const MAX_VIDEO_BYTES = 75 * 1024 * 1024; // 75MB
// Voice messages are short (a couple minutes at most, recording is capped
// client-side) — 10MB is generous headroom for that.
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB
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
function isAudio(mimeType: string) {
  return mimeType.startsWith("audio/");
}
function isHeic(mimeType: string, filename: string) {
  return mimeType === "image/heic" || mimeType === "image/heif" || /\.hei[cf]$/i.test(filename);
}

// Voice recordings always get one of these extensions regardless of the
// browser's exact container (webm/ogg/mp4) — deliberately distinct from
// video extensions (.mp4/.mov/.webm) so isVideoUrl() checks elsewhere never
// mistake a voice message for a video clip and try to render it as one.
function audioExtensionFor(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return ".m4a";
  if (mimeType.includes("ogg")) return ".oga";
  if (mimeType.includes("wav")) return ".wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return ".mp3";
  return ".weba"; // audio/webm — the common case (Chrome/Firefox MediaRecorder default)
}

function extensionFor(mimeType: string, filename: string): string {
  if (isAudio(mimeType)) return audioExtensionFor(mimeType);
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
    const maxBytes = isVideo(file.type) ? MAX_VIDEO_BYTES : isAudio(file.type) ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `${file.name} is too large (max ${Math.round(maxBytes / (1024 * 1024))}MB)` },
        { status: 400 }
      );
    }
    if (!isImage(file.type) && !isVideo(file.type) && !isAudio(file.type) && !isHeic(file.type, file.name)) {
      return NextResponse.json({ error: `${file.name} isn't a supported photo, video, or voice message` }, { status: 400 });
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
