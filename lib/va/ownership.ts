import { amortizationSchedule } from "./amortize";

export type OwnershipInput = {
  loanAmount: number;
  interestRate: number;
  termYears: number;
  price: number;
  downPayment: number;
  cashToClose: number;
  propertyTaxAnnual: number;
  insuranceAnnual: number;
  hoaMonthly: number;
  /** Annual home price appreciation, percent. */
  appreciationPct: number;
  /** Annual growth applied to tax, insurance and HOA, percent. */
  costInflationPct: number;
};

export type OwnershipPoint = {
  year: number;
  /** Cash out of pocket since closing, including cash to close. */
  totalPaid: number;
  interestPaid: number;
  principalPaid: number;
  taxInsHoaPaid: number;
  remainingBalance: number;
  estimatedValue: number;
  /** Value minus what is still owed. */
  equity: number;
  /** Equity minus every dollar spent. Negative until you are ahead. */
  netPosition: number;
};

/**
 * What the house costs, and what you get back, at year milestones.
 *
 * Closing costs answer "what do I need on day one". This answers the question
 * people actually decide on: what has this cost me by year five, and how much of
 * it is still mine. Tax, insurance and HOA are grown at costInflationPct because
 * holding them flat for thirty years understates lifetime cost badly.
 */
export function ownershipOverTime(
  input: OwnershipInput,
  years: number[] = [1, 3, 5, 10, 30],
): OwnershipPoint[] {
  const schedule = amortizationSchedule(input.loanAmount, input.interestRate, input.termYears * 12);
  if (schedule.length === 0) return [];

  const out: OwnershipPoint[] = [];

  for (const year of years) {
    const months = Math.min(year * 12, schedule.length);
    if (months <= 0) continue;

    const slice = schedule.slice(0, months);
    const interestPaid = slice.reduce((s, r) => s + r.interest, 0);
    const principalPaid = slice.reduce((s, r) => s + r.principal, 0);
    const remainingBalance = slice[slice.length - 1].balance;

    // Carrying costs compound yearly rather than staying flat.
    let taxInsHoaPaid = 0;
    const baseAnnual = input.propertyTaxAnnual + input.insuranceAnnual + input.hoaMonthly * 12;
    const fullYears = Math.floor(months / 12);
    const leftoverMonths = months % 12;
    for (let y = 0; y < fullYears; y++) {
      taxInsHoaPaid += baseAnnual * Math.pow(1 + input.costInflationPct / 100, y);
    }
    if (leftoverMonths > 0) {
      taxInsHoaPaid +=
        (baseAnnual * Math.pow(1 + input.costInflationPct / 100, fullYears) * leftoverMonths) / 12;
    }

    const estimatedValue = input.price * Math.pow(1 + input.appreciationPct / 100, months / 12);
    const equity = estimatedValue - remainingBalance;

    // Cash to close already includes the down payment, so it is not added twice.
    const totalPaid = input.cashToClose + interestPaid + principalPaid + taxInsHoaPaid;

    out.push({
      year,
      totalPaid: r2(totalPaid),
      interestPaid: r2(interestPaid),
      principalPaid: r2(principalPaid),
      taxInsHoaPaid: r2(taxInsHoaPaid),
      remainingBalance: r2(remainingBalance),
      estimatedValue: r2(estimatedValue),
      equity: r2(equity),
      netPosition: r2(equity - totalPaid),
    });
  }

  return out;
}

/**
 * Break-even against renting: the first month where owning has cost less in
 * total than renting would have, counting equity as money back.
 * Returns null when it does not break even inside the term.
 */
export function breakEvenAgainstRent(
  input: OwnershipInput,
  monthlyRent: number,
  rentInflationPct: number,
): number | null {
  if (monthlyRent <= 0) return null;

  const schedule = amortizationSchedule(input.loanAmount, input.interestRate, input.termYears * 12);
  if (schedule.length === 0) return null;

  let ownCost = input.cashToClose;
  let rentCost = 0;
  const baseMonthlyCarry =
    (input.propertyTaxAnnual + input.insuranceAnnual) / 12 + input.hoaMonthly;

  for (let m = 1; m <= schedule.length; m++) {
    const yearIndex = Math.floor((m - 1) / 12);
    const inflate = Math.pow(1 + input.costInflationPct / 100, yearIndex);

    ownCost += schedule[m - 1].payment + baseMonthlyCarry * inflate;
    rentCost += monthlyRent * Math.pow(1 + rentInflationPct / 100, yearIndex);

    const value = input.price * Math.pow(1 + input.appreciationPct / 100, m / 12);
    const equity = value - schedule[m - 1].balance;

    // Owning wins once the cash spent, less the equity held, drops below what
    // renting would have burned outright.
    if (ownCost - equity < rentCost) return m;
  }

  return null;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
