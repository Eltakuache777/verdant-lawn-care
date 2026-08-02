import { NextResponse } from "next/server";
import { runDueRecurringPlans } from "@/lib/recurringPlans";

// Staff-only (see middleware.ts). Called automatically when the admin
// dashboard loads (see AdminShell.tsx) to catch up any recurring plans that
// have come due since the app was last opened.
export async function POST() {
  const result = await runDueRecurringPlans();
  return NextResponse.json(result);
}
