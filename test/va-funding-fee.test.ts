import { describe, expect, it } from "vitest";
import { exemptFromRating, fundingFee, fundingFeeRate } from "@/lib/va/funding-fee";

const P = 400_000;

describe("fundingFeeRate — first use", () => {
  it("charges 2.15% under 5% down", () => {
    expect(fundingFeeRate({ price: P, downPayment: 0, firstUse: true })).toBe(2.15);
    expect(fundingFeeRate({ price: P, downPayment: 19_999, firstUse: true })).toBe(2.15);
  });

  it("charges 1.50% from 5% to 9.99% down", () => {
    expect(fundingFeeRate({ price: P, downPayment: 20_000, firstUse: true })).toBe(1.5);
    expect(fundingFeeRate({ price: P, downPayment: 39_999, firstUse: true })).toBe(1.5);
  });

  it("charges 1.25% at 10% down and above", () => {
    expect(fundingFeeRate({ price: P, downPayment: 40_000, firstUse: true })).toBe(1.25);
    expect(fundingFeeRate({ price: P, downPayment: 200_000, firstUse: true })).toBe(1.25);
  });
});

describe("fundingFeeRate — subsequent use", () => {
  it("charges 3.30% under 5% down, the only tier that differs", () => {
    expect(fundingFeeRate({ price: P, downPayment: 0, firstUse: false })).toBe(3.3);
    expect(fundingFeeRate({ price: P, downPayment: 19_999, firstUse: false })).toBe(3.3);
  });

  it("matches first-use rates at 5% and above", () => {
    expect(fundingFeeRate({ price: P, downPayment: 20_000, firstUse: false })).toBe(1.5);
    expect(fundingFeeRate({ price: P, downPayment: 40_000, firstUse: false })).toBe(1.25);
  });
});

describe("tier boundaries are exact", () => {
  it("puts exactly 5% and exactly 10% in the cheaper tier", () => {
    // 5.00% down -> 1.50%, not 2.15%. A >= vs > slip shows up here.
        expect(fundingFeeRate({ price: 100_000, downPayment: 5_000, firstUse: true })).toBe(1.5);
    expect(fundingFeeRate({ price: 100_000, downPayment: 10_000, firstUse: true })).toBe(1.25);
    // A cent under the boundary stays in the more expensive tier.
    expect(fundingFeeRate({ price: 100_000, downPayment: 4_999.99, firstUse: true })).toBe(2.15);
    expect(fundingFeeRate({ price: 100_000, downPayment: 9_999.99, firstUse: true })).toBe(1.5);
  });
});

describe("exemptFromRating", () => {
  it("waives from 10% up — the lowest compensable rating", () => {
    expect(exemptFromRating(10)).toBe(true);
    expect(exemptFromRating(30)).toBe(true);
    expect(exemptFromRating(100)).toBe(true);
  });

  it("does NOT waive at 0% — service-connected but not compensable", () => {
    expect(exemptFromRating(0)).toBe(false);
  });

  it("says nothing when there is no rating", () => {
    // Purple Heart on active duty and surviving spouses are exempt with no
    // rating at all, so this helper must not be the only path to the exemption.
    expect(exemptFromRating(null)).toBe(false);
    expect(exemptFromRating(Number.NaN)).toBe(false);
  });
});

describe("fundingFee", () => {
  it("computes the fee off the base loan, not the price", () => {
    const f = fundingFee({ price: P, downPayment: 20_000, firstUse: true, exempt: false });
    expect(f.baseLoan).toBe(380_000);
    expect(f.rate).toBe(1.5);
    expect(f.amount).toBe(5_700); // 380,000 * 1.5%
  });

  it("zero down, first use", () => {
    const f = fundingFee({ price: 350_000, downPayment: 0, firstUse: true, exempt: false });
    expect(f.baseLoan).toBe(350_000);
    expect(f.amount).toBe(7_525); // 350,000 * 2.15%
  });

  it("zero down, subsequent use costs materially more", () => {
    const f = fundingFee({ price: 350_000, downPayment: 0, firstUse: false, exempt: false });
    expect(f.amount).toBe(11_550); // 350,000 * 3.30%
  });

  it("exemption zeroes the fee regardless of down payment or use", () => {
    for (const firstUse of [true, false]) {
      for (const downPayment of [0, 20_000, 40_000]) {
        const f = fundingFee({ price: P, downPayment, firstUse, exempt: true });
        expect(f.amount).toBe(0);
        expect(f.rate).toBe(0);
        expect(f.exempt).toBe(true);
      }
    }
  });

  it("handles degenerate input without producing NaN", () => {
    expect(fundingFee({ price: 0, downPayment: 0, firstUse: true, exempt: false }).amount).toBe(0);
    // Down payment larger than the price cannot make the loan negative.
    const over = fundingFee({ price: 100_000, downPayment: 150_000, firstUse: true, exempt: false });
    expect(over.baseLoan).toBe(0);
    expect(over.amount).toBe(0);
    // Negative down payment is clamped, not trusted.
    const neg = fundingFee({ price: 100_000, downPayment: -5_000, firstUse: true, exempt: false });
    expect(neg.baseLoan).toBe(100_000);
    expect(neg.rate).toBe(2.15);
  });
});
