import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Gate password sourced from the AGENT_PASSWORD env var (set in .env.local on the VPS).
// No hardcoded fallback: if it's unset the gate fails closed rather than shipping a secret.
const PASSWORD = process.env.AGENT_PASSWORD;
const COOKIE = "agent_auth";

export async function POST(req: Request) {
  let password = "";
  try {
    const body = (await req.json()) as { password?: string };
    password = body?.password ?? "";
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  if (!PASSWORD) {
    return NextResponse.json({ error: "auth not configured: AGENT_PASSWORD is not set" }, { status: 500 });
  }
  if (password !== PASSWORD) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    // No `secure` flag on purpose: keeps the cookie working over both the HTTPS
    // tunnel and plain http://IP:3000 access. httpOnly + sameSite still apply.
  });
  return res;
}
