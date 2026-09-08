import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffSessionFrom } from "@/lib/auth";

// Staff-only feed for the notification bell: broadcasts (empty
// recipientEmails) plus anything targeted at this specific staff member.
export async function GET(req: NextRequest) {
  const session = await staffSessionFrom(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    where: {
      OR: [{ recipientEmails: { isEmpty: true } }, { recipientEmails: { has: session.email } }],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = notifications.filter((n) => !n.readBy.includes(session.email)).length;

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      url: n.url,
      createdAt: n.createdAt,
      read: n.readBy.includes(session.email),
    })),
    unreadCount,
  });
}
