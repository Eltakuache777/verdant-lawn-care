import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Admin-only (see middleware.ts): lists every customer conversation with a preview
// of the most recent message, so you can see who's waiting on a reply.
export async function GET() {
  const messages = await prisma.chatMessage.findMany({
    orderBy: { createdAt: "desc" },
  });

  const threads = new Map<
    string,
    { customerEmail: string; customerName: string; lastMessage: string; lastSender: string; lastAt: string }
  >();

  for (const m of messages) {
    if (!threads.has(m.customerEmail)) {
      threads.set(m.customerEmail, {
        customerEmail: m.customerEmail,
        customerName: m.customerName,
        lastMessage: m.body,
        lastSender: m.sender,
        lastAt: m.createdAt.toISOString(),
      });
    }
  }

  return NextResponse.json(Array.from(threads.values()));
}
