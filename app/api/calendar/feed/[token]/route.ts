import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailFromCalendarToken, generateIcsFeed } from "@/lib/calendarFeed";

// Not staff-session gated (see middleware.ts) -- the token itself IS the
// access control, same trust model as a private share link, so calendar
// apps (which can't do an interactive login) can just fetch this URL
// directly and keep it refreshed on their own schedule.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const email = await emailFromCalendarToken(params.token);
  if (!email) {
    return NextResponse.json({ error: "Invalid or expired calendar link" }, { status: 401 });
  }
  const worker = await prisma.worker.findUnique({ where: { email } });
  if (!worker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bookings = await prisma.booking.findMany({
    where: { scheduledFor: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    include: { customer: { select: { name: true } } },
    orderBy: { scheduledFor: "asc" },
  });

  const ics = generateIcsFeed(
    bookings.map((b) => ({
      id: b.id,
      customerName: b.customer.name,
      services: b.services,
      address: b.address,
      scheduledFor: b.scheduledFor,
      status: b.status,
      assignedWorkerName: b.assignedWorkerName,
    }))
  );

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="verdant-schedule.ics"',
      "Cache-Control": "no-cache",
    },
  });
}
