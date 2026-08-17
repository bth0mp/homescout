/**
 * Effective property tax rate by state, as a percent of market value per year.
 *
 * THESE ARE STATEWIDE MEDIANS AND WILL BE WRONG FOR YOUR HOUSE.
 * Property tax is levied by counties, cities and school districts, and the
 * spread inside a single state is routinely 2-3x. Texas ranges from roughly
 * 1.2% to over 2.5% depending on the district; Illinois likewise. Treat this as
 * a starting number to replace with the county assessor's figure or the actual
 * tax line on the listing.
 *
 * Source: statewide effective-rate summaries derived from Census ACS
 * median-tax-paid over median-home-value.
 *
 * LAST_VERIFIED: 2026-08-17
 */
export const LAST_VERIFIED = "2026-08-17";

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/** Percent of home value, per year. */
export const EFFECTIVE_TAX_RATE: Record<string, number> = {
  AL: 0.41, AK: 1.19, AZ: 0.63, AR: 0.62, CA: 0.75, CO: 0.51, CT: 2.15,
  DE: 0.58, DC: 0.57, FL: 0.91, GA: 0.92, HI: 0.32, ID: 0.67, IL: 2.23,
  IN: 0.83, IA: 1.57, KS: 1.43, KY: 0.64, LA: 0.56, ME: 1.24, MD: 1.07,
  MA: 1.14, MI: 1.38, MN: 1.11, MS: 0.79, MO: 0.97, MT: 0.74, NE: 1.63,
  NV: 0.55, NH: 1.93, NJ: 2.47, NM: 0.80, NY: 1.72, NC: 0.80, ND: 0.98,
  OH: 1.53, OK: 0.89, OR: 0.93, PA: 1.49, RI: 1.40, SC: 0.57, SD: 1.17,
  TN: 0.67, TX: 1.68, UT: 0.57, VT: 1.83, VA: 0.82, WA: 0.94, WV: 0.58,
  WI: 1.73, WY: 0.61,
};

export const STATE_CODES = Object.keys(STATE_NAMES).sort();

export function taxRateForState(state: string): number | null {
  return EFFECTIVE_TAX_RATE[state.trim().toUpperCase()] ?? null;
}

/** Estimated annual property tax, or null when the state is unknown. */
export function estimateAnnualTax(price: number, state: string): number | null {
  const rate = taxRateForState(state);
  if (rate == null || !(price > 0)) return null;
  return Math.round(price * (rate / 100));
}

/**
 * Homeowners insurance, as a percent of purchase price per year.
 *
 * A single national figure on purpose. Real premiums are priced on dwelling
 * replacement cost, roof age, claims history and wind/hail exposure — none of
 * which a purchase price knows. 0.35% is the rate Veterans United's public
 * calculator uses, which makes this comparable to the number most veterans will
 * have seen first.
 *
 * It is badly wrong in the hurricane and hail belt. Florida and Louisiana
 * routinely run 2-4x this; Oklahoma, Texas, Mississippi, Alabama and Colorado
 * run high too. Get a real quote before trusting a payment that depends on it.
 */
export const INSURANCE_RATE_PCT = 0.35;

/** States where the national rate is known to understate badly. */
export const HIGH_INSURANCE_STATES = new Set(["FL", "LA", "OK", "TX", "MS", "AL", "CO", "KS", "NE"]);

export function estimateAnnualInsurance(price: number): number | null {
  if (!(price > 0)) return null;
  return Math.round(price * (INSURANCE_RATE_PCT / 100));
}

/**
 * Annual maintenance reserve, as a percent of home value.
 *
 * The long-standing rule of thumb. Some years you spend nothing; the year the
 * roof goes you spend five years' worth at once. It is not part of a mortgage
 * payment, which is exactly why people are surprised by it.
 */
export const MAINTENANCE_RATE_PCT = 1;

export function estimateMonthlyMaintenance(price: number): number | null {
  if (!(price > 0)) return null;
  return Math.round((price * (MAINTENANCE_RATE_PCT / 100)) / 12);
}

/** Where a state sits nationally — context for whether a rate is unusual. */
export function taxRank(state: string): { rank: number; of: number } | null {
  const rate = taxRateForState(state);
  if (rate == null) return null;
  const sorted = Object.values(EFFECTIVE_TAX_RATE).sort((a, b) => b - a);
  return { rank: sorted.indexOf(rate) + 1, of: sorted.length };
}
