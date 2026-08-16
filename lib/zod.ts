import { z } from "zod";
import { PROPERTY_STATUS } from "@/lib/db/schema";
import { parseNumber } from "@/lib/parse";

/** Accepts "350,000", "$350,000", "6.25%" or a number. Blank -> undefined. */
const loose = z
  .union([z.string(), z.number(), z.undefined(), z.null()])
  .transform((v) => parseNumber(v ?? "") ?? undefined);

const money = loose.pipe(z.number().min(0).max(1_000_000_000).optional());
const moneyOr0 = money.transform((v) => v ?? 0);

export const propertyInput = z.object({
  nickname: z.string().trim().min(1, "Give it a name you'll recognize").max(120),
  street: z.string().trim().max(200).default(""),
  city: z.string().trim().max(120).default(""),
  state: z.string().trim().max(60).default(""),
  zip: z.string().trim().max(12).default(""),
  listPrice: moneyOr0,
  propertyTaxAnnual: moneyOr0,
  insuranceAnnual: moneyOr0,
  hoaMonthly: moneyOr0,
  beds: loose.pipe(z.number().min(0).max(100).optional()),
  baths: loose.pipe(z.number().min(0).max(100).optional()),
  sqft: loose.pipe(z.number().int().min(0).max(1_000_000).optional()),
  notes: z.string().max(20_000).default(""),
  notesPrivate: z.coerce.boolean().default(false),
  status: z.enum(PROPERTY_STATUS).default("watching"),
});

export type PropertyInput = z.infer<typeof propertyInput>;

/** FormData arrives as strings; checkboxes are absent when unchecked. */
export function propertyFromForm(fd: FormData) {
  return propertyInput.safeParse({
    nickname: fd.get("nickname") ?? "",
    street: fd.get("street") ?? "",
    city: fd.get("city") ?? "",
    state: fd.get("state") ?? "",
    zip: fd.get("zip") ?? "",
    listPrice: fd.get("listPrice"),
    propertyTaxAnnual: fd.get("propertyTaxAnnual"),
    insuranceAnnual: fd.get("insuranceAnnual"),
    hoaMonthly: fd.get("hoaMonthly"),
    beds: fd.get("beds"),
    baths: fd.get("baths"),
    sqft: fd.get("sqft"),
    notes: fd.get("notes") ?? "",
    notesPrivate: fd.get("notesPrivate") === "on",
    status: fd.get("status") ?? "watching",
  });
}
