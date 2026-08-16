/**
 * Pull an address out of a listing URL.
 *
 * STILL NO SCRAPING. Nothing here makes a network request — these sites encode
 * the address directly in the URL path, so this is pure string work on a link
 * you already have. The URL is the input; we never fetch it.
 *
 * The output is a one-line address, deliberately not split into fields: the
 * Census geocoder already returns canonical street/city/state/zip, and it is far
 * better at parsing a messy line than a regex is. Parse loosely here, let the
 * geocoder be authoritative.
 *
 * LAST_VERIFIED: 2026-08-16 — URL shapes are hand-checked. If a provider
 * changes its paths, fix it HERE.
 */
export const LAST_VERIFIED = "2026-08-16";

export type ParsedListing = {
  provider: string;
  /** One-line address, suitable for the geocoder. */
  addressLine: string;
  /** Provider's own listing id, when the URL carries one. */
  listingId: string | null;
  /**
   * Set only when the URL separates the fields unambiguously (Redfin, Realtor).
   * Worth keeping even though we geocode: the Census geocoder returns an
   * uppercased, USPS-reduced street that drops directionals — "908 N Elliott
   * Ave" comes back "908 ELLIOTT AVE" — and that string is what the outbound
   * listing links are built from, so the reduced form breaks them.
   */
  parts?: { street: string; city: string; state: string; zip: string };
};

const deslug = (s: string) =>
  decodeURIComponent(s).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

/** Split a trailing 5-digit ZIP off a street slug: "908-N-Elliott-Ave-98801". */
function splitZip(slug: string): { rest: string; zip: string | null } {
  const m = slug.match(/^(.*?)[-_](\d{5})$/);
  return m ? { rest: m[1], zip: m[2] } : { rest: slug, zip: null };
}

const join = (...parts: Array<string | null | undefined>) =>
  parts.map((p) => p?.trim()).filter(Boolean).join(", ").replace(/\s+,/g, ",");

type Parser = (u: URL) => ParsedListing | null;

const parsers: Record<string, Parser> = {
  // https://www.redfin.com/WA/Wenatchee/908-N-Elliott-Ave-98801/home/75131851
  // ...and the unit variant: /WA/Seattle/123-Main-St-98101/unit-4B/home/123456
  redfin: (u) => {
    const m = u.pathname.match(
      /^\/([A-Za-z]{2})\/([^/]+)\/([^/]+?)(?:\/unit-([^/]+))?\/home\/(\d+)/,
    );
    if (!m) return null;
    const [, state, city, streetSlug, unit, id] = m;
    const { rest, zip } = splitZip(streetSlug);
    const street = unit ? `${deslug(rest)} Unit ${deslug(unit)}` : deslug(rest);
    return {
      provider: "redfin",
      addressLine: join(street, deslug(city), `${state.toUpperCase()} ${zip ?? ""}`),
      listingId: id,
      parts: { street, city: deslug(city), state: state.toUpperCase(), zip: zip ?? "" },
    };
  },

  // https://www.zillow.com/homedetails/908-N-Elliott-Ave-Wenatchee-WA-98801/75131851_zpid/
  zillow: (u) => {
    const m = u.pathname.match(/^\/homedetails\/([^/]+)\/(\d+)_zpid/);
    if (!m) return null;
    // The whole slug is street-city-STATE-zip; the geocoder splits it better
    // than a regex would, so hand it over whole.
    return { provider: "zillow", addressLine: deslug(m[1]), listingId: m[2] };
  },

  // https://www.realtor.com/realestateandhomes-detail/908-N-Elliott-Ave_Wenatchee_WA_98801_M12345-67890
  realtor: (u) => {
    const m = u.pathname.match(/^\/realestateandhomes-detail\/([^/]+)/);
    if (!m) return null;
    const parts = m[1].split("_");
    const idPart = parts.find((p) => /^M\d/.test(p)) ?? null;
    const addressParts = parts.filter((p) => !/^M\d/.test(p));
    if (addressParts.length === 0) return null;
    const [street, ...restParts] = addressParts;
    // street_city_state_zip is the usual shape; only claim `parts` when it holds.
    const [city, state, zip] = restParts;
    const clean =
      restParts.length === 3 && /^[A-Za-z]{2}$/.test(state ?? "") && /^\d{5}$/.test(zip ?? "")
        ? { street: deslug(street), city: deslug(city), state: state.toUpperCase(), zip }
        : undefined;
    return {
      provider: "realtor",
      addressLine: join(deslug(street), restParts.map(deslug).join(", ")),
      listingId: idPart,
      ...(clean ? { parts: clean } : {}),
    };
  },

  // https://www.trulia.com/p/wa/wenatchee/908-n-elliott-ave-wenatchee-wa-98801--2079123456
  trulia: (u) => {
    const m = u.pathname.match(/^\/p\/[a-z]{2}\/[^/]+\/([^/]+?)(?:--(\d+))?\/?$/i);
    if (!m) return null;
    return { provider: "trulia", addressLine: deslug(m[1]), listingId: m[2] ?? null };
  },

  // https://www.homes.com/property/908-n-elliott-ave-wenatchee-wa/abc123/
  homes: (u) => {
    const m = u.pathname.match(/^\/property\/([^/]+)/);
    if (!m) return null;
    return { provider: "homes", addressLine: deslug(m[1]), listingId: null };
  },
};

const HOSTS: Array<[RegExp, keyof typeof parsers]> = [
  [/(^|\.)redfin\.com$/i, "redfin"],
  [/(^|\.)zillow\.com$/i, "zillow"],
  [/(^|\.)realtor\.com$/i, "realtor"],
  [/(^|\.)trulia\.com$/i, "trulia"],
  [/(^|\.)homes\.com$/i, "homes"],
];

/**
 * Returns null for anything we cannot confidently read — a search page, an
 * unknown site, junk text. Null means "ask the user to type it", never a guess.
 */
export function parseListingUrl(input: string): ParsedListing | null {
  const raw = input.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const match = HOSTS.find(([re]) => re.test(url.hostname));
  if (!match) return null;

  const parsed = parsers[match[1]](url);
  // A slug with no digits is almost certainly a city/search page, not a home.
  if (!parsed || !/\d/.test(parsed.addressLine)) return null;
  return parsed;
}
