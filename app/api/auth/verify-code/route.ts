import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLoginCode, roleForEmail } from "@/lib/loginCode";
import { hashPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import { z } from "zod";

const BodySchema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(6),
  name: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(6).optional(),
});

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const ok = await verifyLoginCode(email, parsed.data.code);
  if (!ok) {
    return NextResponse.json({ error: "That code is invalid or has expired." }, { status: 401 });
  }

  const role = await roleForEmail(email);
  let name: string | undefined;
  const passwordHash = parsed.data.password ? await hashPassword(parsed.data.password) : undefined;

  if (role === "customer") {
    const existing = await prisma.customer.findUnique({ where: { email } });
    if (!existing && !parsed.data.phone) {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    }
    const customer = await prisma.customer.upsert({
      where: { email },
      update: {
        ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
        ...(passwordHash ? { passwordHash } : {}),
      },
      create: {
        email,
        name: parsed.data.name || email.split("@")[0],
        phone: parsed.data.phone,
        passwordHash,
      },
    });
    name = customer.name;
  } else {
    const worker = await prisma.worker.update({
      where: { email },
      data: passwordHash ? { passwordHash } : {},
    });
    name = worker.name ?? undefined;
  }

  const token = await createSessionToken({
    email,
    role,
    name,
    exp: Date.now() + THIRTY_DAYS_MS,
  });

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
