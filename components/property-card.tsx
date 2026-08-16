import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Property } from "@/lib/db/schema";
import { money } from "@/lib/parse";

const statusTone: Record<Property["status"], string> = {
  watching: "secondary",
  touring: "default",
  offer: "default",
  dead: "outline",
};

export function PropertyCard({ property: p }: { property: Property }) {
  const line = [p.city, p.state].filter(Boolean).join(", ");
  const perSqft = p.sqft && p.listPrice ? p.listPrice / p.sqft : null;

  return (
    <Card className="transition-colors hover:border-foreground/20">
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">
            <Link href={`/property/${p.id}`} className="after:absolute after:inset-0 relative">
              {p.nickname}
            </Link>
          </CardTitle>
          <Badge variant={statusTone[p.status] as "default"}>{p.status}</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {p.street ? `${p.street}, ` : ""}
          {line || "No address yet"}
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
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
      </CardContent>
    </Card>
  );
}
