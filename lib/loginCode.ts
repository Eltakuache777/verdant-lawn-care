import { prisma } from "./prisma";
import sgMail from "@sendgrid/mail";
import { Role } from "./session";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const CODE_TTL_MINUTES = 10;

export async function roleForEmail(email: string): Promise<Role> {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (adminEmail && email.toLowerCase() === adminEmail) return "admin";
  const worker = await prisma.worker.findUnique({ where: { email: email.toLowerCase() } });
  if (worker) return "worker";
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

  await sgMail.send({
    to: email,
    from: fromEmail,
    subject: `Your Verdant Lawn Care login code: ${code}`,
    text: `Your login code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
    html: `<p>Your login code is <strong style="font-size:20px">${code}</strong>.</p><p>It expires in ${CODE_TTL_MINUTES} minutes.</p>`,
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
