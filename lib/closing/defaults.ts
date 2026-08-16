/**
 * Closing cost defaults.
 *
 * Every figure here is a ROUGH MARKET ESTIMATE, not a quote. Fees vary by
 * lender, title company, county and state. They exist so the estimator opens
 * with something plausible rather than zeros — expect to overwrite them with
 * your Loan Estimate.
 *
 * The one hard rule in this file is the VA origination cap, which is
 * regulatory rather than market: 38 CFR 36.4313(d).
 *
 * LAST_VERIFIED: 2026-08-16
 */
export const LAST_VERIFIED = "2026-08-16";

/**
 * VA caps what a lender may charge as a flat origination fee at 1% of the loan
 * amount. https://www.ecfr.gov/current/title-38/part-36/section-36.4313
 */
export const VA_ORIGINATION_CAP_PCT = 1;

/**
 * VA limits "seller concessions" to 4% of the property value. Note this is
 * narrower than it sounds: it covers things like the seller paying the funding
 * fee, prepaying taxes/insurance, or paying off the buyer's debts. A seller
 * paying the buyer's ordinary, customary closing costs is NOT a concession and
 * is not capped by this.
 * https://www.benefits.va.gov/WARMS/pam26_7.asp (Chapter 8)
 */
export const VA_SELLER_CONCESSION_CAP_PCT = 4;

export type LineItemId =
  | "appraisal"
  | "creditReport"
  | "origination"
  | "discountPoints"
  | "titleSearch"
  | "lendersTitle"
  | "ownersTitle"
  | "settlement"
  | "recording"
  | "transferTax"
  | "survey"
  | "pestInspection"
  | "homeInspection";

export type LineItem = {
  id: LineItemId;
  label: string;
  group: "loan" | "title" | "government" | "inspection";
  /** Dollar default given the price and loan amount. */
  default: (ctx: { price: number; loanAmount: number; state: string }) => number;
  note?: string;
};

const flat = (n: number) => () => n;

/**
 * State transfer/deed tax as a percent of price. Only states with a
 * straightforward statewide rate are listed; many are county-level or tiered,
 * and several have none at all. An unlisted state defaults to 0 and the UI says
 * so rather than inventing a number.
 */
export const TRANSFER_TAX_PCT: Record<string, number> = {
  WA: 1.28,
  FL: 0.7,
  MD: 0.5,
  MI: 0.75,
  NY: 0.4,
  PA: 1.0,
  VA: 0.25,
  CO: 0.01,
  IL: 0.1,
  GA: 0.1,
  NC: 0.2,
  SC: 0.37,
  TN: 0.37,
  MN: 0.33,
  WI: 0.3,
  NH: 0.75,
  VT: 1.25,
  DE: 2.0,
  DC: 1.1,
};

/** States with no real-estate transfer tax at all. */
export const NO_TRANSFER_TAX = new Set([
  "AK", "ID", "IN", "LA", "MS", "MO", "MT", "NM", "ND", "OR", "TX", "UT", "WY", "KS",
]);

export const LINE_ITEMS: LineItem[] = [
  {
    id: "appraisal",
    label: "VA appraisal",
    group: "loan",
    default: flat(900),
    note: "VA sets fee schedules by state; 800–1,200 is typical.",
  },
  { id: "creditReport", label: "Credit report", group: "loan", default: flat(75) },
  {
    id: "origination",
    label: "Lender origination",
    group: "loan",
    // Lenders commonly charge the full 1% they are allowed.
    default: ({ loanAmount }) => round2(loanAmount * 0.01),
    note: "VA caps this at 1% of the loan amount.",
  },
  {
    id: "discountPoints",
    label: "Discount points",
    group: "loan",
    default: flat(0),
    note: "Optional, buys down the rate. Not capped by the 1% origination limit.",
  },
  { id: "titleSearch", label: "Title search / exam", group: "title", default: flat(450) },
  {
    id: "lendersTitle",
    label: "Lender's title insurance",
    group: "title",
    default: ({ loanAmount }) => round2(loanAmount * 0.005),
  },
  {
    id: "ownersTitle",
    label: "Owner's title policy",
    group: "title",
    default: ({ price }) => round2(price * 0.005),
    note: "Optional in most states, but the only thing protecting your equity.",
  },
  { id: "settlement", label: "Settlement / escrow fee", group: "title", default: flat(650) },
  { id: "recording", label: "Recording fees", group: "government", default: flat(150) },
  {
    id: "transferTax",
    label: "Transfer tax",
    group: "government",
    default: ({ price, state }) => {
      const key = state.trim().toUpperCase();
      if (NO_TRANSFER_TAX.has(key)) return 0;
      const pct = TRANSFER_TAX_PCT[key];
      return pct ? round2(price * (pct / 100)) : 0;
    },
    note: "Often split with the seller by local custom, and county rates stack in many states.",
  },
  { id: "survey", label: "Survey", group: "inspection", default: flat(500) },
  {
    id: "pestInspection",
    label: "Pest / termite inspection",
    group: "inspection",
    // Defaults to 0 on purpose: this has long been restricted or customary-to-
    // the-seller on VA purchases, so budgeting it to the buyer by default would
    // overstate cash to close. Enter it if your lender says you are paying it.
    default: flat(0),
    note: "Usually paid by the seller on a VA purchase. Confirm who pays before budgeting it.",
  },
  { id: "homeInspection", label: "Home inspection", group: "inspection", default: flat(450) },
];

export const GROUP_LABEL: Record<LineItem["group"], string> = {
  loan: "Lender",
  title: "Title & escrow",
  government: "Government",
  inspection: "Inspections & survey",
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function defaultLineItems(ctx: {
  price: number;
  loanAmount: number;
  state: string;
}): Record<LineItemId, number> {
  const out = {} as Record<LineItemId, number>;
  for (const item of LINE_ITEMS) out[item.id] = item.default(ctx);
  return out;
}
