import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeConceptCount } from "@/lib/designTiers";
import { staffSessionFrom } from "@/lib/auth";
import { z } from "zod";

// Staff-only (see middleware.ts), but free use is further restricted to
// whichever staff the owner has explicitly flagged via Worker.freeAiDesign
// (see /api/workers) — everyone else gets a clear 403 rather than silently
// spending real AI credits. Skips Stripe checkout entirely by creating the
// QuoteRequest already marked "paid" with amountPaid: 0. Tier defaults to
// "standard" (cheapest) rather than always the priciest, since this is also
// how flagged staff test prompt/settings changes. The rest of the pipeline
// (/design/success -> /api/quote/generate) is unchanged.
const BodySchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  photoUrls: z.array(z.string()).min(1),
  description: z.string().optional(),
  tier: z.enum(["standard", "better", "highest", "premium"]).default("standard"),
});

export async function POST(req: NextRequest) {
  const session = await staffSessionFrom(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const worker = await prisma.worker.findUnique({ where: { email: session.email } });
  if (!worker?.freeAiDesign) {
    return NextResponse.json(
      { error: "Free AI Design isn't enabled for your account — ask the owner to turn it on." },
      { status: 403 }
    );
  }

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { customerName, customerEmail, photoUrls, description, tier } = parsed.data;
  const conceptCount = computeConceptCount(tier, photoUrls);

  const customer = await prisma.customer.upsert({
    where: { email: customerEmail },
    update: { name: customerName },
    create: { name: customerName, email: customerEmail },
  });

  const quoteRequest = await prisma.quoteRequest.create({
    data: {
      customerId: customer.id,
      tier,
      amountPaid: 0,
      conceptCount,
      photoUrls,
      description,
      status: "paid",
      createdByStaffEmail: session.email,
    },
  });

  return NextResponse.json({ quoteRequestId: quoteRequest.id });
}
