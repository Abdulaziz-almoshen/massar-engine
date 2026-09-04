import { describe, it, expect } from "vitest";
import { SALES_STAGES, STAGE_OUTCOMES, resolveOutcome } from "../src/sales-domain.js";

// An outcome key is not a command. «مهتم» means something only relative to the rung the deal is
// standing on, and before resolveOutcome existed nothing stopped a caller submitting
// contact/interested as a move to «إغلاق – خسارة». The target stage is DERIVED here, never taken
// from the request, so the write path cannot be talked into an illegal transition.

const ok = (r: ReturnType<typeof resolveOutcome>) => {
  if (!r.ok) throw new Error("expected ok, got " + r.error);
  return r;
};

describe("resolveOutcome derives the target stage", () => {
  it("refuses an outcome that does not belong to the stage being held", () => {
    // not_interested is a «تواصل أولي» outcome. Submitted against a deal at «التقييم التقني» it is
    // not a lost deal, it is a caller guessing.
    const r = resolveOutcome("tech", "not_interested", SALES_STAGES, STAGE_OUTCOMES);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("outcome_not_valid_for_stage");
  });

  it("advances to the next OPEN rung, never skipping and never landing on lost", () => {
    expect(ok(resolveOutcome("contact", "interested", SALES_STAGES, STAGE_OUTCOMES)).toStage).toBe("discover");
    expect(ok(resolveOutcome("tech", "passed", SALES_STAGES, STAGE_OUTCOMES)).toStage).toBe("quote");
  });

  it("advances from the last open rung into won, not into lost", () => {
    // «إغلاق – خسارة» sits at position 8, AFTER «إغلاق – ربح» at 7. A naive next-by-position would
    // send an agreed negotiation to lost.
    const r = ok(resolveOutcome("negotiate", "agreed", SALES_STAGES, STAGE_OUTCOMES));
    expect(r.toStage).toBe("won");
  });

  it("keeps the deal where it is for a needs_action outcome, and names the department", () => {
    const r = ok(resolveOutcome("tech", "awaiting_tech", SALES_STAGES, STAGE_OUTCOMES));
    expect(r.toStage).toBe("tech");
    expect(r.dept).toBe("التقنية");
  });

  it("sends a lost outcome to lost", () => {
    expect(ok(resolveOutcome("contact", "not_interested", SALES_STAGES, STAGE_OUTCOMES)).toStage).toBe("lost");
  });

  it("resolves EVERY outcome in the taxonomy to a real stage", () => {
    // The taxonomy is 28 values recovered from the archive. If one of them names a stage that no
    // longer exists, or advances off the end of the ladder, this is where it surfaces.
    const keys = SALES_STAGES.map((s) => s.key);
    for (const o of STAGE_OUTCOMES) {
      const r = resolveOutcome(o.stage, o.key, SALES_STAGES, STAGE_OUTCOMES);
      expect(r.ok, `${o.stage}/${o.key}`).toBe(true);
      if (r.ok) expect(keys, `${o.stage}/${o.key} -> ${r.toStage}`).toContain(r.toStage);
    }
  });

  it("names a department only from the approved list, or leaves it with sales", () => {
    for (const o of STAGE_OUTCOMES) {
      if (!o.dept) continue;
      expect(["إدارة المنتج", "المبيعات", "التقنية", "القانونية", "المشتريات", "أمن المعلومات"]).toContain(o.dept);
    }
  });
});
