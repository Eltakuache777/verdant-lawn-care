import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Staff-only (see middleware.ts). RepGrid's leaderboard includes hours
// worked/break time, which would need a time-clock feature this app
// doesn't have -- this covers the door-knocking side: counts and a
// booked/knocked conversion rate, built straight from the CanvassStatusEvent
// history (see /api/canvass/houses/[id]).
export async function GET() {
  const events = await prisma.canvassStatusEvent.findMany({
    select: { workerEmail: true, workerName: true, status: true },
  });

  const byWorker = new Map<
    string,
    { workerEmail: string; workerName: string | null; knocks: number; booked: number; completed: number; denied: number }
  >();

  for (const e of events) {
    if (!byWorker.has(e.workerEmail)) {
      byWorker.set(e.workerEmail, {
        workerEmail: e.workerEmail,
        workerName: e.workerName,
        knocks: 0,
        booked: 0,
        completed: 0,
        denied: 0,
      });
    }
    const row = byWorker.get(e.workerEmail)!;
    if (e.status !== "not_knocked") row.knocks++;
    if (e.status === "booked") row.booked++;
    if (e.status === "completed") row.completed++;
    if (e.status === "denied") row.denied++;
  }

  const rows = Array.from(byWorker.values())
    .map((r) => ({ ...r, conversionRate: r.knocks > 0 ? r.booked / r.knocks : 0 }))
    .sort((a, b) => b.booked - a.booked || b.knocks - a.knocks);

  return NextResponse.json(rows);
}
