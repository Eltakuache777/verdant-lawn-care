// A subscribable calendar feed (.ics) of the company schedule -- staff
// subscribe once in their phone's Calendar app (Apple, Google, Outlook, all
// support this natively via a "webcal"/https link) and bookings show up and
// stay updated automatically. Deliberately one-way (the admin panel stays
// the source of truth for edits) -- no OAuth, no per-user account
// connection, no ongoing token refresh to maintain.
//
// The URL itself is the access control: it's a long HMAC-signed token, not
// a real login, so anyone who has the link can view the schedule -- treat
// it like a shared secret link, same as e.g. a private Zoom link.

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const bytes = new Uint8Array(sigBuf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not configured");
  return s;
}

export async function calendarTokenFor(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();
  const sig = await hmacSign(secret(), `calendar:${normalized}`);
  const emailB64 = btoa(normalized).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${emailB64}.${sig}`;
}

export async function emailFromCalendarToken(token: string): Promise<string | null> {
  const [emailB64, sig] = token.split(".");
  if (!emailB64 || !sig) return null;
  try {
    const email = atob(emailB64.replace(/-/g, "+").replace(/_/g, "/"));
    const expectedSig = await hmacSign(secret(), `calendar:${email}`);
    if (expectedSig !== sig) return null;
    return email;
  } catch {
    return null;
  }
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function toIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// One booking = one hour on the calendar by default (bookings don't store
// a duration -- this is a reasonable placeholder, editable per-event by
// whoever's looking at their calendar app if they know it'll run longer).
const DEFAULT_DURATION_MS = 60 * 60 * 1000;

export type IcsBooking = {
  id: string;
  customerName: string;
  services: string[];
  address: string;
  scheduledFor: Date;
  status: string;
  assignedWorkerName?: string | null;
};

export function generateIcsFeed(bookings: IcsBooking[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Verdant Lawn Care//Booking Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Verdant Lawn Care Schedule",
    "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
    "X-PUBLISHED-TTL:PT30M",
  ];

  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const start = b.scheduledFor;
    const end = new Date(start.getTime() + DEFAULT_DURATION_MS);
    const summary = `${b.services.join(", ")} — ${b.customerName}`;
    const description = [
      `Services: ${b.services.join(", ")}`,
      `Customer: ${b.customerName}`,
      b.assignedWorkerName ? `Assigned to: ${b.assignedWorkerName}` : null,
      `Status: ${b.status}`,
    ]
      .filter(Boolean)
      .join("\\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:booking-${b.id}@verdantlawn.care`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(start)}`,
      `DTEND:${toIcsDate(end)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `LOCATION:${escapeIcsText(b.address)}`,
      `DESCRIPTION:${description}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
