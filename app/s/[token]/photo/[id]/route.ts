import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { properties, shareLinks } from "@/lib/db/schema";
import { photoResponse } from "@/lib/photo-response";
import { isWellFormedToken, shareState } from "@/lib/share";

export const dynamic = "force-dynamic";

/**
 * Photo for a shared view.
 *
 * Lives under /s/ because that prefix is already public in middleware. Adding
 * /api/photo to the public list instead would let anyone enumerate every
 * property photo by id without holding a share link at all.
 *
 * The token must be valid AND actually cover this property: a link scoped to
 * one house must not serve another house's photo.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id: rawId } = await ctx.params;
  const id = Number(rawId);

  if (!isWellFormedToken(token) || !Number.isInteger(id)) {
    return new NextResponse(null, { status: 404 });
  }

  const db = getDb();
  const share = db.select().from(shareLinks).where(eq(shareLinks.token, token)).get();
  if (shareState(share) !== "valid") return new NextResponse(null, { status: 404 });

  // A property-scoped link may only serve that property.
  if (share!.propertyId !== null && share!.propertyId !== id) {
    return new NextResponse(null, { status: 404 });
  }

  const row = db
    .select({ photo: properties.photo, photoType: properties.photoType })
    .from(properties)
    .where(eq(properties.id, id))
    .get();

  return photoResponse(row?.photo ?? null, row?.photoType ?? null);
}
