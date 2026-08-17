import { defaultLineItems } from "@/lib/closing/defaults";
import { estimateClosing } from "@/lib/closing/estimate";
import type { PropertyRow, Scenario } from "@/lib/db/schema";
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
  /** Incidents within the cached radius, when a crime lookup has been run. */
  crimeIncidents: number | null;
  crimeCoverage: string | null;
  hasCoords: boolean;
  /**
   * Carrying costs left blank on this property. A house with no tax or
   * insurance entered shows a lower monthly payment than one where those are
   * filled in — which makes it look cheaper when it is only less documented.
   * The table must say so rather than let the number speak for itself.
   */
  missingCosts: string[];
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
      propertyTaxAnnual: p.propertyTaxAnnual,
      insuranceAnnual: p.insuranceAnnual,
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
      insuranceAnnual: p.insuranceAnnual,
      propertyTaxAnnual: p.propertyTaxAnnual,
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
    hasCoords: p.lat != null && p.lng != null,
    missingCosts: monthlyPayment === null ? [] : missingCarryingCosts(p),
  };
}

/** Carrying costs that are absent, and so silently missing from the monthly figure. */
export function missingCarryingCosts(p: PropertyRow): string[] {
  const missing: string[] = [];
  if (!p.propertyTaxAnnual) missing.push("property tax");
  if (!p.insuranceAnnual) missing.push("insurance");
  // HOA is genuinely zero for most houses, so its absence is not suspicious.
  return missing;
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
