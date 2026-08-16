"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import { amortizationSchedule } from "@/lib/va/amortize";
import { money } from "@/lib/parse";

export function AmortizationTable({
  principal,
  rate,
  months,
  filename,
}: {
  principal: number;
  rate: number;
  months: number;
  filename: string;
}) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(
    () => amortizationSchedule(principal, rate, months),
    [principal, rate, months],
  );

  if (rows.length === 0) return null;

  function exportCsv() {
    const csv = toCsv(
      ["Month", "Payment", "Interest", "Principal", "Balance"],
      rows.map((r) => [r.month, r.payment, r.interest, r.principal, r.balance]),
    );
    downloadCsv(filename, csv);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "Hide" : "Show"} amortization schedule ({rows.length} payments)
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download aria-hidden className="size-3.5" />
          CSV
        </Button>
      </div>

      {open ? (
        // Fixed height + overflow so 360 rows never push the page around.
        <div className="border-border max-h-96 overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <caption className="sr-only">Amortization schedule, one row per monthly payment</caption>
            <thead className="bg-muted sticky top-0">
              <tr className="text-left">
                <th scope="col" className="px-3 py-2 font-medium">#</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Payment</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Interest</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Principal</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-border/60 border-t">
                  <td className="text-muted-foreground px-3 py-1.5 tabular-nums">{r.month}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(r.payment, true)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(r.interest, true)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(r.principal, true)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(r.balance, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
