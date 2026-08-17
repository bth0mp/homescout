"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Download, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import { sortRows, type CompareRow, type SortKey } from "@/lib/compare";
import { money } from "@/lib/parse";

const COLUMNS: Array<{
  key: SortKey | "commute";
  label: string;
  numeric?: boolean;
  sortable?: boolean;
  render: (r: CompareRow) => React.ReactNode;
  csv: (r: CompareRow) => string | number;
}> = [
  {
    key: "nickname",
    label: "Property",
    sortable: true,
    render: (r) => (
      <Link href={`/property/${r.id}`} className="font-medium underline-offset-2 hover:underline">
        {r.nickname}
      </Link>
    ),
    csv: (r) => r.nickname,
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (r) => <Badge variant="secondary">{r.status}</Badge>,
    csv: (r) => r.status,
  },
  {
    key: "listPrice",
    label: "List price",
    numeric: true,
    sortable: true,
    render: (r) => (r.listPrice ? money(r.listPrice) : "—"),
    csv: (r) => r.listPrice ?? "",
  },
  {
    key: "monthlyPayment",
    label: "Monthly",
    numeric: true,
    sortable: true,
    render: (r) =>
      r.monthlyPayment ? (
        <span>
          {money(r.monthlyPayment)}
          {r.missingCosts.length > 0 ? (
            <span className="block text-xs font-normal text-amber-600 dark:text-amber-500">
              no {r.missingCosts.join(" or ")}
            </span>
          ) : null}
        </span>
      ) : (
        "—"
      ),
    csv: (r) =>
      r.monthlyPayment == null
        ? ""
        : r.missingCosts.length > 0
          ? `${r.monthlyPayment} (excludes ${r.missingCosts.join(", ")})`
          : r.monthlyPayment,
  },
  {
    key: "cashToClose",
    label: "Cash to close",
    numeric: true,
    sortable: true,
    render: (r) => (r.cashToClose ? money(r.cashToClose) : "—"),
    csv: (r) => r.cashToClose ?? "",
  },
  {
    key: "pricePerSqft",
    label: "$/sq ft",
    numeric: true,
    sortable: true,
    render: (r) => (r.pricePerSqft ? money(r.pricePerSqft) : "—"),
    csv: (r) => r.pricePerSqft ?? "",
  },
  {
    key: "sqft",
    label: "Sq ft",
    numeric: true,
    sortable: true,
    render: (r) => r.sqft?.toLocaleString() ?? "—",
    csv: (r) => r.sqft ?? "",
  },
  {
    key: "crimeIncidents",
    label: "Crime",
    numeric: true,
    sortable: true,
    // Never a bare number: an incident count means nothing without its coverage.
    render: (r) =>
      r.crimeIncidents == null ? (
        <span className="text-muted-foreground">not checked</span>
      ) : (
        <span title={r.crimeCoverage ?? undefined}>
          {r.crimeIncidents.toLocaleString()}
          <span className="text-muted-foreground block text-xs">{r.crimeCoverage}</span>
        </span>
      ),
    csv: (r) => (r.crimeIncidents == null ? "" : `${r.crimeIncidents} (${r.crimeCoverage})`),
  },
  {
    key: "commute",
    label: "Commute",
    sortable: false,
    render: () => <span className="text-muted-foreground text-xs">—</span>,
    csv: () => "",
  },
];

export function CompareTable({ rows }: { rows: CompareRow[] }) {
  const [key, setKey] = useState<SortKey>("monthlyPayment");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => sortRows(rows, key, dir), [rows, key, dir]);

  function toggle(k: SortKey) {
    if (k === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setKey(k);
      setDir("asc");
    }
  }

  function exportCsv() {
    downloadCsv(
      "homescout-compare.csv",
      toCsv(
        COLUMNS.map((c) => c.label),
        sorted.map((r) => COLUMNS.map((c) => c.csv(r))),
      ),
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Save a couple of properties and they will line up here side by side.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer aria-hidden className="size-3.5" />
          Print / PDF
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download aria-hidden className="size-3.5" />
          CSV
        </Button>
      </div>

      <div className="border-border overflow-x-auto rounded-md border print:border-0">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Saved properties compared side by side, sorted by {key} {dir}ending
          </caption>
          <thead className="bg-muted print:bg-transparent">
            <tr>
              {COLUMNS.map((c) => {
                const active = c.key === key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={
                      active ? (dir === "asc" ? "ascending" : "descending") : c.sortable ? "none" : undefined
                    }
                    className={`px-3 py-2 font-medium ${c.numeric ? "text-right" : "text-left"}`}
                  >
                    {c.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggle(c.key as SortKey)}
                        className={`hover:text-foreground inline-flex items-center gap-1 ${
                          active ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {c.label}
                        {active ? (
                          dir === "asc" ? (
                            <ArrowUp aria-hidden className="size-3" />
                          ) : (
                            <ArrowDown aria-hidden className="size-3" />
                          )
                        ) : null}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">{c.label}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-border/60 border-t">
                {COLUMNS.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-2 align-top ${c.numeric ? "text-right tabular-nums" : ""}`}
                  >
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-muted-foreground text-xs">
        Monthly payment and cash to close use each property&rsquo;s saved scenario. Where a property
        has none, the most recent scenario from elsewhere is applied and marked{" "}
        <em>assumed</em> — so the comparison is between houses, not between assumptions. Closing
        costs use defaults; open a property to itemise them.
      </p>
    </div>
  );
}
