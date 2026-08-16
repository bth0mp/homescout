import { NextResponse, type NextRequest } from "next/server";

/**
 * Defense in depth. Pangolin is expected to authenticate the admin side, but if
 * its route rules ever drift, every server action in this app is an
 * unauthenticated write endpoint — including deleteProperty, which cascades to
 * scenarios and share links. Set APP_PASSWORD and this gate closes regardless
 * of what the proxy is doing.
 *
 * ponytail: HTTP Basic over the proxy's TLS. The browser renders the prompt, so
 * there is no login page, no session table and no cookie signing to get wrong.
 */

// Public by design: share links and the container health check.
const PUBLIC = [/^\/s\//, /^\/api\/health$/];

function constantTimeEqual(a: string, b: string): boolean {
  // Compare over a fixed length so the loop count does not leak the password.
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  // Unset = trust the proxy entirely. Documented in the README as the weaker mode.
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(header.slice(6));
    } catch {
      decoded = "";
    }
    const supplied = decoded.slice(decoded.indexOf(":") + 1);
    const user = decoded.slice(0, decoded.indexOf(":"));
    if (constantTimeEqual(supplied, password) && user.length > 0) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="HomeScout", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  // Everything except Next's own static output. Server actions POST to page
  // routes, so they are covered by this matcher.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
