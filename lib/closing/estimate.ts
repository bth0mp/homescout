import {
  VA_ORIGINATION_CAP_PCT,
  VA_SELLER_CONCESSION_CAP_PCT,
  type LineItemId,
} from "./defaults";

export type ClosingInput = {
  price: number;
  loanAmount: number;
  downPayment: number;
  /** Funding fee owed in cash at closing — 0 when financed or exempt. */
  fundingFeeDueAtClosing: number;
  /** Editable line items, dollars. */
  items: Record<LineItemId, number>;

  // Prepaids and escrow reserves
  interestRate: number;
  /** Days of interest collected up front, i.e. days from closing to month end. */
  prepaidInterestDays: number;
  insuranceAnnual: number;
  propertyTaxAnnual: number;
  /** Months of tax collected into escrow at closing. */
  taxReserveMonths: number;
  /** Months of insurance collected into escrow at closing. */
  insuranceReserveMonths: number;

  // Credits
  sellerConcessions: number;
  lenderCredits: number;
  earnestMoney: number;
};

export type ClosingResult = {
  itemsTotal: number;
  prepaidInterest: number;
  insurancePrepaid: number;
  taxReserve: number;
  insuranceReserve: number;
  prepaidsTotal: number;
  /** Line items + prepaids + any funding fee owed in cash. */
  totalClosingCosts: number;
  totalCredits: number;
  cashToClose: number;
  /** Closing costs as a percent of purchase price. */
  pctOfPrice: number;
  warnings: ClosingWarning[];
};

export type ClosingWarning = {
  level: "error" | "warn";
  message: string;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function estimateClosing(input: ClosingInput): ClosingResult {
  const items = input.items;
  const itemsTotal = r2(Object.values(items).reduce((s, v) => s + (Number(v) || 0), 0));

  // Prepaid interest runs from closing to the end of that month, using a daily
  // rate of annual/365.
  const dailyInterest = (input.loanAmount * (input.interestRate / 100)) / 365;
  const prepaidInterest = r2(dailyInterest * Math.max(0, input.prepaidInterestDays));

  // Year one of hazard insurance is paid in full at closing.
  const insurancePrepaid = r2(Math.max(0, input.insuranceAnnual));
  const taxReserve = r2((Math.max(0, input.propertyTaxAnnual) / 12) * Math.max(0, input.taxReserveMonths));
  const insuranceReserve = r2(
    (Math.max(0, input.insuranceAnnual) / 12) * Math.max(0, input.insuranceReserveMonths),
  );

  const prepaidsTotal = r2(prepaidInterest + insurancePrepaid + taxReserve + insuranceReserve);
  const totalClosingCosts = r2(itemsTotal + prepaidsTotal + Math.max(0, input.fundingFeeDueAtClosing));

  const totalCredits = r2(
    Math.max(0, input.sellerConcessions) +
      Math.max(0, input.lenderCredits) +
      Math.max(0, input.earnestMoney),
  );

  const cashToClose = r2(
    Math.max(0, input.downPayment) + totalClosingCosts - totalCredits,
  );

  const warnings: ClosingWarning[] = [];

  // Regulatory, not cosmetic: VA caps the lender's flat origination charge.
  const originationCap = r2(input.loanAmount * (VA_ORIGINATION_CAP_PCT / 100));
  if ((items.origination ?? 0) > originationCap + 0.01) {
    warnings.push({
      level: "error",
      message: `Origination of ${fmt(items.origination)} exceeds VA's ${VA_ORIGINATION_CAP_PCT}% cap of ${fmt(
        originationCap,
      )} on a ${fmt(input.loanAmount)} loan. Discount points are separate and not capped.`,
    });
  }

  const concessionCap = r2(input.price * (VA_SELLER_CONCESSION_CAP_PCT / 100));
  if (input.sellerConcessions > concessionCap + 0.01) {
    warnings.push({
      level: "warn",
      message: `Seller concessions of ${fmt(input.sellerConcessions)} exceed VA's ${VA_SELLER_CONCESSION_CAP_PCT}% limit of ${fmt(
        concessionCap,
      )}. That limit covers concessions such as the seller paying your funding fee or prepaids — a seller paying your ordinary closing costs is not a concession and is not capped.`,
    });
  }

  if (cashToClose < 0) {
    warnings.push({
      level: "warn",
      message:
        "Credits exceed what is owed. Excess seller credit cannot be taken as cash back at closing — it is usually reduced or applied to prepaids.",
    });
  }

  return {
    itemsTotal,
    prepaidInterest,
    insurancePrepaid,
    taxReserve,
    insuranceReserve,
    prepaidsTotal,
    totalClosingCosts,
    totalCredits,
    cashToClose,
    pctOfPrice: input.price > 0 ? r2((totalClosingCosts / input.price) * 100) : 0,
    warnings,
  };
}

/** Days from a closing date to the end of that month, inclusive of closing day. */
export function daysToMonthEnd(closingDate: Date): number {
  const y = closingDate.getFullYear();
  const m = closingDate.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  return daysInMonth - closingDate.getDate() + 1;
}

function fmt(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
