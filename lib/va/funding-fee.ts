/**
 * VA funding fee — purchase loans.
 *
 * Source: https://www.va.gov/housing-assistance/home-loans/funding-fee-and-closing-costs/
 * These rates are set by statute and have changed several times (2020 and 2023
 * both moved them). Check the link against this table before trusting a number.
 *
 * LAST_VERIFIED: 2026-08-16
 */
export const LAST_VERIFIED = "2026-08-16";

export type FundingFeeInput = {
  /** Purchase price. */
  price: number;
  /** Down payment in dollars. */
  downPayment: number;
  /** First use of the VA loan benefit vs. a subsequent use. */
  firstUse: boolean;
  /**
   * Receiving VA compensation for a service-connected disability, Purple Heart
   * on active duty, or a qualifying surviving spouse. Not tied to any specific
   * rating percentage. Eligibility is confirmed by the COE, not by this app.
   */
  exempt: boolean;
};

/** Fee as a percent of the base loan amount, by down-payment tier. */
const TIERS = [
  { minDownPct: 10, firstUse: 1.25, subsequent: 1.25 },
  { minDownPct: 5, firstUse: 1.5, subsequent: 1.5 },
  { minDownPct: 0, firstUse: 2.15, subsequent: 3.3 },
] as const;

export function fundingFeeRate(input: Omit<FundingFeeInput, "exempt">): number {
  const { price, downPayment, firstUse } = input;
  if (price <= 0) return 0;
  const downPct = (Math.max(0, downPayment) / price) * 100;
  // Sorted high-to-low, so the first match is the right tier.
  const tier = TIERS.find((t) => downPct >= t.minDownPct) ?? TIERS[TIERS.length - 1];
  return firstUse ? tier.firstUse : tier.subsequent;
}

export type FundingFee = {
  /** Percent applied, 0 when exempt. */
  rate: number;
  /** Dollar amount of the fee. */
  amount: number;
  /** price - downPayment, before any fee is added. */
  baseLoan: number;
  exempt: boolean;
};

export function fundingFee(input: FundingFeeInput): FundingFee {
  const baseLoan = Math.max(0, input.price - Math.max(0, input.downPayment));

  if (input.exempt) {
    return { rate: 0, amount: 0, baseLoan, exempt: true };
  }

  const rate = fundingFeeRate(input);
  return {
    rate,
    // The fee is a percent of the BASE loan, never of the fee-inflated loan.
    amount: round2(baseLoan * (rate / 100)),
    baseLoan,
    exempt: false,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
