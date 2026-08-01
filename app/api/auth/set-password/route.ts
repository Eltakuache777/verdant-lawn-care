import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { z } from "zod";

// Requires an active session (from email-code verification, or an existing
// password) — lets someone set/change the password on their own account.
// If they already have one, the current password must be provided and match.
const BodySchema = z.object({
  currentPassword: z.string().optional(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const isStaff = session.role === "admin" || session.role === "worker";
  const existing = isStaff
    ? await prisma.worker.findUnique({ where: { email: session.email } })
    : await prisma.customer.findUnique({ where: { email: session.email } });

  if (existing?.passwordHash) {
    if (!parsed.data.currentPassword) {
      return NextResponse.json({ error: "Enter your current password to change it." }, { status: 400 });
    }
    const ok = await verifyPassword(parsed.data.currentPassword, existing.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }
  }

  const passwordHash = await hashPassword(parsed.data.password);
  if (isStaff) {
    await prisma.worker.update({ where: { email: session.email }, data: { passwordHash } });
  } else {
    await prisma.customer.update({ where: { email: session.email }, data: { passwordHash } });
  }

  return NextResponse.json({ ok: true });
}
