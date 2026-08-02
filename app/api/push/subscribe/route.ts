import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { z } from "zod";

// Public — a logged-in session's email is used automatically; a guest who's
// only identified themselves in the chat widget passes their email directly
// (same trust level the chat widget itself already uses).
const BodySchema = z.object({
  email: z.string().email().optional(),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string(), auth: z.string() }),
  }),
});

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const email = (session?.email ?? parsed.data.email)?.toLowerCase().trim();
  if (!email) {
    return NextResponse.json({ error: "No email to subscribe" }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data.subscription;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { email, p256dh: keys.p256dh, auth: keys.auth },
    create: { email, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

// Unsubscribe (e.g. if the user later disables notifications).
export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json();
  if (typeof endpoint !== "string") return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  return NextResponse.json({ ok: true });
}
