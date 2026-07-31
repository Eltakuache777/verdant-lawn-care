import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DESIGN_TIERS } from "@/lib/designTiers";
import { z } from "zod";

// Admin-only (see middleware.ts): the owner's own use of the AI design feature
// is free and always runs at the highest tier — skips Stripe checkout entirely
// by creating the QuoteRequest already marked "paid" with amountPaid: 0. The
// rest of the pipeline (/design/success -> /api/quote/generate) is unchanged.
const BodySchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  photoUrls: z.array(z.string()).min(1),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { customerName, customerEmail, photoUrls, description } = parsed.data;
  const chosen = DESIGN_TIERS.highest;

  const customer = await prisma.customer.upsert({
    where: { email: customerEmail },
    update: { name: customerName },
    create: { name: customerName, email: customerEmail },
  });

  const quoteRequest = await prisma.quoteRequest.create({
    data: {
      customerId: customer.id,
      tier: "highest",
      amountPaid: 0,
      conceptCount: chosen.concepts,
      photoUrls,
      description,
      status: "paid",
    },
  });

  return NextResponse.json({ quoteRequestId: quoteRequest.id });
}
