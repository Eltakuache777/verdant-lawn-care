import { NextRequest, NextResponse } from "next/server";
import { sendLoginCode } from "@/lib/loginCode";
import { isCustomerBlocked, BLOCKED_CUSTOMER_MESSAGE } from "@/lib/blockedCustomer";
import { z } from "zod";

const BodySchema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (await isCustomerBlocked(parsed.data.email)) {
    return NextResponse.json({ error: BLOCKED_CUSTOMER_MESSAGE }, { status: 403 });
  }
  await sendLoginCode(parsed.data.email);
  return NextResponse.json({ ok: true });
}
