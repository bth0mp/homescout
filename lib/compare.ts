import { defaultLineItems } from "@/lib/closing/defaults";
import { estimateClosing } from "@/lib/closing/estimate";
import type { PropertyRow, Scenario } from "@/lib/db/schema";
import { estimateAnnualInsurance, estimateAnnualTax } from "@/lib/property-tax";
import { calculateLoan } from "@/lib/va/amortize";
import { daysToMonthEnd } from "@/lib/closing/estimate";

export type CompareRow = {
  id: number;
  nickname: string;
  location: string;
  status: PropertyRow["status"];
  listPrice: number | null;
  sqft: number | null;
  pricePerSqft: number | null;
  beds: number | null;
  baths: number | null;
  monthlyPayment: number | null;
  cashToClose: number | null;
  loanAmount: number | null;
  /** Which scenario the money came from, so the table can say. */
  scenarioName: string | null;
  /** Tax and insurance actually used in the monthly figure, entered or estimated. */
  taxAnnual: number;
  insuranceAnnual: number;
  /** Incidents within the cached radius, when a crime lookup has been run. */
  crimeIncidents: number | null;
  crimeCoverage: string | null;
  hasCoords: boolean;
  /**
   * Carrying costs that could not even be estimated — no state for tax, or no
   * price at all. These really are absent from the monthly figure.
   */
  missingCosts: string[];
  /**
   * Carrying costs filled from an estimate because the field was left blank.
   * The monthly figure includes them, so it is realistic rather than
   * understated, but the reader must know which numbers are guesses.
   */
  estimatedCosts: string[];
};

/**
 * Build the comparison row for one property.
 *
 * Money is computed from the property's own saved scenario when it has one, and
 * otherwise from `fallback` — the most recently saved scenario anywhere — so the
 * column compares houses rather than comparing whichever assumptions happened to
 * be typed last.
 */
export function buildCompareRow(
  p: PropertyRow,
  scenario: Scenario | undefined,
  fallback: Scenario | undefined,
  crime?: { incidents: number; coverage: string } | null,
): CompareRow {
  const s = scenario ?? fallback;
  const price = p.listPrice || 0;

  // Fill blank carrying costs from estimates so the headline monthly is
  // realistic. A house with no tax entered otherwise shows a lower payment than
  // a fully documented one and reads as cheaper when it is only less filled in.
  const { taxAnnual, insuranceAnnual, estimatedCosts, missingCosts } = resolveCarryingCosts(p);

  let monthlyPayment: number | null = null;
  let cashToClose: number | null = null;
  let loanAmount: number | null = null;

  if (price > 0 && s) {
    const downPayment = (price * s.downPaymentPct) / 100;
    const loan = calculateLoan({
      price,
      downPayment,
      firstUse: s.vaFirstUse,
      exempt: s.fundingFeeExempt,
      interestRate: s.interestRate,
      termYears: s.termYears,
      financeFee: s.fundingFeeFinanced,
      propertyTaxAnnual: taxAnnual,
      insuranceAnnual,
      hoaMonthly: p.hoaMonthly,
    });

    monthlyPayment = loan.monthlyTotal;
    loanAmount = loan.loanAmount;

    cashToClose = estimateClosing({
      price,
      loanAmount: loan.loanAmount,
      downPayment,
      fundingFeeDueAtClosing: loan.feeDueAtClosing,
      items: defaultLineItems({ price, loanAmount: loan.loanAmount, state: p.state }),
      interestRate: s.interestRate,
      prepaidInterestDays: daysToMonthEnd(new Date()),
      insuranceAnnual,
      propertyTaxAnnual: taxAnnual,
      taxReserveMonths: 3,
      insuranceReserveMonths: 2,
      sellerConcessions: 0,
      lenderCredits: 0,
      earnestMoney: 0,
    }).cashToClose;
  }

  return {
    id: p.id,
    nickname: p.nickname,
    location: [p.city, p.state].filter(Boolean).join(", "),
    status: p.status,
    listPrice: p.listPrice || null,
    sqft: p.sqft ?? null,
    pricePerSqft: p.sqft && p.listPrice ? Math.round((p.listPrice / p.sqft) * 100) / 100 : null,
    beds: p.beds ?? null,
    baths: p.baths ?? null,
    monthlyPayment,
    cashToClose,
    loanAmount,
    scenarioName: s ? (scenario ? s.name : `${s.name} (assumed)`) : null,
    crimeIncidents: crime?.incidents ?? null,
    crimeCoverage: crime?.coverage ?? null,
    taxAnnual,
    insuranceAnnual,
    hasCoords: p.lat != null && p.lng != null,
    missingCosts: monthlyPayment === null ? [] : missingCosts,
    estimatedCosts: monthlyPayment === null ? [] : estimatedCosts,
  };
}

/**
 * Decide what tax and insurance to use when the fields are blank.
 *
 * Prefer what the user entered. Otherwise estimate, so the monthly figure is
 * realistic rather than understated — but record which numbers are guesses, so
 * the UI can say so. HOA is never estimated: most houses genuinely have none,
 * and inventing one would inflate every payment.
 */
export function resolveCarryingCosts(p: PropertyRow): {
  taxAnnual: number;
  insuranceAnnual: number;
  estimatedCosts: string[];
  missingCosts: string[];
} {
  const estimatedCosts: string[] = [];
  const missingCosts: string[] = [];

  let taxAnnual = p.propertyTaxAnnual;
  if (!taxAnnual) {
    const est = estimateAnnualTax(p.listPrice, p.state);
    if (est != null) {
      taxAnnual = est;
      estimatedCosts.push("property tax");
    } else {
      // No state, or no price — nothing to estimate from.
      missingCosts.push("property tax");
    }
  }

  let insuranceAnnual = p.insuranceAnnual;
  if (!insuranceAnnual) {
    const est = estimateAnnualInsurance(p.listPrice);
    if (est != null) {
      insuranceAnnual = est;
      estimatedCosts.push("insurance");
    } else {
      missingCosts.push("insurance");
    }
  }

  return { taxAnnual, insuranceAnnual, estimatedCosts, missingCosts };
}

export type SortKey =
  | "nickname"
  | "listPrice"
  | "pricePerSqft"
  | "monthlyPayment"
  | "cashToClose"
  | "sqft"
  | "crimeIncidents"
  | "status";

/**
 * Sort with missing values always last, in both directions. A property with no
 * price should not win "cheapest" by virtue of having no price.
 */
export function sortRows(rows: CompareRow[], key: SortKey, dir: "asc" | "desc"): CompareRow[] {
  const mult = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];

    const aMissing = av === null || av === undefined || av === "";
    const bMissing = bv === null || bv === undefined || bv === "";
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;

    if (typeof av === "number" && typeof bv === "number") return (av - bv) * mult;
    return String(av).localeCompare(String(bv)) * mult;
  });
}
