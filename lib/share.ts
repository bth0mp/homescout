import { randomBytes } from "node:crypto";

/**
 * 96 bits of entropy, URL-safe. ponytail: no nanoid dependency — this is one
 * line of node:crypto and the alphabet is already URL-safe.
 */
export function newToken(): string {
  return randomBytes(12).toString("base64url");
}

/** Tokens we generate are always 16 base64url chars. */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export function isWellFormedToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export type ShareState = "valid" | "revoked" | "expired" | "unknown";

export type ShareLike = {
  expiresAt: Date | null;
  revokedAt: Date | null;
} | null | undefined;

/**
 * Revoked is checked before expired so a link deliberately killed reports as
 * such in the admin UI even if it had also aged out.
 *
 * Callers must render every non-valid state identically to the public — a
 * distinct "expired" page confirms the token once existed, which a plain 404
 * does not.
 */
export function shareState(share: ShareLike, now: Date = new Date()): ShareState {
  if (!share) return "unknown";
  if (share.revokedAt) return "revoked";
  if (share.expiresAt && share.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

export const EXPIRY_CHOICES = [
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 24 * 7 },
  { label: "30 days", hours: 24 * 30 },
  { label: "Never", hours: 0 },
] as const;

export function expiryFromHours(hours: number, now: Date = new Date()): Date | null {
  if (!hours || hours <= 0) return null;
  return new Date(now.getTime() + hours * 3_600_000);
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

type Hit = { count: number; resetAt: number };

// ponytail: an in-memory Map, not Redis. Single process, single user, and the
// worst case of losing the state on restart is that an attacker gets one extra
// window. Ceiling: this does not survive multiple replicas — move to a shared
// store if the app is ever scaled out.
const buckets = new Map<string, Hit>();

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

export function rateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000,
  now: number = Date.now(),
): RateLimitResult {
  const hit = buckets.get(key);

  if (!hit || hit.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    // Opportunistic sweep so the map cannot grow without bound.
    if (buckets.size > 5_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return { allowed: true, remaining: limit - 1, resetAt: fresh.resetAt };
  }

  hit.count += 1;
  return {
    allowed: hit.count <= limit,
    remaining: Math.max(0, limit - hit.count),
    resetAt: hit.resetAt,
  };
}

/** Exposed for tests; never called in app code. */
export function __resetRateLimits(): void {
  buckets.clear();
}
