import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Staff-only (see middleware.ts). Powers the admin Customers list.
export async function GET() {
  const customers = await prisma.customer.findMany({
    include: {
      recurringPlan: true,
      bookings: { select: { amountPaid: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = customers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    createdAt: c.createdAt,
    bookingCount: c.bookings.length,
    totalPaid: c.bookings.reduce((sum, b) => sum + (b.amountPaid ?? 0), 0),
    recurringPlan: c.recurringPlan,
    blocked: c.blocked,
  }));

  return NextResponse.json(result);
}
