import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToEmail } from "@/lib/push";
import { z } from "zod";

// Admin-only (see middleware.ts): send a reply into an existing customer conversation.
const ReplySchema = z.object({
  customerEmail: z.string().email(),
  customerName: z.string().min(1),
  body: z.string().min(1).max(2000),
  attachmentUrls: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = ReplySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const message = await prisma.chatMessage.create({
    data: {
      customerEmail: parsed.data.customerEmail,
      customerName: parsed.data.customerName,
      sender: "admin",
      body: parsed.data.body,
      attachmentUrls: parsed.data.attachmentUrls ?? [],
    },
  });

  await sendPushToEmail(parsed.data.customerEmail, {
    title: "New message from Verdant Lawn Care",
    body: parsed.data.body,
  });

  return NextResponse.json(message, { status: 201 });
}
