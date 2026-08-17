import { sql } from "drizzle-orm";
import { blob, index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Pipeline order, and the order they appear in the picker.
 *
 * "pending" covers under-contract either way — your offer accepted, or the
 * listing gone to someone else. Deliberately one status rather than two: in a
 * fast market the useful distinction is "can I still act on this", and which
 * side the contract is on is a note, not a state machine.
 */
export const PROPERTY_STATUS = ["watching", "touring", "offer", "pending", "dead"] as const;

export const STATUS_HINT: Record<(typeof PROPERTY_STATUS)[number], string> = {
  watching: "On the shortlist, no visit yet",
  touring: "Seen it, or a viewing booked",
  offer: "You have an offer in",
  pending: "Under contract — yours or someone else's. Keep it: they fall through.",
  dead: "Gone, sold, or ruled out",
};
export type PropertyStatus = (typeof PROPERTY_STATUS)[number];

export const properties = sqliteTable("properties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nickname: text("nickname").notNull(),
  street: text("street").notNull().default(""),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  zip: text("zip").notNull().default(""),
  lat: real("lat"),
  lng: real("lng"),
  // FIPS codes from the Census geocoder; used to pick crime providers.
  fipsState: text("fips_state"),
  fipsCounty: text("fips_county"),
  fipsTract: text("fips_tract"),
  listPrice: real("list_price").notNull().default(0),
  propertyTaxAnnual: real("property_tax_annual").notNull().default(0),
  insuranceAnnual: real("insurance_annual").notNull().default(0),
  hoaMonthly: real("hoa_monthly").notNull().default(0),
  beds: real("beds"),
  baths: real("baths"),
  sqft: integer("sqft"),
  // Stored in the database rather than on disk so the single-file backup story
  // stays true, and stored at all rather than hotlinked because listing images
  // disappear the moment a house sells.
  photo: blob("photo", { mode: "buffer" }),
  photoType: text("photo_type"),
  notes: text("notes").notNull().default(""),
  // Notes marked private are stripped from shared views.
  notesPrivate: integer("notes_private", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: PROPERTY_STATUS }).notNull().default("watching"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const scenarios = sqliteTable(
  "scenarios",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Scenario"),
    downPaymentPct: real("down_payment_pct").notNull().default(0),
    interestRate: real("interest_rate").notNull().default(6.5),
    termYears: integer("term_years").notNull().default(30),
    fundingFeeFinanced: integer("funding_fee_financed", { mode: "boolean" }).notNull().default(true),
    fundingFeeExempt: integer("funding_fee_exempt", { mode: "boolean" }).notNull().default(false),
    vaFirstUse: integer("va_first_use", { mode: "boolean" }).notNull().default(true),
    // Closing-cost overrides, stored as a JSON map of lineItemId -> dollars.
    closingOverrides: text("closing_overrides").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("scenarios_property_idx").on(t.propertyId)],
);

export const shareLinks = sqliteTable("share_links", {
  token: text("token").primaryKey(),
  // null = share the whole board
  propertyId: integer("property_id").references(() => properties.id, { onDelete: "cascade" }),
  label: text("label").notNull().default(""),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  readOnly: integer("read_only", { mode: "boolean" }).notNull().default(true),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** Geocode cache, keyed by the normalized address string. Never re-hit the API for a hit. */
export const geocodeCache = sqliteTable("geocode_cache", {
  key: text("key").primaryKey(),
  lat: real("lat"),
  lng: real("lng"),
  street: text("street"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  fipsState: text("fips_state"),
  fipsCounty: text("fips_county"),
  fipsTract: text("fips_tract"),
  provider: text("provider").notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** Crime provider responses, cached so a page reload doesn't burn API quota. */
export const crimeCache = sqliteTable("crime_cache", {
  key: text("key").primaryKey(),
  payload: text("payload").notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/**
 * Every property column EXCEPT the photo blob.
 *
 * Use this for every read that is not the photo route itself. Two reasons:
 * the blob is a Node Buffer, which React cannot serialise across the
 * server/client boundary — passing a full row to a client component throws at
 * render time — and selecting it drags up to 5MB per property into memory on
 * pages that only ever needed to know whether a photo exists. photoType
 * answers that in a few bytes.
 */
export const propertyColumns = {
  id: properties.id,
  nickname: properties.nickname,
  street: properties.street,
  city: properties.city,
  state: properties.state,
  zip: properties.zip,
  lat: properties.lat,
  lng: properties.lng,
  fipsState: properties.fipsState,
  fipsCounty: properties.fipsCounty,
  fipsTract: properties.fipsTract,
  listPrice: properties.listPrice,
  propertyTaxAnnual: properties.propertyTaxAnnual,
  insuranceAnnual: properties.insuranceAnnual,
  hoaMonthly: properties.hoaMonthly,
  beds: properties.beds,
  baths: properties.baths,
  sqft: properties.sqft,
  photoType: properties.photoType,
  notes: properties.notes,
  notesPrivate: properties.notesPrivate,
  status: properties.status,
  createdAt: properties.createdAt,
} as const;

export type Property = typeof properties.$inferSelect;
/** A property row without the photo blob — safe to pass to client components. */
export type PropertyRow = Omit<Property, "photo">;
export type NewProperty = typeof properties.$inferInsert;
export type Scenario = typeof scenarios.$inferSelect;
export type NewScenario = typeof scenarios.$inferInsert;
export type ShareLink = typeof shareLinks.$inferSelect;
