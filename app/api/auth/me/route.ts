import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// Public: lets client components (like NavBar) know if the current visitor
// is logged in, without exposing anything sensitive from the session.
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ loggedIn: false });
  return NextResponse.json({
    loggedIn: true,
    role: session.role,
    email: session.email,
    name: session.name,
  });
}
