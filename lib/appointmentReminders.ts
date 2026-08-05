import { prisma } from "./prisma";
import { sendAppointmentReminder } from "./email";
import { sendPushToEmail } from "./push";

// Window rather than an exact 24h mark, since this runs on a periodic timer
// (see instrumentation.ts) rather than at the precise scheduled minute --
// wide enough that a delayed tick or a server restart never causes a
// booking to fall through the gap. reminderSentAt guards against sending
// the same reminder twice across ticks.
const WINDOW_START_HOURS = 23;
const WINDOW_END_HOURS = 25;

export async function runDueAppointmentReminders(): Promise<{ sent: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_START_HOURS * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + WINDOW_END_HOURS * 60 * 60 * 1000);

  const due = await prisma.booking.findMany({
    where: {
      scheduledFor: { gte: windowStart, lte: windowEnd },
      reminderSentAt: null,
      status: { in: ["pending", "confirmed"] },
    },
    include: { customer: true },
  });

  let sent = 0;
  for (const booking of due) {
    try {
      await sendAppointmentReminder({
        customerName: booking.customer.name,
        customerEmail: booking.customer.email,
        services: booking.services,
        address: booking.address,
        scheduledFor: booking.scheduledFor,
      });
      await sendPushToEmail(booking.customer.email, {
        title: "Appointment reminder",
        body: `${booking.services.join(", ")} — tomorrow`,
      });
      await prisma.booking.update({ where: { id: booking.id }, data: { reminderSentAt: now } });
      sent++;
    } catch (err) {
      // One failed reminder shouldn't stop the rest of the batch, and
      // leaving reminderSentAt unset means it'll just retry next tick.
      console.error(`Failed to send appointment reminder for booking ${booking.id}:`, err);
    }
  }
  return { sent };
}
