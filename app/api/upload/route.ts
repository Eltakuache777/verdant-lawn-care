import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

// Stores customer-attached photos/videos of a project idea locally under public/uploads.
// Fine for local development; a real deployment (especially serverless hosts like Vercel)
// needs actual cloud storage (Vercel Blob, S3, Cloudinary, etc.) since local disk isn't
// persistent there — swap this out before going live.

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB
const MAX_FILES = 5;

function extensionFor(mimeType: string): string {
  return (
    {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "video/mp4": ".mp4",
      "video/quicktime": ".mov",
      "video/webm": ".webm",
    }[mimeType] ?? ""
  );
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
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `${file.name} is too large (max 25MB)` }, { status: 400 });
    }

    const filename = `${crypto.randomUUID()}${extensionFor(file.type)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);
    urls.push(`/uploads/${filename}`);
  }

  return NextResponse.json({ urls });
}
