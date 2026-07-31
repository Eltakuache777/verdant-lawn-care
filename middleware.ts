import { NextRequest, NextResponse } from "next/server";
import { parseWorkerAccounts } from "@/lib/workerAccounts";

// Uses HTTP Basic Auth — the browser handles the login prompt natively, no custom login page needed.
function credentialsFrom(req: NextRequest): { username: string; password: string } | null {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return null;
  const decoded = atob(auth.slice(6));
  const i = decoded.indexOf(":");
  if (i === -1) return null;
  return { username: decoded.slice(0, i), password: decoded.slice(i + 1) };
}

function isAdminAuthorized(req: NextRequest): boolean {
  const creds = credentialsFrom(req);
  if (!creds) return false;
  const expectedUsername = process.env.ADMIN_USERNAME || "admin";
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedPassword) return false; // fail closed if it's never been configured
  return creds.username === expectedUsername && creds.password === expectedPassword;
}

// Workers each get their own username/password (see WORKER_ACCOUNTS above),
// so you don't have to hand out one shared login. Your admin login also
// works here, so you can preview the worker view yourself.
function isWorkerAuthorized(req: NextRequest): boolean {
  const creds = credentialsFrom(req);
  if (!creds) return false;
  if (isAdminAuthorized(req)) return true;
  const account = parseWorkerAccounts(process.env.WORKER_ACCOUNTS).find((a) => a.username === creds.username);
  return !!account && account.password === creds.password;
}

// Endpoints only the owner can use — editing prices, sending chat replies,
// recording/viewing money (reports, payment amounts are enforced inside the
// booking route itself since that route also allows worker access for the
// "mark completed" action).
const ADMIN_ONLY_PATHS = new Set(["/admin", "/api/chat/reply", "/api/reports", "/api/reports/worker-payments"]);
// Endpoints workers can view too (same data the owner sees, read-only) — plus
// marking a job completed, which is a write action both roles can do.
const SHARED_READ_PATHS = new Set(["/worker", "/api/bookings", "/api/chat/threads"]);

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const m = req.method;

  const isAdminOnly =
    ADMIN_ONLY_PATHS.has(path) ||
    (path === "/api/services" && m === "PUT") ||
    (path === "/api/materials" && m === "PUT");
  const isSharedAccess =
    (SHARED_READ_PATHS.has(path) && m === "GET") ||
    (path.startsWith("/api/bookings/") && m === "PATCH");

  if (isAdminOnly) {
    if (isAdminAuthorized(req)) return NextResponse.next();
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Greenline Admin"' },
    });
  }

  if (isSharedAccess) {
    if (isWorkerAuthorized(req)) return NextResponse.next();
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Greenline"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/worker",
    "/api/services",
    "/api/materials",
    "/api/bookings",
    "/api/bookings/:id",
    "/api/chat/threads",
    "/api/chat/reply",
    "/api/reports",
    "/api/reports/worker-payments",
  ],
};
