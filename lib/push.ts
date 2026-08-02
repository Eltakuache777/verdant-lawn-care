import webpush from "web-push";
import { prisma } from "./prisma";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

if (publicKey && privateKey && subject) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

type PushPayload = { title: string; body: string; url?: string };

// Sends a push notification to every device a person has enabled notifications
// on. Silently no-ops if VAPID isn't configured. Prunes subscriptions the
// browser has revoked (expired/uninstalled) so the table doesn't accumulate
// dead entries.
export async function sendPushToEmail(rawEmail: string, payload: PushPayload) {
  if (!publicKey || !privateKey || !subject) return;
  const email = rawEmail.toLowerCase().trim();

  const subs = await prisma.pushSubscription.findMany({ where: { email } });
  if (subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error("Push send failed:", err?.message ?? err);
        }
      }
    })
  );
}

export async function sendPushToEmails(emails: string[], payload: PushPayload) {
  await Promise.all(emails.map((email) => sendPushToEmail(email, payload)));
}
