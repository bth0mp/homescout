/**
 * Forgiving coercion for money/percent inputs.
 * Accepts "350,000", "$350,000", "6.25%", "6.25", " 1.5 ", "" -> null.
 */
export function parseNumber(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/[$,%\s,]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Same as parseNumber but returns 0 instead of null, for "blank means zero" fields. */
export function parseNumberOr0(input: unknown): number {
  return parseNumber(input) ?? 0;
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usdCents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function money(n: number, cents = false): string {
  if (!Number.isFinite(n)) return "—";
  return cents ? usdCents.format(n) : usd.format(n);
}

export function pct(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

/**
 * Cache key for geocoding. Collapses case, punctuation and whitespace so
 * "123 Main St." and "123 main st" resolve to the same cached row.
 */
export function normalizeAddress(input: string): string {
  return input
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
