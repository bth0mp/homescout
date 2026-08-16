import { describe, expect, it } from "vitest";
import {
  boundingBox,
  categorize,
  monthKeys,
  ratePer100k,
  tally,
} from "@/lib/crime/types";

describe("categorize", () => {
  it("recognises violent offences across provider vocabularies", () => {
    for (const s of [
      "HOMICIDE",
      "Criminal Homicide",
      "Murder & Non-Negligent Manslaughter",
      "ROBBERY",
      "Aggravated Assault",
      "AGG ASSAULT",
      "RAPE",
      "Sex Offense",
      "KIDNAPPING",
    ]) {
      expect(categorize(s), s).toBe("violent");
    }
  });

  it("recognises property offences", () => {
    for (const s of [
      "BURGLARY",
      "THEFT",
      "LARCENY - FROM VEHICLE",
      "MOTOR VEHICLE THEFT",
      "ARSON",
      "CRIMINAL DAMAGE",
      "VANDALISM",
      "SHOPLIFTING",
    ]) {
      expect(categorize(s), s).toBe("property");
    }
  });

  it("recognises quality-of-life offences", () => {
    for (const s of ["NARCOTICS", "Liquor Law Violation", "DISORDERLY CONDUCT", "PROSTITUTION"]) {
      expect(categorize(s), s).toBe("quality-of-life");
    }
  });

  it("puts anything unrecognised in other rather than guessing", () => {
    // Guessing wrong inflates "violent", which is the number people react to.
    for (const s of ["", "MISC", "OTHER OFFENSE", "ZZZ", "NON-CRIMINAL"]) {
      expect(categorize(s), s).toBe("other");
    }
  });

  it("does not let a substring drag an offence into the wrong bucket", () => {
    // "Assault" appears inside violent matching, but simple assault is not
    // aggravated — it should not be silently promoted.
    expect(categorize("THEFT OF MOTOR VEHICLE")).toBe("property");
    expect(categorize("CRIMINAL TRESPASS TO LAND")).toBe("quality-of-life");
  });
});

describe("tally", () => {
  it("counts by bucket, largest first", () => {
    const t = tally(["THEFT", "BURGLARY", "THEFT", "HOMICIDE", "NARCOTICS", "THEFT"]);
    expect(t[0]).toEqual({ category: "property", count: 4 });
    expect(t.find((x) => x.category === "violent")?.count).toBe(1);
    expect(t.find((x) => x.category === "quality-of-life")?.count).toBe(1);
  });

  it("returns an empty list for no offences", () => {
    expect(tally([])).toEqual([]);
  });
});

describe("ratePer100k", () => {
  it("annualises a partial period", () => {
    // 600 incidents over 12 months in a population of 100,000 -> 600 per 100k.
    expect(ratePer100k(600, 100_000, 12)).toBe(600);
    // Same 600 over only 6 months annualises to 1,200.
    expect(ratePer100k(600, 100_000, 6)).toBe(1_200);
  });

  it("scales by population", () => {
    expect(ratePer100k(300, 50_000, 12)).toBe(600);
  });

  it("returns undefined rather than Infinity when population is unknown", () => {
    expect(ratePer100k(600, 0, 12)).toBeUndefined();
    expect(ratePer100k(600, -1, 12)).toBeUndefined();
    expect(ratePer100k(600, 100_000, 0)).toBeUndefined();
  });
});

describe("boundingBox", () => {
  it("is roughly a mile per 1/69th of a degree of latitude", () => {
    const b = boundingBox(47.43, -120.33, 1);
    expect(b.maxLat - b.minLat).toBeCloseTo(2 / 69, 5);
  });

  it("widens longitude toward the poles", () => {
    const equator = boundingBox(0, 0, 1);
    const north = boundingBox(60, 0, 1);
    const eqWidth = equator.maxLng - equator.minLng;
    const nWidth = north.maxLng - north.minLng;
    // cos(60) = 0.5, so a degree of longitude covers half the distance.
    expect(nWidth).toBeCloseTo(eqWidth * 2, 3);
  });

  it("does not blow up at the pole", () => {
    const b = boundingBox(90, 0, 1);
    expect(Number.isFinite(b.minLng)).toBe(true);
    expect(Number.isFinite(b.maxLng)).toBe(true);
  });

  it("brackets the origin point", () => {
    const b = boundingBox(47.43, -120.33, 2);
    expect(b.minLat).toBeLessThan(47.43);
    expect(b.maxLat).toBeGreaterThan(47.43);
    expect(b.minLng).toBeLessThan(-120.33);
    expect(b.maxLng).toBeGreaterThan(-120.33);
  });
});

describe("monthKeys", () => {
  it("returns N months oldest-first, ending with the current month", () => {
    const keys = monthKeys(new Date(Date.UTC(2026, 7, 16)), 12);
    expect(keys).toHaveLength(12);
    expect(keys[11]).toBe("2026-08");
    expect(keys[0]).toBe("2025-09");
  });

  it("rolls back across a year boundary", () => {
    const keys = monthKeys(new Date(Date.UTC(2026, 1, 5)), 3);
    expect(keys).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("zero-pads single-digit months", () => {
    expect(monthKeys(new Date(Date.UTC(2026, 0, 1)), 1)).toEqual(["2026-01"]);
  });
});
