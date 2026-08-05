import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// A logged-in customer's own past AI Design orders — shown as a "My AI
// Designs" folder on the account page. Works even for designs bought as a
// guest before they had an account, since QuoteRequest is linked by the
// Customer record (keyed by email), not by who was logged in at the time.
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.customer.findUnique({ where: { email: session.email } });
  if (!customer) {
    return NextResponse.json([]);
  }

  const designs = await prisma.quoteRequest.findMany({
    where: { customerId: customer.id, status: "generated" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      tier: true,
      conceptCount: true,
      conceptUrls: true,
      conceptVideoUrls: true,
      description: true,
      createdAt: true,
    },
  });
  return NextResponse.json(designs);
}
