import { describe, expect, it } from "vitest";
import { buildCompareRow, sortRows, type CompareRow } from "@/lib/compare";
import type { Property, Scenario } from "@/lib/db/schema";

const property = (over: Partial<Property> = {}): Property =>
  ({
    id: 1,
    nickname: "Test",
    street: "1 Main St",
    city: "Wenatchee",
    state: "WA",
    zip: "98801",
    lat: 47.4,
    lng: -120.3,
    fipsState: null,
    fipsCounty: null,
    fipsTract: null,
    listPrice: 350_000,
    propertyTaxAnnual: 3_600,
    insuranceAnnual: 1_200,
    hoaMonthly: 50,
    beds: 3,
    baths: 2,
    sqft: 1_850,
    notes: "",
    notesPrivate: false,
    status: "watching",
    createdAt: new Date(),
    ...over,
  }) as Property;

const scenario = (over: Partial<Scenario> = {}): Scenario =>
  ({
    id: 1,
    propertyId: 1,
    name: "Base case",
    downPaymentPct: 0,
    interestRate: 6.5,
    termYears: 30,
    fundingFeeFinanced: true,
    fundingFeeExempt: false,
    vaFirstUse: true,
    closingOverrides: "{}",
    createdAt: new Date(),
    ...over,
  }) as Scenario;

describe("buildCompareRow", () => {
  it("computes payment, cash to close and $/sqft from the property's own scenario", () => {
    const r = buildCompareRow(property(), scenario(), undefined);
    expect(r.pricePerSqft).toBeCloseTo(350_000 / 1_850, 2);
    expect(r.loanAmount).toBe(357_525); // 350k + 2.15% financed fee
    expect(r.monthlyPayment).toBeGreaterThan(0);
    expect(r.cashToClose).toBeGreaterThan(0);
    expect(r.scenarioName).toBe("Base case");
  });

  it("marks the scenario as assumed when the property has none of its own", () => {
    const r = buildCompareRow(property(), undefined, scenario({ name: "Shared" }));
    expect(r.scenarioName).toBe("Shared (assumed)");
    expect(r.monthlyPayment).toBeGreaterThan(0);
  });

  it("leaves money null rather than guessing when there is no scenario at all", () => {
    const r = buildCompareRow(property(), undefined, undefined);
    expect(r.monthlyPayment).toBeNull();
    expect(r.cashToClose).toBeNull();
    expect(r.scenarioName).toBeNull();
    // Non-financial facts are still populated.
    expect(r.pricePerSqft).toBeCloseTo(189.19, 1);
  });

  it("leaves money null when there is no price", () => {
    const r = buildCompareRow(property({ listPrice: 0 }), scenario(), undefined);
    expect(r.monthlyPayment).toBeNull();
    expect(r.pricePerSqft).toBeNull();
  });

  it("an exempt veteran borrows less and pays less than a non-exempt one", () => {
    const exempt = buildCompareRow(property(), scenario({ fundingFeeExempt: true }), undefined);
    const plain = buildCompareRow(property(), scenario({ fundingFeeExempt: false }), undefined);
    expect(exempt.loanAmount).toBe(350_000);
    expect(plain.loanAmount).toBe(357_525);
    expect(exempt.monthlyPayment!).toBeLessThan(plain.monthlyPayment!);
  });

  it("a down payment raises cash to close and lowers the payment", () => {
    const zero = buildCompareRow(property(), scenario({ downPaymentPct: 0 }), undefined);
    const down = buildCompareRow(property(), scenario({ downPaymentPct: 10 }), undefined);
    expect(down.monthlyPayment!).toBeLessThan(zero.monthlyPayment!);
    expect(down.cashToClose!).toBeGreaterThan(zero.cashToClose!);
  });
});

describe("missing carrying costs", () => {
  it("flags a property whose tax and insurance are blank", () => {
    // Otherwise this house shows a LOWER monthly than a fully-documented one
    // and reads as cheaper when it is only less filled in.
    const bare = buildCompareRow(
      property({ propertyTaxAnnual: 0, insuranceAnnual: 0 }),
      scenario(),
      undefined,
    );
    expect(bare.missingCosts).toEqual(["property tax", "insurance"]);
  });

  it("flags each one independently", () => {
    expect(
      buildCompareRow(property({ propertyTaxAnnual: 0 }), scenario(), undefined).missingCosts,
    ).toEqual(["property tax"]);
    expect(
      buildCompareRow(property({ insuranceAnnual: 0 }), scenario(), undefined).missingCosts,
    ).toEqual(["insurance"]);
  });

  it("says nothing when both are present", () => {
    expect(buildCompareRow(property(), scenario(), undefined).missingCosts).toEqual([]);
  });

  it("does not treat a zero HOA as missing — most houses have none", () => {
    expect(buildCompareRow(property({ hoaMonthly: 0 }), scenario(), undefined).missingCosts).toEqual(
      [],
    );
  });

  it("stays quiet when there is no payment to qualify", () => {
    expect(buildCompareRow(property(), undefined, undefined).missingCosts).toEqual([]);
  });

  it("the bare property really does show a lower monthly — the reason this matters", () => {
    const full = buildCompareRow(property(), scenario(), undefined);
    const bare = buildCompareRow(
      property({ listPrice: 400_000, propertyTaxAnnual: 0, insuranceAnnual: 0, hoaMonthly: 0 }),
      scenario(),
      undefined,
    );
    expect(bare.listPrice!).toBeGreaterThan(full.listPrice!);
    expect(bare.monthlyPayment!).toBeLessThan(full.monthlyPayment!);
    expect(bare.missingCosts.length).toBeGreaterThan(0);
  });
});

describe("sortRows", () => {
  const rows = [
    { nickname: "B", listPrice: 300_000, monthlyPayment: 2_000 },
    { nickname: "A", listPrice: 500_000, monthlyPayment: null },
    { nickname: "C", listPrice: null, monthlyPayment: 1_000 },
  ] as CompareRow[];

  it("sorts numerically ascending and descending", () => {
    expect(sortRows(rows, "listPrice", "asc").map((r) => r.nickname)).toEqual(["B", "A", "C"]);
    expect(sortRows(rows, "listPrice", "desc").map((r) => r.nickname)).toEqual(["A", "B", "C"]);
  });

  it("keeps missing values last in BOTH directions", () => {
    // A property with no price must not win "cheapest" by having no price.
    expect(sortRows(rows, "listPrice", "asc").at(-1)!.nickname).toBe("C");
    expect(sortRows(rows, "listPrice", "desc").at(-1)!.nickname).toBe("C");
    expect(sortRows(rows, "monthlyPayment", "asc").at(-1)!.nickname).toBe("A");
    expect(sortRows(rows, "monthlyPayment", "desc").at(-1)!.nickname).toBe("A");
  });

  it("sorts text case-insensitively by locale", () => {
    expect(sortRows(rows, "nickname", "asc").map((r) => r.nickname)).toEqual(["A", "B", "C"]);
  });

  it("does not mutate the input", () => {
    const before = rows.map((r) => r.nickname);
    sortRows(rows, "listPrice", "desc");
    expect(rows.map((r) => r.nickname)).toEqual(before);
  });
});
