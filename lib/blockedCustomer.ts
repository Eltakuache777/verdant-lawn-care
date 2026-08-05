import { prisma } from "./prisma";

export const BLOCKED_CUSTOMER_MESSAGE =
  "This account isn't able to use this feature right now. Contact us if you think this is a mistake.";

export async function isCustomerBlocked(rawEmail: string): Promise<boolean> {
  const email = rawEmail.toLowerCase().trim();
  const customer = await prisma.customer.findUnique({ where: { email }, select: { blocked: true } });
  return customer?.blocked ?? false;
}
