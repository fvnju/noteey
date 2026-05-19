import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export async function GET() {
  // Refresh first so the session cookie is rotated before we read the session
  // back. After this returns, the next call to getSession() observes the
  // refreshed tokenSet rather than the stale one.
  try {
    await auth0.getAccessToken({ refresh: true });
  } catch {
    // Best-effort refresh — fall through to whatever session exists.
  }

  const session = await auth0.getSession();

  if (!session?.tokenSet.idToken) {
    return NextResponse.json({ token: null }, { status: 401 });
  }

  return NextResponse.json({ token: session.tokenSet.idToken });
}
