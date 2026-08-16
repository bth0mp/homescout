import { monthKeys, type CrimeProvider, type CrimeResult } from "../types";

/**
 * FBI Crime Data Explorer.
 *
 * IMPORTANT — this provider is AGENCY/STATE level. It cannot say anything about
 * a street or a neighbourhood, and the UI must never render it as though it
 * could. Its value here is as a baseline: how does this state compare.
 *
 * UNVERIFIED AGAINST THE LIVE API. Building this needed an api.data.gov key,
 * which was not available, so the response parsing below is written from the
 * documented shapes and is deliberately defensive: anything unexpected returns
 * null and the caller falls through to the deep-link provider rather than
 * rendering a wrong number. If you add a key and it returns nothing, this
 * parsing is the first place to look.
 *
 * Key: https://api.data.gov/signup/
 * Docs: https://cde.ucr.cjis.gov/LATEST/webapp/#/pages/docApi
 *
 * LAST_VERIFIED: never (no key available at time of writing)
 */
export const LAST_VERIFIED = "unverified";

const BASE = "https://api.usa.gov/crime/fbi/cde";
const PERIOD_MONTHS = 12;

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
}

export const fbiCdeProvider: CrimeProvider = {
  id: "fbi-cde",
  name: "FBI Crime Data Explorer",

  available: (q) => Boolean(process.env.FBI_CDE_API_KEY && q.state.trim()),

  async fetch(q, signal): Promise<CrimeResult | null> {
    const key = process.env.FBI_CDE_API_KEY;
    if (!key) return null;

    const state = q.state.trim().toUpperCase();
    const now = new Date();
    const from = `01-${now.getUTCFullYear() - 1}`;
    const to = `12-${now.getUTCFullYear() - 1}`;

    const url = new URL(`${BASE}/estimate/state/${state}`);
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    url.searchParams.set("API_KEY", key);

    let json: unknown;
    try {
      const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
      if (!res.ok) return null;
      json = await res.json();
    } catch {
      return null;
    }

    // Documented shape is { results: [ { year, population, violent_crime,
    // property_crime, ... } ] }. Anything else, bail rather than guess.
    const results = (json as { results?: unknown })?.results;
    if (!Array.isArray(results) || results.length === 0) return null;

    const row = results[results.length - 1] as Record<string, unknown>;
    const population = num(row.population);
    const violent = num(row.violent_crime);
    const property = num(row.property_crime);
    if (violent === undefined && property === undefined) return null;

    const total = (violent ?? 0) + (property ?? 0);

    return {
      providerId: "fbi-cde",
      providerName: "FBI Crime Data Explorer",
      coverage: "state",
      coverageNote:
        `Statewide totals for ${state} — reported by agencies to the FBI. This describes the whole state, ` +
        "not this address, this city or this neighbourhood.",
      areaName: `State of ${state}`,
      periodMonths: PERIOD_MONTHS,
      totals: [
        ...(violent !== undefined ? [{ category: "violent" as const, count: violent }] : []),
        ...(property !== undefined ? [{ category: "property" as const, count: property }] : []),
      ].sort((a, b) => b.count - a.count),
      total,
      // Annual figures only — there is no monthly series to draw.
      monthly: monthKeys(new Date(), 0).map((month) => ({ month, count: 0 })),
      population,
      ratePer100k:
        population && population > 0 ? Math.round((total / population) * 100_000) : undefined,
      sourceUrl: "https://cde.ucr.cjis.gov/",
      lastUpdated: typeof row.year === "number" ? String(row.year) : undefined,
      notes: [
        "Agency-reported data is voluntary and coverage varies by year and department.",
      ],
    };
  },
};
