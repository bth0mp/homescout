"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { properties } from "@/lib/db/schema";
import { geocode } from "@/lib/geocode";
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

  const current = getDb().select().from(properties).where(eq(properties.id, id)).get();
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

export async function deleteProperty(id: number) {
  getDb().delete(properties).where(eq(properties.id, id)).run();
  revalidatePath("/");
  redirect("/");
}
