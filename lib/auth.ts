import { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "./session";

async function sessionFrom(req: NextRequest) {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  const session = await sessionFrom(req);
  return session?.role === "admin";
}

export async function isWorkerRequest(req: NextRequest): Promise<boolean> {
  const session = await sessionFrom(req);
  return session?.role === "admin" || session?.role === "worker";
}

// Returns the session only if it belongs to staff (admin or worker), else null.
export async function staffSessionFrom(req: NextRequest) {
  const session = await sessionFrom(req);
  if (session?.role === "admin" || session?.role === "worker") return session;
  return null;
}
