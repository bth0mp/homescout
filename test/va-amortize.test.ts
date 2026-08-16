import { describe, expect, it } from "vitest";
import { amortizationSchedule, calculateLoan, monthlyPayment } from "@/lib/va/amortize";

describe("monthlyPayment", () => {
  it("matches known-good amortization figures", () => {
    // $200,000 @ 6% / 30yr -> $1,199.10 (standard textbook figure)
    expect(monthlyPayment(200_000, 6, 360)).toBeCloseTo(1199.1, 1);
    // $300,000 @ 7% / 30yr -> $1,995.91
    expect(monthlyPayment(300_000, 7, 360)).toBeCloseTo(1995.91, 1);
    // $200,000 @ 6% / 15yr -> $1,687.71
    expect(monthlyPayment(200_000, 6, 180)).toBeCloseTo(1687.71, 1);
  });

  it("handles 0% interest as straight-line principal", () => {
    expect(monthlyPayment(360_000, 0, 360)).toBe(1000);
  });

  it("returns 0 rather than NaN for degenerate input", () => {
    expect(monthlyPayment(0, 6, 360)).toBe(0);
    expect(monthlyPayment(200_000, 6, 0)).toBe(0);
    expect(monthlyPayment(-1, 6, 360)).toBe(0);
  });
});

describe("calculateLoan", () => {
  const base = {
    price: 350_000,
    downPayment: 0,
    firstUse: true,
    exempt: false,
    interestRate: 6.5,
    termYears: 30,
    financeFee: true,
    propertyTaxAnnual: 3_600,
    insuranceAnnual: 1_200,
    hoaMonthly: 50,
  };

  it("adds a financed funding fee to principal BEFORE amortizing", () => {
    const r = calculateLoan(base);
    expect(r.baseLoan).toBe(350_000);
    expect(r.fundingFeeRate).toBe(2.15);
    expect(r.fundingFeeAmount).toBe(7_525);
    expect(r.loanAmount).toBe(357_525); // fee rolled in
    expect(r.feeDueAtClosing).toBe(0);
    // P&I must be computed on 357,525 — not on 350,000.
    expect(r.monthlyPI).toBeCloseTo(monthlyPayment(357_525, 6.5, 360), 2);
    expect(r.monthlyPI).not.toBeCloseTo(monthlyPayment(350_000, 6.5, 360), 2);
  });

  it("leaves principal alone and bills the fee at closing when not financed", () => {
    const r = calculateLoan({ ...base, financeFee: false });
    expect(r.loanAmount).toBe(350_000);
    expect(r.feeDueAtClosing).toBe(7_525);
    expect(r.monthlyPI).toBeCloseTo(monthlyPayment(350_000, 6.5, 360), 2);
  });

  it("totals PITI + HOA, and never adds PMI", () => {
    const r = calculateLoan(base);
    expect(r.monthlyTax).toBe(300); // 3600/12
    expect(r.monthlyInsurance).toBe(100); // 1200/12
    expect(r.monthlyHoa).toBe(50);
    expect(r.monthlyTotal).toBeCloseTo(r.monthlyPI + 300 + 100 + 50, 2);
    // Zero down on a VA loan still carries no mortgage insurance.
    expect(Object.keys(r)).not.toContain("monthlyPmi");
  });

  it("an exempt borrower with zero down borrows exactly the price", () => {
    const r = calculateLoan({ ...base, exempt: true });
    expect(r.fundingFeeAmount).toBe(0);
    expect(r.loanAmount).toBe(350_000);
    expect(r.feeDueAtClosing).toBe(0);
  });

  it("computes total interest over the term", () => {
    const r = calculateLoan({ ...base, termYears: 15 });
    expect(r.months).toBe(180);
    expect(r.totalInterest).toBeCloseTo(r.monthlyPI * 180 - r.loanAmount, -1);
    // A 15-year term costs far less interest than 30.
    expect(r.totalInterest).toBeLessThan(calculateLoan(base).totalInterest);
  });
});

describe("amortizationSchedule", () => {
  it("runs the full term and ends at exactly zero", () => {
    const rows = amortizationSchedule(357_525, 6.5, 360);
    expect(rows).toHaveLength(360);
    expect(rows[359].balance).toBe(0);
  });

  it("splits each payment into interest and principal correctly", () => {
    const rows = amortizationSchedule(200_000, 6, 360);
    // Month 1 interest = 200,000 * 0.06/12 = 1,000
    expect(rows[0].interest).toBe(1000);
    expect(rows[0].principal).toBeCloseTo(199.1, 1);
    expect(rows[0].balance).toBeCloseTo(199_800.9, 1);
  });

  it("shifts from interest-heavy to principal-heavy over the term", () => {
    const rows = amortizationSchedule(200_000, 6, 360);
    expect(rows[0].interest).toBeGreaterThan(rows[0].principal);
    expect(rows[359].principal).toBeGreaterThan(rows[359].interest);
  });

  it("principal paid over the schedule sums to the loan amount", () => {
    const principal = 357_525;
    const rows = amortizationSchedule(principal, 6.5, 360);
    const paid = rows.reduce((s, r) => s + r.principal, 0);
    expect(paid).toBeCloseTo(principal, 1);
  });

  it("interest sums to roughly the reported total interest", () => {
    const rows = amortizationSchedule(200_000, 6, 360);
    const interest = rows.reduce((s, r) => s + r.interest, 0);
    // 30yr @6% on 200k costs ~231,676 in interest.
    expect(interest).toBeCloseTo(231_676, -2);
  });

  it("handles a 0% loan", () => {
    const rows = amortizationSchedule(12_000, 0, 12);
    expect(rows).toHaveLength(12);
    expect(rows[0].interest).toBe(0);
    expect(rows[0].principal).toBe(1000);
    expect(rows[11].balance).toBe(0);
  });

  it("agrees with the summary — same payment, same total interest", () => {
    // The summary card and the amortization table are read side by side, so a
    // borrower notices immediately if they disagree.
    const loan = calculateLoan({
      price: 350_000,
      downPayment: 0,
      firstUse: true,
      exempt: false,
      interestRate: 6.5,
      termYears: 30,
      financeFee: true,
    });
    const rows = amortizationSchedule(loan.loanAmount, 6.5, loan.months);

    expect(rows[0].payment).toBe(loan.monthlyPI);
    const scheduleInterest = rows.reduce((s, r) => s + r.interest, 0);
    // Exact to the cent: the summary is summed from this very schedule.
    expect(scheduleInterest).toBeCloseTo(loan.totalInterest, 2);
  });

  it("returns an empty schedule for degenerate input", () => {
    expect(amortizationSchedule(0, 6, 360)).toEqual([]);
    expect(amortizationSchedule(200_000, 6, 0)).toEqual([]);
  });
});
