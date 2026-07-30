import { NextRequest, NextResponse } from "next/server";

// Gates /admin and price-editing so only whoever has ADMIN_PASSWORD can use them.
// Uses HTTP Basic Auth — the browser handles the login prompt natively, no custom login page needed.
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false; // fail closed if it's never been configured

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return false;

  const decoded = atob(auth.slice(6));
  const password = decoded.slice(decoded.indexOf(":") + 1);
  return password === expected;
}

export function middleware(req: NextRequest) {
  const guarded =
    req.nextUrl.pathname === "/admin" ||
    (req.nextUrl.pathname === "/api/services" && req.method === "PUT") ||
    (req.nextUrl.pathname === "/api/materials" && req.method === "PUT") ||
    (req.nextUrl.pathname === "/api/bookings" && req.method === "GET") ||
    req.nextUrl.pathname === "/api/chat/threads" ||
    req.nextUrl.pathname === "/api/chat/reply";

  if (!guarded || isAuthorized(req)) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Greenline Admin"' },
  });
}

export const config = {
  matcher: ["/admin", "/api/services", "/api/materials", "/api/bookings", "/api/chat/threads", "/api/chat/reply"],
};
