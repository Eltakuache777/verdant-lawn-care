import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/auth";
import { z } from "zod";

// Staff-only (see middleware.ts). Powers the customer detail panel in admin.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      recurringPlan: true,
      bookings: { orderBy: { scheduledFor: "desc" } },
    },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(customer);
}

const RecurringPlanSchema = z.object({
  services: z.array(z.string().min(1)).min(1),
  address: z.string().min(3),
  frequency: z.enum(["weekly", "biweekly", "every_3_weeks", "monthly"]),
  pricePerVisit: z.number().min(0),
  nextDate: z.string(), // ISO date for the first/next scheduled visit
});

// Set or update a customer's recurring lawn-care plan and custom price.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = RecurringPlanSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { services, address, frequency, pricePerVisit, nextDate } = parsed.data;

  const plan = await prisma.recurringPlan.upsert({
    where: { customerId: params.id },
    update: { services, address, frequency, pricePerVisit, nextDate: new Date(nextDate), active: true },
    create: {
      customerId: params.id,
      services,
      address,
      frequency,
      pricePerVisit,
      nextDate: new Date(nextDate),
    },
  });
  return NextResponse.json(plan);
}

const BlockSchema = z.object({ blocked: z.boolean() });

// Block/unblock a customer from logging in, booking, or messaging — admin
// only (see isAdminRequest), same tier of action as deleting a portfolio
// item or a review, checked here since middleware.ts only enforces "staff"
// (admin or worker) for /api/customers/:id as a whole.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const parsed = BlockSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const customer = await prisma.customer.update({
    where: { id: params.id },
    data: { blocked: parsed.data.blocked },
  });
  return NextResponse.json(customer);
}

// Cancel (deactivate) a customer's recurring plan.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.recurringPlan.findUnique({ where: { customerId: params.id } });
  if (!existing) return NextResponse.json({ error: "No recurring plan" }, { status: 404 });
  const plan = await prisma.recurringPlan.update({ where: { customerId: params.id }, data: { active: false } });
  return NextResponse.json(plan);
}
