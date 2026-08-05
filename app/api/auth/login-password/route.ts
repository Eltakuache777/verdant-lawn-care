import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { roleForEmail } from "@/lib/loginCode";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import { isCustomerBlocked, BLOCKED_CUSTOMER_MESSAGE } from "@/lib/blockedCustomer";
import { z } from "zod";

const BodySchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const role = await roleForEmail(email);
  if (role === "customer" && (await isCustomerBlocked(email))) {
    return NextResponse.json({ error: BLOCKED_CUSTOMER_MESSAGE }, { status: 403 });
  }

  let passwordHash: string | null | undefined;
  let name: string | undefined;
  if (role === "admin" || role === "worker") {
    const worker = await prisma.worker.findUnique({ where: { email } });
    passwordHash = worker?.passwordHash;
    name = worker?.name ?? undefined;
  } else {
    const customer = await prisma.customer.findUnique({ where: { email } });
    passwordHash = customer?.passwordHash;
    name = customer?.name;
  }

  if (!passwordHash) {
    return NextResponse.json({ error: "No password set for this account yet — use a login code instead." }, { status: 401 });
  }
  const ok = await verifyPassword(parsed.data.password, passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const token = await createSessionToken({ email, role, name, exp: Date.now() + THIRTY_DAYS_MS });
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS_MS / 1000,
  });
  return res;
}
