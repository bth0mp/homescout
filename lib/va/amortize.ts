import { fundingFee, type FundingFeeInput } from "./funding-fee";

export type LoanInput = FundingFeeInput & {
  /** Annual nominal rate as a percent, e.g. 6.25. */
  interestRate: number;
  termYears: number;
  /** Roll the funding fee into the loan instead of paying it at closing. */
  financeFee: boolean;
  propertyTaxAnnual?: number;
  insuranceAnnual?: number;
  hoaMonthly?: number;
};

export type LoanResult = {
  baseLoan: number;
  fundingFeeRate: number;
  fundingFeeAmount: number;
  /** What actually gets amortized: base loan plus the fee if financed. */
  loanAmount: number;
  monthlyPI: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyHoa: number;
  monthlyTotal: number;
  totalInterest: number;
  /** Fee paid in cash at closing when not financed. */
  feeDueAtClosing: number;
  months: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Standard amortization: P * r / (1 - (1+r)^-n).
 *
 * VA loans carry NO mortgage insurance at any down payment — there is
 * deliberately no PMI term anywhere in this file.
 */
export function monthlyPayment(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  // A 0% loan is just principal spread evenly; the formula divides by zero.
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export function calculateLoan(input: LoanInput): LoanResult {
  const fee = fundingFee(input);
  const months = Math.round(input.termYears * 12);

  // Financed fee is added to principal BEFORE amortizing.
  const loanAmount = r2(fee.baseLoan + (input.financeFee ? fee.amount : 0));
  // Round to the cent once, here, and derive every downstream figure from it.
  // A lender bills a whole number of cents, and the amortization table below
  // uses the same rounded payment — deriving totals from the unrounded value
  // would leave the summary and the table disagreeing by a dollar or so.
  const monthlyPI = r2(monthlyPayment(loanAmount, input.interestRate, months));

  const monthlyTax = (input.propertyTaxAnnual ?? 0) / 12;
  const monthlyInsurance = (input.insuranceAnnual ?? 0) / 12;
  const monthlyHoa = input.hoaMonthly ?? 0;

  return {
    baseLoan: fee.baseLoan,
    fundingFeeRate: fee.rate,
    fundingFeeAmount: fee.amount,
    loanAmount,
    monthlyPI,
    monthlyTax: r2(monthlyTax),
    monthlyInsurance: r2(monthlyInsurance),
    monthlyHoa: r2(monthlyHoa),
    monthlyTotal: r2(monthlyPI + monthlyTax + monthlyInsurance + monthlyHoa),
    // Summed from the schedule rather than payment * months: the final payment
    // is adjusted to close the balance exactly, so the flat formula overstates
    // interest by a dollar or so and would disagree with the table on screen.
    totalInterest: r2(
      amortizationSchedule(loanAmount, input.interestRate, months).reduce(
        (sum, row) => sum + row.interest,
        0,
      ),
    ),
    feeDueAtClosing: input.financeFee ? 0 : fee.amount,
    months,
  };
}

export type ScheduleRow = {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
};

/**
 * Full amortization schedule. The final payment absorbs the rounding drift so
 * the balance lands exactly on zero rather than a few cents either side.
 */
export function amortizationSchedule(
  principal: number,
  annualRatePct: number,
  months: number,
): ScheduleRow[] {
  if (principal <= 0 || months <= 0) return [];

  const r = annualRatePct / 100 / 12;
  // Same rounded payment calculateLoan reports, so the table and the summary agree.
  const payment = r2(monthlyPayment(principal, annualRatePct, months));
  const rows: ScheduleRow[] = [];
  let balance = principal;

  for (let month = 1; month <= months; month++) {
    const interest = balance * r;
    let principalPart = payment - interest;
    let thisPayment = payment;

    if (month === months) {
      // Close out exactly: pay whatever is left plus its interest.
      principalPart = balance;
      thisPayment = balance + interest;
    }

    balance -= principalPart;
    if (Math.abs(balance) < 0.005) balance = 0;

    rows.push({
      month,
      payment: r2(thisPayment),
      interest: r2(interest),
      principal: r2(principalPart),
      balance: r2(balance),
    });
  }

  return rows;
}
