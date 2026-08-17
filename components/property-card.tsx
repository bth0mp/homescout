import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PropertyRow } from "@/lib/db/schema";
import { money } from "@/lib/parse";

const statusTone: Record<PropertyRow["status"], string> = {
  watching: "secondary",
  touring: "default",
  offer: "default",
  dead: "outline",
};

export function PropertyCard({
  property: p,
  monthly,
  missingCosts = [],
}: {
  property: PropertyRow;
  /** Total monthly payment from this property's scenario, when it has one. */
  monthly?: number | null;
  missingCosts?: string[];
}) {
  const line = [p.city, p.state].filter(Boolean).join(", ");
  const perSqft = p.sqft && p.listPrice ? p.listPrice / p.sqft : null;

  return (
    // `relative` belongs HERE, not on the link: the stretched overlay is
    // positioned against its nearest positioned ancestor, so putting it on the
    // link made only the nickname text clickable.
    <Card className="focus-within:ring-ring relative overflow-hidden transition-colors hover:border-foreground/20 focus-within:ring-2">
      {p.photoType ? (
        // eslint-disable-next-line @next/next/no-img-element -- raw bytes from our own route.
        <img
          src={`/api/photo/${p.id}`}
          alt=""
          aria-hidden
          loading="lazy"
          className="h-40 w-full object-cover"
        />
      ) : null}
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">
            <Link
              href={`/property/${p.id}`}
              // after:content-[''] is required — Tailwind's after:absolute does
              // not generate a content property, so without it the pseudo-element
              // has no box and the overlay silently does not exist.
              className="outline-none after:absolute after:inset-0 after:content-['']"
            >
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
      <CardContent className="space-y-3">
        {/* The number that decides whether a house is possible, shown without
            making anyone open a tab to find it. */}
        <div className="bg-muted/50 flex items-baseline justify-between rounded-md px-3 py-2">
          <span className="text-muted-foreground text-xs">Est. monthly</span>
          <span className="text-lg font-semibold tabular-nums">
            {monthly ? money(monthly) : "—"}
            {monthly && missingCosts.length > 0 ? (
              <span className="block text-right text-xs font-normal text-amber-600 dark:text-amber-500">
                no {missingCosts.join(" or ")}
              </span>
            ) : null}
          </span>
        </div>

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
      </CardContent>
    </Card>
  );
}
