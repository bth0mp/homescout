"use client";

import { useMemo, useState, useTransition } from "react";
import { Info } from "lucide-react";
import { deleteScenario, saveScenario } from "@/app/actions";
import { AmortizationTable } from "@/components/amortization-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Property, Scenario } from "@/lib/db/schema";
import { money, parseNumber, pct } from "@/lib/parse";
import { calculateLoan } from "@/lib/va/amortize";
import {
  DISABILITY_RATINGS,
  LAST_VERIFIED as FEE_VERIFIED,
  MIN_COMPENSABLE_RATING,
  exemptFromRating,
} from "@/lib/va/funding-fee";
import {
  DTI_GUIDELINE,
  REGIONS,
  REGION_LABEL,
  estimateUtilities,
  regionForState,
  residualIncome,
  type Region,
} from "@/lib/va/residual-income";

const num = (v: string, fallback = 0) => parseNumber(v) ?? fallback;

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className={strong ? "font-medium" : "text-muted-foreground text-sm"}>{label}</dt>
      <dd className={`tabular-nums ${strong ? "text-lg font-semibold" : "text-sm"}`}>{value}</dd>
    </div>
  );
}

function Field({
  label,
  hint,
  ...rest
}: React.ComponentProps<typeof Input> & { label: string; hint?: string }) {
  const id = `fin-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode="decimal" {...rest} />
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

/** Stacked bar, hand-rolled SVG. A chart library for one bar is not worth 40KB. */
function Breakdown({
  parts,
}: {
  parts: Array<{ label: string; value: number; className: string }>;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total <= 0) return null;
  let x = 0;

  return (
    <div className="space-y-2">
      <svg
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        className="h-4 w-full overflow-hidden rounded"
        role="img"
        aria-label={`Monthly payment breakdown: ${parts
          .filter((p) => p.value > 0)
          .map((p) => `${p.label} ${money(p.value)}`)
          .join(", ")}`}
      >
        {parts.map((p) => {
          const w = (p.value / total) * 100;
          const rect = <rect key={p.label} x={x} y={0} width={w} height={8} className={p.className} />;
          x += w;
          return rect;
        })}
      </svg>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <li key={p.label} className="flex items-center gap-1.5">
              <span aria-hidden className={`inline-block size-2.5 rounded-sm ${p.className}`} />
              <span className="text-muted-foreground">{p.label}</span>
              <span className="tabular-nums">{money(p.value)}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}

export function FinancingPanel({
  property,
  scenarios,
  lastUsed,
}: {
  property: Property;
  scenarios: Scenario[];
  /** Most recent scenario from any property, used to seed a first one here. */
  lastUsed?: Scenario | null;
}) {
  const [activeId, setActiveId] = useState<number | null>(scenarios[0]?.id ?? null);
  const active = scenarios.find((s) => s.id === activeId);
  // Rate, term and the VA flags describe the buyer, not the house.
  const seed = active ?? lastUsed ?? undefined;
  const [pending, startSave] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);

  // Loan inputs
  const [name, setName] = useState(active?.name ?? "Base case");
  const [price, setPrice] = useState(String(property.listPrice || ""));
  const [downPct, setDownPct] = useState(String(seed?.downPaymentPct ?? 0));
  const [rate, setRate] = useState(String(seed?.interestRate ?? 6.5));
  const [term, setTerm] = useState(String(seed?.termYears ?? 30));
  const [firstUse, setFirstUse] = useState(seed?.vaFirstUse ?? true);
  const [exempt, setExempt] = useState(seed?.fundingFeeExempt ?? false);
  // ponytail: not persisted. The rating is a property of the veteran, not of a
  // scenario, and only the exemption it implies affects the math — and that IS
  // persisted. No migration for a UI helper.
  const [rating, setRating] = useState<number | null>(null);
  const [financeFee, setFinanceFee] = useState(seed?.fundingFeeFinanced ?? true);
  const [tax, setTax] = useState(String(property.propertyTaxAnnual || ""));
  const [ins, setIns] = useState(String(property.insuranceAnnual || ""));
  const [hoa, setHoa] = useState(String(property.hoaMonthly || ""));

  // Residual income inputs
  const [showResidual, setShowResidual] = useState(false);
  const [region, setRegion] = useState<Region>(regionForState(property.state) ?? "west");
  const [household, setHousehold] = useState("2");
  const [income, setIncome] = useState("");
  const [debts, setDebts] = useState("");
  const [taxesWithheld, setTaxesWithheld] = useState("");
  const [utilities, setUtilities] = useState(
    property.sqft ? String(estimateUtilities(property.sqft)) : "",
  );

  const priceN = num(price);
  const downPctN = num(downPct);
  const downPayment = (priceN * downPctN) / 100;

  const loan = useMemo(
    () =>
      calculateLoan({
        price: priceN,
        downPayment,
        firstUse,
        exempt,
        interestRate: num(rate, 0),
        termYears: Math.max(1, num(term, 30)),
        financeFee,
        propertyTaxAnnual: num(tax),
        insuranceAnnual: num(ins),
        hoaMonthly: num(hoa),
      }),
    [priceN, downPayment, firstUse, exempt, rate, term, financeFee, tax, ins, hoa],
  );

  const residual = useMemo(
    () =>
      residualIncome({
        region,
        familySize: num(household, 1),
        loanAmount: loan.loanAmount,
        grossMonthlyIncome: num(income),
        monthlyHousing: loan.monthlyTotal,
        monthlyDebts: num(debts),
        monthlyTaxes: num(taxesWithheld),
        monthlyUtilities: num(utilities),
      }),
    [region, household, loan.loanAmount, loan.monthlyTotal, income, debts, taxesWithheld, utilities],
  );

  function onSave() {
    startSave(async () => {
      const res = await saveScenario({
        id: activeId ?? undefined,
        propertyId: property.id,
        name: name.trim() || "Scenario",
        downPaymentPct: downPctN,
        interestRate: num(rate, 0),
        termYears: Math.max(1, Math.round(num(term, 30))),
        fundingFeeFinanced: financeFee,
        fundingFeeExempt: exempt,
        vaFirstUse: firstUse,
      });
      if ("error" in res) {
        setSaved(res.error);
        return;
      }
      setActiveId(res.id);
      setSaved("Saved.");
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      {/* ---------- inputs ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {scenarios.length > 0 ? (
            <div className="grid gap-1.5">
              <Label htmlFor="fin-scenario">Scenario</Label>
              <div className="flex gap-2">
                <select
                  id="fin-scenario"
                  value={activeId ?? ""}
                  onChange={(e) => {
                    const s = scenarios.find((x) => x.id === Number(e.target.value));
                    if (!s) return;
                    setActiveId(s.id);
                    setName(s.name);
                    setDownPct(String(s.downPaymentPct));
                    setRate(String(s.interestRate));
                    setTerm(String(s.termYears));
                    setFirstUse(s.vaFirstUse);
                    setExempt(s.fundingFeeExempt);
                    setFinanceFee(s.fundingFeeFinanced);
                    setSaved(null);
                  }}
                  className="border-input bg-background h-9 flex-1 rounded-md border px-3 text-sm"
                >
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveId(null);
                    setName("New scenario");
                    setSaved(null);
                  }}
                >
                  New
                </Button>
                {activeId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startSave(async () => { await deleteScenario(activeId, property.id); })}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <Field label="Scenario name" value={name} onChange={(e) => setName(e.target.value)} inputMode="text" />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Purchase price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="350,000" />
            <Field
              label="Down payment %"
              value={downPct}
              onChange={(e) => setDownPct(e.target.value)}
              placeholder="0"
              hint={downPctN > 0 ? money(downPayment) : "VA allows 0% down."}
            />
            <Field label="Interest rate %" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="6.25%" />
            <div className="grid gap-1.5">
              <Label htmlFor="fin-term">Term</Label>
              <select
                id="fin-term"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="30">30 years</option>
                <option value="15">15 years</option>
              </select>
            </div>
            <Field label="Property tax / yr" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="3,600" />
            <Field label="Insurance / yr" value={ins} onChange={(e) => setIns(e.target.value)} placeholder="1,200" />
            <Field label="HOA / mo" value={hoa} onChange={(e) => setHoa(e.target.value)} placeholder="0" />
          </div>

          <fieldset className="grid gap-3 pt-1">
            <legend className="mb-1 text-sm font-medium">VA benefit</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={firstUse} onChange={(e) => setFirstUse(e.target.checked)} className="size-4" />
              First use of the VA loan benefit
            </label>

            <div className="grid gap-1.5">
              <Label htmlFor="fin-rating">VA disability rating</Label>
              <select
                id="fin-rating"
                value={rating ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  setRating(v);
                  // Drives the exemption for the common case; the checkbox below
                  // stays independently settable for the cases a rating misses.
                  if (v !== null) setExempt(exemptFromRating(v));
                }}
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              >
                <option value="">Not sure / not rated</option>
                {DISABILITY_RATINGS.map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </select>
              {rating === 0 ? (
                <p className="text-muted-foreground text-xs">
                  A 0% rating is service-connected but not compensable, so it does not waive the
                  funding fee.
                </p>
              ) : null}
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={exempt}
                onChange={(e) => setExempt(e.target.checked)}
                className="mt-0.5 size-4"
              />
              <span>
                Receiving VA disability compensation (funding fee exempt)
                <span className="text-muted-foreground mt-0.5 flex items-start gap-1 text-xs">
                  <Info aria-hidden className="mt-0.5 size-3 shrink-0" />
                  This box, not the rating, is what waives the fee. {MIN_COMPENSABLE_RATING}% is the
                  lowest compensable rating, but Purple Heart recipients on active duty and certain
                  surviving spouses are exempt with no rating at all — tick it directly in those
                  cases. Eligibility is confirmed by your COE, not by this calculator.
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={financeFee}
                onChange={(e) => setFinanceFee(e.target.checked)}
                disabled={exempt}
                className="size-4"
              />
              Finance the funding fee into the loan
            </label>
          </fieldset>

          <div className="flex items-center gap-2">
            <Button onClick={onSave} disabled={pending}>
              {pending ? "Saving…" : activeId ? "Save scenario" : "Save as new scenario"}
            </Button>
            {saved ? <span className="text-muted-foreground text-xs">{saved}</span> : null}
          </div>
        </CardContent>
      </Card>

      {/* ---------- results ---------- */}
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Row label="Total monthly" value={money(loan.monthlyTotal, true)} strong />
            <Breakdown
              parts={[
                { label: "P&I", value: loan.monthlyPI, className: "fill-sky-500 bg-sky-500" },
                { label: "Tax", value: loan.monthlyTax, className: "fill-amber-500 bg-amber-500" },
                { label: "Insurance", value: loan.monthlyInsurance, className: "fill-emerald-500 bg-emerald-500" },
                { label: "HOA", value: loan.monthlyHoa, className: "fill-violet-500 bg-violet-500" },
              ]}
            />
            <p className="text-muted-foreground text-xs">
              No PMI — VA loans never carry mortgage insurance, even at 0% down.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Loan</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-border/60 divide-y">
              <Row label="Base loan (price − down)" value={money(loan.baseLoan)} />
              <Row
                label={`Funding fee${loan.fundingFeeRate ? ` (${pct(loan.fundingFeeRate)})` : ""}`}
                value={loan.fundingFeeAmount ? money(loan.fundingFeeAmount) : "Exempt"}
              />
              <Row
                label={financeFee ? "Loan amount (fee financed)" : "Loan amount"}
                value={money(loan.loanAmount)}
                strong
              />
              {loan.feeDueAtClosing > 0 ? (
                <Row label="Funding fee due at closing" value={money(loan.feeDueAtClosing)} />
              ) : null}
              <Row label={`Total interest over ${loan.months / 12} years`} value={money(loan.totalInterest)} />
            </dl>
            <p className="text-muted-foreground mt-3 text-xs">
              Funding fee table last verified {FEE_VERIFIED}. Rates are set by statute and change.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Amortization</CardTitle>
          </CardHeader>
          <CardContent>
            <AmortizationTable
              principal={loan.loanAmount}
              rate={num(rate, 0)}
              months={loan.months}
              filename={`homescout-${property.nickname.replace(/\W+/g, "-").toLowerCase()}-amortization.csv`}
            />
          </CardContent>
        </Card>
      </div>

      {/* ---------- residual income ---------- */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">VA residual income &amp; DTI</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowResidual((v) => !v)} aria-expanded={showResidual}>
              {showResidual ? "Hide" : "Check eligibility"}
            </Button>
          </div>
        </CardHeader>
        {showResidual ? (
          <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="fin-region">Region</Label>
                <select
                  id="fin-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value as Region)}
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {REGION_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>
              <Field label="Household size" value={household} onChange={(e) => setHousehold(e.target.value)} />
              <Field label="Gross monthly income" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="9,000" />
              <Field label="Other monthly debts" value={debts} onChange={(e) => setDebts(e.target.value)} placeholder="600" />
              <Field label="Monthly tax withholding" value={taxesWithheld} onChange={(e) => setTaxesWithheld(e.target.value)} placeholder="1,800" />
              <Field
                label="Maintenance + utilities"
                value={utilities}
                onChange={(e) => setUtilities(e.target.value)}
                hint="VA estimates $0.14 per sq ft per month."
              />
            </div>

            <div>
              <dl className="divide-border/60 divide-y">
                <Row label="Required residual" value={money(residual.required)} />
                <Row label="Your residual" value={money(residual.actual)} strong />
                <Row
                  label="Back-end DTI"
                  value={residual.dti ? pct(residual.dti, 1) : "—"}
                />
              </dl>

              {num(income) > 0 ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p
                    className={
                      residual.passes
                        ? "text-emerald-600 dark:text-emerald-500"
                        : "text-destructive font-medium"
                    }
                  >
                    {residual.passes
                      ? `Meets the residual income guideline by ${money(residual.surplus)}.`
                      : `Short of the residual income guideline by ${money(Math.abs(residual.surplus))}.`}
                  </p>
                  {residual.dtiExceedsGuideline ? (
                    <p className="text-amber-600 dark:text-amber-500">
                      DTI is above VA&rsquo;s {DTI_GUIDELINE}% guideline. Not automatically
                      disqualifying, but lenders look for compensating factors.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-muted-foreground mt-3 text-sm">
                  Enter your gross monthly income to check.
                </p>
              )}

              <p className="text-muted-foreground mt-3 text-xs">
                Guideline only. Your lender&rsquo;s underwriting governs.
              </p>
            </div>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
