import { prisma } from "./prisma";
import { sendRecurringBookingNotification } from "./email";
import { daysForFrequency } from "./recurringFrequency";

// Creates the next Booking for every active recurring plan whose nextDate has
// arrived, advances that plan's nextDate, and emails the customer. Triggered
// from the admin dashboard on load (see AdminShell.tsx) rather than a
// dedicated cron job, so it costs nothing extra to host — the trade-off is a
// plan only catches up whenever staff next opens the app, not at the exact
// scheduled minute.
export async function runDueRecurringPlans(): Promise<{ created: number }> {
  const due = await prisma.recurringPlan.findMany({
    where: { active: true, nextDate: { lte: new Date() } },
    include: { customer: true },
  });

  let created = 0;
  for (const plan of due) {
    const booking = await prisma.booking.create({
      data: {
        customerId: plan.customerId,
        services: plan.services,
        planFrequency: plan.frequency,
        address: plan.address,
        scheduledFor: plan.nextDate,
        basePrice: plan.pricePerVisit,
        totalPrice: plan.pricePerVisit,
      },
    });

    const nextDate = new Date(plan.nextDate);
    nextDate.setDate(nextDate.getDate() + daysForFrequency(plan.frequency));
    await prisma.recurringPlan.update({ where: { id: plan.id }, data: { nextDate } });

    try {
      await sendRecurringBookingNotification({
        customerName: plan.customer.name,
        customerEmail: plan.customer.email,
        services: booking.services,
        address: booking.address,
        scheduledFor: booking.scheduledFor,
        price: plan.pricePerVisit,
      });
    } catch (err) {
      console.error("Failed to send recurring booking notification:", err);
    }
    created++;
  }
  return { created };
}
