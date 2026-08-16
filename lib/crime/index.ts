import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { crimeCache } from "@/lib/db/schema";
import { fbiCdeProvider } from "./providers/fbi-cde";
import { socrataProvider } from "./providers/socrata";
import { crimeMapLinks, type CrimeMapLink } from "./providers/deeplinks";
import type { CrimeQuery, CrimeResult } from "./types";

/**
 * Providers in descending order of how well they describe an actual address.
 * The first one that returns data wins; deep links are always appended.
 */
const PROVIDERS = [socrataProvider, fbiCdeProvider];

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export type CrimeReport = {
  result: CrimeResult | null;
  links: CrimeMapLink[];
  /** Providers that were skipped, and why — shown so gaps are visible. */
  skipped: Array<{ name: string; reason: string }>;
  cachedAt?: string;
};

export async function getCrimeReport(q: CrimeQuery): Promise<CrimeReport> {
  const links = crimeMapLinks(q);
  const key = `${q.lat.toFixed(4)},${q.lng.toFixed(4)},${q.radiusMiles}`;

  const cached = getDb().select().from(crimeCache).where(eq(crimeCache.key, key)).get();
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    try {
      const payload = JSON.parse(cached.payload) as Omit<CrimeReport, "links">;
      return { ...payload, links, cachedAt: cached.fetchedAt.toISOString() };
    } catch {
      // Corrupt cache row — fall through and refetch.
    }
  }

  const skipped: Array<{ name: string; reason: string }> = [];
  let result: CrimeResult | null = null;

  for (const provider of PROVIDERS) {
    if (!provider.available(q)) {
      skipped.push({
        name: provider.name,
        reason:
          provider.id === "socrata"
            ? `No open-data portal configured for ${q.city || "this city"}. Add one in lib/crime/cities.ts.`
            : "No FBI_CDE_API_KEY set.",
      });
      continue;
    }
    try {
      result = await provider.fetch(q, AbortSignal.timeout(15_000));
      if (result) break;
      skipped.push({ name: provider.name, reason: "Returned no data for this area." });
    } catch (err) {
      skipped.push({
        name: provider.name,
        reason: err instanceof Error ? err.message : "Request failed.",
      });
    }
  }

  const report: Omit<CrimeReport, "links"> = { result, skipped };

  getDb()
    .insert(crimeCache)
    .values({ key, payload: JSON.stringify(report), fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: crimeCache.key,
      set: { payload: JSON.stringify(report), fetchedAt: new Date() },
    })
    .run();

  return { ...report, links };
}

export type { CrimeMapLink };
