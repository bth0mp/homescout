/**
 * Outbound deep links to listing sites.
 *
 * NO SCRAPING. Zillow/Redfin/Realtor/Trulia have no free public API and their
 * terms forbid automated access, so this file only ever builds a URL the user
 * clicks. Nothing here fetches anything.
 *
 * These are search entry points, not canonical listing URLs — we cannot know a
 * property's listing ID without a licensed feed, so each link lands the user on
 * that site's search results for the address. Some will land dead-on, some will
 * land on a neighborhood page.
 *
 * LAST_VERIFIED: 2026-08-16 — patterns are hand-checked, not test-covered
 * (asserting against live third-party URLs would be scraping). If a provider
 * changes its URL shape, fix it HERE. No component imports a URL directly.
 */
export const LAST_VERIFIED = "2026-08-16";

export type LinkTarget = {
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  county?: string | null;
};

export type ListingLink = {
  id: string;
  label: string;
  group: "listing" | "map" | "public-record";
  /** Returns null when the address lacks what this provider needs. */
  build: (t: LinkTarget) => string | null;
};

const oneLine = (t: LinkTarget) =>
  [t.street, t.city, t.state, t.zip].map((s) => s?.trim()).filter(Boolean).join(", ");

/** "123 Main St, Washington, DC 20500" -> "123-Main-St-Washington-DC-20500" */
const dashSlug = (t: LinkTarget) =>
  [t.street, t.city, t.state, t.zip]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");

const hasAddress = (t: LinkTarget) => Boolean(t.street?.trim() && (t.city?.trim() || t.zip?.trim()));

export const LISTING_LINKS: ListingLink[] = [
  {
    id: "zillow",
    label: "Zillow",
    group: "listing",
    build: (t) => (hasAddress(t) ? `https://www.zillow.com/homes/${dashSlug(t)}_rb/` : null),
  },
  {
    id: "redfin",
    label: "Redfin",
    group: "listing",
    build: (t) =>
      hasAddress(t)
        ? `https://www.redfin.com/search?location=${encodeURIComponent(oneLine(t))}`
        : null,
  },
  {
    id: "realtor",
    label: "Realtor.com",
    group: "listing",
    build: (t) =>
      hasAddress(t) ? `https://www.realtor.com/realestateandhomes-search/${dashSlug(t)}` : null,
  },
  {
    id: "trulia",
    label: "Trulia",
    group: "listing",
    build: (t) =>
      hasAddress(t)
        ? `https://www.trulia.com/search/?searchQuery=${encodeURIComponent(oneLine(t))}`
        : null,
  },
  {
    id: "homes",
    label: "Homes.com",
    group: "listing",
    build: (t) =>
      hasAddress(t) ? `https://www.homes.com/search/?q=${encodeURIComponent(oneLine(t))}` : null,
  },
  {
    id: "google-maps",
    label: "Google Maps",
    group: "map",
    build: (t) => {
      const q = t.lat != null && t.lng != null ? `${t.lat},${t.lng}` : oneLine(t);
      return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
    },
  },
  {
    id: "street-view",
    label: "Street View",
    group: "map",
    build: (t) =>
      t.lat != null && t.lng != null
        ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${t.lat},${t.lng}`
        : null,
  },
  {
    id: "county-appraiser",
    label: "County property records",
    group: "public-record",
    // Every county runs its own parcel search on its own domain, so this is a
    // scoped web search rather than a direct link. Replace per-county if you
    // hunt in one area a lot.
    build: (t) => {
      if (!t.state?.trim()) return null;
      const terms = [t.county, t.state, "county property appraiser parcel search", t.street]
        .filter(Boolean)
        .join(" ");
      return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
    },
  },
];

export function buildLinks(t: LinkTarget) {
  return LISTING_LINKS.map((l) => ({ ...l, href: l.build(t) })).filter(
    (l): l is typeof l & { href: string } => l.href !== null,
  );
}
