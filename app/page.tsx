import Link from "next/link";
import { desc } from "drizzle-orm";
import { PropertyCard } from "@/components/property-card";
import { buttonVariants } from "@/components/ui/button";
import { buildCompareRow } from "@/lib/compare";
import { getDb } from "@/lib/db";
import { propertyColumns, properties, scenarios } from "@/lib/db/schema";
import { money } from "@/lib/parse";

export const dynamic = "force-dynamic";

export default function Home() {
  const db = getDb();
  const rows = db.select(propertyColumns).from(properties).orderBy(desc(properties.createdAt)).all();
  const allScenarios = db.select().from(scenarios).orderBy(desc(scenarios.createdAt)).all();
  const fallback = allScenarios[0];

  // The same computation the compare table uses, so the board and the table can
  // never disagree about what a house costs per month.
  const priced = rows.map((p) =>
    buildCompareRow(
      p,
      allScenarios.find((s) => s.propertyId === p.id),
      fallback,
    ),
  );

  const cheapest = priced
    .filter((r) => r.monthlyPayment)
    .sort((a, b) => a.monthlyPayment! - b.monthlyPayment!)[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[2rem] leading-none font-semibold">Properties</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            <span className="numeric">{rows.length}</span> saved
            {cheapest?.monthlyPayment ? (
              <>
                {" · lowest monthly "}
                <span className="numeric text-foreground">{money(cheapest.monthlyPayment)}</span>
                {` (${cheapest.nickname})`}
              </>
            ) : null}
          </p>
        </div>
        <Link href="/property/new" className={buttonVariants()}>
          Add property
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="border-border rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">Nothing saved yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add an address and HomeScout geocodes it, builds the listing links, and runs the VA
            numbers.
          </p>
          <Link href="/property/new" className={buttonVariants({ className: "mt-4" })}>
            Add your first property
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((p, i) => {
            const row = priced.find((r) => r.id === p.id);
            return (
              <PropertyCard
                key={p.id}
                property={p}
                index={i}
                monthly={row?.monthlyPayment}
                missingCosts={row?.missingCosts ?? []}
                estimatedCosts={row?.estimatedCosts ?? []}
                taxAnnual={row?.taxAnnual}
                insuranceAnnual={row?.insuranceAnnual}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
