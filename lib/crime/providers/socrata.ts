import { findCity } from "../cities";
import {
  boundingBox,
  monthKeys,
  ratePer100k,
  tally,
  type CrimeProvider,
  type CrimeResult,
} from "../types";

const PERIOD_MONTHS = 12;
/** Hard cap so a dense downtown query cannot pull an unbounded response. */
const ROW_LIMIT = 50_000;

/**
 * City open-data portals via the SODA API.
 *
 * The only provider here that is genuinely incident-level — individual reports
 * with coordinates, which can honestly be described as "within N miles of this
 * address". Availability is per-city and configured explicitly in cities.ts.
 */
export const socrataProvider: CrimeProvider = {
  id: "socrata",
  name: "City open data",

  available: (q) => findCity(q.city, q.state) !== null,

  async fetch(q, signal): Promise<CrimeResult | null> {
    const cfg = findCity(q.city, q.state);
    if (!cfg) return null;

    const since = new Date();
    since.setUTCMonth(since.getUTCMonth() - PERIOD_MONTHS);
    const sinceIso = since.toISOString().slice(0, 19);

    // A bounding box rather than within_circle: these portals store lat/lon as
    // separate numeric columns, so there is no point column to search.
    const box = boundingBox(q.lat, q.lng, q.radiusMiles);

    const where = [
      `${cfg.dateField} >= '${sinceIso}'`,
      `${cfg.latField} between ${box.minLat} and ${box.maxLat}`,
      `${cfg.lonField} between ${box.minLng} and ${box.maxLng}`,
      `${cfg.offenseField} IS NOT NULL`,
    ].join(" AND ");

    const url = new URL(`https://${cfg.domain}/resource/${cfg.datasetId}.json`);
    url.searchParams.set("$select", `${cfg.offenseField},${cfg.dateField}`);
    url.searchParams.set("$where", where);
    url.searchParams.set("$limit", String(ROW_LIMIT));

    const headers: Record<string, string> = { Accept: "application/json" };
    // Optional; portals throttle hard without one but do work.
    if (process.env.SOCRATA_APP_TOKEN) {
      headers["X-App-Token"] = process.env.SOCRATA_APP_TOKEN;
    }

    const res = await fetch(url, { signal, headers });
    if (!res.ok) return null;

    const rows = (await res.json()) as Array<Record<string, string>>;
    if (!Array.isArray(rows)) return null;

    const offenses = rows.map((r) => r[cfg.offenseField] ?? "").filter(Boolean);

    const buckets = new Map<string, number>();
    for (const r of rows) {
      const raw = r[cfg.dateField];
      if (!raw) continue;
      const key = raw.slice(0, 7); // YYYY-MM
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    const monthly = monthKeys(new Date(), PERIOD_MONTHS).map((month) => ({
      month,
      count: buckets.get(month) ?? 0,
    }));

    const notes: string[] = [];
    if (rows.length >= ROW_LIMIT) {
      notes.push(
        `Capped at ${ROW_LIMIT.toLocaleString()} incidents — the real count in this radius is higher.`,
      );
    }
    notes.push(
      "Filtered to a square around the address rather than a true circle, so corners reach about 1.4x the stated radius.",
    );

    return {
      providerId: "socrata",
      providerName: `${cfg.agency} open data`,
      coverage: "incident",
      coverageNote: `Individual reported incidents within about ${q.radiusMiles} miles of this address.`,
      areaName: `${cfg.city}, ${cfg.state}`,
      radiusMiles: q.radiusMiles,
      periodMonths: PERIOD_MONTHS,
      totals: tally(offenses),
      total: offenses.length,
      monthly,
      // Deliberately no per-capita rate: the population of a 1-mile radius is
      // unknown, and dividing by the whole city's population would be wrong by
      // orders of magnitude.
      sourceUrl: cfg.portalUrl,
      notes,
    };
  },
};
