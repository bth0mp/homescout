"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { propertyColumns, properties, scenarios, shareLinks } from "@/lib/db/schema";
import { expiryFromHours, newToken } from "@/lib/share";
import { geocode } from "@/lib/geocode";
import { MAX_PHOTO_BYTES, validatePhoto } from "@/lib/image";
import { parseListingUrl } from "@/lib/listing-parse";
import { titleCase } from "@/lib/parse";
import { propertyFromForm } from "@/lib/zod";

export type ActionState = { error?: string } | null;

// ponytail: server actions instead of REST routes for CRUD — no client fetch
// layer, no route handlers, and revalidatePath keeps the board fresh. Anything
// that needs query params or an API key still gets a real route.

async function geocodeInto(input: {
  street: string;
  city: string;
  state: string;
  zip: string;
}) {
  const line = [input.street, input.city, input.state, input.zip].filter(Boolean).join(", ");
  if (!line.trim()) return {};
  const hit = await geocode(line);
  if (!hit) return {};
  return {
    lat: hit.lat,
    lng: hit.lng,
    fipsState: hit.fipsState,
    fipsCounty: hit.fipsCounty,
    fipsTract: hit.fipsTract,
  };
}

export type LookupResult =
  | {
      ok: true;
      provider: string;
      street: string;
      city: string;
      state: string;
      zip: string;
      geocoded: boolean;
    }
  | { ok: false; error: string };

/**
 * Paste a listing URL, get back an address. The URL is parsed locally — we
 * never fetch the listing page — and then handed to the geocoder, which is the
 * authority on how the address actually splits.
 */
export async function lookupListing(url: string): Promise<LookupResult> {
  const parsed = parseListingUrl(url);
  if (!parsed) {
    return {
      ok: false,
      error:
        "Could not read an address from that link. Supported: Redfin, Zillow, Realtor.com, Trulia, Homes.com property pages (not search pages).",
    };
  }

  const hit = await geocode(parsed.addressLine);
  if (!hit) {
    // Parsed but not geocodable: hand back the raw line so the user can correct
    // it rather than losing what we did work out.
    return {
      ok: true,
      provider: parsed.provider,
      street: parsed.addressLine,
      city: "",
      state: "",
      zip: "",
      geocoded: false,
    };
  }

  // The listing URL wins for the street when it gave us clean fields: Census
  // returns an uppercased USPS-reduced form that drops directionals, and that
  // string is what the outbound listing links are built from.
  return {
    ok: true,
    provider: parsed.provider,
    street: parsed.parts?.street ?? titleCase(hit.street ?? parsed.addressLine),
    city: parsed.parts?.city ?? titleCase(hit.city ?? ""),
    state: parsed.parts?.state ?? (hit.state ?? "").toUpperCase(),
    zip: parsed.parts?.zip || (hit.zip ?? ""),
    geocoded: true,
  };
}

export async function createProperty(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = propertyFromForm(fd);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const geo = await geocodeInto(parsed.data);
  const row = getDb()
    .insert(properties)
    .values({ ...parsed.data, ...geo })
    .returning({ id: properties.id })
    .get();

  revalidatePath("/");
  redirect(`/property/${row.id}`);
}

export async function updateProperty(id: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = propertyFromForm(fd);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const current = getDb().select(propertyColumns).from(properties).where(eq(properties.id, id)).get();
  if (!current) return { error: "Property not found" };

  // Only re-geocode when the address actually changed; the cache makes this cheap anyway.
  const moved =
    current.street !== parsed.data.street ||
    current.city !== parsed.data.city ||
    current.state !== parsed.data.state ||
    current.zip !== parsed.data.zip;
  const geo = moved ? await geocodeInto(parsed.data) : {};

  getDb().update(properties).set({ ...parsed.data, ...geo }).where(eq(properties.id, id)).run();

  revalidatePath("/");
  revalidatePath(`/property/${id}`);
  return null;
}

export type ScenarioInput = {
  id?: number;
  propertyId: number;
  name: string;
  downPaymentPct: number;
  interestRate: number;
  termYears: number;
  fundingFeeFinanced: boolean;
  fundingFeeExempt: boolean;
  vaFirstUse: boolean;
  /** Property-level fields edited on the Financing tab; written through. */
  listPrice?: number;
  propertyTaxAnnual?: number;
  insuranceAnnual?: number;
  hoaMonthly?: number;
};

const money = z.number().min(0).max(1_000_000_000);

const scenarioSchema = z.object({
  id: z.number().int().positive().optional(),
  propertyId: z.number().int().positive(),
  name: z.string().trim().min(1).max(80),
  downPaymentPct: z.number().min(0).max(100),
  interestRate: z.number().min(0).max(30),
  termYears: z.number().int().min(1).max(50),
  fundingFeeFinanced: z.boolean(),
  fundingFeeExempt: z.boolean(),
  vaFirstUse: z.boolean(),
  // These four are edited on the Financing tab but belong to the PROPERTY, not
  // the scenario. They were previously dropped on the floor: the button said
  // "Saved." and the price vanished on reload. They are written through here.
  listPrice: money.optional(),
  propertyTaxAnnual: money.optional(),
  insuranceAnnual: money.optional(),
  hoaMonthly: money.optional(),
});

export async function saveScenario(input: ScenarioInput): Promise<{ id: number } | { error: string }> {
  const parsed = scenarioSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid scenario" };
  const { id, listPrice, propertyTaxAnnual, insuranceAnnual, hoaMonthly, ...values } = parsed.data;

  const db = getDb();

  const row = id
    ? db.update(scenarios).set(values).where(eq(scenarios.id, id)).returning({ id: scenarios.id }).get()
    : db.insert(scenarios).values(values).returning({ id: scenarios.id }).get();

  const propertyEdits = {
    ...(listPrice !== undefined ? { listPrice } : {}),
    ...(propertyTaxAnnual !== undefined ? { propertyTaxAnnual } : {}),
    ...(insuranceAnnual !== undefined ? { insuranceAnnual } : {}),
    ...(hoaMonthly !== undefined ? { hoaMonthly } : {}),
  };
  if (Object.keys(propertyEdits).length > 0) {
    db.update(properties).set(propertyEdits).where(eq(properties.id, values.propertyId)).run();
  }

  revalidatePath("/");
  revalidatePath("/compare");
  revalidatePath(`/property/${values.propertyId}`);
  return { id: row.id };
}

export async function deleteScenario(id: number, propertyId: number) {
  getDb().delete(scenarios).where(eq(scenarios.id, id)).run();
  revalidatePath(`/property/${propertyId}`);
}

export async function savePhoto(
  propertyId: number,
  fd: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No image supplied." };
  }
  // Cheap rejection before reading the whole thing into memory.
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: `Image is too large; the limit is ${MAX_PHOTO_BYTES / 1024 / 1024}MB.` };
  }

  const checked = validatePhoto(Buffer.from(await file.arrayBuffer()));
  if (!checked.ok) return checked;

  getDb()
    .update(properties)
    .set({ photo: checked.bytes, photoType: checked.type })
    .where(eq(properties.id, propertyId))
    .run();

  revalidatePath("/");
  revalidatePath(`/property/${propertyId}`);
  return { ok: true };
}

export async function removePhoto(propertyId: number) {
  getDb()
    .update(properties)
    .set({ photo: null, photoType: null })
    .where(eq(properties.id, propertyId))
    .run();

  revalidatePath("/");
  revalidatePath(`/property/${propertyId}`);
}

export async function createShare(fd: FormData) {
  const propertyIdRaw = String(fd.get("propertyId") ?? "");
  const hours = Number(fd.get("expiryHours") ?? 0);

  getDb()
    .insert(shareLinks)
    .values({
      token: newToken(),
      // Empty string means the whole board.
      propertyId: propertyIdRaw ? Number(propertyIdRaw) : null,
      label: String(fd.get("label") ?? "").slice(0, 120),
      expiresAt: expiryFromHours(Number.isFinite(hours) ? hours : 0),
      readOnly: true,
    })
    .run();

  revalidatePath("/shares");
}

export async function revokeShare(token: string) {
  // Revoke, never delete: a deleted row would let the same token be minted
  // again by chance, and the audit trail of what was shared disappears.
  getDb()
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(eq(shareLinks.token, token))
    .run();

  revalidatePath("/shares");
}

export async function deleteProperty(id: number) {
  getDb().delete(properties).where(eq(properties.id, id)).run();
  revalidatePath("/");
  redirect("/");
}
