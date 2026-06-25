import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths reachable WITHOUT the auth cookie:
//  - /login        the login page
//  - /api/auth     the login endpoint itself (chicken/egg — must be open)
//  - /api/telegram the Telegram bridge (authenticates via its own x-bridge-secret header)
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/telegram"];

const COOKIE = "agent_auth";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const authed = req.cookies.get(COOKIE)?.value === "1";
  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url); // 307
  }

  return NextResponse.next();
}

export const config = {
  // Run the gate on everything except Next internals and the favicon.
  matcher: ["/((?!_next|favicon.ico).*)"],
};
