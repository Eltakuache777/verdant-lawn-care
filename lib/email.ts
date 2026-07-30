import sgMail from "@sendgrid/mail";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

type BookingConfirmationInput = {
  customerName: string;
  customerEmail: string;
  services: string[];
  address: string;
  scheduledFor: Date;
  totalPrice: number;
};

export async function sendBookingConfirmation(booking: BookingConfirmationInput) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) return; // not configured — skip silently

  const when = booking.scheduledFor.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });

  await sgMail.send({
    to: booking.customerEmail,
    from: fromEmail,
    subject: "Your Verdant Lawn Care appointment is confirmed",
    text: `Hi ${booking.customerName},\n\nYour appointment is confirmed:\n\nServices: ${booking.services.join(", ")}\nWhen: ${when}\nAddress: ${booking.address}\nTotal: $${booking.totalPrice}\n\nThanks for choosing Verdant Lawn Care!`,
    html: `<p>Hi ${booking.customerName},</p><p>Your appointment is confirmed:</p><ul><li><strong>Services:</strong> ${booking.services.join(", ")}</li><li><strong>When:</strong> ${when}</li><li><strong>Address:</strong> ${booking.address}</li><li><strong>Total:</strong> $${booking.totalPrice}</li></ul><p>Thanks for choosing Verdant Lawn Care!</p>`,
  });
}
