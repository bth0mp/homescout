"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROPERTY_STATUS, type Property } from "@/lib/db/schema";

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
  property?: Property;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const p = property;

  return (
    <form action={formAction} className="grid gap-5">
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
          <Field name="state" label="State" defaultValue={p?.state} placeholder="VA" />
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
          <Field
            name="listPrice"
            label="List price"
            inputMode="decimal"
            defaultValue={p?.listPrice || ""}
            placeholder="350,000"
            hint="Commas and $ are fine."
          />
          <Field
            name="propertyTaxAnnual"
            label="Property tax (annual)"
            inputMode="decimal"
            defaultValue={p?.propertyTaxAnnual || ""}
            placeholder="3,200"
          />
          <Field
            name="insuranceAnnual"
            label="Homeowners insurance (annual)"
            inputMode="decimal"
            defaultValue={p?.insuranceAnnual || ""}
            placeholder="1,400"
          />
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
