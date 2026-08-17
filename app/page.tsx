import Link from "next/link";
import { desc } from "drizzle-orm";
import { PropertyCard } from "@/components/property-card";
import { buttonVariants } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { propertyColumns, properties } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default function Home() {
  const rows = getDb().select(propertyColumns).from(properties).orderBy(desc(properties.createdAt)).all();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
          <p className="text-muted-foreground text-sm">
            {rows.length} saved{rows.length === 1 ? "" : ""}
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
          {rows.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </div>
  );
}
