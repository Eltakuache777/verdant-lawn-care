import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { z } from "zod";

// A logged-in customer's own saved info — used to prefill the Book page
// (name/phone/address) and shown/editable on the account page.
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const customer = await prisma.customer.findUnique({
    where: { email: session.email },
    select: { name: true, phone: true, address: true },
  });
  return NextResponse.json(customer ?? { name: null, phone: null, address: null });
}

const BodySchema = z.object({
  address: z.string().max(300).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session || session.role !== "customer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const customer = await prisma.customer.update({
    where: { email: session.email },
    data: parsed.data,
    select: { name: true, phone: true, address: true },
  });
  return NextResponse.json(customer);
}
