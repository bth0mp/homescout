import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetRateLimits,
  expiryFromHours,
  isWellFormedToken,
  newToken,
  rateLimit,
  shareState,
} from "@/lib/share";

describe("newToken", () => {
  it("is URL-safe and long enough to be unguessable", () => {
    for (let i = 0; i < 50; i++) {
      const t = newToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(t.length).toBeGreaterThanOrEqual(16);
      expect(isWellFormedToken(t)).toBe(true);
    }
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 2_000 }, () => newToken()));
    expect(seen.size).toBe(2_000);
  });
});

describe("isWellFormedToken", () => {
  it("rejects anything that is not a token, before any database lookup", () => {
    for (const bad of [
      "",
      "short",
      "has spaces here!!",
      "../../etc/passwd",
      "a".repeat(200),
      "tok+en/with=base64",
      "'; DROP TABLE share_links;--",
    ]) {
      expect(isWellFormedToken(bad), bad).toBe(false);
    }
  });
});

describe("shareState", () => {
  const now = new Date("2026-08-17T12:00:00Z");

  it("is valid when neither revoked nor expired", () => {
    expect(shareState({ expiresAt: null, revokedAt: null }, now)).toBe("valid");
    expect(shareState({ expiresAt: new Date("2026-09-01"), revokedAt: null }, now)).toBe("valid");
  });

  it("is expired once the moment has passed", () => {
    expect(shareState({ expiresAt: new Date("2026-08-01"), revokedAt: null }, now)).toBe("expired");
  });

  it("expires exactly at the boundary, not a moment later", () => {
    expect(shareState({ expiresAt: new Date(now), revokedAt: null }, now)).toBe("expired");
    expect(
      shareState({ expiresAt: new Date(now.getTime() + 1), revokedAt: null }, now),
    ).toBe("valid");
  });

  it("reports revoked ahead of expired", () => {
    // A link killed on purpose should say so in the admin UI even if it had
    // also aged out.
    expect(
      shareState({ expiresAt: new Date("2026-08-01"), revokedAt: new Date("2026-08-05") }, now),
    ).toBe("revoked");
  });

  it("treats a missing share as unknown rather than throwing", () => {
    expect(shareState(null, now)).toBe("unknown");
    expect(shareState(undefined, now)).toBe("unknown");
  });
});

describe("expiryFromHours", () => {
  const now = new Date("2026-08-17T12:00:00Z");

  it("adds the requested hours", () => {
    expect(expiryFromHours(24, now)!.toISOString()).toBe("2026-08-18T12:00:00.000Z");
  });

  it("treats zero and negative as never expiring", () => {
    expect(expiryFromHours(0, now)).toBeNull();
    expect(expiryFromHours(-5, now)).toBeNull();
  });
});

describe("rateLimit", () => {
  beforeEach(() => __resetRateLimits());

  it("allows up to the limit then blocks", () => {
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("ip", 5, 60_000, t).allowed, `call ${i + 1}`).toBe(true);
    }
    expect(rateLimit("ip", 5, 60_000, t).allowed).toBe(false);
  });

  it("counts down remaining", () => {
    const t = 1_000_000;
    expect(rateLimit("ip", 3, 60_000, t).remaining).toBe(2);
    expect(rateLimit("ip", 3, 60_000, t).remaining).toBe(1);
    expect(rateLimit("ip", 3, 60_000, t).remaining).toBe(0);
  });

  it("resets after the window", () => {
    const t = 1_000_000;
    rateLimit("ip", 1, 60_000, t);
    expect(rateLimit("ip", 1, 60_000, t).allowed).toBe(false);
    expect(rateLimit("ip", 1, 60_000, t + 60_001).allowed).toBe(true);
  });

  it("keeps separate buckets per key", () => {
    const t = 1_000_000;
    rateLimit("a", 1, 60_000, t);
    expect(rateLimit("a", 1, 60_000, t).allowed).toBe(false);
    // One caller being throttled must not throttle everyone else.
    expect(rateLimit("b", 1, 60_000, t).allowed).toBe(true);
  });

  it("does not grow without bound", () => {
    const t = 1_000_000;
    for (let i = 0; i < 6_000; i++) rateLimit(`k${i}`, 10, 1_000, t);
    // Every bucket above is stale by now; the next call sweeps them.
    const after = rateLimit("trigger", 10, 1_000, t + 5_000);
    expect(after.allowed).toBe(true);
  });
});
