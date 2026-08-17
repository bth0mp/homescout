"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Link2 } from "lucide-react";
import { lookupListing, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROPERTY_STATUS, type PropertyRow } from "@/lib/db/schema";
import { money, parseNumber } from "@/lib/parse";
import {
  HIGH_INSURANCE_STATES,
  INSURANCE_RATE_PCT,
  STATE_CODES,
  STATE_NAMES,
  estimateAnnualInsurance,
  estimateAnnualTax,
  taxRateForState,
} from "@/lib/property-tax";

function Field({
  name,
  label,
  hint,
  ...rest
}: React.ComponentProps<typeof Input> & { label: string; name: string; hint?: string }) {
  const id = `f-${name}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} {...rest} />
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function PropertyForm({
  action,
  property,
  submitLabel = "Save",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  property?: PropertyRow;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const p = property;

  const formRef = useRef<HTMLFormElement>(null);
  const [stateCode, setStateCode] = useState(p?.state?.toUpperCase() ?? "");
  const [price, setPrice] = useState(String(p?.listPrice || ""));
  const [, setTaxTouched] = useState(Boolean(p?.propertyTaxAnnual));
  const taxRate = taxRateForState(stateCode);
  const taxEstimate = estimateAnnualTax(parseNumber(price) ?? 0, stateCode);
  const insEstimate = estimateAnnualInsurance(parseNumber(price) ?? 0);
  const [linkPending, startLink] = useTransition();
  const [linkNote, setLinkNote] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(
    null,
  );

  function fillFromLink(url: string) {
    if (!url.trim()) return;
    startLink(async () => {
      const res = await lookupListing(url);
      if (!res.ok) {
        setLinkNote({ tone: "err", text: res.error });
        return;
      }
      const form = formRef.current;
      if (!form) return;
      // Inputs are uncontrolled, so writing .value is enough for FormData.
      const set = (name: string, value: string) => {
        const el = form.elements.namedItem(name);
        if (el instanceof HTMLInputElement && value) el.value = value;
      };
      set("street", res.street);
      set("city", res.city);
      set("zip", res.zip);
      // The state <select> is controlled, so drive it through state rather than
      // writing .value — otherwise the tax estimate below would not update.
      if (res.state) setStateCode(res.state.toUpperCase());
      const nick = form.elements.namedItem("nickname");
      if (nick instanceof HTMLInputElement && !nick.value) nick.value = res.street;

      setLinkNote(
        res.geocoded
          ? { tone: "ok", text: `Filled from ${res.provider} and confirmed by the geocoder.` }
          : {
              tone: "warn",
              text: `Read the address from ${res.provider}, but the geocoder did not match it. Check the fields below.`,
            },
      );
    });
  }

  return (
    <form ref={formRef} action={formAction} className="grid gap-5">
      <div className="border-border bg-muted/30 grid gap-2 rounded-lg border p-3">
        <Label htmlFor="f-listing-url" className="flex items-center gap-1.5">
          <Link2 aria-hidden className="size-3.5" />
          Paste a listing link
        </Label>
        <div className="flex gap-2">
          <Input
            id="f-listing-url"
            type="url"
            inputMode="url"
            placeholder="https://www.redfin.com/WA/Wenatchee/908-N-Elliott-Ave-98801/home/75131851"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Don't submit the whole property form on Enter here.
                e.preventDefault();
                fillFromLink(e.currentTarget.value);
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (text) setTimeout(() => fillFromLink(text), 0);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={linkPending}
            onClick={() => {
              const el = document.getElementById("f-listing-url");
              if (el instanceof HTMLInputElement) fillFromLink(el.value);
            }}
          >
            {linkPending ? "Reading…" : "Fill"}
          </Button>
        </div>
        <p
          role="status"
          aria-live="polite"
          className={
            linkNote?.tone === "err"
              ? "text-destructive text-xs"
              : linkNote?.tone === "warn"
                ? "text-xs text-amber-600 dark:text-amber-500"
                : "text-muted-foreground text-xs"
          }
        >
          {linkNote?.text ??
            "Redfin, Zillow, Realtor.com, Trulia or Homes.com. The address is read from the link itself — the listing page is never fetched."}
        </p>
      </div>

      {state?.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <Field
        name="nickname"
        label="Nickname"
        required
        defaultValue={p?.nickname}
        placeholder="The one with the big garage"
      />

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-sm font-medium">Address</legend>
        <Field name="street" label="Street" defaultValue={p?.street} placeholder="123 Main St" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="city" label="City" defaultValue={p?.city} />
          <div className="grid gap-1.5">
            <Label htmlFor="f-state">State</Label>
            <select
              id="f-state"
              name="state"
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            >
              <option value="">Select…</option>
              {STATE_CODES.map((c) => (
                <option key={c} value={c}>
                  {c} — {STATE_NAMES[c]}
                </option>
              ))}
            </select>
          </div>
          <Field name="zip" label="ZIP" defaultValue={p?.zip} inputMode="numeric" />
        </div>
        <p className="text-muted-foreground text-xs">
          Geocoded on save via the U.S. Census Geocoder, falling back to Nominatim. Results are
          cached, so re-saving costs nothing.
        </p>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-sm font-medium">Money</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="f-listPrice">List price</Label>
            <Input
              id="f-listPrice"
              name="listPrice"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="350,000"
            />
            <p className="text-muted-foreground text-xs">Commas and $ are fine.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-propertyTaxAnnual">Property tax (annual)</Label>
            <Input
              id="f-propertyTaxAnnual"
              name="propertyTaxAnnual"
              inputMode="decimal"
              defaultValue={p?.propertyTaxAnnual || ""}
              placeholder={taxEstimate ? String(taxEstimate) : "3,200"}
              onChange={(e) => setTaxTouched(e.target.value !== "")}
            />
            {taxEstimate ? (
              <p className="text-muted-foreground text-xs">
                {stateCode} averages {taxRate}% of value — about{" "}
                <button
                  type="button"
                  className="text-foreground underline underline-offset-2"
                  onClick={() => {
                    const el = document.getElementById("f-propertyTaxAnnual");
                    if (el instanceof HTMLInputElement) {
                      el.value = String(taxEstimate);
                      setTaxTouched(true);
                    }
                  }}
                >
                  {money(taxEstimate)}/yr
                </button>
                . Statewide median only — counties vary 2-3x, so use the listing
                or assessor figure when you have it.
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-insuranceAnnual">Homeowners insurance (annual)</Label>
            <Input
              id="f-insuranceAnnual"
              name="insuranceAnnual"
              inputMode="decimal"
              defaultValue={p?.insuranceAnnual || ""}
              placeholder={insEstimate ? String(insEstimate) : "1,400"}
            />
            {insEstimate ? (
              <p className="text-muted-foreground text-xs">
                Rough estimate{" "}
                <button
                  type="button"
                  className="text-foreground underline underline-offset-2"
                  onClick={() => {
                    const el = document.getElementById("f-insuranceAnnual");
                    if (el instanceof HTMLInputElement) el.value = String(insEstimate);
                  }}
                >
                  {money(insEstimate)}/yr
                </button>{" "}
                ({INSURANCE_RATE_PCT}% of price).{" "}
                {HIGH_INSURANCE_STATES.has(stateCode)
                  ? `${stateCode} is a high-premium state — expect well above this, and get a real quote.`
                  : "Real premiums depend on roof age, claims and wind exposure, not price."}
              </p>
            ) : null}
          </div>
          <Field
            name="hoaMonthly"
            label="HOA (monthly)"
            inputMode="decimal"
            defaultValue={p?.hoaMonthly || ""}
            placeholder="0"
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-sm font-medium">Details</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="beds" label="Beds" inputMode="decimal" defaultValue={p?.beds ?? ""} />
          <Field name="baths" label="Baths" inputMode="decimal" defaultValue={p?.baths ?? ""} />
          <Field name="sqft" label="Sq ft" inputMode="numeric" defaultValue={p?.sqft ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="f-status">Status</Label>
          <select
            id="f-status"
            name="status"
            defaultValue={p?.status ?? "watching"}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            {PROPERTY_STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor="f-notes">Notes</Label>
        <textarea
          id="f-notes"
          name="notes"
          rows={4}
          defaultValue={p?.notes}
          className="border-input bg-background ring-offset-background focus-visible:ring-ring min-h-20 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
        />
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="notesPrivate"
            defaultChecked={p?.notesPrivate ?? false}
            className="size-4 rounded border"
          />
          Keep notes private (hidden from share links)
        </label>
      </div>

      <div className="flex gap-2">
        <Submit label={submitLabel} />
      </div>
    </form>
  );
}
