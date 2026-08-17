import { describe, expect, it } from "vitest";
import { breakEvenAgainstRent, ownershipOverTime } from "@/lib/va/ownership";
import {
  estimateAnnualTax,
  estimateMonthlyMaintenance,
  taxRank,
  taxRateForState,
} from "@/lib/property-tax";

const base = {
  loanAmount: 350_000,
  interestRate: 6.5,
  termYears: 30,
  price: 350_000,
  downPayment: 0,
  cashToClose: 18_000,
  propertyTaxAnnual: 3_600,
  insuranceAnnual: 1_200,
  hoaMonthly: 50,
  appreciationPct: 3,
  costInflationPct: 3,
};

describe("ownershipOverTime", () => {
  it("returns a point per requested year", () => {
    const pts = ownershipOverTime(base, [1, 5, 30]);
    expect(pts.map((p) => p.year)).toEqual([1, 5, 30]);
  });

  it("pays mostly interest early on", () => {
    const [y1] = ownershipOverTime(base, [1]);
    expect(y1.interestPaid).toBeGreaterThan(y1.principalPaid * 4);
  });

  it("pays down the balance to zero by the end of the term", () => {
    const [y30] = ownershipOverTime(base, [30]);
    expect(y30.remainingBalance).toBe(0);
    expect(y30.principalPaid).toBeCloseTo(350_000, 0);
  });

  it("grows carrying costs rather than holding them flat", () => {
    const flat = ownershipOverTime({ ...base, costInflationPct: 0 }, [10])[0];
    const grown = ownershipOverTime({ ...base, costInflationPct: 3 }, [10])[0];
    expect(grown.taxInsHoaPaid).toBeGreaterThan(flat.taxInsHoaPaid);
    // 10 years of tax+ins+hoa at 3% growth on 5,400/yr.
    expect(flat.taxInsHoaPaid).toBeCloseTo(54_000, 0);
  });

  it("counts cash to close once, not twice", () => {
    const [y1] = ownershipOverTime(base, [1]);
    expect(y1.totalPaid).toBeCloseTo(
      base.cashToClose + y1.interestPaid + y1.principalPaid + y1.taxInsHoaPaid,
      1,
    );
  });

  it("builds equity from both appreciation and principal", () => {
    const [y5] = ownershipOverTime(base, [5]);
    expect(y5.estimatedValue).toBeGreaterThan(base.price);
    expect(y5.equity).toBeCloseTo(y5.estimatedValue - y5.remainingBalance, 1);
  });

  it("shows a negative net position early — the honest part", () => {
    // Year one you are down closing costs and a year of interest.
    const [y1] = ownershipOverTime(base, [1]);
    expect(y1.netPosition).toBeLessThan(0);
  });

  it("with zero appreciation, equity is only what you paid down", () => {
    const [y5] = ownershipOverTime({ ...base, appreciationPct: 0 }, [5]);
    expect(y5.estimatedValue).toBeCloseTo(350_000, 0);
    expect(y5.equity).toBeCloseTo(350_000 - y5.remainingBalance, 1);
  });

  it("clamps a year beyond the term to the term", () => {
    const pts = ownershipOverTime({ ...base, termYears: 15 }, [30]);
    expect(pts[0].remainingBalance).toBe(0);
  });

  it("returns nothing for a degenerate loan", () => {
    expect(ownershipOverTime({ ...base, loanAmount: 0 })).toEqual([]);
  });
});

describe("breakEvenAgainstRent", () => {
  it("breaks even sooner against expensive rent", () => {
    const cheap = breakEvenAgainstRent(base, 1_200, 3);
    const dear = breakEvenAgainstRent(base, 3_500, 3);
    expect(dear).not.toBeNull();
    if (cheap !== null) expect(dear!).toBeLessThan(cheap);
  });

  it("returns null when rent is not supplied", () => {
    expect(breakEvenAgainstRent(base, 0, 3)).toBeNull();
  });

  it("returns a month number inside the term when it does break even", () => {
    const m = breakEvenAgainstRent(base, 3_000, 3);
    if (m !== null) {
      expect(m).toBeGreaterThan(0);
      expect(m).toBeLessThanOrEqual(360);
    }
  });
});

describe("property tax by state", () => {
  it("knows every state plus DC", () => {
    expect(taxRateForState("WA")).toBeCloseTo(0.94, 2);
    expect(taxRateForState("NJ")).toBeCloseTo(2.47, 2);
    expect(taxRateForState("HI")).toBeCloseTo(0.32, 2);
    expect(taxRateForState("dc")).toBeCloseTo(0.57, 2);
  });

  it("returns null for an unknown state rather than guessing", () => {
    expect(taxRateForState("XX")).toBeNull();
    expect(taxRateForState("")).toBeNull();
    expect(estimateAnnualTax(350_000, "XX")).toBeNull();
  });

  it("estimates annual tax from price", () => {
    // 350,000 at WA's 0.94%
    expect(estimateAnnualTax(350_000, "WA")).toBe(3_290);
    expect(estimateAnnualTax(350_000, "NJ")).toBe(8_645);
  });

  it("does not estimate without a price", () => {
    expect(estimateAnnualTax(0, "WA")).toBeNull();
    expect(estimateAnnualTax(-1, "WA")).toBeNull();
  });

  it("estimates a maintenance reserve at 1% of value per year", () => {
    // $395,000 house -> $3,950/yr -> $329/mo. Not in any mortgage payment,
    // which is exactly why it needs showing.
    expect(estimateMonthlyMaintenance(395_000)).toBe(329);
    expect(estimateMonthlyMaintenance(0)).toBeNull();
    expect(estimateMonthlyMaintenance(-1)).toBeNull();
  });

  it("ranks New Jersey as the most expensive and Hawaii the cheapest", () => {
    expect(taxRank("NJ")!.rank).toBe(1);
    const hi = taxRank("HI")!;
    expect(hi.rank).toBe(hi.of);
  });
});
