import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// Endpoints only the owner can use — editing prices, sending chat replies,
// recording/viewing money, managing worker accounts, free AI design generation.
const ADMIN_ONLY_PATHS = new Set([
  "/admin",
  "/api/chat/reply",
  "/api/reports",
  "/api/reports/worker-payments",
  "/api/design/admin-generate",
  "/api/workers",
]);
// Endpoints workers can view too (same data the owner sees, read-only) — plus
// marking a job completed, which is a write action both roles can do.
const SHARED_READ_PATHS = new Set(["/worker", "/api/bookings", "/api/chat/threads"]);

async function roleOf(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  return session?.role ?? null;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const m = req.method;
  const isPage = path === "/admin" || path === "/worker";

  const isAdminOnly =
    ADMIN_ONLY_PATHS.has(path) ||
    path.startsWith("/api/workers/") ||
    (path === "/api/services" && m === "PUT") ||
    (path === "/api/materials" && m === "PUT");
  const isSharedAccess =
    (SHARED_READ_PATHS.has(path) && m === "GET") ||
    (path.startsWith("/api/bookings/") && m === "PATCH");

  if (isAdminOnly) {
    const role = await roleOf(req);
    if (role === "admin") return NextResponse.next();
    if (isPage) return NextResponse.redirect(new URL("/login", req.url));
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isSharedAccess) {
    const role = await roleOf(req);
    if (role === "admin" || role === "worker") return NextResponse.next();
    if (isPage) return NextResponse.redirect(new URL("/login", req.url));
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    "/api/design/admin-generate",
    "/api/workers",
    "/api/workers/:id",
  ],
};
