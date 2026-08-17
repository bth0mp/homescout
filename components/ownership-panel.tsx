"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money, parseNumber } from "@/lib/parse";
import { breakEvenAgainstRent, ownershipOverTime } from "@/lib/va/ownership";

const num = (v: string, fallback = 0) => parseNumber(v) ?? fallback;

export function OwnershipPanel({
  loanAmount,
  interestRate,
  termYears,
  price,
  downPayment,
  cashToClose,
  propertyTaxAnnual,
  insuranceAnnual,
  hoaMonthly,
}: {
  loanAmount: number;
  interestRate: number;
  termYears: number;
  price: number;
  downPayment: number;
  cashToClose: number;
  propertyTaxAnnual: number;
  insuranceAnnual: number;
  hoaMonthly: number;
}) {
  const [appreciation, setAppreciation] = useState("3");
  const [inflation, setInflation] = useState("3");
  const [rent, setRent] = useState("");

  const input = useMemo(
    () => ({
      loanAmount,
      interestRate,
      termYears,
      price,
      downPayment,
      cashToClose,
      propertyTaxAnnual,
      insuranceAnnual,
      hoaMonthly,
      appreciationPct: num(appreciation),
      costInflationPct: num(inflation),
    }),
    [
      loanAmount, interestRate, termYears, price, downPayment, cashToClose,
      propertyTaxAnnual, insuranceAnnual, hoaMonthly, appreciation, inflation,
    ],
  );

  const points = useMemo(() => ownershipOverTime(input, [1, 3, 5, 10, termYears]), [input, termYears]);
  const breakEven = useMemo(
    () => breakEvenAgainstRent(input, num(rent), num(inflation)),
    [input, rent, inflation],
  );

  if (points.length === 0) {
    return <p className="text-muted-foreground text-sm">Enter a price to see long-run costs.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">What it costs over time</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ow-appr">Appreciation %/yr</Label>
            <Input id="ow-appr" inputMode="decimal" value={appreciation} onChange={(e) => setAppreciation(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ow-infl">Cost inflation %/yr</Label>
            <Input id="ow-infl" inputMode="decimal" value={inflation} onChange={(e) => setInflation(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ow-rent">Rent you&rsquo;d pay instead</Label>
            <Input id="ow-rent" inputMode="decimal" value={rent} onChange={(e) => setRent(e.target.value)} placeholder="2,000" />
          </div>
        </div>

        <div className="border-border overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <caption className="sr-only">Cost and equity at year milestones</caption>
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Year</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Total paid</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Interest</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Tax/ins/HOA</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Owed</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Equity</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.year} className="border-border/60 border-t">
                  <td className="px-3 py-1.5 tabular-nums">{p.year}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(p.totalPaid)}</td>
                  <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums">{money(p.interestPaid)}</td>
                  <td className="text-muted-foreground px-3 py-1.5 text-right tabular-nums">{money(p.taxInsHoaPaid)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(p.remainingBalance)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{money(p.equity)}</td>
                  <td
                    className={`px-3 py-1.5 text-right tabular-nums ${
                      p.netPosition < 0 ? "text-amber-600 dark:text-amber-500" : "text-emerald-600 dark:text-emerald-500"
                    }`}
                  >
                    {money(p.netPosition)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-muted-foreground text-xs">
          <span className="text-foreground">Net</span> is equity minus every dollar spent, including
          cash to close. It is negative for years — that is normal, and it is the number sellers and
          lenders never show you. Tax, insurance and HOA grow at the inflation rate rather than
          staying flat, because holding them flat for thirty years understates lifetime cost badly.
        </p>

        {num(rent) > 0 ? (
          <p className="text-sm">
            {breakEven
              ? `Against ${money(num(rent))}/mo rent, owning pulls ahead around month ${breakEven} (year ${(breakEven / 12).toFixed(1)}).`
              : `Against ${money(num(rent))}/mo rent, owning does not pull ahead within ${termYears} years at these assumptions.`}
          </p>
        ) : null}

        <p className="text-muted-foreground text-xs">
          Projections, not predictions. Appreciation is the assumption doing the most work here —
          try 0% and see what changes.
        </p>
      </CardContent>
    </Card>
  );
}
