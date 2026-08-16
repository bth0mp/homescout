import { describe, expect, it } from "vitest";
import { money, normalizeAddress, parseNumber, parseNumberOr0, pct, titleCase } from "@/lib/parse";

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

describe("normalizeAddress", () => {
  it("collapses punctuation, case and whitespace to one cache key", () => {
    const key = "123 main st washington dc 20500";
    expect(normalizeAddress("123 Main St., Washington, DC 20500")).toBe(key);
    expect(normalizeAddress("  123   main st washington dc 20500 ")).toBe(key);
    expect(normalizeAddress("123 Main St, Washington, DC, 20500")).toBe(key);
  });

  it("keeps genuinely different addresses apart", () => {
    expect(normalizeAddress("123 Main St")).not.toBe(normalizeAddress("124 Main St"));
  });
});

describe("titleCase", () => {
  it("tames the Census geocoder's shouting without mangling directionals", () => {
    expect(titleCase("908 ELLIOTT AVE")).toBe("908 Elliott Ave");
    expect(titleCase("WENATCHEE")).toBe("Wenatchee");
    expect(titleCase("1600 PENNSYLVANIA AVE NW")).toBe("1600 Pennsylvania Ave NW");
    expect(titleCase("123 N MAIN ST")).toBe("123 N Main St");
    expect(titleCase("")).toBe("");
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
