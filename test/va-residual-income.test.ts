import { describe, expect, it } from "vitest";
import {
  DTI_GUIDELINE,
  estimateUtilities,
  regionForState,
  requiredResidualIncome,
  residualIncome,
} from "@/lib/va/residual-income";

describe("regionForState", () => {
  it("maps states to VA regions", () => {
    expect(regionForState("WA")).toBe("west");
    expect(regionForState("TX")).toBe("south");
    expect(regionForState("OH")).toBe("midwest");
    expect(regionForState("NY")).toBe("northeast");
    expect(regionForState("VA")).toBe("south");
    expect(regionForState("DC")).toBe("south");
  });

  it("is case and whitespace tolerant", () => {
    expect(regionForState(" wa ")).toBe("west");
    expect(regionForState("Tx")).toBe("south");
  });

  it("returns null for anything it does not know", () => {
    expect(regionForState("XX")).toBeNull();
    expect(regionForState("")).toBeNull();
    expect(regionForState("Washington")).toBeNull();
  });
});

describe("requiredResidualIncome", () => {
  it("matches the published table for loans of $80,000 and above", () => {
    expect(requiredResidualIncome("west", 1, 350_000)).toBe(491);
    expect(requiredResidualIncome("west", 4, 350_000)).toBe(1117);
    expect(requiredResidualIncome("northeast", 2, 350_000)).toBe(755);
    expect(requiredResidualIncome("midwest", 3, 350_000)).toBe(889);
    expect(requiredResidualIncome("south", 5, 350_000)).toBe(1039);
  });

  it("matches the published table for loans under $80,000", () => {
    expect(requiredResidualIncome("west", 1, 79_999)).toBe(425);
    expect(requiredResidualIncome("northeast", 4, 50_000)).toBe(888);
    expect(requiredResidualIncome("south", 5, 79_999)).toBe(902);
  });

  it("switches tables at exactly $80,000", () => {
    expect(requiredResidualIncome("west", 2, 79_999.99)).toBe(713);
    expect(requiredResidualIncome("west", 2, 80_000)).toBe(823);
  });

  it("adds per extra member above 5, at the right rate per table", () => {
    // $80k+: +$80 each
    expect(requiredResidualIncome("west", 6, 350_000)).toBe(1158 + 80);
    expect(requiredResidualIncome("west", 7, 350_000)).toBe(1158 + 160);
    // under $80k: +$75 each
    expect(requiredResidualIncome("west", 6, 50_000)).toBe(1004 + 75);
  });

  it("caps the additions at a family of seven", () => {
    const seven = requiredResidualIncome("west", 7, 350_000);
    expect(requiredResidualIncome("west", 8, 350_000)).toBe(seven);
    expect(requiredResidualIncome("west", 12, 350_000)).toBe(seven);
  });

  it("treats a missing or absurd family size as one person", () => {
    expect(requiredResidualIncome("west", 0, 350_000)).toBe(491);
    expect(requiredResidualIncome("west", -3, 350_000)).toBe(491);
  });
});

describe("estimateUtilities", () => {
  it("uses the VA's $0.14 per square foot per month", () => {
    expect(estimateUtilities(1_850)).toBe(259);
    expect(estimateUtilities(0)).toBe(0);
    expect(estimateUtilities(-500)).toBe(0);
  });
});

describe("residualIncome", () => {
  const base = {
    region: "west" as const,
    familySize: 4,
    loanAmount: 357_525,
    grossMonthlyIncome: 9_000,
    monthlyHousing: 2_700,
    monthlyDebts: 600,
    monthlyTaxes: 1_800,
    monthlyUtilities: 259,
  };

  it("passes a comfortable household and reports the surplus", () => {
    const r = residualIncome(base);
    expect(r.required).toBe(1117);
    // 9000 - 2700 - 600 - 1800 - 259 = 3641
    expect(r.actual).toBe(3641);
    expect(r.passes).toBe(true);
    expect(r.surplus).toBe(3641 - 1117);
  });

  it("flags a household that falls short", () => {
    const r = residualIncome({ ...base, grossMonthlyIncome: 5_400 });
    expect(r.actual).toBe(41);
    expect(r.passes).toBe(false);
    expect(r.surplus).toBeLessThan(0);
  });

  it("passes exactly at the threshold", () => {
    // Tune income so residual lands exactly on the requirement.
    const income = 1117 + 2_700 + 600 + 1_800 + 259;
    const r = residualIncome({ ...base, grossMonthlyIncome: income });
    expect(r.actual).toBe(1117);
    expect(r.passes).toBe(true);
    expect(r.surplus).toBe(0);
  });

  it("computes back-end DTI from housing plus debts", () => {
    const r = residualIncome(base);
    // (2700 + 600) / 9000 = 36.67%
    expect(r.dti).toBeCloseTo(36.67, 2);
    expect(r.dtiExceedsGuideline).toBe(false);
    expect(r.dtiThreshold).toBe(DTI_GUIDELINE);
  });

  it("flags DTI above the 41% guideline", () => {
    const r = residualIncome({ ...base, grossMonthlyIncome: 7_000 });
    // (2700 + 600) / 7000 = 47.14%
    expect(r.dti).toBeCloseTo(47.14, 2);
    expect(r.dtiExceedsGuideline).toBe(true);
  });

  it("does not divide by zero on missing income", () => {
    const r = residualIncome({ ...base, grossMonthlyIncome: 0 });
    expect(r.dti).toBe(0);
    expect(Number.isFinite(r.actual)).toBe(true);
    expect(r.passes).toBe(false);
  });

  it("residual and DTI are independent checks — one can pass while the other fails", () => {
    // High income, high debts: comfortable residual but DTI over guideline.
    const r = residualIncome({
      ...base,
      grossMonthlyIncome: 12_000,
      monthlyDebts: 2_500,
      monthlyTaxes: 2_000,
    });
    expect(r.passes).toBe(true);
    expect(r.dtiExceedsGuideline).toBe(true);
  });
});
