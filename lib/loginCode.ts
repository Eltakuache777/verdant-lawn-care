import { prisma } from "./prisma";
import sgMail from "@sendgrid/mail";
import { Role } from "./session";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const CODE_TTL_MINUTES = 10;

export async function roleForEmail(email: string): Promise<Role> {
  const worker = await prisma.worker.findUnique({ where: { email: email.toLowerCase() } });
  if (worker) return worker.isAdmin ? "admin" : "worker";
  return "customer";
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendLoginCode(rawEmail: string): Promise<void> {
  const email = rawEmail.toLowerCase().trim();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await prisma.loginCode.create({ data: { email, code, expiresAt } });

  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) return; // not configured — code still stored, just can't be emailed

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://verdantlawn.care";
  const logo = `<img src="${appUrl}/logo.svg" width="48" height="48" alt="Verdant Lawn Care" style="display:block;margin-bottom:16px;border-radius:10px" />`;

  await sgMail.send({
    to: email,
    from: { email: fromEmail, name: "Verdant Lawn Care" },
    subject: "Your Verdant Lawn Care sign-in code",
    text: `Here's your one-time sign-in code for Verdant Lawn Care:\n\n${code}\n\nIt expires in ${CODE_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email.`,
    html: `${logo}<p>Here's your one-time sign-in code for Verdant Lawn Care:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>It expires in ${CODE_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email.</p>`,
  });
}

export async function verifyLoginCode(rawEmail: string, code: string): Promise<boolean> {
  const email = rawEmail.toLowerCase().trim();
  const match = await prisma.loginCode.findFirst({
    where: { email, code, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!match) return false;
  await prisma.loginCode.update({ where: { id: match.id }, data: { usedAt: new Date() } });
  return true;
}
