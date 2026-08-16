/**
 * VA residual income — the money left over each month after the mortgage,
 * taxes, insurance, debts and estimated maintenance/utilities.
 *
 * Source: VA Lenders Handbook (M26-7), Chapter 4, Topic 9, Tables 1 and 2.
 * https://www.benefits.va.gov/WARMS/pam26_7.asp
 *
 * These figures have been stable for a long time but are not statutory in the
 * way the funding fee is — verify against the current handbook.
 *
 * LAST_VERIFIED: 2026-08-16
 */
export const LAST_VERIFIED = "2026-08-16";

export const REGIONS = ["northeast", "midwest", "south", "west"] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABEL: Record<Region, string> = {
  northeast: "Northeast",
  midwest: "Midwest",
  south: "South",
  west: "West",
};

/** Loan amounts of $79,999 and below. Index = family size 1..5. */
const TABLE_UNDER_80K: Record<Region, number[]> = {
  northeast: [390, 654, 788, 888, 921],
  midwest: [382, 641, 772, 868, 902],
  south: [382, 641, 772, 868, 902],
  west: [425, 713, 859, 967, 1004],
};

/** Loan amounts of $80,000 and above. Index = family size 1..5. */
const TABLE_80K_PLUS: Record<Region, number[]> = {
  northeast: [450, 755, 909, 1025, 1062],
  midwest: [441, 738, 889, 1003, 1039],
  south: [441, 738, 889, 1003, 1039],
  west: [491, 823, 990, 1117, 1158],
};

/** Per additional family member beyond 5, by loan-size table. */
const PER_EXTRA_UNDER_80K = 75;
const PER_EXTRA_80K_PLUS = 80;

const STATE_REGION: Record<string, Region> = {};
const assign = (region: Region, states: string[]) => {
  for (const s of states) STATE_REGION[s] = region;
};
assign("northeast", ["CT", "MA", "ME", "NH", "NJ", "NY", "PA", "RI", "VT"]);
assign("midwest", ["IL", "IN", "IA", "KS", "MI", "MN", "MO", "NE", "ND", "OH", "SD", "WI"]);
assign("south", [
  "AL", "AR", "DE", "DC", "FL", "GA", "KY", "LA", "MD", "MS",
  "NC", "OK", "PR", "SC", "TN", "TX", "VA", "WV",
]);
assign("west", [
  "AK", "AZ", "CA", "CO", "HI", "ID", "MT", "NV", "NM", "OR", "UT", "WA", "WY",
]);

/** Two-letter state code to VA region. Returns null for anything unrecognized. */
export function regionForState(state: string): Region | null {
  return STATE_REGION[state.trim().toUpperCase()] ?? null;
}

/**
 * Required residual income for a household.
 * Family size above 7 is capped: the handbook stops adding at 7.
 */
export function requiredResidualIncome(
  region: Region,
  familySize: number,
  loanAmount: number,
): number {
  const big = loanAmount >= 80_000;
  const table = big ? TABLE_80K_PLUS[region] : TABLE_UNDER_80K[region];
  const perExtra = big ? PER_EXTRA_80K_PLUS : PER_EXTRA_UNDER_80K;

  const size = Math.max(1, Math.floor(familySize || 1));
  if (size <= 5) return table[size - 1];

  // "Over 5: add $75/$80 per additional member up to a family of seven."
  const extras = Math.min(size, 7) - 5;
  return table[4] + extras * perExtra;
}

export type ResidualInput = {
  region: Region;
  familySize: number;
  loanAmount: number;
  /** Gross monthly household income, before tax. */
  grossMonthlyIncome: number;
  /** Total monthly housing cost: P&I + tax + insurance + HOA. */
  monthlyHousing: number;
  /** All other recurring monthly debt: cars, cards, student loans, child support. */
  monthlyDebts: number;
  /** Estimated federal + state + FICA withholding per month. */
  monthlyTaxes: number;
  /**
   * Maintenance and utilities. The VA uses roughly $0.14 per square foot per
   * month when the lender does not supply a figure.
   */
  monthlyUtilities: number;
};

export type ResidualResult = {
  required: number;
  actual: number;
  passes: boolean;
  /** actual - required. Negative means short. */
  surplus: number;
  /** Back-end DTI as a percent: (housing + debts) / gross income. */
  dti: number;
  /** VA's guideline threshold. Above this needs compensating factors. */
  dtiThreshold: number;
  dtiExceedsGuideline: boolean;
};

export const DTI_GUIDELINE = 41;

/** VA's default estimate for maintenance + utilities: $0.14/sq ft/month. */
export function estimateUtilities(sqft: number): number {
  return Math.round(Math.max(0, sqft) * 0.14 * 100) / 100;
}

export function residualIncome(input: ResidualInput): ResidualResult {
  const required = requiredResidualIncome(input.region, input.familySize, input.loanAmount);

  const actual =
    input.grossMonthlyIncome -
    input.monthlyHousing -
    input.monthlyDebts -
    input.monthlyTaxes -
    input.monthlyUtilities;

  const dti =
    input.grossMonthlyIncome > 0
      ? ((input.monthlyHousing + input.monthlyDebts) / input.grossMonthlyIncome) * 100
      : 0;

  return {
    required,
    actual: Math.round(actual * 100) / 100,
    passes: actual >= required,
    surplus: Math.round((actual - required) * 100) / 100,
    dti: Math.round(dti * 100) / 100,
    dtiThreshold: DTI_GUIDELINE,
    dtiExceedsGuideline: dti > DTI_GUIDELINE,
  };
}
