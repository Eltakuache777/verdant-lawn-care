import { NextRequest, NextResponse } from "next/server";
import { runDueAppointmentReminders } from "@/lib/appointmentReminders";

// Called only by instrumentation.ts's internal timer via a loopback request
// (not a public browser flow) -- guarded by a shared secret so it can't be
// triggered from outside and abused to spam customers with emails.
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-internal-key");
  if (!process.env.SESSION_SECRET || key !== process.env.SESSION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDueAppointmentReminders();
  return NextResponse.json(result);
}
