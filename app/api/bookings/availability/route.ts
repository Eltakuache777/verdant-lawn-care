import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public endpoint: shows customers how busy each day is without exposing
// any customer names, emails, or addresses — just counts and times.

export async function GET() {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 30);

  const bookings = await prisma.booking.findMany({
    where: { scheduledFor: { gte: now, lte: horizon } },
    select: { scheduledFor: true },
    orderBy: { scheduledFor: "asc" },
  });

  const byDate = new Map<string, string[]>();
  for (const b of bookings) {
    const date = b.scheduledFor.toISOString().slice(0, 10); // YYYY-MM-DD
    const time = b.scheduledFor.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(time);
  }

  const days = Array.from(byDate.entries()).map(([date, times]) => ({
    date,
    count: times.length,
    times,
  }));

  return NextResponse.json({ days });
}
