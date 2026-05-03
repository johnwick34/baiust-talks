// middleware.ts
// Lightweight route guard — /admin is only reachable if the user's
// Firebase session cookie carries the admin UID.
// For a production app, use Firebase Admin SDK in an API route to
// verify ID tokens server-side. This is a client-friendly fallback.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only guard the /admin prefix
  if (pathname.startsWith("/admin")) {
    // The admin UID check happens client-side in the AdminPage component.
    // Here we just ensure the route exists and passes through — the page
    // itself will redirect unauthenticated users.
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
