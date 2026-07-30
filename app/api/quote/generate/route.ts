import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDesignConcept } from "@/lib/stability";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

// Triggered by the /design/success page once Stripe confirms payment.
// Generates the paid-for concept count from the customer's reference photo.
//
// NOTE: this runs the whole batch synchronously in one request, which is fine
// locally but risks timing out on serverless hosts for the larger tiers (15/50
// concepts) — a real deployment should move this to a background job/queue.

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
    const inputImagePath = path.join(process.cwd(), "public", quote.photoUrls[0]);
    const inputImage = await readFile(inputImagePath);

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const conceptUrls: string[] = [];
    for (let i = 0; i < quote.conceptCount; i++) {
      const resultBuffer = await generateDesignConcept(
        inputImage,
        quote.description ?? "a beautifully landscaped yard"
      );
      const filename = `${crypto.randomUUID()}.png`;
      await writeFile(path.join(uploadDir, filename), resultBuffer);
      conceptUrls.push(`/uploads/${filename}`);
    }

    const updated = await prisma.quoteRequest.update({
      where: { id: quoteRequestId },
      data: { conceptUrls, status: "generated" },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    await prisma.quoteRequest.update({ where: { id: quoteRequestId }, data: { status: "paid" } });
    return NextResponse.json({ error: err.message ?? "Generation failed" }, { status: 500 });
  }
}
