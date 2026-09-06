import { describe, it, expect } from "vitest";
import { offListPct } from "../src/sales-domain.js";

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
