import { NextResponse } from "next/server";

/**
 * Serve a stored photo.
 *
 * Headers matter here: the bytes are user-supplied, so the browser must be told
 * exactly what they are and forbidden from re-sniffing. Without nosniff, a file
 * that slipped past validation could be interpreted as HTML and become stored
 * XSS on the app's own origin.
 */
export function photoResponse(photo: Buffer | null, type: string | null) {
  if (!photo || !type) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(photo), {
    headers: {
      "Content-Type": type,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      // Immutable per property version; a changed photo changes the URL's cache
      // key via the ?v= stamp the callers append.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
