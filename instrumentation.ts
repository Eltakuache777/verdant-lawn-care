// Runs once when the server process boots (not per-request, not per-page-load)
// -- this is what lets appointment reminders go out on their own schedule
// instead of depending on staff happening to have the admin dashboard open
// (that's how the recurring-plan job works, see lib/recurringPlans.ts, which
// is fine for something staff checks daily but not for a time-sensitive
// customer-facing reminder). Render's Starter plan keeps this process running
// continuously (no serverless cold start/sleep), so a plain timer here is
// reliable and costs nothing extra to host.
//
// Deliberately calls the actual work through a real API route (loopback
// fetch) instead of importing lib/appointmentReminders.ts directly. Next.js
// also compiles an edge-runtime bundle of this file whenever middleware.ts
// exists, and even a NEXT_RUNTIME-guarded dynamic import of that chain
// (Prisma, SendGrid, web-push) still got traced into the edge bundle and
// failed to build ("Module not found: fs/path/crypto/stream"). Keeping this
// file to only fetch/setTimeout/setInterval -- all edge-safe -- sidesteps
// that entirely.
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const FIRST_CHECK_DELAY_MS = 10 * 1000; // let the server finish booting first

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const port = process.env.PORT ?? "10000";
  const url = `http://localhost:${port}/api/reminders/run-due`;
  const key = process.env.SESSION_SECRET ?? "";

  async function tick() {
    try {
      const res = await fetch(url, { method: "POST", headers: { "x-internal-key": key } });
      if (!res.ok) {
        console.error(`Appointment reminder check failed: HTTP ${res.status}`);
        return;
      }
      const { sent } = await res.json();
      if (sent > 0) console.log(`Sent ${sent} appointment reminder(s)`);
    } catch (err) {
      console.error("Appointment reminder check failed:", err);
    }
  }

  setTimeout(tick, FIRST_CHECK_DELAY_MS);
  setInterval(tick, CHECK_INTERVAL_MS);
}
