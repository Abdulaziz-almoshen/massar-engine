import { describe, expect, it } from "vitest";
import {
  canMoveQuote, checkActivity, checkLossReason, checkOppWorkDomainClosure, checkQuote, isLossClose,
  LOSS_REASON_LABELS, LOSS_REASONS, OPP_WORK_DOMAIN_JS,
} from "../src/opp-work-domain.js";
import { DEPARTMENTS, STAGE_OUTCOMES } from "../src/sales-domain.js";

describe("loss reasons (BRULE-009, BR-RPT-003)", () => {
  it("are the ladder's lost outcomes, and include the BRD's four causes", () => {
    const keys = LOSS_REASONS.map((r) => r.key);
    expect(keys).toEqual(STAGE_OUTCOMES.filter((o) => o.stage === "lost").map((o) => o.key));
    for (const k of ["lost_price", "lost_competitor", "lost_no_need", "lost_fit", "lost_budget", "lost_other"]) expect(keys).toContain(k);
    expect(LOSS_REASONS.find((r) => r.key === "lost_price")?.label).toBe("السعر");
  });
  it("labels every lost-kind outcome a rep can record, not only the board's", () => {
    expect(LOSS_REASON_LABELS.not_interested).toBe("غير مهتم");
    expect(LOSS_REASON_LABELS.integration_failed).toBe("فشل التكامل");
  });
  it("requires a known reason, and a sentence for «سبب آخر»", () => {
    expect(checkLossReason("", null)).toMatchObject({ ok: false, field: "lost_reason" });
    expect(checkLossReason("because", null)).toMatchObject({ ok: false, field: "lost_reason" });
    expect(checkLossReason("lost_other", "  ")).toMatchObject({ ok: false, field: "lost_note" });
    expect(checkLossReason("lost_other", "انتقلوا لمنصة حكومية")).toEqual({ ok: true, reason: "lost_other", note: "انتقلوا لمنصة حكومية" });
    expect(checkLossReason("lost_price", "")).toEqual({ ok: true, reason: "lost_price", note: null });
    expect(checkLossReason("lost_price", "x".repeat(301))).toMatchObject({ ok: false, field: "lost_note" });
    expect(checkLossReason(["lost_price"], null)).toMatchObject({ ok: false });
  });
  it("only a move INTO lost is a close", () => {
    expect(isLossClose("tech", "lost")).toBe(true);
    expect(isLossClose("lost", "lost")).toBe(false);
    expect(isLossClose("lost", "tech")).toBe(false);
  });
});

describe("activities (BR-OPP-003)", () => {
  const today = "2026-09-15";
  const good = { kind: "meeting", occurredOn: "2026-09-14", summary: "استعراض متطلبات التكامل", nextStep: "إرسال العرض الفني", nextOn: "2026-09-20", owner: "سارة", dept: DEPARTMENTS[0] };
  it("accepts a meeting with a dated next step", () => {
    expect(checkActivity(good, today, DEPARTMENTS)).toMatchObject({ ok: true, value: { kind: "meeting", nextOn: "2026-09-20" } });
  });
  it("refuses a future activity, a dateless one, an empty summary and unknown kinds", () => {
    expect(checkActivity({ ...good, occurredOn: "2026-09-16" }, today, DEPARTMENTS)).toMatchObject({ field: "occurredOn" });
    expect(checkActivity({ ...good, occurredOn: "" }, today, DEPARTMENTS)).toMatchObject({ field: "occurredOn" });
    expect(checkActivity({ ...good, occurredOn: "2026-02-31x" }, today, DEPARTMENTS)).toMatchObject({ field: "occurredOn" });
    expect(checkActivity({ ...good, summary: " " }, today, DEPARTMENTS)).toMatchObject({ field: "summary" });
    expect(checkActivity({ ...good, kind: "lunch" }, today, DEPARTMENTS)).toMatchObject({ field: "kind" });
  });
  it("a next date needs its step and cannot precede the activity", () => {
    expect(checkActivity({ ...good, nextStep: "" }, today, DEPARTMENTS)).toMatchObject({ field: "nextStep" });
    expect(checkActivity({ ...good, nextOn: "2026-09-01" }, today, DEPARTMENTS)).toMatchObject({ field: "nextOn" });
    expect(checkActivity({ ...good, nextStep: "", nextOn: "" }, today, DEPARTMENTS)).toMatchObject({ ok: true, value: { nextStep: null, nextOn: null } });
  });
  it("real calendar days only (review: 2026-02-31 and 0001-01-01 were accepted)", () => {
    expect(checkActivity({ ...good, occurredOn: "2026-02-31" }, today, DEPARTMENTS)).toMatchObject({ field: "occurredOn" });
    expect(checkActivity({ ...good, occurredOn: "0001-01-01" }, today, DEPARTMENTS)).toMatchObject({ field: "occurredOn" });
    expect(checkActivity({ ...good, nextOn: "9999-12-31" }, today, DEPARTMENTS)).toMatchObject({ field: "nextOn" });
  });
  it("department comes from the company list", () => {
    expect(checkActivity({ ...good, dept: "المطبخ" }, today, DEPARTMENTS)).toMatchObject({ field: "dept" });
  });
});

describe("quotes (BR-OPP-004)", () => {
  const today = "2026-09-15";
  it("uses the line's arithmetic fields with sane bounds", () => {
    expect(checkQuote({ salePrice: "18000", years: "2", qty: 1, discount: "10", validUntil: "2026-10-15" }, today))
      .toEqual({ ok: true, value: { salePrice: 18000, years: 2, qty: 1, discount: 10, validUntil: "2026-10-15", note: null } });
    expect(checkQuote({ salePrice: 0 }, today)).toMatchObject({ field: "salePrice" });
    expect(checkQuote({ salePrice: 100, years: 11 }, today)).toMatchObject({ field: "years" });
    expect(checkQuote({ salePrice: 100, qty: 1.5 }, today)).toMatchObject({ field: "qty" });
    expect(checkQuote({ salePrice: 100, discount: 120 }, today)).toMatchObject({ field: "discount" });
    expect(checkQuote({ salePrice: 100, validUntil: "2026-09-01" }, today)).toMatchObject({ field: "validUntil" });
    expect(checkQuote({ salePrice: 100 }, today)).toMatchObject({ ok: true, value: { years: 1, qty: 1, discount: 0 } });
  });
  it("stays inside the line's own bounds so an accepted quote can always become the line (review)", () => {
    expect(checkQuote({ salePrice: 100, discount: 12.5 }, today)).toMatchObject({ field: "discount" });
    expect(checkQuote({ salePrice: 100, qty: 50000 }, today)).toMatchObject({ field: "qty" });
    expect(checkQuote({ salePrice: "0x10" }, today)).toMatchObject({ field: "salePrice" });
    expect(checkQuote({ salePrice: "1e3" }, today)).toMatchObject({ field: "salePrice" });
    expect(checkQuote({ salePrice: 100, note: { a: 1 } }, today)).toMatchObject({ field: "note" });
    expect(checkQuote({ salePrice: 100, validUntil: "2026-02-31" }, "2026-01-01")).toMatchObject({ field: "validUntil" });
  });
  it("moves forward only; a decided quote is history", () => {
    expect(canMoveQuote("draft", "sent")).toBe(true);
    expect(canMoveQuote("sent", "accepted")).toBe(true);
    expect(canMoveQuote("draft", "accepted")).toBe(false);
    expect(canMoveQuote("accepted", "rejected")).toBe(false);
    expect(canMoveQuote("rejected", "sent")).toBe(false);
  });
});

describe("the page seam", () => {
  it("is closed and runs identically", () => {
    expect(checkOppWorkDomainClosure()).toEqual([]);
    const page = new Function(OPP_WORK_DOMAIN_JS + "; return { checkLossReason, checkActivity, checkQuote };")();
    expect(page.checkLossReason("lost_other", "")).toEqual(checkLossReason("lost_other", ""));
    expect(page.checkActivity({ kind: "call", occurredOn: "2026-09-15", summary: "x" }, "2026-09-15", DEPARTMENTS))
      .toEqual(checkActivity({ kind: "call", occurredOn: "2026-09-15", summary: "x" }, "2026-09-15", DEPARTMENTS));
    expect(page.checkQuote({ salePrice: "5" }, "2026-09-15")).toEqual(checkQuote({ salePrice: "5" }, "2026-09-15"));
  });
});
