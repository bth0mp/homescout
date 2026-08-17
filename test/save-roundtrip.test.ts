import { describe, expect, it } from "vitest";
import { propertyFromForm } from "@/lib/zod";

/**
 * The property form posts FormData. These assert that what a person types
 * survives parsing — the half of the save path that is testable without a
 * database.
 *
 * The other half broke in production: the Financing tab's price, tax, insurance
 * and HOA were sent to saveScenario, which had no schema fields for them, so zod
 * stripped them and the action reported success. The fix writes them through to
 * the property; the guard against a repeat is that those fields are now declared
 * in the scenario schema, so dropping one is a type error rather than silence.
 */
function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe("propertyFromForm", () => {
  const base = { nickname: "15 Martin Pl", street: "15 Martin Pl", city: "Wenatchee", state: "WA", zip: "98801" };

  it("keeps a typed price", () => {
    const r = propertyFromForm(form({ ...base, listPrice: "395,000" }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.listPrice).toBe(395_000);
  });

  it("keeps every money field", () => {
    const r = propertyFromForm(
      form({
        ...base,
        listPrice: "$395,000",
        propertyTaxAnnual: "4,740",
        insuranceAnnual: "1,380",
        hoaMonthly: "50",
      }),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.listPrice).toBe(395_000);
      expect(r.data.propertyTaxAnnual).toBe(4_740);
      expect(r.data.insuranceAnnual).toBe(1_380);
      expect(r.data.hoaMonthly).toBe(50);
    }
  });

  it("treats a blank money field as zero rather than failing the save", () => {
    const r = propertyFromForm(form({ ...base, listPrice: "" }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.listPrice).toBe(0);
  });

  it("accepts every status including pending", () => {
    for (const status of ["watching", "touring", "offer", "pending", "dead"]) {
      const r = propertyFromForm(form({ ...base, status }));
      expect(r.success, status).toBe(true);
      if (r.success) expect(r.data.status).toBe(status);
    }
  });

  it("rejects a status that is not in the list", () => {
    expect(propertyFromForm(form({ ...base, status: "sold-ish" })).success).toBe(false);
  });

  it("requires a nickname, since it is the only human label", () => {
    expect(propertyFromForm(form({ ...base, nickname: "" })).success).toBe(false);
  });

  it("carries the private-notes flag through", () => {
    const on = propertyFromForm(form({ ...base, notes: "secret", notesPrivate: "on" }));
    expect(on.success && on.data.notesPrivate).toBe(true);
    const off = propertyFromForm(form({ ...base, notes: "public" }));
    expect(off.success && off.data.notesPrivate).toBe(false);
  });
});
