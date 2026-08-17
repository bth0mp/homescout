import { monthlyPayment } from "./amortize";

export type PayoffResult = {
  /** Months to clear the loan with the extra payment applied. */
  months: number;
  totalInterest: number;
  /** Months earlier than the scheduled term. */
  monthsSaved: number;
  interestSaved: number;
  /** Scheduled payment before the extra. */
  basePayment: number;
  extraMonthly: number;
};

/**
 * How much sooner the loan is gone if you overpay each month.
 *
 * Every extra dollar goes straight to principal, which removes all the future
 * interest that dollar would have carried — which is why a small overpayment
 * early buys a surprising number of months.
 */
export function payoffWithExtra(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  extraMonthly: number,
): PayoffResult | null {
  if (principal <= 0 || termMonths <= 0) return null;

  const base = monthlyPayment(principal, annualRatePct, termMonths);
  const r = annualRatePct / 100 / 12;
  const extra = Math.max(0, extraMonthly);

  // Baseline interest over the full scheduled term.
  const baselineInterest = runToPayoff(principal, r, base, 0, termMonths).interest;

  const withExtra = runToPayoff(principal, r, base, extra, termMonths);

  return {
    months: withExtra.months,
    totalInterest: round2(withExtra.interest),
    monthsSaved: termMonths - withExtra.months,
    interestSaved: round2(baselineInterest - withExtra.interest),
    basePayment: round2(base),
    extraMonthly: round2(extra),
  };
}

/**
 * Amortise until the balance clears. Capped at the scheduled term plus a small
 * margin so a zero-interest or degenerate input cannot spin forever.
 */
function runToPayoff(
  principal: number,
  monthlyRate: number,
  basePayment: number,
  extra: number,
  termMonths: number,
): { months: number; interest: number } {
  let balance = principal;
  let interest = 0;
  let months = 0;
  const cap = termMonths + 1;

  while (balance > 0.005 && months < cap) {
    const i = balance * monthlyRate;
    let principalPart = basePayment + extra - i;

    // A payment that does not even cover interest would never amortise.
    if (principalPart <= 0) return { months: termMonths, interest: Number.POSITIVE_INFINITY };

    if (principalPart > balance) principalPart = balance;

    interest += i;
    balance -= principalPart;
    months++;
  }

  return { months, interest };
}

/** "4 years 7 months", or "7 months". */
export function formatMonths(months: number): string {
  if (months <= 0) return "no time";
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} year${y === 1 ? "" : "s"}`);
  if (m > 0) parts.push(`${m} month${m === 1 ? "" : "s"}`);
  return parts.join(" ");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
