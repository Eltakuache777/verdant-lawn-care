import sgMail from "@sendgrid/mail";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const PAYMENT_METHOD_LABELS: Record<string, string> = { cash: "Cash", zelle: "Zelle", venmo: "Venmo" };

type BookingConfirmationInput = {
  customerName: string;
  customerEmail: string;
  services: string[];
  address: string;
  scheduledFor: Date;
  totalPrice: number;
  paymentMethod?: string | null;
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://verdantlawn.care";
  const logo = `<img src="${appUrl}/logo.svg" width="48" height="48" alt="Verdant Lawn Care" style="display:block;margin-bottom:16px;border-radius:10px" />`;
  const paymentLabel = booking.paymentMethod ? PAYMENT_METHOD_LABELS[booking.paymentMethod] ?? booking.paymentMethod : null;

  await sgMail.send({
    to: booking.customerEmail,
    from: { email: fromEmail, name: "Verdant Lawn Care" },
    subject: "Your Verdant Lawn Care appointment is confirmed",
    text: `Hi ${booking.customerName},\n\nYour appointment is confirmed:\n\nServices: ${booking.services.join(", ")}\nWhen: ${when}\nAddress: ${booking.address}\nTotal: $${booking.totalPrice}${paymentLabel ? `\nPayment: ${paymentLabel}` : ""}\n\nThanks for choosing Verdant Lawn Care!`,
    html: `${logo}<p>Hi ${booking.customerName},</p><p>Your appointment is confirmed:</p><ul><li><strong>Services:</strong> ${booking.services.join(", ")}</li><li><strong>When:</strong> ${when}</li><li><strong>Address:</strong> ${booking.address}</li><li><strong>Total:</strong> $${booking.totalPrice}</li>${paymentLabel ? `<li><strong>Payment:</strong> ${paymentLabel}</li>` : ""}</ul><p>Thanks for choosing Verdant Lawn Care!</p>`,
  });
}

type RecurringBookingNotificationInput = {
  customerName: string;
  customerEmail: string;
  services: string[];
  address: string;
  scheduledFor: Date;
  price: number;
};

export async function sendRecurringBookingNotification(booking: RecurringBookingNotificationInput) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) return;

  const when = booking.scheduledFor.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://verdantlawn.care";
  const logo = `<img src="${appUrl}/logo.svg" width="48" height="48" alt="Verdant Lawn Care" style="display:block;margin-bottom:16px;border-radius:10px" />`;

  await sgMail.send({
    to: booking.customerEmail,
    from: { email: fromEmail, name: "Verdant Lawn Care" },
    subject: "Your next lawn service is scheduled",
    text: `Hi ${booking.customerName},\n\nYour next recurring visit is scheduled:\n\nServices: ${booking.services.join(", ")}\nWhen: ${when}\nAddress: ${booking.address}\nPrice: $${booking.price}\n\nWant to change how often we come by? Log in at ${appUrl} and visit your account page.\n\nThanks for choosing Verdant Lawn Care!`,
    html: `${logo}<p>Hi ${booking.customerName},</p><p>Your next recurring visit is scheduled:</p><ul><li><strong>Services:</strong> ${booking.services.join(", ")}</li><li><strong>When:</strong> ${when}</li><li><strong>Address:</strong> ${booking.address}</li><li><strong>Price:</strong> $${booking.price}</li></ul><p>Want to change how often we come by? Log in at <a href="${appUrl}">${appUrl}</a> and visit your account page.</p><p>Thanks for choosing Verdant Lawn Care!</p>`,
  });
}

type NewBookingAlertInput = {
  staffEmails: string[];
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  services: string[];
  address: string;
  scheduledFor: Date;
  totalPrice: number;
  paymentMethod?: string | null;
};

export async function sendNewBookingAlert(booking: NewBookingAlertInput) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail || booking.staffEmails.length === 0) return;

  const when = booking.scheduledFor.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://verdantlawn.care";
  const logo = `<img src="${appUrl}/logo.svg" width="48" height="48" alt="Verdant Lawn Care" style="display:block;margin-bottom:16px;border-radius:10px" />`;
  const paymentLabel = booking.paymentMethod ? PAYMENT_METHOD_LABELS[booking.paymentMethod] ?? booking.paymentMethod : null;

  await sgMail.send({
    to: booking.staffEmails,
    from: { email: fromEmail, name: "Verdant Lawn Care" },
    subject: `New booking: ${booking.customerName}`,
    text: `New booking from ${booking.customerName}:\n\nServices: ${booking.services.join(", ")}\nWhen: ${when}\nAddress: ${booking.address}\nPhone: ${booking.customerPhone ?? "not provided"}\nEmail: ${booking.customerEmail}\nTotal: $${booking.totalPrice}${paymentLabel ? `\nPayment: ${paymentLabel}` : ""}`,
    html: `${logo}<p>New booking from <strong>${booking.customerName}</strong>:</p><ul><li><strong>Services:</strong> ${booking.services.join(", ")}</li><li><strong>When:</strong> ${when}</li><li><strong>Address:</strong> ${booking.address}</li><li><strong>Phone:</strong> ${booking.customerPhone ?? "not provided"}</li><li><strong>Email:</strong> ${booking.customerEmail}</li><li><strong>Total:</strong> $${booking.totalPrice}</li>${paymentLabel ? `<li><strong>Payment:</strong> ${paymentLabel}</li>` : ""}</ul>`,
  });
}
