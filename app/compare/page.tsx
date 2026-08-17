import { desc } from "drizzle-orm";
import { CompareTable } from "@/components/compare-table";
import { getDb } from "@/lib/db";
import { crimeCache, properties, scenarios } from "@/lib/db/schema";
import { buildCompareRow } from "@/lib/compare";
import { COVERAGE_LABEL, type Coverage } from "@/lib/crime/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Compare — HomeScout" };

export default function ComparePage() {
  const db = getDb();
  const rows = db.select().from(properties).orderBy(desc(properties.createdAt)).all();
  const allScenarios = db.select().from(scenarios).orderBy(desc(scenarios.createdAt)).all();
  const cached = db.select().from(crimeCache).all();

  const fallback = allScenarios[0];

  const compareRows = rows.map((p) => {
    const own = allScenarios.find((s) => s.propertyId === p.id);

    // Reuse whatever the Crime tab already fetched; never fetch here, since a
    // compare page that fans out to third parties on every load is a bad idea.
    let crime: { incidents: number; coverage: string } | null = null;
    if (p.lat != null && p.lng != null) {
      const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)},1`;
      const hit = cached.find((c) => c.key === key);
      if (hit) {
        try {
          const payload = JSON.parse(hit.payload) as {
            result?: { total?: number; coverage?: Coverage } | null;
          };
          if (payload.result && typeof payload.result.total === "number") {
            crime = {
              incidents: payload.result.total,
              coverage: COVERAGE_LABEL[payload.result.coverage ?? "none"],
            };
          }
        } catch {
          // Corrupt cache row — treat as not checked.
        }
      }
    }

    return buildCompareRow(p, own, fallback, crime);
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
        <p className="text-muted-foreground text-sm">
          {rows.length} propert{rows.length === 1 ? "y" : "ies"} side by side.
        </p>
      </div>
      <CompareTable rows={compareRows} />
    </div>
  );
}
