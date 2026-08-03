import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffSessionFrom } from "@/lib/auth";

async function assertMember(threadId: string, email: string) {
  const member = await prisma.staffThreadMember.findUnique({
    where: { threadId_workerEmail: { threadId, workerEmail: email } },
  });
  return !!member;
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; messageId: string } }) {
  const session = await staffSessionFrom(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await assertMember(params.id, session.email))) {
    return NextResponse.json({ error: "Not a member of this thread" }, { status: 403 });
  }
  const message = await prisma.staffMessage.findUnique({ where: { id: params.messageId } });
  if (!message || message.threadId !== params.id) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }
  await prisma.staffMessage.delete({ where: { id: params.messageId } });
  return NextResponse.json({ ok: true });
}
