import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDesignConcept, describeYardVideo, describeConceptMaterials } from "@/lib/gemini";
import { generateDesignVideo } from "@/lib/veo";
import { DESIGN_TIERS, DesignTierKey, isImageUrl, isVideoUrl, videoMimeType } from "@/lib/designTiers";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

// Triggered by the /design/success page once Stripe confirms payment.
// Generates conceptsPerPhoto designs from EACH uploaded reference photo (see
// lib/designTiers.ts) plus the tier's video count/length.
//
// NOTE: this runs the whole batch synchronously in one request, which is fine
// on Render's persistent server (no serverless timeout) but would need to move
// to a background job/queue on a host with hard request time limits —
// especially now that a Premium-tier order can take several minutes just for
// its extended video.

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

  const tierInfo = DESIGN_TIERS[quote.tier as DesignTierKey];
  if (!tierInfo) {
    return NextResponse.json({ error: `Unknown tier: ${quote.tier}` }, { status: 400 });
  }

  await prisma.quoteRequest.update({ where: { id: quoteRequestId }, data: { status: "generating" } });

  try {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    // photoUrls store whatever /api/upload returned, which is a /api/files/<name>
    // link (see that route for why) — the actual file always lives in
    // public/uploads regardless of URL prefix, so read it by filename.
    //
    // Only photos seed image generation — EVERY uploaded photo gets its own
    // full set of conceptsPerPhoto designs generated from it specifically,
    // not spread/cycled across photos. A video alone can't seed a design
    // (the image editor needs a still photo to edit), so require at least
    // one real photo rather than silently feeding it raw video bytes.
    const referencePhotoUrls = quote.photoUrls.filter(isImageUrl);
    if (referencePhotoUrls.length === 0) {
      await prisma.quoteRequest.update({ where: { id: quoteRequestId }, data: { status: "paid" } });
      return NextResponse.json(
        { error: "At least one photo is required to generate a design — a video alone isn't enough." },
        { status: 400 }
      );
    }
    const photosToUse = referencePhotoUrls;

    const conceptUrls: string[] = [];
    const conceptVideoUrls: string[] = [];
    const conceptMaterials: string[] = [];
    let description = quote.description ?? "a beautifully landscaped yard";

    // Any attached video isn't used to seed images directly, but it's still
    // put to use: have Gemini "watch" it and describe the yard, then fold
    // that into the prompt so the design generator understands the space
    // better. A failed description shouldn't sink the whole order — same
    // treatment as a failed video clip below.
    const videoUrls = quote.photoUrls.filter(isVideoUrl);
    if (videoUrls.length > 0) {
      const videoDescriptions: string[] = [];
      for (const videoUrl of videoUrls) {
        try {
          const videoPath = path.join(uploadDir, path.basename(videoUrl));
          const videoDescription = await describeYardVideo(videoPath, videoMimeType(videoUrl));
          videoDescriptions.push(videoDescription);
        } catch (videoDescErr) {
          console.error(`Video description failed for ${videoUrl}:`, videoDescErr);
        }
      }
      if (videoDescriptions.length > 0) {
        description = `${description}\n\nAdditional context from a video walkthrough of the yard: ${videoDescriptions.join(" ")}`;
      }
    }

    let conceptIndex = 0;

    for (const referenceUrl of photosToUse) {
      const inputImagePath = path.join(uploadDir, path.basename(referenceUrl));
      const inputImage = await readFile(inputImagePath);

      for (let n = 0; n < tierInfo.conceptsPerPhoto; n++) {
        const resultBuffer = await generateDesignConcept(inputImage, description);
        const filename = `${crypto.randomUUID()}.png`;
        await writeFile(path.join(uploadDir, filename), resultBuffer);
        conceptUrls.push(`/api/files/${filename}`);

        try {
          conceptMaterials.push(await describeConceptMaterials(resultBuffer));
        } catch (materialsErr) {
          // Same treatment as a failed video clip -- don't sink the whole
          // concept over this, just push an empty entry so the array stays
          // aligned index-wise with conceptUrls.
          console.error(`Materials description failed for concept ${conceptIndex}:`, materialsErr);
          conceptMaterials.push("");
        }

        if (conceptIndex < tierInfo.videoCount) {
          try {
            const videoBuffer = await generateDesignVideo(resultBuffer, description, tierInfo.videoDurationSeconds);
            const videoFilename = `${crypto.randomUUID()}.mp4`;
            await writeFile(path.join(uploadDir, videoFilename), videoBuffer);
            conceptVideoUrls.push(`/api/files/${videoFilename}`);
          } catch (videoErr) {
            // A failed video clip shouldn't sink the whole order — the still image concept is still delivered.
            console.error(`Video generation failed for concept ${conceptIndex}:`, videoErr);
          }
        }
        conceptIndex++;
      }
    }

    const updated = await prisma.quoteRequest.update({
      where: { id: quoteRequestId },
      data: { conceptUrls, conceptVideoUrls, conceptMaterials, status: "generated" },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("Design generation failed:", err?.stack ?? err);
    await prisma.quoteRequest.update({ where: { id: quoteRequestId }, data: { status: "paid" } });
    return NextResponse.json({ error: err.message ?? "Generation failed" }, { status: 500 });
  }
}
