import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

// This is what makes payment "real": Stripe calls THIS endpoint (not the browser)
// to confirm money actually landed, so no one can fake a paid status client-side.
// You register this URL with Stripe when you set up the webhook — see SETUP.md.

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature verification failed` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const quoteRequestId = session.metadata?.quoteRequestId;
    if (quoteRequestId) {
      await prisma.quoteRequest.update({
        where: { id: quoteRequestId },
        data: { status: "paid" },
      });
      // Actual generation is triggered by /design/success (via /api/quote/generate)
      // once the customer lands there — keeps this webhook fast, since generating
      // a full concept batch can take a while.
    }
  }

  return NextResponse.json({ received: true });
}
