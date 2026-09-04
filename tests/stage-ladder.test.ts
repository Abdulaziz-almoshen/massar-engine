import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { SALES_STAGES, STALL_STAGES, CONFIRMED_INTEREST_MIN_WEIGHT } from "../src/sales-domain.js";
import {
  OPP_STAGES, OPP_STALL_STAGES, CONFIRMED_INTEREST_STAGES, isConfirmedInterestStage,
} from "../src/opps-domain.js";
import { OPP_STAGES as DB_OPP_STAGES } from "../src/db.js";

// ONE LADDER. These tests exist because there used to be two, and the drift between them produced
// both stage defects of 2026-09-04: «اكتشاف الحاجة» and «عرض السعر» were unreachable from any UI,
// and the confirmed-interest pair silently dropped a deal out of the Makeen feed on its way past.
//
// Every assertion here is a REGRESSION test in the strict sense: it locks a failure that already
// happened in this codebase, not a hypothetical one.

describe("the stage ladder has exactly one source", () => {
  it("derives the board's ladder from SALES_STAGES, key for key and in order", () => {
    expect(OPP_STAGES.map((s) => s.key)).toEqual(SALES_STAGES.map((s) => s.key));
    expect(OPP_STAGES.map((s) => s.position)).toEqual(SALES_STAGES.map((s) => s.position));
    expect(OPP_STAGES.map((s) => s.label)).toEqual(SALES_STAGES.map((s) => s.label));
  });

  it("derives the db validator's list from the same source", () => {
    expect([...DB_OPP_STAGES]).toEqual(SALES_STAGES.map((s) => s.key));
  });

  it("makes discover and quote REACHABLE — the defect this refactor exists for", () => {
    // Before: OPP_STAGES was a hand-written six-item list and validateOppLine rejected anything
    // outside it, so a PATCH setting stage:"discover" returned 400 invalid_field even though the
    // Postgres CHECK already accepted it.
    expect(DB_OPP_STAGES).toContain("discover");
    expect(DB_OPP_STAGES).toContain("quote");
    expect(OPP_STAGES.map((s) => s.key)).toContain("discover");
    expect(OPP_STAGES.map((s) => s.key)).toContain("quote");
  });

  it("derives the stall set rather than repeating it", () => {
    expect([...OPP_STALL_STAGES]).toEqual([...STALL_STAGES]);
    expect([...STALL_STAGES]).toEqual(SALES_STAGES.filter((s) => s.stalls).map((s) => s.key));
  });

  it("keeps the Postgres CHECK in step with the ladder", () => {
    // The constraint is SQL text in a versioned migration, so it cannot be generated from a mutable
    // list without rewriting history. It is asserted instead: change the ladder and this fails,
    // which is the reminder to write the next migration.
    const src = readFileSync(new URL("../src/db.ts", import.meta.url), "utf8");
    const m = src.match(/opportunities_stage_check\s*\n?\s*CHECK \(stage IN \(([^)]*)\)\)/);
    expect(m, "could not find the widened CHECK in db.ts").toBeTruthy();
    const inCheck = (m![1].match(/'([a-z]+)'/g) || []).map((x) => x.replace(/'/g, ""));
    expect(inCheck.sort()).toEqual(SALES_STAGES.map((s) => s.key).slice().sort());
  });
});

describe("confirmed interest is derived, and excludes customers", () => {
  it("INCLUDES quote — the rung that was silently dropping deals out of the Makeen feed", () => {
    // «عرض السعر» sits at 80, between «التقييم التقني» (65) and «التفاوض والاعتماد» (90). The old
    // hardcoded pair ["tech","negotiate"] meant a deal moving tech -> quote vanished from the feed
    // and reappeared at negotiate. Found by the Codex outside voice, 2026-09-04.
    expect(isConfirmedInterestStage("quote")).toBe(true);
    expect(CONFIRMED_INTEREST_STAGES).toContain("quote");
  });

  it("EXCLUDES won even though its weight is the highest on the ladder", () => {
    // The trap this refactor nearly walked into. opps-domain's own comment warns that «إغلاق الصفقة»
    // is a CUSTOMER, not a potential one, and a range test would fold won deals into a number the
    // product side reads as pipeline. The first draft used weightPct >= 65 alone; won carries 100.
    const won = SALES_STAGES.find((s) => s.key === "won")!;
    expect(won.weightPct).toBeGreaterThanOrEqual(CONFIRMED_INTEREST_MIN_WEIGHT);
    expect(isConfirmedInterestStage("won")).toBe(false);
    expect(CONFIRMED_INTEREST_STAGES).not.toContain("won");
  });

  it("excludes every terminal stage and every rung below the threshold", () => {
    for (const s of SALES_STAGES) {
      const expected = s.weightPct >= CONFIRMED_INTEREST_MIN_WEIGHT && s.terminal === null;
      expect(isConfirmedInterestStage(s.key), s.key).toBe(expected);
    }
    expect(isConfirmedInterestStage("lost")).toBe(false);
    expect(isConfirmedInterestStage("contact")).toBe(false);
  });

  it("still contains the two rungs the original hardcoded pair named", () => {
    expect(isConfirmedInterestStage("tech")).toBe(true);
    expect(isConfirmedInterestStage("negotiate")).toBe(true);
  });
});
