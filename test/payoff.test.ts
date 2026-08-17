import { describe, expect, it } from "vitest";
import { formatMonths, payoffWithExtra } from "@/lib/va/payoff";

describe("payoffWithExtra", () => {
  it("changes nothing when the extra is zero", () => {
    const r = payoffWithExtra(395_000, 6.3, 360, 0)!;
    expect(r.months).toBe(360);
    expect(r.monthsSaved).toBe(0);
    expect(r.interestSaved).toBeCloseTo(0, 2);
  });

  it("matches the known result for $100/mo extra on a 30-year loan", () => {
    // $395,000 at 6.3% over 30 years. Base payment is $2,444.94.
    const r = payoffWithExtra(395_000, 6.3, 360, 100)!;
    expect(r.basePayment).toBeCloseTo(2_444.94, 1);
    // Roughly two and a half years earlier.
    expect(r.monthsSaved).toBeGreaterThan(24);
    expect(r.monthsSaved).toBeLessThan(40);
    expect(r.interestSaved).toBeGreaterThan(40_000);
  });

  it("saves more the larger the overpayment", () => {
    const a = payoffWithExtra(395_000, 6.3, 360, 100)!;
    const b = payoffWithExtra(395_000, 6.3, 360, 300)!;
    const c = payoffWithExtra(395_000, 6.3, 360, 1_000)!;
    expect(b.monthsSaved).toBeGreaterThan(a.monthsSaved);
    expect(c.monthsSaved).toBeGreaterThan(b.monthsSaved);
    expect(c.interestSaved).toBeGreaterThan(b.interestSaved);
  });

  it("returns less interest paid than the baseline, always", () => {
    const noExtra = payoffWithExtra(300_000, 7, 360, 0)!;
    const withExtra = payoffWithExtra(300_000, 7, 360, 250)!;
    expect(withExtra.totalInterest).toBeLessThan(noExtra.totalInterest);
    expect(withExtra.interestSaved).toBeCloseTo(
      noExtra.totalInterest - withExtra.totalInterest,
      1,
    );
  });

  it("never runs past the scheduled term", () => {
    const r = payoffWithExtra(395_000, 6.3, 360, 0)!;
    expect(r.months).toBeLessThanOrEqual(360);
  });

  it("handles a very large overpayment without looping forever", () => {
    const r = payoffWithExtra(100_000, 6, 360, 50_000)!;
    expect(r.months).toBeLessThan(4);
    expect(r.monthsSaved).toBeGreaterThan(355);
  });

  it("handles a zero-interest loan", () => {
    const r = payoffWithExtra(36_000, 0, 36, 500)!;
    expect(r.totalInterest).toBe(0);
    // 1,000/mo scheduled plus 500 extra clears 36,000 in 24 months.
    expect(r.months).toBe(24);
    expect(r.monthsSaved).toBe(12);
  });

  it("shortens a 15-year loan too, not just a 30", () => {
    const r = payoffWithExtra(395_000, 6.3, 180, 200)!;
    expect(r.monthsSaved).toBeGreaterThan(0);
    expect(r.months).toBeLessThan(180);
  });

  it("returns null for a degenerate loan", () => {
    expect(payoffWithExtra(0, 6.3, 360, 100)).toBeNull();
    expect(payoffWithExtra(395_000, 6.3, 0, 100)).toBeNull();
  });

  it("treats a negative extra as zero rather than extending the loan", () => {
    const r = payoffWithExtra(395_000, 6.3, 360, -500)!;
    expect(r.months).toBe(360);
    expect(r.extraMonthly).toBe(0);
  });
});

describe("formatMonths", () => {
  it("reads the way a person would say it", () => {
    expect(formatMonths(31)).toBe("2 years 7 months");
    expect(formatMonths(24)).toBe("2 years");
    expect(formatMonths(7)).toBe("7 months");
    expect(formatMonths(1)).toBe("1 month");
    expect(formatMonths(12)).toBe("1 year");
    expect(formatMonths(0)).toBe("no time");
  });
});
