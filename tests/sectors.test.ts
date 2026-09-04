import { describe, it, expect } from "vitest";
import { rollupBySector, UNCLASSIFIED_SECTOR, SECTORS, PRODUCT_SECTOR } from "../src/sales-domain.js";

const row = (product: string, sector: string | null, o: Partial<{
  target: number; achieved: number; weightedOpen: number; openCount: number; wonCount: number }> = {}) => ({
  product, sector,
  target: o.target ?? 0, achieved: o.achieved ?? 0, weightedOpen: o.weightedOpen ?? 0,
  openCount: o.openCount ?? 0, wonCount: o.wonCount ?? 0,
});

describe("rollupBySector", () => {
  it("sums each sector and keeps the declared sector order", () => {
    const out = rollupBySector([
      row("فحص الموظفين", "قطاع الأعمال", { target: 100, achieved: 40 }),
      row("الإجازات المرضية", "قطاع المستشفيات", { target: 300, achieved: 150 }),
      row("التقارير الطبية", "قطاع المستشفيات", { target: 200, achieved: 50 }),
    ]);
    expect(out.map((s) => s.sector)).toEqual(["قطاع المستشفيات", "قطاع الأعمال"]);
    expect(out[0].target).toBe(500);
    expect(out[0].achieved).toBe(200);
    expect(out[0].products).toHaveLength(2);
  });

  // The defect this whole function exists to prevent: a product with no sector must not fall out
  // of the totals. Production carries two such products today.
  it("puts unmapped products in an explicit bucket instead of dropping them", () => {
    const rows = [
      row("الإجازات المرضية", "قطاع المستشفيات", { achieved: 100, openCount: 1 }),
      row("سجل التطعيمات الوطني", null, { achieved: 70, openCount: 2 }),
      row("صحة أعمال Plus", null, { achieved: 30, openCount: 3 }),
    ];
    const out = rollupBySector(rows);
    const summed = out.reduce((n, s) => n + s.achieved, 0);
    const original = rows.reduce((n, r) => n + r.achieved, 0);
    expect(summed).toBe(original);            // nothing lost
    expect(summed).toBe(200);
    const un = out.find((s) => s.isUnclassified)!;
    expect(un.sector).toBe(UNCLASSIFIED_SECTOR);
    expect(un.products).toEqual(["سجل التطعيمات الوطني", "صحة أعمال Plus"]);
    expect(un.openCount).toBe(5);
  });

  it("sorts the unclassified bucket last, never into the middle", () => {
    const out = rollupBySector([
      row("مجهول", null),
      row("فحص الموظفين", "قطاع الأعمال"),
      row("الإجازات المرضية", "قطاع المستشفيات"),
    ]);
    expect(out[out.length - 1].isUnclassified).toBe(true);
  });

  // null coverage and 0% coverage mean different things: no target set vs. a target being missed.
  it("returns null coverage for a sector with no target, not zero", () => {
    const out = rollupBySector([row("الإجازات المرضية", "قطاع المستشفيات", { achieved: 500 })]);
    expect(out[0].coveragePct).toBeNull();
  });

  it("computes coverage from achieved plus weighted open", () => {
    const out = rollupBySector([
      row("الإجازات المرضية", "قطاع المستشفيات", { target: 1000, achieved: 400, weightedOpen: 300 }),
    ]);
    expect(out[0].coveragePct).toBe(70);
  });

  it("returns nothing for no rows rather than empty sectors", () => {
    expect(rollupBySector([])).toEqual([]);
  });
});

describe("the seeded sector map", () => {
  it("assigns every catalogue product to a declared sector", () => {
    for (const [product, sector] of PRODUCT_SECTOR) {
      expect(SECTORS, `${product} points at an undeclared sector`).toContain(sector);
    }
  });

  it("flags exactly the two products whose bestFor contradicts the placement", () => {
    const assumed = PRODUCT_SECTOR.filter(([, , a]) => a).map(([p]) => p);
    expect(assumed).toEqual(["خدمات التطعيمات", "فحص الموظفين"]);
  });

  // «الإجازات المرضية» is the only product with published packages, so it is the only one whose
  // price is not a note. offListPct depends on this being true.
  it("gives a pricing note to every product except the one with real packages", () => {
    const noNote = PRODUCT_SECTOR.filter(([, , , n]) => n === null).map(([p]) => p);
    expect(noNote).toEqual(["الإجازات المرضية"]);
  });

  it("does not seed the analyst catch-all as a product", () => {
    expect(PRODUCT_SECTOR.map(([p]) => p)).not.toContain("خدمة أخرى");
  });
});
