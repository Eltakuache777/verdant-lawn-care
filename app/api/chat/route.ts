import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToEmails } from "@/lib/push";
import { isCustomerBlocked, BLOCKED_CUSTOMER_MESSAGE } from "@/lib/blockedCustomer";
import { z } from "zod";

// Public: a customer's own conversation, looked up by the email they provide.
// This is the same trust model as bookings (email is customer-supplied, not authenticated).

const MessageSchema = z.object({
  customerEmail: z.string().email(),
  customerName: z.string().min(1),
  body: z.string().min(1).max(2000),
  attachmentUrls: z.array(z.string()).max(5).optional(),
});

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }
  const messages = await prisma.chatMessage.findMany({
    where: { customerEmail: email },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  const parsed = MessageSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (await isCustomerBlocked(parsed.data.customerEmail)) {
    return NextResponse.json({ error: BLOCKED_CUSTOMER_MESSAGE }, { status: 403 });
  }
  const message = await prisma.chatMessage.create({
    data: {
      customerEmail: parsed.data.customerEmail,
      customerName: parsed.data.customerName,
      sender: "customer",
      body: parsed.data.body,
      attachmentUrls: parsed.data.attachmentUrls ?? [],
    },
  });

  const staff = await prisma.worker.findMany({ select: { email: true } });
  await sendPushToEmails(staff.map((w) => w.email), {
    title: `New message from ${parsed.data.customerName}`,
    body: parsed.data.body,
    url: "/admin",
  });

  return NextResponse.json(message, { status: 201 });
}
