import Link from "next/link";
import type { PropertyRow } from "@/lib/db/schema";
import { money } from "@/lib/parse";

/**
 * A dossier card, not a listing tile.
 *
 * The photo is memory; the monthly payment is the decision. So the photo sits
 * behind a scrim with the name over it, and the payment gets the largest,
 * hardest type on the card. Everything else is a hairline-separated data strip
 * underneath, in mono, so two cards line up column-for-column when scanned.
 */

const STATUS_DOT: Record<PropertyRow["status"], string> = {
  watching: "bg-sky-400",
  touring: "bg-violet-400",
  offer: "bg-emerald-400",
  pending: "bg-amber-400",
  dead: "bg-zinc-500",
};

export function PropertyCard({
  property: p,
  monthly,
  missingCosts = [],
  estimatedCosts = [],
  taxAnnual,
  insuranceAnnual,
  index = 0,
}: {
  property: PropertyRow;
  monthly?: number | null;
  missingCosts?: string[];
  estimatedCosts?: string[];
  taxAnnual?: number | null;
  insuranceAnnual?: number | null;
  /** Position in the grid, used to stagger the entrance. */
  index?: number;
}) {
  const line = [p.city, p.state].filter(Boolean).join(", ");
  const perSqft = p.sqft && p.listPrice ? p.listPrice / p.sqft : null;

  return (
    <article
      // `relative` belongs on the card, not the link: the stretched overlay is
      // positioned against its nearest positioned ancestor.
      className="group border-border bg-card rise focus-within:ring-ring/60 relative overflow-hidden rounded-lg border transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-lg hover:shadow-black/20 focus-within:ring-2"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className="relative h-44 overflow-hidden">
        {p.photoType ? (
          // eslint-disable-next-line @next/next/no-img-element -- raw bytes from our own route.
          <img
            src={`/api/photo/${p.id}`}
            alt=""
            aria-hidden
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          // No photo: a blueprint field rather than a grey box, so the card
          // still reads as part of the set.
          <div className="bg-muted/40 h-full w-full" />
        )}

        {/* Scrim: dense at the base so the name always has contrast, whatever
            the photo happens to be. */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/70 to-card/5" />

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <div className="min-w-0">
            <h2 className="font-display truncate text-[1.35rem] leading-tight font-semibold">
              <Link
                href={`/property/${p.id}`}
                // after:content-[''] is required — Tailwind's after:absolute
                // emits no content, so without it the overlay has no box and
                // only the text itself is clickable.
                className="outline-none after:absolute after:inset-0 after:content-['']"
              >
                {p.nickname}
              </Link>
            </h2>
            <p className="text-muted-foreground truncate text-xs">
              {p.street ? `${p.street}, ` : ""}
              {line || "No address yet"}
            </p>
          </div>

          <span className="bg-background/70 text-foreground/90 ring-border/60 flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] ring-1 backdrop-blur">
            <span aria-hidden className={`size-1.5 rounded-full ${STATUS_DOT[p.status]}`} />
            {p.status}
          </span>
        </div>
      </div>

      <div className="p-4 pt-3.5">
        {/* The decision. Largest, hardest type on the card. */}
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground text-[0.6875rem] tracking-[0.08em] uppercase">
            Est. monthly
          </span>
          <span className="numeric text-2xl leading-none font-semibold">
            {monthly ? money(monthly) : "—"}
          </span>
        </div>

        {monthly ? (
          <p className="text-muted-foreground numeric mt-1.5 flex flex-wrap justify-end gap-x-3 text-[0.6875rem]">
            {taxAnnual ? (
              <span>
                tax {money(taxAnnual / 12)}
                {estimatedCosts.includes("property tax") ? (
                  <span className="text-estimate">*</span>
                ) : null}
              </span>
            ) : null}
            {insuranceAnnual ? (
              <span>
                ins {money(insuranceAnnual / 12)}
                {estimatedCosts.includes("insurance") ? (
                  <span className="text-estimate">*</span>
                ) : null}
              </span>
            ) : null}
            {p.hoaMonthly ? <span>hoa {money(p.hoaMonthly)}</span> : null}
          </p>
        ) : null}

        {monthly && estimatedCosts.length > 0 ? (
          <p className="text-estimate mt-1 text-right text-[0.6875rem]">
            * estimated {estimatedCosts.join(" and ")}
          </p>
        ) : null}
        {monthly && missingCosts.length > 0 ? (
          <p className="text-estimate mt-1 text-right text-[0.6875rem]">
            excludes {missingCosts.join(" and ")} — add a state to estimate
          </p>
        ) : null}

        {/* Hairline-separated strip. Mono so cards align column-for-column. */}
        <dl className="rule mt-3.5 grid grid-cols-4 gap-px border-t pt-3 text-center">
          <Cell label="List" value={p.listPrice ? money(p.listPrice) : "—"} />
          <Cell label="Beds/ba" value={`${p.beds ?? "—"}/${p.baths ?? "—"}`} />
          <Cell label="Sq ft" value={p.sqft?.toLocaleString() ?? "—"} />
          <Cell label="$/sqft" value={perSqft ? money(perSqft) : "—"} />
        </dl>
      </div>
    </article>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-[0.625rem] tracking-[0.06em] uppercase">{label}</dt>
      <dd className="numeric mt-0.5 text-[0.8125rem] font-medium">{value}</dd>
    </div>
  );
}
