import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { staffSessionFrom } from "@/lib/auth";
import { z } from "zod";

// Marks notifications read for the calling staff member only -- readBy is
// shared across everyone who can see a broadcast row, so this appends
// rather than overwrites.
const BodySchema = z.object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() });

export async function POST(req: NextRequest) {
  const session = await staffSessionFrom(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const targets = parsed.data.all
    ? await prisma.notification.findMany({
        where: {
          OR: [{ recipientEmails: { isEmpty: true } }, { recipientEmails: { has: session.email } }],
          NOT: { readBy: { has: session.email } },
        },
        select: { id: true },
      })
    : (parsed.data.ids ?? []).map((id) => ({ id }));

  await Promise.all(
    targets.map(async ({ id }) => {
      const existing = await prisma.notification.findUnique({ where: { id }, select: { readBy: true } });
      if (existing && !existing.readBy.includes(session.email)) {
        await prisma.notification.update({ where: { id }, data: { readBy: { push: session.email } } });
      }
    })
  );

  return NextResponse.json({ ok: true });
}
