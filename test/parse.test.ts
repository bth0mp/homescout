import { describe, expect, it } from "vitest";
import { money, parseNumber, parseNumberOr0, pct } from "@/lib/parse";

describe("parseNumber", () => {
  it("accepts the ways a human types money and percents", () => {
    expect(parseNumber("350,000")).toBe(350000);
    expect(parseNumber("$350,000")).toBe(350000);
    expect(parseNumber("6.25%")).toBe(6.25);
    expect(parseNumber("6.25")).toBe(6.25);
    expect(parseNumber(" 1.5 ")).toBe(1.5);
    expect(parseNumber("-2,000")).toBe(-2000);
    expect(parseNumber(0)).toBe(0);
  });

  it("returns null for blank or junk rather than NaN", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("   ")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("-")).toBeNull();
    expect(parseNumber(".")).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
    expect(parseNumber(Number.NaN)).toBeNull();
    expect(parseNumberOr0("")).toBe(0);
  });
});

describe("formatting", () => {
  it("formats currency and percent", () => {
    expect(money(350000)).toBe("$350,000");
    expect(money(1234.56, true)).toBe("$1,234.56");
    expect(money(Number.NaN)).toBe("—");
    expect(pct(6.25)).toBe("6.25%");
  });
});
