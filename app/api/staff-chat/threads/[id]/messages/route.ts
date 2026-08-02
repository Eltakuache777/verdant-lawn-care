import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffSessionFrom } from "@/lib/auth";
import { sendPushToEmails } from "@/lib/push";
import { z } from "zod";

async function assertMember(threadId: string, email: string) {
  const member = await prisma.staffThreadMember.findUnique({
    where: { threadId_workerEmail: { threadId, workerEmail: email } },
  });
  return !!member;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await staffSessionFrom(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await assertMember(params.id, session.email))) {
    return NextResponse.json({ error: "Not a member of this thread" }, { status: 403 });
  }
  const messages = await prisma.staffMessage.findMany({
    where: { threadId: params.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(messages);
}

const BodySchema = z.object({
  body: z.string().max(4000),
  attachmentUrls: z.array(z.string().url()).default([]),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await staffSessionFrom(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await assertMember(params.id, session.email))) {
    return NextResponse.json({ error: "Not a member of this thread" }, { status: 403 });
  }
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (!parsed.data.body.trim() && parsed.data.attachmentUrls.length === 0) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const message = await prisma.staffMessage.create({
    data: {
      threadId: params.id,
      senderEmail: session.email,
      senderName: session.name,
      body: parsed.data.body,
      attachmentUrls: parsed.data.attachmentUrls,
    },
  });

  const members = await prisma.staffThreadMember.findMany({ where: { threadId: params.id } });
  const others = members.map((m) => m.workerEmail).filter((email) => email !== session.email);
  await sendPushToEmails(others, {
    title: `${session.name || session.email}`,
    body: parsed.data.body,
    url: "/admin",
  });

  return NextResponse.json(message, { status: 201 });
}
