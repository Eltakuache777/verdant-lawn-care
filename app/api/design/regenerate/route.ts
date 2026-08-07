import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { staffSessionFrom } from "@/lib/auth";

// Lets someone re-roll a batch of concepts from the same photos/description
// if they didn't like the first outcome. Paid orders (amountPaid > 0) get
// charged a flat $20 for a fresh batch via Stripe; the free admin design
// tool (amountPaid === 0) stays free — skips checkout entirely, same as its
// original generation did.
const REGENERATE_PRICE = 20;

// TEMPORARY: matches PUBLIC_AI_DESIGN_ENABLED in app/design/page.tsx and
// app/api/checkout/route.ts — only the paid path is blocked, so the owner's
// free tool can keep regenerating while this is paused.
const PUBLIC_AI_DESIGN_ENABLED = false;

export async function POST(req: NextRequest) {
  const { quoteRequestId } = await req.json();
  if (!quoteRequestId) {
    return NextResponse.json({ error: "quoteRequestId is required" }, { status: 400 });
  }

  const original = await prisma.quoteRequest.findUnique({ where: { id: quoteRequestId } });
  if (!original) {
    return NextResponse.json({ error: "Quote request not found" }, { status: 404 });
  }
  if (original.status !== "generated") {
    return NextResponse.json({ error: "Original design isn't finished generating yet" }, { status: 400 });
  }

  const wasFree = original.amountPaid === 0;

  // Free regenerations mirror /api/design/admin-generate: they're for staff
  // use only, so require an actual staff session rather than trusting that
  // the ORIGINAL quote happened to be free. Without this, anyone who obtains
  // a free quoteRequestId (a shared link, a screenshot, etc.) could re-roll
  // unlimited free AI-generated batches at the business's real cost.
  if (wasFree) {
    const session = await staffSessionFrom(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!wasFree && !PUBLIC_AI_DESIGN_ENABLED) {
    return NextResponse.json(
      { error: "AI Design is temporarily unavailable while we improve results. Check back soon!" },
      { status: 503 }
    );
  }

  const fresh = await prisma.quoteRequest.create({
    data: {
      customerId: original.customerId,
      tier: original.tier,
      amountPaid: wasFree ? 0 : REGENERATE_PRICE,
      conceptCount: original.conceptCount,
      photoUrls: original.photoUrls,
      description: original.description,
      status: wasFree ? "paid" : "awaiting_payment",
    },
  });

  if (wasFree) {
    return NextResponse.json({ quoteRequestId: fresh.id, checkoutUrl: null });
  }

  const customer = await prisma.customer.findUnique({ where: { id: original.customerId } });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customer.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `New AI Design concepts (${fresh.conceptCount} concepts)`,
          },
          unit_amount: REGENERATE_PRICE * 100,
        },
        quantity: 1,
      },
    ],
    metadata: { quoteRequestId: fresh.id },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/design/success?qr=${fresh.id}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/design/success?qr=${original.id}`,
  });

  await prisma.quoteRequest.update({
    where: { id: fresh.id },
    data: { stripeSessionId: session.id },
  });

  return NextResponse.json({ quoteRequestId: fresh.id, checkoutUrl: session.url });
}
