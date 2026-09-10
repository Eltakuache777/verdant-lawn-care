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

// Deliberately doesn't include a dollar amount — the confirmation goes out
// the moment someone books, before staff have actually looked at the job, so
// a number here would read as a locked-in final price when it isn't one.
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
    text: `Hi ${booking.customerName},\n\nYour appointment is confirmed:\n\nServices: ${booking.services.join(", ")}\nWhen: ${when}\nAddress: ${booking.address}${paymentLabel ? `\nPayment: ${paymentLabel}` : ""}\n\nWe'll confirm your total once we've had a look at the job.\n\nThanks for choosing Verdant Lawn Care!`,
    html: `${logo}<p>Hi ${booking.customerName},</p><p>Your appointment is confirmed:</p><ul><li><strong>Services:</strong> ${booking.services.join(", ")}</li><li><strong>When:</strong> ${when}</li><li><strong>Address:</strong> ${booking.address}</li>${paymentLabel ? `<li><strong>Payment:</strong> ${paymentLabel}</li>` : ""}</ul><p>We'll confirm your total once we've had a look at the job.</p><p>Thanks for choosing Verdant Lawn Care!</p>`,
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

type AppointmentReminderInput = {
  customerName: string;
  customerEmail: string;
  services: string[];
  address: string;
  scheduledFor: Date;
};

export async function sendAppointmentReminder(booking: AppointmentReminderInput) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) return;

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

  await sgMail.send({
    to: booking.customerEmail,
    from: { email: fromEmail, name: "Verdant Lawn Care" },
    subject: "Reminder: your Verdant Lawn Care appointment is tomorrow",
    text: `Hi ${booking.customerName},\n\nJust a reminder — your appointment is coming up tomorrow:\n\nServices: ${booking.services.join(", ")}\nWhen: ${when}\nAddress: ${booking.address}\n\nSee you then!`,
    html: `${logo}<p>Hi ${booking.customerName},</p><p>Just a reminder — your appointment is coming up tomorrow:</p><ul><li><strong>Services:</strong> ${booking.services.join(", ")}</li><li><strong>When:</strong> ${when}</li><li><strong>Address:</strong> ${booking.address}</li></ul><p>See you then!</p>`,
  });
}

type StaffAppointmentReminderInput = {
  staffEmails: string[];
  customerName: string;
  address: string;
  services: string[];
  scheduledFor: Date;
};

// The customer-facing reminder above only ever went to the customer -- staff
// found out about a job by whatever they remembered from the original
// booking alert, with nothing prompting them again the day before. Same
// 23-25h window and reminderSentAt guard as the customer one (see
// runDueAppointmentReminders), just addressed to every worker instead.
export async function sendStaffAppointmentReminder(booking: StaffAppointmentReminderInput) {
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

  await sgMail.send({
    to: booking.staffEmails,
    from: { email: fromEmail, name: "Verdant Lawn Care" },
    subject: `Tomorrow: ${booking.customerName} — ${booking.services.join(", ")}`,
    text: `Reminder — this job is scheduled for tomorrow:\n\nCustomer: ${booking.customerName}\nServices: ${booking.services.join(", ")}\nWhen: ${when}\nAddress: ${booking.address}`,
    html: `${logo}<p>Reminder — this job is scheduled for tomorrow:</p><ul><li><strong>Customer:</strong> ${booking.customerName}</li><li><strong>Services:</strong> ${booking.services.join(", ")}</li><li><strong>When:</strong> ${when}</li><li><strong>Address:</strong> ${booking.address}</li></ul>`,
  });
}

type ReviewRequestInput = {
  customerName: string;
  customerEmail: string;
  services: string[];
};

// Sent once a booking is marked "completed" — this is what actually drives
// customers to /reviews. A page nobody's pointed at just sits empty; asking
// right after a good job is when people are most likely to say yes.
export async function sendReviewRequestEmail(input: ReviewRequestInput) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://verdantlawn.care";
  const logo = `<img src="${appUrl}/logo.svg" width="48" height="48" alt="Verdant Lawn Care" style="display:block;margin-bottom:16px;border-radius:10px" />`;
  const reviewUrl = `${appUrl}/reviews`;

  await sgMail.send({
    to: input.customerEmail,
    from: { email: fromEmail, name: "Verdant Lawn Care" },
    subject: "How did we do?",
    text: `Hi ${input.customerName},\n\nWe just finished your ${input.services.join(", ")} service — thanks for choosing Verdant Lawn Care!\n\nIf you have a minute, we'd really appreciate a quick review: ${reviewUrl}\n\nThanks again!`,
    html: `${logo}<p>Hi ${input.customerName},</p><p>We just finished your <strong>${input.services.join(", ")}</strong> service — thanks for choosing Verdant Lawn Care!</p><p>If you have a minute, we'd really appreciate a quick review:</p><p><a href="${reviewUrl}" style="display:inline-block;padding:10px 20px;background:#34d67f;color:#06130c;text-decoration:none;border-radius:6px;font-weight:700;">Leave a review</a></p><p>Thanks again!</p>`,
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

type NewAccountAlertInput = {
  staffEmails: string[];
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
};

// Fired once, at the moment a brand-new Customer row is actually created
// (see /api/auth/verify-code) -- not on every login/code-verify, which
// would fire this on every returning customer too.
export async function sendNewAccountAlert(alert: NewAccountAlertInput) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail || alert.staffEmails.length === 0) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://verdantlawn.care";
  const logo = `<img src="${appUrl}/logo.svg" width="48" height="48" alt="Verdant Lawn Care" style="display:block;margin-bottom:16px;border-radius:10px" />`;

  await sgMail.send({
    to: alert.staffEmails,
    from: { email: fromEmail, name: "Verdant Lawn Care" },
    subject: `New account: ${alert.customerName}`,
    text: `A new customer account was just created:\n\nName: ${alert.customerName}\nEmail: ${alert.customerEmail}\nPhone: ${alert.customerPhone ?? "not provided"}`,
    html: `${logo}<p>A new customer account was just created:</p><ul><li><strong>Name:</strong> ${alert.customerName}</li><li><strong>Email:</strong> ${alert.customerEmail}</li><li><strong>Phone:</strong> ${alert.customerPhone ?? "not provided"}</li></ul>`,
  });
}

type BookingCancelledInput = {
  customerName: string;
  customerEmail: string;
  services: string[];
  scheduledFor: Date;
};

export async function sendBookingCancelledEmail(booking: BookingCancelledInput) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) return;

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

  await sgMail.send({
    to: booking.customerEmail,
    from: { email: fromEmail, name: "Verdant Lawn Care" },
    subject: "Your Verdant Lawn Care appointment was cancelled",
    text: `Hi ${booking.customerName},\n\nYour appointment has been cancelled:\n\nServices: ${booking.services.join(", ")}\nWhen: ${when}\n\nIf this wasn't expected or you'd like to rebook, just reply or book again at ${appUrl}.`,
    html: `${logo}<p>Hi ${booking.customerName},</p><p>Your appointment has been cancelled:</p><ul><li><strong>Services:</strong> ${booking.services.join(", ")}</li><li><strong>When:</strong> ${when}</li></ul><p>If this wasn't expected or you'd like to rebook, just reply or book again at <a href="${appUrl}">${appUrl}</a>.</p>`,
  });
}
