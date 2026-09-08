import { prisma } from "./prisma";

// Writes a row to the staff notification bell feed. Leave recipientEmails
// empty for a broadcast every staff member sees (new account, new booking,
// new customer message); pass specific emails to target only them (an
// internal staff-chat reply, so people outside that thread don't see a
// preview of it in their own feed).
export async function createNotification(input: {
  type: string;
  title: string;
  body: string;
  url?: string;
  recipientEmails?: string[];
}) {
  return prisma.notification.create({
    data: {
      type: input.type,
      title: input.title,
      body: input.body,
      url: input.url,
      recipientEmails: input.recipientEmails ?? [],
    },
  });
}
