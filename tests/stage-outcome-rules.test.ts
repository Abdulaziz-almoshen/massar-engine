import { describe, it, expect, afterEach } from "vitest";
import {
  moveOutcomeKind, outcomesForMove, checkMoveOutcome, setLiveOutcomes, outcomesForStage, outcomeForStage,
  SEED_OUTCOMES, STAGE_OUTCOMES, SALES_STAGES, SALES_DOMAIN_JS,
} from "../src/sales-domain.js";
import { checkOutcome, checkOutcomeDelete, outcomeKeyFrom } from "../src/config-domain.js";
import { LOSS_REASONS, LOSS_REASON_LABELS, refreshLossReasons, checkLossReason } from "../src/opp-work-domain.js";

const ladder = SALES_STAGES.map((s) => ({ key: s.key, position: s.position, terminal: s.terminal }));
afterEach(() => { setLiveOutcomes(SEED_OUTCOMES); refreshLossReasons(); });

describe("what a move must record", () => {
  it("forward needs advance, back needs needs_action, lost has its own dialog, reopen needs nothing", () => {
    expect(moveOutcomeKind("contact", "discover", ladder)).toBe("advance");
    expect(moveOutcomeKind("contact", "quote", ladder)).toBe("advance");
    expect(moveOutcomeKind("negotiate", "won", ladder)).toBe("advance");
    expect(moveOutcomeKind("quote", "discover", ladder)).toBe("needs_action");
    expect(moveOutcomeKind("tech", "lost", ladder)).toBe("lost");
    expect(moveOutcomeKind("lost", "contact", ladder)).toBe(null);
    expect(moveOutcomeKind("won", "negotiate", ladder)).toBe(null);
    expect(moveOutcomeKind("tech", "tech", ladder)).toBe(null);
  });
  it("offers only the leaving rung's outcomes of the right kind", () => {
    const fwd = outcomesForMove("contact", "discover", ladder).map((o) => o.key);
    expect(fwd).toEqual(["interested"]);
    const back = outcomesForMove("present", "contact", ladder).map((o) => o.kind);
    expect(back.length).toBeGreaterThan(0);
    expect(back.every((k) => k === "needs_action")).toBe(true);
  });
  it("refuses a move with no outcome, the wrong rung's outcome, or the wrong kind", () => {
    expect(checkMoveOutcome("contact", "discover", null, ladder)).toMatchObject({ ok: false, code: "outcome_required" });
    expect(checkMoveOutcome("contact", "discover", "need_confirmed", ladder)).toMatchObject({ ok: false, code: "outcome_not_for_move" });
    expect(checkMoveOutcome("contact", "discover", "not_interested", ladder)).toMatchObject({ ok: false, code: "outcome_not_for_move" });
    expect(checkMoveOutcome("contact", "discover", "interested", ladder)).toEqual({ ok: true, required: true });
    expect(checkMoveOutcome("tech", "lost", null, ladder)).toEqual({ ok: true, required: false });
    expect(checkMoveOutcome("lost", "contact", null, ladder)).toEqual({ ok: true, required: false });
  });
  it("says where to configure when a rung has no outcome of the needed kind", () => {
    setLiveOutcomes(SEED_OUTCOMES.filter((o) => !(o.stage === "contact" && o.kind === "advance")));
    const r = checkMoveOutcome("contact", "discover", null, ladder);
    expect(r).toMatchObject({ ok: false, code: "no_outcomes_configured" });
  });
});

describe("the live list is the admin's", () => {
  it("replaces in place, so every reader sees an added or paused outcome", () => {
    const ref = STAGE_OUTCOMES;
    setLiveOutcomes([...SEED_OUTCOMES.map((o) => (o.key === "interested" ? { ...o, active: false } : o)),
      { stage: "contact", key: "oc_contact_1", label: "طلب عرضًا تجريبيًا", reason: "", nextAction: "جدولة عرض", kind: "advance", dept: "" }]);
    expect(STAGE_OUTCOMES).toBe(ref);
    expect(outcomesForStage("contact").map((o) => o.key)).toContain("oc_contact_1");
    expect(outcomesForStage("contact").map((o) => o.key)).not.toContain("interested");
    expect(outcomeForStage("contact", "interested")).toBe(null);          // paused: not accepted on a write
    expect(STAGE_OUTCOMES.find((o) => o.key === "interested")?.label).toBe("مهتم");   // …still has a label
  });
  it("an empty read keeps what we had", () => {
    setLiveOutcomes([]);
    expect(STAGE_OUTCOMES.length).toBe(SEED_OUTCOMES.length);
  });
  it("rebuilds the loss reasons from the lost rung", () => {
    setLiveOutcomes([...SEED_OUTCOMES, { stage: "lost", key: "oc_lost_1", label: "خسارة – إغلاق المنشأة", reason: "", nextAction: "تسجيل", kind: "lost", dept: "" }]);
    refreshLossReasons();
    expect(LOSS_REASONS.map((r) => r.key)).toContain("oc_lost_1");
    expect(LOSS_REASON_LABELS.oc_lost_1).toBe("إغلاق المنشأة");
    expect(checkLossReason("oc_lost_1", "")).toMatchObject({ ok: true });
  });
  it("the browser copy carries the move rules", () => {
    for (const n of ["moveOutcomeKind", "outcomesForMove", "checkMoveOutcome"]) expect(SALES_DOMAIN_JS).toContain("function " + n);
  });
});

describe("editing an outcome", () => {
  const D = ["إدارة المنتج", "المبيعات"];
  it("validates label, kind, next action and department", () => {
    expect(checkOutcome({ label: "طلب عرض", kind: "advance", nextAction: "جدولة" }, [], D)).toMatchObject({ ok: true });
    expect(checkOutcome({ label: "", kind: "advance", nextAction: "x" }, [], D)).toMatchObject({ ok: false, field: "label" });
    expect(checkOutcome({ label: "مقبول", kind: "advance", nextAction: "x" }, ["مقبول"], D)).toMatchObject({ ok: false, code: "label_exists" });
    expect(checkOutcome({ label: "مقبول", kind: "advance", nextAction: "x" }, ["مقبول"], D, "مقبول")).toMatchObject({ ok: true });
    expect(checkOutcome({ label: "س", kind: "done", nextAction: "x" }, [], D)).toMatchObject({ ok: false, field: "kind" });
    expect(checkOutcome({ label: "س", kind: "lost", nextAction: "" }, [], D)).toMatchObject({ ok: false, field: "nextAction" });
    expect(checkOutcome({ label: "س", kind: "lost", nextAction: "x", dept: "التسويق" }, [], D)).toMatchObject({ ok: false, field: "dept" });
  });
  it("never deletes a seeded or a recorded outcome", () => {
    expect(checkOutcomeDelete(true, 0).ok).toBe(false);
    expect(checkOutcomeDelete(false, 2).ok).toBe(false);
    expect(checkOutcomeDelete(false, 0).ok).toBe(true);
  });
  it("derives a fresh ascii key", () => {
    expect(outcomeKeyFrom("contact", [])).toBe("oc_contact_1");
    expect(outcomeKeyFrom("contact", ["oc_contact_1"])).toBe("oc_contact_2");
  });
});
