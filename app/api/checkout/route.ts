import { NextRequest, NextResponse } from "next/server";
import { stripe, DESIGN_TIERS, DesignTierKey } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { tier, customerEmail, customerName, photoUrls, description } = await req.json();

  if (!(tier in DESIGN_TIERS)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }
  const chosen = DESIGN_TIERS[tier as DesignTierKey];

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
      conceptCount: chosen.concepts,
      photoUrls: photoUrls ?? [],
      description,
      status: "awaiting_payment",
    },
  });

  // Real Stripe Checkout session — this is the actual $50/$60/$100 charge.
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${chosen.label} AI Design Package (${chosen.concepts} concepts)`,
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
