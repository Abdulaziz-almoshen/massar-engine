import { describe, it, expect } from "vitest";
import { offListPct, offListRollup } from "../src/sales-domain.js";

// «كم تحت السعر المعلن بيعت» — a NEW question, deliberately not a redefinition of «قيمة الفرصة».
// The value formula is untouched by packages: 37 live deals are computed from it and it was
// correct before a reference price existed.

describe("offListPct", () => {
  it("is null when the product publishes no price, which is FIVE of the six", () => {
    // agent.ts says «يحدده المختص» for فحص الموظفين، التقارير الطبية، خدمات التطعيمات،
    // الشهادات الصحية and تكامل الأنظمة. No published price is not a zero discount, and a screen
    // that renders ٠٪ there is claiming something nobody said.
    expect(offListPct(100000, null, 1, null)).toBeNull();
    expect(offListPct(100000, null, 1, 2)).toBeNull();
    expect(offListPct(100000, 50000, 1, null)).toBeNull();
  });

  it("measures against the QUOTED reference, scaled by quantity and years", () => {
    // 5 branches on الباقة القياسية at 18,000/yr for 1 year = 90,000 asked.
    // Sold for 72,000 -> 20% under list.
    expect(offListPct(72000, 18000, 5, 1)).toBeCloseTo(20, 6);
  });

  it("returns zero when a deal lands exactly on list, and that is different from null", () => {
    expect(offListPct(18000, 18000, 1, 1)).toBe(0);
    expect(offListPct(18000, null, 1, 1)).toBeNull();
  });

  it("goes negative when a deal is sold ABOVE list rather than clamping", () => {
    // Clamping would hide the one case a product manager most wants to see.
    expect(offListPct(22500, 18000, 1, 1)).toBeCloseTo(-25, 6);
  });

  it("handles the real published pair without either package contaminating the other", () => {
    // The two prices that disproved the price-on-product model: same product, both annual,
    // separated by branch count.
    expect(offListPct(18000, 18000, 1, 1)).toBe(0);
    expect(offListPct(95000, 95000, 1, 1)).toBe(0);
    // Measuring an enterprise deal against the one-branch price is exactly the failure the
    // package-level price exists to prevent: it would read as 428% over list.
    expect(offListPct(95000, 18000, 1, 1)).toBeLessThan(-400);
  });

  it("is null rather than Infinity when the reference works out to zero", () => {
    expect(offListPct(1000, 0, 1, 1)).toBeNull();
    expect(offListPct(1000, 18000, 0, 1)).not.toBeNull(); // qty 0 falls back to 1, not a divide by zero
  });
});

// ---------------------------------------------------------------------------
// The rollup every screen reads. Added when packages were finally linked to deals (2026-09-17):
// before that, offListPct had no production caller and could never return a number.

describe("offListRollup", () => {
  const line = (value: number, list: number | null, qty = 1, years = 1) =>
    ({ value, quotedListPrice: list, qty, years });

  it("weights by money, not by line: the big deal's small discount is not averaged away", () => {
    // 40٪ off a 5,000 reference and 2٪ off a 500,000 one. A mean of percentages says 21٪;
    // the money says 2.38٪, which is what was actually given away.
    const r = offListRollup([line(3000, 5000), line(490000, 500000)]);
    expect(r.referenceTotal).toBe(505000);
    expect(r.valueTotal).toBe(493000);
    expect(r.savedTotal).toBe(12000);
    expect(r.pct).toBeCloseTo(2.376, 2);
  });

  it("excludes lines with no published price rather than counting them as zero", () => {
    const r = offListRollup([line(72000, 18000, 5, 1), line(40000, null), line(9000, null)]);
    expect(r.lines).toBe(3);
    expect(r.withReference).toBe(1);
    expect(r.pct).toBeCloseTo(20, 6);
  });

  it("is null, not zero, when nothing in the book carries a reference", () => {
    const r = offListRollup([line(40000, null), line(9000, null)]);
    expect(r.pct).toBeNull();
    expect(r.withReference).toBe(0);
    expect(r.savedTotal).toBe(0);
  });

  it("is null on an empty book", () => {
    expect(offListRollup([]).pct).toBeNull();
  });

  it("goes negative when the book sold above list, and does not clamp", () => {
    expect(offListRollup([line(22500, 18000)]).pct!).toBeCloseTo(-25, 6);
  });

  it("uses each line's OWN term, so a multi-year deal is compared against the same term", () => {
    // 18,000/yr list, 3 years, 1 branch: 54,000 asked. Sold at 48,600 -> 10٪ under.
    expect(offListRollup([line(48600, 18000, 1, 3)]).pct!).toBeCloseTo(10, 6);
  });

  it("ignores a reference of zero rather than dividing by it", () => {
    const r = offListRollup([line(1000, 0), line(72000, 18000, 5, 1)]);
    expect(r.withReference).toBe(1);
    expect(r.pct).toBeCloseTo(20, 6);
  });
});
