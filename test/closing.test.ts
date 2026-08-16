import { describe, expect, it } from "vitest";
import {
  NO_TRANSFER_TAX,
  TRANSFER_TAX_PCT,
  VA_ORIGINATION_CAP_PCT,
  defaultLineItems,
  type LineItemId,
} from "@/lib/closing/defaults";
import { daysToMonthEnd, estimateClosing } from "@/lib/closing/estimate";

const items = (over: Partial<Record<LineItemId, number>> = {}) =>
  ({
    appraisal: 900,
    creditReport: 75,
    origination: 3_500,
    discountPoints: 0,
    titleSearch: 450,
    lendersTitle: 1_750,
    ownersTitle: 1_750,
    settlement: 650,
    recording: 150,
    transferTax: 4_480,
    survey: 500,
    pestInspection: 0,
    homeInspection: 450,
    ...over,
  }) as Record<LineItemId, number>;

const base = {
  price: 350_000,
  loanAmount: 350_000,
  downPayment: 0,
  fundingFeeDueAtClosing: 0,
  items: items(),
  interestRate: 6.5,
  prepaidInterestDays: 15,
  insuranceAnnual: 1_200,
  propertyTaxAnnual: 3_600,
  taxReserveMonths: 3,
  insuranceReserveMonths: 2,
  sellerConcessions: 0,
  lenderCredits: 0,
  earnestMoney: 0,
};

describe("defaults", () => {
  it("keys origination and title off the loan and price", () => {
    const d = defaultLineItems({ price: 400_000, loanAmount: 380_000, state: "WA" });
    expect(d.origination).toBe(3_800); // 1% of loan
    expect(d.lendersTitle).toBe(1_900); // 0.5% of loan
    expect(d.ownersTitle).toBe(2_000); // 0.5% of price
  });

  it("applies state transfer tax, and zero where a state has none", () => {
    expect(defaultLineItems({ price: 350_000, loanAmount: 350_000, state: "WA" }).transferTax).toBe(
      350_000 * (TRANSFER_TAX_PCT.WA / 100),
    );
    for (const state of ["TX", "OR", "ID", "MT"]) {
      expect(NO_TRANSFER_TAX.has(state)).toBe(true);
      expect(defaultLineItems({ price: 350_000, loanAmount: 350_000, state }).transferTax).toBe(0);
    }
  });

  it("does not budget the pest inspection to the buyer by default", () => {
    // Long restricted on VA purchases and customarily the seller's; defaulting
    // it to the buyer would overstate cash to close.
    expect(defaultLineItems({ price: 350_000, loanAmount: 350_000, state: "WA" }).pestInspection).toBe(0);
  });

  it("returns zero rather than inventing a rate for an unlisted state", () => {
    expect(defaultLineItems({ price: 350_000, loanAmount: 350_000, state: "ZZ" }).transferTax).toBe(0);
  });

  it("is case and whitespace tolerant on state", () => {
    const a = defaultLineItems({ price: 350_000, loanAmount: 350_000, state: " wa " }).transferTax;
    const b = defaultLineItems({ price: 350_000, loanAmount: 350_000, state: "WA" }).transferTax;
    expect(a).toBe(b);
  });
});

describe("estimateClosing — prepaids", () => {
  it("computes prepaid interest on a 365-day daily rate", () => {
    const r = estimateClosing(base);
    // 350,000 * 6.5% / 365 * 15 days
    expect(r.prepaidInterest).toBeCloseTo((350_000 * 0.065) / 365 * 15, 2);
  });

  it("charges a full year of insurance up front plus reserves", () => {
    const r = estimateClosing(base);
    expect(r.insurancePrepaid).toBe(1_200);
    expect(r.taxReserve).toBe(900); // 3600/12 * 3
    expect(r.insuranceReserve).toBe(200); // 1200/12 * 2
    expect(r.prepaidsTotal).toBeCloseTo(r.prepaidInterest + 1_200 + 900 + 200, 2);
  });

  it("treats zero days of prepaid interest as zero, not NaN", () => {
    const r = estimateClosing({ ...base, prepaidInterestDays: 0 });
    expect(r.prepaidInterest).toBe(0);
  });
});

describe("estimateClosing — totals", () => {
  it("sums line items, prepaids and any cash funding fee", () => {
    const r = estimateClosing({ ...base, fundingFeeDueAtClosing: 7_525 });
    expect(r.itemsTotal).toBe(14_655);
    expect(r.totalClosingCosts).toBeCloseTo(14_655 + r.prepaidsTotal + 7_525, 2);
  });

  it("excludes a financed funding fee from cash to close", () => {
    const financed = estimateClosing({ ...base, fundingFeeDueAtClosing: 0 });
    const cash = estimateClosing({ ...base, fundingFeeDueAtClosing: 7_525 });
    expect(cash.cashToClose - financed.cashToClose).toBeCloseTo(7_525, 2);
  });

  it("subtracts concessions, lender credits and earnest money from cash to close", () => {
    const plain = estimateClosing(base);
    const credited = estimateClosing({
      ...base,
      sellerConcessions: 5_000,
      lenderCredits: 2_000,
      earnestMoney: 3_000,
    });
    expect(credited.totalCredits).toBe(10_000);
    expect(credited.cashToClose).toBeCloseTo(plain.cashToClose - 10_000, 2);
  });

  it("adds the down payment to cash to close", () => {
    const zero = estimateClosing(base);
    const down = estimateClosing({ ...base, downPayment: 35_000, loanAmount: 315_000 });
    expect(down.cashToClose).toBeGreaterThan(zero.cashToClose);
  });

  it("reports closing costs as a percent of price", () => {
    const r = estimateClosing(base);
    expect(r.pctOfPrice).toBeCloseTo((r.totalClosingCosts / 350_000) * 100, 2);
  });

  it("does not divide by zero on a zero price", () => {
    const r = estimateClosing({ ...base, price: 0 });
    expect(r.pctOfPrice).toBe(0);
    expect(Number.isFinite(r.cashToClose)).toBe(true);
  });
});

describe("estimateClosing — VA rules", () => {
  it("errors when origination exceeds 1% of the loan", () => {
    const r = estimateClosing({ ...base, items: items({ origination: 4_000 }) });
    const err = r.warnings.find((w) => w.level === "error");
    expect(err).toBeDefined();
    expect(err!.message).toContain("exceeds VA's 1% cap");
  });

  it("allows origination exactly at the cap", () => {
    const r = estimateClosing({ ...base, items: items({ origination: 3_500 }) });
    expect(r.warnings.some((w) => w.level === "error")).toBe(false);
    expect(VA_ORIGINATION_CAP_PCT).toBe(1);
  });

  it("does not count discount points against the origination cap", () => {
    const r = estimateClosing({
      ...base,
      items: items({ origination: 3_500, discountPoints: 7_000 }),
    });
    expect(r.warnings.some((w) => w.level === "error")).toBe(false);
  });

  it("warns above the 4% seller concession limit, and explains what it covers", () => {
    const r = estimateClosing({ ...base, sellerConcessions: 15_000 }); // >4% of 350k
    const w = r.warnings.find((x) => x.message.includes("concession"));
    expect(w).toBeDefined();
    expect(w!.level).toBe("warn");
    // The nuance matters: ordinary closing costs paid by the seller are not capped.
    expect(w!.message).toContain("not capped");
  });

  it("allows concessions exactly at 4%", () => {
    const r = estimateClosing({ ...base, sellerConcessions: 14_000 });
    expect(r.warnings.some((x) => x.message.includes("concession"))).toBe(false);
  });

  it("flags credits that exceed what is owed", () => {
    const r = estimateClosing({ ...base, lenderCredits: 500_000 });
    expect(r.cashToClose).toBeLessThan(0);
    expect(r.warnings.some((w) => w.message.includes("cash back"))).toBe(true);
  });
});

describe("daysToMonthEnd", () => {
  it("counts the closing day through month end", () => {
    expect(daysToMonthEnd(new Date(2026, 0, 15))).toBe(17); // Jan 15 -> 31
    expect(daysToMonthEnd(new Date(2026, 0, 31))).toBe(1);
    expect(daysToMonthEnd(new Date(2026, 3, 1))).toBe(30); // April
  });

  it("handles February in a leap year", () => {
    expect(daysToMonthEnd(new Date(2028, 1, 28))).toBe(2); // 2028 is a leap year
    expect(daysToMonthEnd(new Date(2026, 1, 28))).toBe(1); // 2026 is not
  });
});
