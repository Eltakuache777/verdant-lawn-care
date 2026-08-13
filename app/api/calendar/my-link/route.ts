import { NextRequest, NextResponse } from "next/server";
import { staffSessionFrom } from "@/lib/auth";
import { calendarTokenFor } from "@/lib/calendarFeed";

// Staff-only (see middleware.ts). Hands back the current staff member's own
// calendar feed link -- computed from their session, never from a client-
// supplied email, so nobody can fetch another person's link this way.
export async function GET(req: NextRequest) {
  const session = await staffSessionFrom(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await calendarTokenFor(session.email);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://verdantlawn.care";
  return NextResponse.json({ url: `${appUrl}/api/calendar/feed/${token}` });
}
