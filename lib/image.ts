/**
 * Image validation for user-supplied photos.
 *
 * A browser-declared content-type is attacker-controlled, so it is never
 * trusted: the format is decided by sniffing magic bytes, and only formats on
 * the allow-list are stored. This is a trust boundary — an HTML file accepted
 * here and later served back would be stored XSS.
 */

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export type ImageKind = "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "image/avif";

const startsWith = (b: Uint8Array, sig: number[], offset = 0) =>
  sig.every((byte, i) => b[offset + i] === byte);

const ascii = (b: Uint8Array, offset: number, s: string) =>
  [...s].every((ch, i) => b[offset + i] === ch.charCodeAt(0));

/** Returns the real format, or null if the bytes are not an allowed image. */
export function sniffImageType(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";

  // GIF87a / GIF89a
  if (ascii(bytes, 0, "GIF87a") || ascii(bytes, 0, "GIF89a")) return "image/gif";

  // RIFF....WEBP
  if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) return "image/webp";

  // ISO-BMFF: ....ftyp{avif,avis}
  if (ascii(bytes, 4, "ftyp") && (ascii(bytes, 8, "avif") || ascii(bytes, 8, "avis"))) {
    return "image/avif";
  }

  return null;
}

export type PhotoError =
  | { ok: false; error: string }
  | { ok: true; bytes: Buffer; type: ImageKind };

export function validatePhoto(buf: Buffer | Uint8Array): PhotoError {
  if (buf.length === 0) return { ok: false, error: "That file was empty." };
  if (buf.length > MAX_PHOTO_BYTES) {
    return {
      ok: false,
      error: `Image is ${(buf.length / 1024 / 1024).toFixed(1)}MB; the limit is ${
        MAX_PHOTO_BYTES / 1024 / 1024
      }MB.`,
    };
  }

  const type = sniffImageType(buf instanceof Uint8Array ? buf : new Uint8Array(buf));
  if (!type) {
    return {
      ok: false,
      error: "That does not look like a JPEG, PNG, WebP, GIF or AVIF image.",
    };
  }

  return { ok: true, bytes: Buffer.from(buf), type };
}
