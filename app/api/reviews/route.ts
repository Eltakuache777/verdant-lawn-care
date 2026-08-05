import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { z } from "zod";

// Public: anyone can read reviews (shown on /reviews and folded into SEO
// structured data). Leaving one requires a logged-in customer account,
// enforced here rather than in middleware.ts since only this one method
// needs it, not the whole route.

export async function GET() {
  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
  });
  const count = reviews.length;
  const average = count > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;
  return NextResponse.json({ reviews, average, count });
}

const BodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1).max(1000),
  service: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Log in as a customer to leave a review" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { email: session.email } });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const review = await prisma.review.create({
    data: {
      customerId: customer.id,
      customerName: customer.name,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      service: parsed.data.service,
    },
  });
  return NextResponse.json(review, { status: 201 });
}
