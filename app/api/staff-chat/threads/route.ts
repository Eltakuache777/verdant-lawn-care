import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffSessionFrom } from "@/lib/auth";
import { z } from "zod";

// Staff-only (see middleware.ts). Lists the internal team-chat threads the
// current staff member belongs to, with a preview of the last message.
export async function GET(req: NextRequest) {
  const session = await staffSessionFrom(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const threads = await prisma.staffThread.findMany({
    where: { members: { some: { workerEmail: session.email } } },
    include: {
      members: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const result = threads
    .map((t) => {
      const others = t.members.filter((m) => m.workerEmail !== session.email);
      const displayName = t.isGroup ? t.name || others.map((o) => o.workerName || o.workerEmail).join(", ") : others[0]?.workerName || others[0]?.workerEmail || "Unknown";
      const last = t.messages[0];
      return {
        id: t.id,
        isGroup: t.isGroup,
        name: displayName,
        memberEmails: t.members.map((m) => m.workerEmail),
        lastMessage: last?.body ?? "",
        lastSenderEmail: last?.senderEmail ?? "",
        lastAt: last?.createdAt ?? t.createdAt,
      };
    })
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());

  return NextResponse.json(result);
}

const CreateSchema = z.object({
  memberEmails: z.array(z.string().email()).min(1),
  name: z.string().max(100).optional(),
});

// Creates a new thread (1:1 if exactly one other member and no name given,
// otherwise a group). Reuses an existing 1:1 thread with the same two people
// instead of creating a duplicate.
export async function POST(req: NextRequest) {
  const session = await staffSessionFrom(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const otherEmails = Array.from(new Set(parsed.data.memberEmails.filter((e) => e !== session.email)));
  if (otherEmails.length === 0) {
    return NextResponse.json({ error: "Pick at least one other person" }, { status: 400 });
  }
  const isGroup = otherEmails.length > 1 || !!parsed.data.name;

  if (!isGroup) {
    const existing = await prisma.staffThread.findFirst({
      where: {
        isGroup: false,
        AND: [
          { members: { some: { workerEmail: session.email } } },
          { members: { some: { workerEmail: otherEmails[0] } } },
        ],
      },
      include: { members: true },
    });
    if (existing && existing.members.length === 2) {
      return NextResponse.json(existing);
    }
  }

  const allEmails = [session.email, ...otherEmails];
  const workers = await prisma.worker.findMany({ where: { email: { in: allEmails } } });
  const nameFor = (email: string) => workers.find((w) => w.email === email)?.name ?? email;

  const thread = await prisma.staffThread.create({
    data: {
      isGroup,
      name: parsed.data.name,
      members: {
        create: allEmails.map((email) => ({ workerEmail: email, workerName: nameFor(email) })),
      },
    },
    include: { members: true },
  });

  return NextResponse.json(thread, { status: 201 });
}
