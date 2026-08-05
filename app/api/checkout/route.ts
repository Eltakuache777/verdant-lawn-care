import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { DESIGN_TIERS, DesignTierKey, computeConceptCount, isImageUrl } from "@/lib/designTiers";
import { prisma } from "@/lib/prisma";

// TEMPORARY: AI Design is paused for the public while results quality is
// being dialed in. The owner's own free tool (a separate route,
// /api/design/admin-generate) is unaffected. Remove this block to reopen it.
const PUBLIC_AI_DESIGN_ENABLED = false;

export async function POST(req: NextRequest) {
  if (!PUBLIC_AI_DESIGN_ENABLED) {
    return NextResponse.json(
      { error: "AI Design is temporarily unavailable while we improve results. Check back soon!" },
      { status: 503 }
    );
  }

  const { tier, customerEmail, customerName, photoUrls, description } = await req.json();

  if (!(tier in DESIGN_TIERS)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }
  if (!(photoUrls ?? []).some(isImageUrl)) {
    return NextResponse.json(
      { error: "At least one photo is required — a video alone isn't enough to generate a design from." },
      { status: 400 }
    );
  }
  const chosen = DESIGN_TIERS[tier as DesignTierKey];
  const conceptCount = computeConceptCount(tier as DesignTierKey, photoUrls ?? []);

  const customer = await prisma.customer.upsert({
    where: { email: customerEmail },
    update: { name: customerName },
    create: { name: customerName, email: customerEmail },
  });

  const quoteRequest = await prisma.quoteRequest.create({
    data: {
      customerId: customer.id,
      tier,
      amountPaid: chosen.price,
      conceptCount,
      photoUrls: photoUrls ?? [],
      description,
      status: "awaiting_payment",
    },
  });

  // Real Stripe Checkout session — this is the actual charge.
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${chosen.label} AI Design Package (${conceptCount} concepts)`,
          },
          unit_amount: chosen.price * 100, // Stripe uses cents
        },
        quantity: 1,
      },
    ],
    metadata: { quoteRequestId: quoteRequest.id },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/design/success?qr=${quoteRequest.id}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/design`,
  });

  await prisma.quoteRequest.update({
    where: { id: quoteRequest.id },
    data: { stripeSessionId: session.id },
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
