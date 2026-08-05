import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// Everything below is "staff only" — the owner and workers have equal, full
// access (view schedule/messages/prices/reports, edit prices, reply to
// customers, manage worker accounts, free AI design generation). The only
// thing that's ever admin-only is who's allowed to log in as a worker in the
// first place (see lib/loginCode.ts — that's controlled by the Worker table,
// which only staff who are already in can add to).
const STAFF_PATHS = new Set([
  "/admin",
  "/worker",
  "/api/bookings",
  "/api/chat/threads",
  "/api/chat/reply",
  "/api/reports",
  "/api/reports/worker-payments",
  "/api/design/admin-generate",
  "/api/design/history",
  "/api/workers",
  "/api/customers",
  "/api/recurring/run-due",
  "/api/staff-chat/threads",
]);

// Just needs to be logged in as someone — used for the customer self-service
// account page, not gated to a specific role.
const LOGGED_IN_PATHS = new Set(["/account"]);

async function roleOf(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  return session?.role ?? null;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const m = req.method;
  const isPage = path === "/admin" || path === "/worker" || path === "/account";

  const isStaffOnly =
    STAFF_PATHS.has(path) ||
    path.startsWith("/api/workers/") ||
    path.startsWith("/api/customers/") ||
    path.startsWith("/api/staff-chat/threads/") ||
    (path === "/api/services" && m === "PUT") ||
    (path === "/api/materials" && m === "PUT") ||
    (path === "/api/feedback" && m === "GET") ||
    (path.startsWith("/api/bookings/") && m === "PATCH") ||
    (path.startsWith("/api/chat/") && m === "DELETE") ||
    (path === "/api/portfolio" && m === "POST") ||
    (path.startsWith("/api/portfolio/") && m === "DELETE") ||
    (path.startsWith("/api/reviews/") && m === "DELETE");

  if (isStaffOnly) {
    const role = await roleOf(req);
    if (role === "admin" || role === "worker") return NextResponse.next();
    if (isPage) return NextResponse.redirect(new URL("/login", req.url));
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (LOGGED_IN_PATHS.has(path)) {
    const role = await roleOf(req);
    if (!role) return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/worker",
    "/account",
    "/api/services",
    "/api/materials",
    "/api/feedback",
    "/api/bookings",
    "/api/bookings/:id",
    "/api/chat/threads",
    "/api/chat/reply",
    "/api/chat/:id",
    "/api/reports",
    "/api/reports/worker-payments",
    "/api/design/admin-generate",
    "/api/design/history",
    "/api/workers",
    "/api/workers/:id",
    "/api/customers",
    "/api/customers/:id",
    "/api/recurring/run-due",
    "/api/staff-chat/threads",
    "/api/staff-chat/threads/:id/messages",
    "/api/staff-chat/threads/:id/messages/:messageId",
    "/api/portfolio",
    "/api/portfolio/:id",
    "/api/reviews/:id",
  ],
};
