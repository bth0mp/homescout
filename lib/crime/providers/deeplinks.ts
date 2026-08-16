/**
 * Always-available fallback: links out to public crime maps.
 *
 * No API, no key, no data of our own — which is exactly the point. When we
 * genuinely do not have numbers for an address, the honest answer is "here is
 * where to look", not a number borrowed from a wider geography and presented as
 * though it described this street.
 *
 * LAST_VERIFIED: 2026-08-16
 */
export const LAST_VERIFIED = "2026-08-16";

export type CrimeMapLink = { id: string; label: string; href: string; note?: string };

export function crimeMapLinks(q: {
  lat: number;
  lng: number;
  city: string;
  state: string;
}): CrimeMapLink[] {
  const place = [q.city, q.state].filter(Boolean).join(", ");
  const links: CrimeMapLink[] = [
    {
      id: "spotcrime",
      label: "SpotCrime",
      href: `https://spotcrime.com/map?lat=${q.lat}&lon=${q.lng}`,
      note: "Aggregates police reports and user submissions.",
    },
    {
      id: "cityprotect",
      label: "CityProtect",
      href: `https://cityprotect.com/map?lat=${q.lat}&lng=${q.lng}`,
      note: "Feeds directly from participating agencies.",
    },
    {
      id: "fbi-cde",
      label: "FBI Crime Data Explorer",
      href: "https://cde.ucr.cjis.gov/",
      note: "Agency and state totals. No address-level data anywhere on it.",
    },
    {
      id: "nsopw",
      label: "National Sex Offender Registry",
      href: `https://www.nsopw.gov/search-public-sex-offender-registries?address=${encodeURIComponent(
        place,
      )}`,
      note: "Official DOJ registry search.",
    },
  ];

  if (q.state.trim()) {
    links.push({
      id: "state-portal",
      label: `${q.state.trim().toUpperCase()} state police / UCR`,
      href: `https://www.google.com/search?q=${encodeURIComponent(
        `${q.state} state police uniform crime report ${q.city}`,
      )}`,
      note: "State-level reporting varies; this is a scoped search.",
    });
  }

  return links;
}
