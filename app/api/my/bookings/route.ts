import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// A logged-in customer's own booking history — powers the calendar on their account page.
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const customer = await prisma.customer.findUnique({ where: { email: session.email } });
  if (!customer) return NextResponse.json([]);

  const bookings = await prisma.booking.findMany({
    where: { customerId: customer.id },
    orderBy: { scheduledFor: "asc" },
  });
  return NextResponse.json(bookings);
}
