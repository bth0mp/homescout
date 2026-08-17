import { describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES, sniffImageType, validatePhoto } from "@/lib/image";

const pad = (head: number[], len = 32) =>
  Buffer.concat([Buffer.from(head), Buffer.alloc(Math.max(0, len - head.length))]);

const JPEG = pad([0xff, 0xd8, 0xff, 0xe0]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF = pad([...Buffer.from("GIF89a")]);
const WEBP = pad([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);
const AVIF = pad([0, 0, 0, 0x20, ...Buffer.from("ftyp"), ...Buffer.from("avif")]);

describe("sniffImageType", () => {
  it("identifies each allowed format by its magic bytes", () => {
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(GIF)).toBe("image/gif");
    expect(sniffImageType(WEBP)).toBe("image/webp");
    expect(sniffImageType(AVIF)).toBe("image/avif");
  });

  it("rejects things that are not images", () => {
    expect(sniffImageType(pad([...Buffer.from("<!DOCTYPE html>")]))).toBeNull();
    expect(sniffImageType(pad([...Buffer.from("<svg xmlns=")]))).toBeNull();
    expect(sniffImageType(pad([0x25, 0x50, 0x44, 0x46]))).toBeNull(); // %PDF
    expect(sniffImageType(pad([0x4d, 0x5a]))).toBeNull(); // MZ, a Windows exe
    expect(sniffImageType(new Uint8Array([1, 2, 3]))).toBeNull(); // too short
  });

  it("is not fooled by an image extension or declared type", () => {
    // The whole point: only the bytes decide.
    const htmlNamedJpg = pad([...Buffer.from("<html><script>alert(1)</script>")]);
    expect(sniffImageType(htmlNamedJpg)).toBeNull();
  });

  it("does not accept a RIFF container that is not WebP", () => {
    // RIFF....WAVE is audio, not an image.
    const wav = pad([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WAVE")]);
    expect(sniffImageType(wav)).toBeNull();
  });
});

describe("validatePhoto", () => {
  it("accepts a real image and reports its sniffed type", () => {
    const r = validatePhoto(JPEG);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.type).toBe("image/jpeg");
      expect(r.bytes.length).toBe(JPEG.length);
    }
  });

  it("rejects an empty file", () => {
    const r = validatePhoto(Buffer.alloc(0));
    expect(r.ok).toBe(false);
  });

  it("rejects anything over the size limit", () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(MAX_PHOTO_BYTES + 1)]);
    const r = validatePhoto(big);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("limit");
  });

  it("rejects HTML outright — this is the stored-XSS path", () => {
    const r = validatePhoto(pad([...Buffer.from("<!DOCTYPE html><script>")]));
    expect(r.ok).toBe(false);
  });

  it("accepts a file exactly at the limit", () => {
    const exact = Buffer.concat([JPEG, Buffer.alloc(MAX_PHOTO_BYTES - JPEG.length)]);
    expect(exact.length).toBe(MAX_PHOTO_BYTES);
    expect(validatePhoto(exact).ok).toBe(true);
  });
});
