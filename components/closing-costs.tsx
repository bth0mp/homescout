"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  GROUP_LABEL,
  LAST_VERIFIED as DEFAULTS_VERIFIED,
  LINE_ITEMS,
  NO_TRANSFER_TAX,
  TRANSFER_TAX_PCT,
  defaultLineItems,
  type LineItem,
  type LineItemId,
} from "@/lib/closing/defaults";
import { NON_ALLOWABLE_FEES } from "@/lib/closing/non-allowable";
import { daysToMonthEnd, estimateClosing } from "@/lib/closing/estimate";
import { money, parseNumber, pct } from "@/lib/parse";

const num = (v: string, fallback = 0) => parseNumber(v) ?? fallback;

export function ClosingCosts({
  price,
  loanAmount,
  downPayment,
  fundingFeeDueAtClosing,
  interestRate,
  insuranceAnnual,
  propertyTaxAnnual,
  state,
  nickname,
}: {
  price: number;
  loanAmount: number;
  downPayment: number;
  fundingFeeDueAtClosing: number;
  interestRate: number;
  insuranceAnnual: number;
  propertyTaxAnnual: number;
  state: string;
  nickname: string;
}) {
  const seeded = useMemo(
    () => defaultLineItems({ price, loanAmount, state }),
    [price, loanAmount, state],
  );

  // Only the items the user has actually touched are held here; everything else
  // tracks the defaults as price and loan change.
  const [overrides, setOverrides] = useState<Partial<Record<LineItemId, string>>>({});
  const items = useMemo(() => {
    const out = { ...seeded };
    for (const [id, v] of Object.entries(overrides)) {
      if (v !== undefined && v !== "") out[id as LineItemId] = num(v);
      else if (v === "") out[id as LineItemId] = 0;
    }
    return out;
  }, [seeded, overrides]);

  const [prepaidDays, setPrepaidDays] = useState(String(daysToMonthEnd(new Date())));
  const [taxMonths, setTaxMonths] = useState("3");
  const [insMonths, setInsMonths] = useState("2");
  const [concessions, setConcessions] = useState("");
  const [lenderCredits, setLenderCredits] = useState("");
  const [earnest, setEarnest] = useState("");
  const [showNonAllowable, setShowNonAllowable] = useState(false);

  const result = useMemo(
    () =>
      estimateClosing({
        price,
        loanAmount,
        downPayment,
        fundingFeeDueAtClosing,
        items,
        interestRate,
        prepaidInterestDays: num(prepaidDays),
        insuranceAnnual,
        propertyTaxAnnual,
        taxReserveMonths: num(taxMonths),
        insuranceReserveMonths: num(insMonths),
        sellerConcessions: num(concessions),
        lenderCredits: num(lenderCredits),
        earnestMoney: num(earnest),
      }),
    [
      price, loanAmount, downPayment, fundingFeeDueAtClosing, items, interestRate,
      prepaidDays, insuranceAnnual, propertyTaxAnnual, taxMonths, insMonths,
      concessions, lenderCredits, earnest,
    ],
  );

  const stateKey = state.trim().toUpperCase();
  const transferTaxNote = NO_TRANSFER_TAX.has(stateKey)
    ? `${stateKey} has no state transfer tax.`
    : TRANSFER_TAX_PCT[stateKey]
      ? `${stateKey} state rate ${TRANSFER_TAX_PCT[stateKey]}%. County rates often stack.`
      : `No statewide rate on file for ${stateKey || "this state"} — enter it yourself.`;

  function exportCsv() {
    const rows: Array<Array<string | number>> = LINE_ITEMS.map((i) => [
      GROUP_LABEL[i.group],
      i.label,
      items[i.id],
    ]);
    rows.push(["Prepaids", "Prepaid interest", result.prepaidInterest]);
    rows.push(["Prepaids", "Homeowners insurance, year 1", result.insurancePrepaid]);
    rows.push(["Prepaids", "Property tax reserve", result.taxReserve]);
    rows.push(["Prepaids", "Insurance reserve", result.insuranceReserve]);
    if (fundingFeeDueAtClosing > 0) rows.push(["Loan", "VA funding fee (cash)", fundingFeeDueAtClosing]);
    rows.push(["Total", "Total closing costs", result.totalClosingCosts]);
    rows.push(["Credits", "Seller concessions", num(concessions)]);
    rows.push(["Credits", "Lender credits", num(lenderCredits)]);
    rows.push(["Credits", "Earnest money", num(earnest)]);
    rows.push(["Total", "Down payment", downPayment]);
    rows.push(["Total", "Cash to close", result.cashToClose]);

    downloadCsv(
      `homescout-${nickname.replace(/\W+/g, "-").toLowerCase()}-closing-costs.csv`,
      toCsv(["Group", "Item", "Amount"], rows),
    );
  }

  const byGroup = (["loan", "title", "government", "inspection"] as const).map((g) => ({
    group: g,
    items: LINE_ITEMS.filter((i) => i.group === g),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {byGroup.map(({ group, items: groupItems }) => (
            <fieldset key={group}>
              <legend className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                {GROUP_LABEL[group]}
              </legend>
              <div className="grid gap-3">
                {groupItems.map((item: LineItem) => {
                  const id = `cc-${item.id}`;
                  return (
                    <div key={item.id} className="grid gap-1">
                      <div className="flex items-center gap-3">
                        <Label htmlFor={id} className="flex-1">
                          {item.label}
                        </Label>
                        <Input
                          id={id}
                          inputMode="decimal"
                          className="w-32 text-right"
                          value={overrides[item.id] ?? String(seeded[item.id] || "")}
                          onChange={(e) =>
                            setOverrides((o) => ({ ...o, [item.id]: e.target.value }))
                          }
                        />
                      </div>
                      {item.id === "transferTax" ? (
                        <p className="text-muted-foreground text-xs">{transferTaxNote}</p>
                      ) : item.note ? (
                        <p className="text-muted-foreground text-xs">{item.note}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <fieldset>
            <legend className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              Prepaids &amp; reserves
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cc-days">Prepaid interest days</Label>
                <Input id="cc-days" inputMode="numeric" value={prepaidDays} onChange={(e) => setPrepaidDays(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cc-taxmo">Tax reserve (months)</Label>
                <Input id="cc-taxmo" inputMode="numeric" value={taxMonths} onChange={(e) => setTaxMonths(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cc-insmo">Insurance reserve (months)</Label>
                <Input id="cc-insmo" inputMode="numeric" value={insMonths} onChange={(e) => setInsMonths(e.target.value)} />
              </div>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Days default to closing today through month end. Year one of homeowners insurance
              ({money(insuranceAnnual)}) is collected in full at closing.
            </p>
          </fieldset>

          <fieldset>
            <legend className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              Credits
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cc-conc">Seller concessions</Label>
                <Input id="cc-conc" inputMode="decimal" value={concessions} onChange={(e) => setConcessions(e.target.value)} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cc-lc">Lender credits</Label>
                <Input id="cc-lc" inputMode="decimal" value={lenderCredits} onChange={(e) => setLenderCredits(e.target.value)} placeholder="0" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cc-em">Earnest money paid</Label>
                <Input id="cc-em" inputMode="decimal" value={earnest} onChange={(e) => setEarnest(e.target.value)} placeholder="0" />
              </div>
            </div>
          </fieldset>
        </CardContent>
      </Card>

      <div className="grid content-start gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cash to close</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">Estimated cash to close</span>
              <span className="text-2xl font-semibold tabular-nums">{money(result.cashToClose)}</span>
            </div>
            <dl className="divide-border/60 divide-y text-sm">
              {[
                ["Line items", result.itemsTotal],
                ["Prepaids & reserves", result.prepaidsTotal],
                ...(fundingFeeDueAtClosing > 0
                  ? ([["VA funding fee (cash)", fundingFeeDueAtClosing]] as const)
                  : []),
                ["Total closing costs", result.totalClosingCosts],
                ["Down payment", downPayment],
                ["Less credits", -result.totalCredits],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between py-1">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="tabular-nums">{money(Number(value))}</dd>
                </div>
              ))}
            </dl>
            <p className="text-muted-foreground text-sm">
              Closing costs are {pct(result.pctOfPrice)} of the purchase price.
            </p>

            {result.warnings.map((w) => (
              <p
                key={w.message}
                role="alert"
                className={`flex items-start gap-2 rounded-md border p-2 text-xs ${
                  w.level === "error"
                    ? "border-destructive/40 text-destructive"
                    : "border-amber-500/40 text-amber-600 dark:text-amber-500"
                }`}
              >
                <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                <span>{w.message}</span>
              </p>
            ))}

            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download aria-hidden className="size-3.5" />
              Export CSV
            </Button>

            <p className="text-muted-foreground text-xs">
              An estimate only. Your Loan Estimate and Closing Disclosure are the documents that
              govern. Defaults last reviewed {DEFAULTS_VERIFIED}.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Fees you can&rsquo;t be charged</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowNonAllowable((v) => !v)} aria-expanded={showNonAllowable}>
                {showNonAllowable ? "Hide" : "Show"}
              </Button>
            </div>
          </CardHeader>
          {showNonAllowable ? (
            <CardContent>
              <p className="text-muted-foreground mb-3 text-xs">
                The lender&rsquo;s 1% flat origination charge is meant to cover these. If you see one
                itemised on your Loan Estimate, ask about it.
              </p>
              <ul className="space-y-2 text-sm">
                {NON_ALLOWABLE_FEES.map((f) => (
                  <li key={f.fee}>
                    <span className="font-medium">{f.fee}</span>
                    {f.note ? (
                      <span className="text-muted-foreground block text-xs">{f.note}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
