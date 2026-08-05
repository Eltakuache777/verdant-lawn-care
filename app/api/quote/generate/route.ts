import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDesignConcept } from "@/lib/gemini";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

// Triggered by the /design/success page once Stripe confirms payment.
// Generates the paid-for concept count from the customer's reference photos.
//
// NOTE: this runs the whole batch synchronously in one request, which is fine
// on Render's persistent server (no serverless timeout) but would need to move
// to a background job/queue on a host with hard request time limits.

function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(url);
}

export async function POST(req: NextRequest) {
  const { quoteRequestId } = await req.json();
  if (!quoteRequestId) {
    return NextResponse.json({ error: "quoteRequestId is required" }, { status: 400 });
  }

  const quote = await prisma.quoteRequest.findUnique({ where: { id: quoteRequestId } });
  if (!quote) {
    return NextResponse.json({ error: "Quote request not found" }, { status: 404 });
  }

  if (quote.status === "generated" || quote.status === "generating") {
    return NextResponse.json(quote);
  }
  if (quote.status !== "paid") {
    return NextResponse.json({ error: "Payment not confirmed yet" }, { status: 400 });
  }
  if (quote.photoUrls.length === 0) {
    return NextResponse.json({ error: "No reference photo was provided" }, { status: 400 });
  }

  await prisma.quoteRequest.update({ where: { id: quoteRequestId }, data: { status: "generating" } });

  try {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    // photoUrls store whatever /api/upload returned, which is a /api/files/<name>
    // link (see that route for why) — the actual file always lives in
    // public/uploads regardless of URL prefix, so read it by filename.
    //
    // Only photos can seed image generation (not videos) — cycling through every
    // uploaded photo across the concept loop, instead of only ever using the
    // first one, means an order with multiple reference photos actually uses
    // all of them for variety.
    const referencePhotoUrls = quote.photoUrls.filter(isImageUrl);
    const photosToUse = referencePhotoUrls.length > 0 ? referencePhotoUrls : quote.photoUrls;

    const conceptUrls: string[] = [];
    for (let i = 0; i < quote.conceptCount; i++) {
      const referenceUrl = photosToUse[i % photosToUse.length];
      const inputImagePath = path.join(uploadDir, path.basename(referenceUrl));
      const inputImage = await readFile(inputImagePath);

      const resultBuffer = await generateDesignConcept(
        inputImage,
        quote.description ?? "a beautifully landscaped yard"
      );
      const filename = `${crypto.randomUUID()}.png`;
      await writeFile(path.join(uploadDir, filename), resultBuffer);
      conceptUrls.push(`/api/files/${filename}`);
    }

    const updated = await prisma.quoteRequest.update({
      where: { id: quoteRequestId },
      data: { conceptUrls, status: "generated" },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("Design generation failed:", err?.stack ?? err);
    await prisma.quoteRequest.update({ where: { id: quoteRequestId }, data: { status: "paid" } });
    return NextResponse.json({ error: err.message ?? "Generation failed" }, { status: 500 });
  }
}
