import Link from "next/link";
import { desc } from "drizzle-orm";
import { PropertyMap, type MapPin } from "@/components/property-map";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { properties } from "@/lib/db/schema";
import { money } from "@/lib/parse";

export const dynamic = "force-dynamic";
export const metadata = { title: "Map — HomeScout" };

export default function MapPage() {
  const rows = getDb().select().from(properties).orderBy(desc(properties.createdAt)).all();

  const mapped = rows.filter((p) => p.lat != null && p.lng != null);
  const unmapped = rows.length - mapped.length;

  const pins: MapPin[] = mapped.map((p) => ({
    id: p.id,
    lat: p.lat!,
    lng: p.lng!,
    label: p.nickname,
    sublabel: [p.city, p.state].filter(Boolean).join(", "),
    price: p.listPrice || undefined,
    href: `/property/${p.id}`,
    status: p.status,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Map</h1>
        <p className="text-muted-foreground text-sm">
          {pins.length} of {rows.length} propert{rows.length === 1 ? "y" : "ies"} pinned
          {unmapped > 0 ? ` — ${unmapped} without a geocoded address` : ""}.
        </p>
      </div>

      <PropertyMap pins={pins} height="70vh" />

      {rows.length > 0 ? (
        <Card>
          <CardContent className="flex flex-wrap gap-2">
            {rows.map((p) => (
              <Link
                key={p.id}
                href={`/property/${p.id}`}
                className="border-border hover:bg-muted flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
              >
                <span className="font-medium">{p.nickname}</span>
                {p.listPrice ? (
                  <span className="text-muted-foreground tabular-nums">{money(p.listPrice)}</span>
                ) : null}
                <Badge variant="secondary">{p.status}</Badge>
                {p.lat == null ? (
                  <span className="text-muted-foreground text-xs">(not pinned)</span>
                ) : null}
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
