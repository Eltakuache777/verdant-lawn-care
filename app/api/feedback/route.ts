import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { message, email, page } = await req.json();
  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Feedback message is required" }, { status: 400 });
  }
  const feedback = await prisma.feedback.create({
    data: {
      message: message.trim().slice(0, 4000),
      email: typeof email === "string" && email.trim() ? email.trim() : null,
      page: typeof page === "string" ? page.slice(0, 200) : null,
    },
  });
  return NextResponse.json(feedback);
}

export async function GET() {
  // Auth enforced by middleware.ts (staff only)
  const feedback = await prisma.feedback.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(feedback);
}
