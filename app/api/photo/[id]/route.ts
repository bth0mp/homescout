import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { properties } from "@/lib/db/schema";
import { photoResponse } from "@/lib/photo-response";

export const dynamic = "force-dynamic";

/** Admin-side photo. Behind the auth gate like every other non-public route. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new NextResponse(null, { status: 404 });

  const row = getDb()
    .select({ photo: properties.photo, photoType: properties.photoType })
    .from(properties)
    .where(eq(properties.id, id))
    .get();

  return photoResponse(row?.photo ?? null, row?.photoType ?? null);
}
