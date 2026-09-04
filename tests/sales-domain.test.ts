// Unit tests for the commercial engine's business tier.
//
// These target the arithmetic a sales director is measured on, and the two places it goes silently
// wrong: a quarter boundary read in the wrong timezone, and a percentage that means one thing on
// one screen and another thing on the next. FIRST + AAA; nothing here touches Postgres, the network
// or the real clock.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  SALES_STAGES, STAGE_OUTCOMES, LEGACY_STAGE_MAP, STALL_STAGES, STALL_DAYS, DEPARTMENTS,
  stageWeight, isTerminalStage, isStalled, weightedValue, riyadhFiscalPeriod,
  riyadhPeriodBounds, attainmentPct, coveragePct, periodElapsedFraction, ragKey, contactState,
  checkSalesDomainClosure, SALES_DOMAIN_JS,
} from "../src/sales-domain.js";

/** A Riyadh wall-clock moment as epoch ms. Riyadh is UTC+3 with no DST, ever, so this is exact. */
function riyadh(y: number, m: number, d: number, hh = 0, mm = 0): number {
  return Date.UTC(y, m - 1, d, hh, mm) - 3 * 60 * 60 * 1000;
}

describe("the stage ladder", () => {
  it("carries all eight stages from the recovered archive", () => {
    expect(SALES_STAGES.map((s) => s.key)).toEqual([
      "contact", "discover", "present", "tech", "quote", "negotiate", "won", "lost",
    ]);
  });

  it("weights rise monotonically to the win and drop to zero on the loss", () => {
    // A forecast is only meaningful if a later stage is never worth less than an earlier one.
    const open = SALES_STAGES.filter((s) => s.key !== "lost");
    for (let i = 1; i < open.length; i++) {
      expect(open[i].weightPct).toBeGreaterThan(open[i - 1].weightPct);
    }
    expect(SALES_STAGES.find((s) => s.key === "won")!.weightPct).toBe(100);
    expect(SALES_STAGES.find((s) => s.key === "lost")!.weightPct).toBe(0);
  });

  it("maps every legacy stage to itself, so no live row is reclassified", () => {
    // The engine ships six stages today. The migration adds two; it must move nothing.
    const legacy = ["contact", "present", "tech", "negotiate", "won", "lost"];
    for (const key of legacy) expect(LEGACY_STAGE_MAP[key]).toBe(key);
    const targets = new Set(Object.values(LEGACY_STAGE_MAP));
    expect(targets.size).toBe(legacy.length); // injective: no two legacy stages collapse into one
  });

  it("the two genuinely new stages have no legacy source", () => {
    expect(Object.values(LEGACY_STAGE_MAP)).not.toContain("discover");
    expect(Object.values(LEGACY_STAGE_MAP)).not.toContain("quote");
  });

  it("weighs an unknown stage at nothing rather than guessing", () => {
    expect(stageWeight("not_a_stage", SALES_STAGES)).toBe(0);
    expect(stageWeight("tech", SALES_STAGES)).toBeCloseTo(0.65);
  });

  it("knows which stages are terminal", () => {
    expect(isTerminalStage("won")).toBe(true);
    expect(isTerminalStage("lost")).toBe(true);
    expect(isTerminalStage("negotiate")).toBe(false);
  });
});

describe("the outcome taxonomy", () => {
  it("gives every non-terminal stage at least one way forward and one way out", () => {
    for (const stage of ["contact", "discover", "present", "tech"]) {
      const outs = STAGE_OUTCOMES.filter((o) => o.stage === stage);
      expect(outs.some((o) => o.kind === "advance")).toBe(true);
      expect(outs.some((o) => o.kind === "needs_action" || o.kind === "lost")).toBe(true);
    }
  });

  it("names a real department on every outcome that needs one", () => {
    // This is the differentiator: a pending action nobody owns is the stall being described
    // rather than fixed.
    for (const o of STAGE_OUTCOMES) {
      if (o.kind === "needs_action") {
        expect(o.dept, `${o.stage}/${o.key}`).not.toBe("");
        expect(DEPARTMENTS).toContain(o.dept);
      }
    }
  });

  it("routes the two stalling stages outside sales, which is why they stall", () => {
    const techDepts = STAGE_OUTCOMES.filter((o) => o.stage === "tech" && o.kind === "needs_action").map((o) => o.dept);
    const negDepts = STAGE_OUTCOMES.filter((o) => o.stage === "negotiate" && o.kind === "needs_action").map((o) => o.dept);
    expect(techDepts).toContain("التقنية");
    expect(negDepts).toContain("المشتريات");
  });

  it("only references stages that exist", () => {
    const keys = new Set(SALES_STAGES.map((s) => s.key));
    for (const o of STAGE_OUTCOMES) expect(keys.has(o.stage as never), o.stage).toBe(true);
  });
});

describe("stall detection", () => {
  it("flags the crossing points past the window and nothing else", () => {
    expect(isStalled("tech", 14, STALL_STAGES, STALL_DAYS)).toBe(true);
    expect(isStalled("negotiate", 40, STALL_STAGES, STALL_DAYS)).toBe(true);
    expect(isStalled("tech", 13, STALL_STAGES, STALL_DAYS)).toBe(false);
    // A deal parked in discovery is a different problem and must not read as a departmental stall.
    expect(isStalled("discover", 90, STALL_STAGES, STALL_DAYS)).toBe(false);
  });
});

describe("weighted forecast", () => {
  it("weighs an open deal by its stage", () => {
    // 100,000 x 2 branches x 3 years, 10% off, at 65% = 351,000
    expect(weightedValue(100000, 2, 3, 10, "tech", SALES_STAGES)).toBe(351000);
  });

  it("counts a won deal as zero, because a win is achieved and not forecast", () => {
    // Counting it in both is how a pipeline reports the same riyal twice.
    expect(weightedValue(500000, 1, 1, 0, "won", SALES_STAGES)).toBe(0);
    expect(weightedValue(500000, 1, 1, 0, "lost", SALES_STAGES)).toBe(0);
  });

  it("defaults an absent quantity, term and discount rather than zeroing the deal", () => {
    expect(weightedValue(100000, 0, 0, 0, "quote", SALES_STAGES)).toBe(80000);
  });
});

describe("fiscal periods in Riyadh local time", () => {
  it("keeps a late-March win in Q1, where UTC would move it", () => {
    // The case that silently moves someone's number: 23:30 Riyadh on 31 March is 20:30Z.
    const at = riyadh(2026, 3, 31, 23, 30);
    expect(new Date(at).getUTCMonth() + 1).toBe(3); // still March in UTC here, but only just
    expect(riyadhFiscalPeriod(at, 1)).toEqual({ year: 2026, quarter: 1 });
  });

  it("puts the moment just after midnight Riyadh on 1 April into Q2", () => {
    // Half-open boundaries: the instant a quarter opens belongs to the new quarter.
    expect(riyadhFiscalPeriod(riyadh(2026, 4, 1, 0, 0), 1)).toEqual({ year: 2026, quarter: 2 });
    expect(riyadhFiscalPeriod(riyadh(2026, 3, 31, 23, 59), 1)).toEqual({ year: 2026, quarter: 1 });
  });

  it("does not let a UTC reading of a late-evening win change the quarter", () => {
    // 01:30 Riyadh on 1 April is 22:30Z on 31 March. Read as UTC it is Q1; it is really Q2.
    const at = riyadh(2026, 4, 1, 1, 30);
    expect(new Date(at).getUTCDate()).toBe(31); // UTC still says March
    expect(riyadhFiscalPeriod(at, 1)).toEqual({ year: 2026, quarter: 2 });
  });

  it("handles a non-January fiscal year, labelled by its starting calendar year", () => {
    // April start: April is FY Q1, and March belongs to the PREVIOUS fiscal year's Q4.
    expect(riyadhFiscalPeriod(riyadh(2026, 4, 1), 4)).toEqual({ year: 2026, quarter: 1 });
    expect(riyadhFiscalPeriod(riyadh(2026, 3, 31), 4)).toEqual({ year: 2025, quarter: 4 });
  });

  it("covers all four quarters of a calendar year", () => {
    expect(riyadhFiscalPeriod(riyadh(2026, 1, 1), 1).quarter).toBe(1);
    expect(riyadhFiscalPeriod(riyadh(2026, 6, 15), 1).quarter).toBe(2);
    expect(riyadhFiscalPeriod(riyadh(2026, 9, 30), 1).quarter).toBe(3);
    expect(riyadhFiscalPeriod(riyadh(2026, 12, 31), 1).quarter).toBe(4);
  });
});

describe("period bounds round-trip with period bucketing", () => {
  it("bounds a calendar quarter at Riyadh midnight, half-open", () => {
    const b = riyadhPeriodBounds(2026, 1, 1);
    expect(b.startMs).toBe(riyadh(2026, 1, 1, 0, 0));
    expect(b.endMs).toBe(riyadh(2026, 4, 1, 0, 0));
  });

  it("every quarter's last instant buckets back to that quarter, and its end to the next", () => {
    // The property that stops a deal being counted twice or dropped on a boundary.
    for (let q = 1; q <= 4; q++) {
      const b = riyadhPeriodBounds(2026, q, 1);
      expect(riyadhFiscalPeriod(b.startMs, 1)).toEqual({ year: 2026, quarter: q });
      expect(riyadhFiscalPeriod(b.endMs - 1, 1)).toEqual({ year: 2026, quarter: q });
      const next = riyadhFiscalPeriod(b.endMs, 1);
      expect(next).not.toEqual({ year: 2026, quarter: q });
    }
  });

  it("round-trips a non-January fiscal year too", () => {
    const b = riyadhPeriodBounds(2026, 1, 4);           // FY starts April
    expect(riyadhFiscalPeriod(b.startMs, 4)).toEqual({ year: 2026, quarter: 1 });
    expect(riyadhFiscalPeriod(b.endMs - 1, 4)).toEqual({ year: 2026, quarter: 1 });
    // Q4 of an April-start FY2026 spills into calendar 2027.
    const q4 = riyadhPeriodBounds(2026, 4, 4);
    expect(new Date(q4.startMs + 3 * 3600 * 1000).getUTCFullYear()).toBe(2027);
  });
});

describe("attainment and coverage are different questions", () => {
  it("attainment asks what has been won", () => {
    expect(attainmentPct(350000, 1000000)).toBeCloseTo(35);
  });

  it("coverage adds the weighted pipeline, so the two differ on the same row", () => {
    expect(coveragePct(350000, 400000, 1000000)).toBeCloseTo(75);
    // Same row, two numbers. This is why one ambiguous "%" coloured the screen wrongly.
    expect(attainmentPct(350000, 1000000)).not.toBeCloseTo(75);
  });

  it("returns null with no target rather than zero", () => {
    // "No target set" and "zero percent of target" are different facts; a screen that renders
    // them the same is lying to an executive.
    expect(attainmentPct(100, 0)).toBeNull();
    expect(coveragePct(100, 50, 0)).toBeNull();
  });
});

describe("RAG is pace-adjusted", () => {
  it("does not paint a product red in the first week of a quarter", () => {
    // 10% attained with 10% of the quarter elapsed is exactly on pace.
    expect(ragKey(10, 0.1)).toBe("good");
  });

  it("paints the same number red at the end of the quarter", () => {
    expect(ragKey(10, 1)).toBe("bad");
  });

  it("bands on pace, not raw attainment", () => {
    expect(ragKey(35, 0.5)).toBe("good");  // pace 70
    expect(ragKey(30, 0.5)).toBe("warn");  // pace 60
    expect(ragKey(20, 0.5)).toBe("bad");   // pace 40
  });

  it("says nothing when there is no target", () => {
    expect(ragKey(null, 0.5)).toBe("none");
  });

  it("survives a zero-elapsed period without dividing by zero", () => {
    expect(["good", "warn", "bad"]).toContain(ragKey(1, 0));
  });
});

describe("period elapsed", () => {
  it("clamps outside the period and interpolates inside it", () => {
    const s = riyadh(2026, 1, 1), e = riyadh(2026, 4, 1);
    expect(periodElapsedFraction(s - 1000, s, e)).toBe(0);
    expect(periodElapsedFraction(e + 1000, s, e)).toBe(1);
    expect(periodElapsedFraction(riyadh(2026, 2, 15), s, e)).toBeGreaterThan(0.4);
    expect(periodElapsedFraction(riyadh(2026, 2, 15), s, e)).toBeLessThan(0.6);
  });

  it("does not divide by zero on an empty period", () => {
    expect(periodElapsedFraction(5, 10, 10)).toBe(1);
  });
});

describe("absence told apart from silence", () => {
  it("separates never-contacted from nobody-recorded-it", () => {
    // The PM outcome view's credibility: these look identical in a ledger and mean opposite things.
    expect(contactState(0, false)).toBe("untouched");
    expect(contactState(0, true)).toBe("unrecorded");
    expect(contactState(3, true)).toBe("worked");
  });
});

describe("the browser seam", () => {
  it("ships every rule the page needs, self-contained", () => {
    // A function referencing anything outside its parameters and the injected constants passes in
    // Node and throws in the browser, which renders a blank page.
    expect(checkSalesDomainClosure()).toEqual([]);
  });

  it("does not mistake a property of an allowed global for a free reference", () => {
    // Regression: the checker matched `UTC` in `Date.UTC(...)` and reported correct code as
    // broken. A guard that cries wolf gets widened until it guards nothing.
    expect(checkSalesDomainClosure()).not.toContain("UTC");
  });

  it("carries the constants and the functions into the bundle", () => {
    expect(SALES_DOMAIN_JS).toContain("var SALES_STAGES =");
    expect(SALES_DOMAIN_JS).toContain("var STAGE_OUTCOMES =");
    expect(SALES_DOMAIN_JS).toContain("function riyadhFiscalPeriod");
    expect(SALES_DOMAIN_JS).toContain("function ragKey");
  });

  it("declares no lowercase module-scope binding, which the closure checker depends on", () => {
    // checkSalesDomainClosure only inspects identifiers starting with an upper-case letter, so a
    // lowercase module-scope const referenced from a shipped function would pass in Node and throw
    // ReferenceError in the browser. Rather than pretend the checker catches that, assert its
    // precondition: every module-scope value here is UPPER_CASE or a function declaration.
    const src = readFileSync(new URL("../src/sales-domain.ts", import.meta.url), "utf8");
    const offenders = src
      .split("\n")
      .filter((l) => /^(?:export\s+)?(?:const|let|var)\s+[a-z]/.test(l))
      .map((l) => l.trim().slice(0, 70));
    expect(offenders, "add it to DOMAIN_FNS' allowlist or rename it UPPER_CASE").toEqual([]);
  });

  it("is executable as emitted, not merely present as text", () => {
    // Evaluate the shipped bundle the way the browser does and call through it.
    const run = new Function(SALES_DOMAIN_JS + "; return { ragKey: ragKey, weightedValue: weightedValue, SALES_STAGES: SALES_STAGES };")();
    expect(run.ragKey(10, 1)).toBe("bad");
    expect(run.weightedValue(100000, 2, 3, 10, "tech", run.SALES_STAGES)).toBe(351000);
  });
});
