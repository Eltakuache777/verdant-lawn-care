import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { SERVICE_FREQUENCY_VALUES } from "@/lib/recurringFrequency";
import { z } from "zod";

// A logged-in customer's standing cadence preference for Mowing/Bin Cleaning
// — separate from the admin-managed RecurringPlan (no pricing/auto-booking
// here, just what they'd like prefilled into future bookings).
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const customer = await prisma.customer.findUnique({
    where: { email: session.email },
    select: { mowingFrequency: true, binCleaningFrequency: true },
  });
  return NextResponse.json(customer ?? { mowingFrequency: null, binCleaningFrequency: null });
}

const freqOrNull = z
  .enum(SERVICE_FREQUENCY_VALUES as [string, ...string[]])
  .nullable()
  .optional();

const BodySchema = z.object({
  mowingFrequency: freqOrNull,
  binCleaningFrequency: freqOrNull,
});

export async function PATCH(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const customer = await prisma.customer.update({
    where: { email: session.email },
    data: parsed.data,
    select: { mowingFrequency: true, binCleaningFrequency: true },
  });
  return NextResponse.json(customer);
}
