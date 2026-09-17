import { describe, it, expect } from "vitest";
import {
  parseISODate, toISODate, formatArabicDate, isWithinISO, isDayAllowed, monthGrid,
  shiftMonth, shiftISODay, yearRange, pickRange, DATE_FIELD_DOMAIN_JS,
} from "../src/date-field-domain.js";

describe("parse and format", () => {
  it("reads an ISO day as a LOCAL day, so it cannot slide backwards in Riyadh", () => {
    const d = parseISODate("2026-09-17")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 17]);
    expect(toISODate(d)).toBe("2026-09-17");
  });
  it("refuses a well-formed but impossible day", () => {
    expect(parseISODate("2026-02-31")).toBeNull();
    expect(parseISODate("2026-13-01")).toBeNull();
    expect(parseISODate("17/09/2026")).toBeNull();
    expect(parseISODate("")).toBeNull();
  });
  it("prints the Arabic month with western numerals", () => {
    expect(formatArabicDate("2026-09-17")).toBe("17 سبتمبر 2026");
    expect(formatArabicDate("nonsense")).toBe("");
  });
});

describe("bounds", () => {
  it("honours min and max", () => {
    expect(isDayAllowed("2026-09-17", "2026-09-01", "2026-09-30")).toBe(true);
    expect(isDayAllowed("2026-08-31", "2026-09-01", null)).toBe(false);
    expect(isDayAllowed("2026-10-01", null, "2026-09-30")).toBe(false);
    expect(isDayAllowed("2026-10-01", null, null)).toBe(true);
  });
  it("a range contains its ends; a half-open one contains only its start", () => {
    expect(isWithinISO("2026-09-17", "2026-09-01", "2026-09-30")).toBe(true);
    expect(isWithinISO("2026-09-01", "2026-09-01", "2026-09-30")).toBe(true);
    expect(isWithinISO("2026-09-30", "2026-09-01", "2026-09-30")).toBe(true);
    expect(isWithinISO("2026-10-01", "2026-09-01", "2026-09-30")).toBe(false);
    expect(isWithinISO("2026-09-02", "2026-09-01", "")).toBe(false);
    expect(isWithinISO("2026-09-01", "2026-09-01", "")).toBe(true);
  });
});

describe("monthGrid", () => {
  it("is always 42 cells, so the calendar never changes height", () => {
    for (const [y, m] of [[2026, 8], [2026, 1], [2024, 1], [2026, 10]] as [number, number][]) {
      expect(monthGrid(y, m)).toHaveLength(42);
    }
  });
  it("starts on the Sunday at or before the 1st and marks the neighbours", () => {
    const g = monthGrid(2026, 8);                      // September 2026: the 1st is a Tuesday
    expect(parseISODate(g[0].iso)!.getDay()).toBe(0);
    expect(g[0].inMonth).toBe(false);
    const firsts = g.filter((c) => c.inMonth && c.day === 1);
    expect(firsts).toHaveLength(1);
    expect(g.filter((c) => c.inMonth)).toHaveLength(30);
  });
  it("handles a leap February", () => {
    expect(monthGrid(2024, 1).filter((c) => c.inMonth)).toHaveLength(29);
    expect(monthGrid(2026, 1).filter((c) => c.inMonth)).toHaveLength(28);
  });
});

describe("stepping", () => {
  it("shifts months across a year boundary", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 8, 12)).toEqual({ year: 2027, month: 8 });
  });
  it("shifts days across a month and a year boundary", () => {
    expect(shiftISODay("2026-09-30", 1)).toBe("2026-10-01");
    expect(shiftISODay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftISODay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftISODay("", 1)).toBe("");
  });
  it("offers the bounds' years, and a window around the anchor without bounds", () => {
    expect(yearRange(2026, "2020-01-01", "2026-12-31")).toEqual([2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    expect(yearRange(2026)).toHaveLength(11);
    // an anchor outside the bounds is still reachable, or the picker could not show its own value
    expect(yearRange(2019, "2020-01-01", "2021-12-31")).toContain(2019);
  });
});

describe("pickRange", () => {
  it("first click starts, second closes", () => {
    expect(pickRange("", "", "2026-09-10")).toEqual({ from: "2026-09-10", to: "" });
    expect(pickRange("2026-09-10", "", "2026-09-17")).toEqual({ from: "2026-09-10", to: "2026-09-17" });
  });
  it("a second click before the first swaps the ends rather than refusing", () => {
    expect(pickRange("2026-09-17", "", "2026-09-10")).toEqual({ from: "2026-09-10", to: "2026-09-17" });
  });
  it("clicking again with a complete range starts a new one", () => {
    expect(pickRange("2026-09-10", "2026-09-17", "2026-09-20")).toEqual({ from: "2026-09-20", to: "" });
  });
});

describe("the browser bundle", () => {
  it("ships every function and each one resolves only against the bundle", () => {
    // eslint-disable-next-line no-new-func
    const run = new Function(DATE_FIELD_DOMAIN_JS + "; return { formatArabicDate, monthGrid, pickRange, shiftISODay };");
    const f = run();
    expect(f.formatArabicDate("2026-09-17")).toBe("17 سبتمبر 2026");
    expect(f.monthGrid(2026, 8)).toHaveLength(42);
    expect(f.pickRange("2026-09-17", "", "2026-09-10")).toEqual({ from: "2026-09-10", to: "2026-09-17" });
    expect(f.shiftISODay("2026-09-30", 1)).toBe("2026-10-01");
  });
});
