/** Canonical offense buckets. Every provider maps its own vocabulary into these. */
export const CATEGORIES = [
  "violent",
  "property",
  "quality-of-life",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  violent: "Violent",
  property: "Property",
  "quality-of-life": "Quality of life",
  other: "Other",
};

/**
 * How precisely a result actually describes the address.
 *
 * This exists so the UI can never imply precision the source does not have.
 * FBI CDE reports whole agencies; a city portal reports individual incidents.
 * Those are not the same claim and must not render the same way.
 */
export type Coverage = "incident" | "agency" | "state" | "none";

export const COVERAGE_LABEL: Record<Coverage, string> = {
  incident: "Incident-level",
  agency: "Agency-level",
  state: "Statewide",
  none: "No data",
};

export type CategoryCount = { category: Category; count: number };

export type CrimeResult = {
  providerId: string;
  providerName: string;
  coverage: Coverage;
  /** Plain-English statement of exactly what the numbers describe. */
  coverageNote: string;
  /** What geography the numbers cover, e.g. "Seattle Police Department". */
  areaName: string;
  /** Radius in miles, when the provider queried around a point. */
  radiusMiles?: number;
  periodMonths: number;
  totals: CategoryCount[];
  total: number;
  /** Oldest-first monthly totals for the sparkline. */
  monthly: Array<{ month: string; count: number }>;
  /** Incidents per 100k population per year, when population is known. */
  ratePer100k?: number;
  population?: number;
  /** Comparison rates, when available. */
  stateRatePer100k?: number;
  nationalRatePer100k?: number;
  sourceUrl: string;
  lastUpdated?: string;
  /** Non-fatal problems worth showing the user. */
  notes?: string[];
};

export type CrimeQuery = {
  lat: number;
  lng: number;
  city: string;
  state: string;
  fipsState?: string | null;
  fipsCounty?: string | null;
  radiusMiles: number;
};

export type CrimeProvider = {
  id: string;
  name: string;
  /** Cheap synchronous check — is this provider usable for this query at all? */
  available: (q: CrimeQuery) => boolean;
  fetch: (q: CrimeQuery, signal: AbortSignal) => Promise<CrimeResult | null>;
};

/**
 * Map a provider's raw offense text into a canonical bucket.
 * Deliberately conservative: anything unrecognized lands in "other" rather than
 * being guessed into "violent", which would inflate the number people react to.
 */
export function categorize(raw: string): Category {
  const s = raw.toLowerCase();

  if (
    /(homicide|murder|manslaughter|rape|sexual assault|sex offense|robbery|aggravated assault|agg assault|assault w|shooting|kidnap|weapon.*(discharge|assault))/.test(
      s,
    )
  ) {
    return "violent";
  }
  if (
    /(burglary|larceny|theft|shoplift|motor vehicle theft|stolen|arson|vandalism|criminal damage|property damage|breaking|trespass of a dwelling)/.test(
      s,
    )
  ) {
    return "property";
  }
  if (/(narcotic|drug|liquor|disorderly|prostitution|public (drink|intox)|loitering|noise|trespass)/.test(s)) {
    return "quality-of-life";
  }
  return "other";
}

/** Bucket raw offense strings into canonical categories, largest first. */
export function tally(offenses: string[]): CategoryCount[] {
  const counts = new Map<Category, number>();
  for (const o of offenses) {
    const c = categorize(o);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

/** Incidents per 100k residents per year. */
export function ratePer100k(count: number, population: number, months: number): number | undefined {
  if (!population || population <= 0 || months <= 0) return undefined;
  const perYear = (count / months) * 12;
  return Math.round((perYear / population) * 100_000);
}

/**
 * Bounding box around a point, for portals that store lat/lon as separate
 * numeric columns and so cannot use SODA's within_circle.
 */
export function boundingBox(lat: number, lng: number, radiusMiles: number) {
  const latDelta = radiusMiles / 69;
  // Longitude degrees shrink toward the poles.
  const lngDelta = radiusMiles / (69 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

/** Oldest-first list of the last N months as YYYY-MM, ending with `now`. */
export function monthKeys(now: Date, months: number): string[] {
  const out: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
