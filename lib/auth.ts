import { NextRequest } from "next/server";
import { parseWorkerAccounts } from "./workerAccounts";

// Node-runtime credential check for use inside API route handlers (middleware.ts
// has its own Edge-compatible copy since it can't import Buffer-based code).
function credentialsFrom(req: NextRequest): { username: string; password: string } | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return null;
  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
  const i = decoded.indexOf(":");
  if (i === -1) return null;
  return { username: decoded.slice(0, i), password: decoded.slice(i + 1) };
}

export function isAdminRequest(req: NextRequest): boolean {
  const creds = credentialsFrom(req);
  if (!creds) return false;
  const expectedUsername = process.env.ADMIN_USERNAME || "admin";
  const expectedPassword = process.env.ADMIN_PASSWORD;
  return !!expectedPassword && creds.username === expectedUsername && creds.password === expectedPassword;
}

export function isWorkerRequest(req: NextRequest): boolean {
  const creds = credentialsFrom(req);
  if (!creds) return false;
  const account = parseWorkerAccounts(process.env.WORKER_ACCOUNTS).find((a) => a.username === creds.username);
  return !!account && account.password === creds.password;
}
