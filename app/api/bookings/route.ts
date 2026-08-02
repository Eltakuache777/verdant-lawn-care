import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBookingConfirmation, sendNewBookingAlert } from "@/lib/email";
import { sendPushToEmails } from "@/lib/push";
import { SERVICE_FREQUENCY_VALUES } from "@/lib/recurringFrequency";
import { z } from "zod";

const EMERGENCY_FEE = 15; // adjust to $10-$20 as you decide
const ServiceFreq = z.enum(SERVICE_FREQUENCY_VALUES as [string, ...string[]]).optional();

const BookingSchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(1),
  services: z.array(z.string().min(1)).min(1),
  planFrequency: z.enum(["weekly", "biweekly", "monthly", "one_time"]).optional(),
  mowingFrequency: ServiceFreq,
  binCleaningFrequency: ServiceFreq,
  address: z.string().min(3),
  scheduledFor: z.string(), // ISO datetime from the date+time picker
  isEmergency: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const parsed = BookingSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const services = await prisma.service.findMany({ where: { name: { in: data.services } } });
  const foundNames = new Set(services.map((s) => s.name));
  const missing = data.services.filter((name) => !foundNames.has(name));
  if (missing.length > 0) {
    return NextResponse.json({ error: `Unknown service(s): ${missing.join(", ")}` }, { status: 400 });
  }

  const customer = await prisma.customer.upsert({
    where: { email: data.customerEmail },
    update: {
      name: data.customerName,
      phone: data.customerPhone,
      address: data.address,
      ...(data.mowingFrequency ? { mowingFrequency: data.mowingFrequency } : {}),
      ...(data.binCleaningFrequency ? { binCleaningFrequency: data.binCleaningFrequency } : {}),
    },
    create: {
      name: data.customerName,
      email: data.customerEmail,
      phone: data.customerPhone,
      address: data.address,
      mowingFrequency: data.mowingFrequency,
      binCleaningFrequency: data.binCleaningFrequency,
    },
  });

  const basePrice = services.reduce((sum, s) => sum + s.basePrice, 0);
  const emergencyFee = data.isEmergency ? EMERGENCY_FEE : 0;
  const totalPrice = basePrice + emergencyFee;

  const booking = await prisma.booking.create({
    data: {
      customerId: customer.id,
      services: data.services,
      planFrequency: data.planFrequency,
      mowingFrequency: data.mowingFrequency,
      binCleaningFrequency: data.binCleaningFrequency,
      address: data.address,
      scheduledFor: new Date(data.scheduledFor),
      isEmergency: data.isEmergency,
      emergencyFee,
      basePrice,
      totalPrice,
    },
  });

  try {
    await sendBookingConfirmation({
      customerName: customer.name,
      customerEmail: customer.email,
      services: booking.services,
      address: booking.address,
      scheduledFor: booking.scheduledFor,
      totalPrice: booking.totalPrice,
    });
  } catch (err) {
    console.error("Failed to send booking confirmation email:", err);
  }

  const staff = await prisma.worker.findMany({ select: { email: true } });
  try {
    await sendNewBookingAlert({
      staffEmails: staff.map((w) => w.email),
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      services: booking.services,
      address: booking.address,
      scheduledFor: booking.scheduledFor,
      totalPrice: booking.totalPrice,
    });
  } catch (err) {
    console.error("Failed to send new booking alert:", err);
  }

  await sendPushToEmails(staff.map((w) => w.email), {
    title: "New booking",
    body: `${customer.name} — ${booking.services.join(", ")}`,
    url: "/admin",
  });

  return NextResponse.json(booking, { status: 201 });
}

export async function GET() {
  // Powers the Admin schedule view.
  const bookings = await prisma.booking.findMany({
    include: { customer: true },
    orderBy: { scheduledFor: "asc" },
  });
  return NextResponse.json(bookings);
}
