import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { PropertyMap, type MapPin } from "@/components/property-map";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { properties, shareLinks } from "@/lib/db/schema";
import { money } from "@/lib/parse";
import { isWellFormedToken, rateLimit, shareState } from "@/lib/share";

export const dynamic = "force-dynamic";

// This page is public by design; keep it out of every index.
export const metadata = {
  title: "Shared properties",
  robots: { index: false, follow: false, nocache: true },
};

export default async function SharedView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Cheap rejection before any database work, so a token-guessing flood costs
  // nothing but a regex.
  if (!isWellFormedToken(token)) notFound();

  const h = await headers();
  // Behind Pangolin this is the proxy-set client address. It is only as
  // trustworthy as the proxy; the token itself is the real access control.
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0]!.trim();
  if (!rateLimit(`share:${ip}`, 60, 60_000).allowed) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-semibold">Too many requests</h1>
        <p className="text-muted-foreground mt-2 text-sm">Try again in a minute.</p>
      </div>
    );
  }

  const db = getDb();
  const share = db.select().from(shareLinks).where(eq(shareLinks.token, token)).get();

  // Revoked, expired and never-existed all render identically. A distinct
  // "expired" page would confirm the token was once real.
  if (shareState(share) !== "valid") notFound();

  const rows = share!.propertyId
    ? db.select().from(properties).where(eq(properties.id, share!.propertyId)).all()
    : db.select().from(properties).orderBy(desc(properties.createdAt)).all();

  if (rows.length === 0) notFound();

  const pins: MapPin[] = rows
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({
      id: p.id,
      lat: p.lat!,
      lng: p.lng!,
      label: p.nickname,
      sublabel: [p.city, p.state].filter(Boolean).join(", "),
      price: p.listPrice || undefined,
      status: p.status,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {share!.label || (rows.length === 1 ? rows[0].nickname : "Shared properties")}
        </h1>
        <p className="text-muted-foreground text-sm">
          Read-only view shared from HomeScout
          {share!.expiresAt ? ` · expires ${share!.expiresAt.toLocaleDateString()}` : ""}
        </p>
      </div>

      {pins.length > 0 ? <PropertyMap pins={pins} height="20rem" /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((p) => {
          const perSqft = p.sqft && p.listPrice ? p.listPrice / p.sqft : null;
          return (
            <Card key={p.id} className="overflow-hidden">
              {p.photoType ? (
                // eslint-disable-next-line @next/next/no-img-element -- raw bytes,
                // served through the share-scoped route so no auth is needed.
                <img
                  src={`/s/${token}/photo/${p.id}`}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  className="h-48 w-full object-cover"
                />
              ) : null}
              <CardHeader className="gap-1">
                <div className="flex items-start justify-between gap-2">
                  {/* No link: there is nothing to navigate to from a shared view. */}
                  <CardTitle className="text-base leading-tight">{p.nickname}</CardTitle>
                  <Badge variant="secondary">{p.status}</Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  {[p.street, p.city, p.state, p.zip].filter(Boolean).join(", ") || "No address"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground text-xs">List</dt>
                    <dd className="font-medium">{p.listPrice ? money(p.listPrice) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Beds / baths</dt>
                    <dd className="font-medium">
                      {p.beds ?? "—"} / {p.baths ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Sq ft</dt>
                    <dd className="font-medium">{p.sqft?.toLocaleString() ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">$/sq ft</dt>
                    <dd className="font-medium">{perSqft ? money(perSqft) : "—"}</dd>
                  </div>
                </dl>

                {/* Notes marked private never leave the admin side. */}
                {p.notes && !p.notesPrivate ? (
                  <p className="text-muted-foreground border-border/60 border-t pt-3 text-sm whitespace-pre-wrap">
                    {p.notes}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        Figures are estimates entered by the sharer, not lender-verified.
      </p>
    </div>
  );
}
