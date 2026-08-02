import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { z } from "zod";

// Lets a logged-in customer see their own recurring plan (price is set by
// staff and read-only here) and change how often they're serviced.
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const customer = await prisma.customer.findUnique({
    where: { email: session.email },
    include: { recurringPlan: true },
  });
  return NextResponse.json({ recurringPlan: customer?.recurringPlan ?? null });
}

const BodySchema = z.object({
  frequency: z.enum(["weekly", "biweekly", "every_3_weeks", "monthly"]),
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
  const customer = await prisma.customer.findUnique({
    where: { email: session.email },
    include: { recurringPlan: true },
  });
  if (!customer?.recurringPlan) {
    return NextResponse.json({ error: "No recurring plan on file" }, { status: 404 });
  }
  const plan = await prisma.recurringPlan.update({
    where: { customerId: customer.id },
    data: { frequency: parsed.data.frequency },
  });
  return NextResponse.json(plan);
}
