import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { geocodeCache } from "@/lib/db/schema";
import { normalizeAddress } from "@/lib/parse";

export type GeocodeResult = {
  lat: number | null;
  lng: number | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  fipsState: string | null;
  fipsCounty: string | null;
  fipsTract: string | null;
  provider: string;
};

function contact() {
  return process.env.GEOCODER_CONTACT || "homescout (unconfigured)";
}

/**
 * U.S. Census Geocoder. Free, no key, and the only one of the two that returns
 * FIPS state/county/tract, which the crime providers key off.
 * https://geocoding.geo.census.gov/geocoder/
 */
async function census(address: string, signal: AbortSignal): Promise<GeocodeResult | null> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress");
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("vintage", "Current_Current");
  url.searchParams.set("format", "json");

  const res = await fetch(url, { signal, headers: { "User-Agent": contact() } });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    result?: { addressMatches?: Array<Record<string, never>> };
  };
  const m = json.result?.addressMatches?.[0] as
    | {
        coordinates?: { x: number; y: number };
        addressComponents?: Record<string, string>;
        geographies?: Record<string, Array<Record<string, string>>>;
      }
    | undefined;
  if (!m?.coordinates) return null;

  const c = m.addressComponents ?? {};
  const tract = m.geographies?.["Census Tracts"]?.[0];
  const street = [c.fromAddress, c.streetName, c.suffixType].filter(Boolean).join(" ").trim();

  return {
    lat: m.coordinates.y,
    lng: m.coordinates.x,
    street: street || null,
    city: c.city ?? null,
    state: c.state ?? null,
    zip: c.zip ?? null,
    fipsState: tract?.STATE ?? null,
    fipsCounty: tract?.COUNTY ?? null,
    fipsTract: tract?.TRACT ?? null,
    provider: "census",
  };
}

/**
 * Nominatim fallback. No FIPS codes, so crime falls back to agency-level.
 * Usage policy requires an identifying User-Agent and max 1 req/sec:
 * https://operations.osmfoundation.org/policies/nominatim/
 */
async function nominatim(address: string, signal: AbortSignal): Promise<GeocodeResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  const res = await fetch(url, { signal, headers: { "User-Agent": contact() } });
  if (!res.ok) return null;

  const hits = (await res.json()) as Array<{
    lat: string;
    lon: string;
    address?: Record<string, string>;
  }>;
  const hit = hits?.[0];
  if (!hit) return null;

  const a = hit.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ").trim();
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    street: street || null,
    city: a.city ?? a.town ?? a.village ?? a.hamlet ?? null,
    state: a.state ?? null,
    zip: a.postcode ?? null,
    fipsState: null,
    fipsCounty: null,
    fipsTract: null,
    provider: "nominatim",
  };
}

/** Census first, Nominatim on a miss. Cached forever in SQLite — addresses don't move. */
export async function geocode(rawAddress: string): Promise<GeocodeResult | null> {
  const key = normalizeAddress(rawAddress);
  if (!key) return null;

  const cached = getDb().select().from(geocodeCache).where(eq(geocodeCache.key, key)).get();
  if (cached) {
    const { key: _k, fetchedAt: _f, ...rest } = cached;
    return rest;
  }

  const signal = AbortSignal.timeout(10_000);
  let result: GeocodeResult | null = null;
  for (const provider of [census, nominatim]) {
    try {
      result = await provider(rawAddress, signal);
      if (result) break;
    } catch {
      // Network error or timeout: fall through to the next provider.
    }
  }
  if (!result) return null;

  getDb().insert(geocodeCache).values({ key, ...result }).onConflictDoNothing().run();
  return result;
}
