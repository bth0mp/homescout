/**
 * Per-city Socrata (SODA) open-data configuration.
 *
 * Every field name below was read from the live endpoint, not from
 * documentation — city schemas drift and several of these do not match what you
 * would guess (Seattle moved to NIBRS vocabulary; LA uses lat/lon rather than a
 * point column).
 *
 * To add a city: find its crime dataset on its Socrata portal, hit
 *   https://<domain>/resource/<datasetId>.json?$limit=1
 * and copy the real field names in.
 *
 * LAST_VERIFIED: 2026-08-16 (field names probed live on this date)
 */
export const LAST_VERIFIED = "2026-08-16";

export type CityConfig = {
  /** Matched case-insensitively against the property's city + state. */
  city: string;
  state: string;
  domain: string;
  datasetId: string;
  /** Column holding the offence description. */
  offenseField: string;
  /** Column holding the incident date. */
  dateField: string;
  /** Separate numeric lat/lon columns. */
  latField: string;
  lonField: string;
  /** Agency name to show as the source. */
  agency: string;
  /** Most recent published population, for per-capita rates. */
  population?: number;
  portalUrl: string;
};

export const CITIES: CityConfig[] = [
  {
    city: "Chicago",
    state: "IL",
    domain: "data.cityofchicago.org",
    datasetId: "ijzp-q8t2",
    offenseField: "primary_type",
    dateField: "date",
    latField: "latitude",
    lonField: "longitude",
    agency: "Chicago Police Department",
    population: 2_664_000,
    portalUrl: "https://data.cityofchicago.org/Public-Safety/Crimes-2001-to-Present/ijzp-q8t2",
  },
  {
    city: "Seattle",
    state: "WA",
    domain: "data.seattle.gov",
    datasetId: "tazs-3rd5",
    // NIBRS schema — not the old "offense"/"offense_start_datetime" fields.
    offenseField: "offense_category",
    dateField: "offense_date",
    latField: "latitude",
    lonField: "longitude",
    agency: "Seattle Police Department",
    population: 755_000,
    portalUrl: "https://data.seattle.gov/Public-Safety/SPD-Crime-Data-2008-Present/tazs-3rd5",
  },
  {
    city: "Los Angeles",
    state: "CA",
    domain: "data.lacity.org",
    datasetId: "2nrs-mtv8",
    offenseField: "crm_cd_desc",
    dateField: "date_occ",
    latField: "lat",
    lonField: "lon",
    agency: "Los Angeles Police Department",
    population: 3_820_000,
    portalUrl: "https://data.lacity.org/Public-Safety/Crime-Data-from-2020-to-Present/2nrs-mtv8",
  },
  {
    city: "New York",
    state: "NY",
    domain: "data.cityofnewyork.us",
    datasetId: "5uac-w243",
    offenseField: "ofns_desc",
    dateField: "cmplnt_fr_dt",
    latField: "latitude",
    lonField: "longitude",
    agency: "New York City Police Department",
    population: 8_260_000,
    portalUrl:
      "https://data.cityofnewyork.us/Public-Safety/NYPD-Complaint-Data-Current-Year-To-Date/5uac-w243",
  },
];

export function findCity(city: string, state: string): CityConfig | null {
  const c = city.trim().toLowerCase();
  const s = state.trim().toUpperCase();
  return CITIES.find((x) => x.city.toLowerCase() === c && x.state === s) ?? null;
}
