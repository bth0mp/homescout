import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getCrimeReport } from "@/lib/crime";
import { getDb } from "@/lib/db";
import { properties } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const query = z.object({
  propertyId: z.coerce.number().int().positive(),
  // Wider than ~5 miles stops describing a neighbourhood at all.
  radiusMiles: z.coerce.number().min(0.25).max(5).default(1),
});

export async function GET(req: NextRequest) {
  const parsed = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  // Coordinates come from the database, never from the caller — otherwise this
  // route is an open proxy for arbitrary outbound requests.
  const p = getDb()
    .select()
    .from(properties)
    .where(eq(properties.id, parsed.data.propertyId))
    .get();

  if (!p) return NextResponse.json({ error: "Property not found" }, { status: 404 });
  if (p.lat == null || p.lng == null) {
    return NextResponse.json({ error: "Property is not geocoded" }, { status: 409 });
  }

  const report = await getCrimeReport({
    lat: p.lat,
    lng: p.lng,
    city: p.city,
    state: p.state,
    fipsState: p.fipsState,
    fipsCounty: p.fipsCounty,
    radiusMiles: parsed.data.radiusMiles,
  });

  return NextResponse.json(report);
}
