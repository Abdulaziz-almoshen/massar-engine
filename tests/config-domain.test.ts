import { describe, it, expect } from "vitest";
import {
  checkStage, checkStageDelete, stageKeyFrom, isValidStageKey, isTerminalStageKey,
  isStageSelectable, stageSlaState, isEmailShaped, checkMember, checkDivision,
  checkDivisionDelete, checkEscalation, checkConfigDomainClosure, CONFIG_DOMAIN_JS,
  type StageRow,
} from "../src/config-domain.js";

const stage = (over: Partial<StageRow> = {}): StageRow => ({
  key: "tech", label: "التقييم التقني", weightPct: 65, position: 4, slaDays: 14,
  active: true, dot: "#7A5CC4", terminal: null, exitCriterion: null, ...over,
});

describe("stage keys — identity the admin never types by accident", () => {
  it("derives an ascii key from a latin label and falls back for Arabic", () => {
    expect(stageKeyFrom("Legal Review", [])).toBe("legal_review");
    expect(stageKeyFrom("مراجعة قانونية", [])).toBe("stage");
  });
  it("always starts with a letter, whatever the label ends in", () => {
    expect(stageKeyFrom("مراجعة قانونية 1234", [])).toBe("stage_1234");
    expect(isValidStageKey(stageKeyFrom("مراجعة قانونية 1234", []))).toBe(true);
    expect(isValidStageKey(stageKeyFrom("2026 review", []))).toBe(true);
  });
  it("never collides with a key already on the ladder", () => {
    expect(stageKeyFrom("Legal Review", ["legal_review"])).toBe("legal_review_2");
    expect(stageKeyFrom("مراجعة", ["stage", "stage_2"])).toBe("stage_3");
  });
  it("accepts only lowercase ascii keys", () => {
    expect(isValidStageKey("legal_review")).toBe(true);
    expect(isValidStageKey("Legal")).toBe(false);
    expect(isValidStageKey("مرحلة")).toBe(false);
    expect(isValidStageKey("9lives")).toBe(false);
  });
  it("knows the two rungs the engine is written against", () => {
    expect(isTerminalStageKey("won")).toBe(true);
    expect(isTerminalStageKey("lost")).toBe(true);
    expect(isTerminalStageKey("quote")).toBe(false);
  });
});

describe("checkStage — the one gate add and edit share", () => {
  const base = { label: "مراجعة قانونية", weightPct: 70, position: 5, slaDays: 7 };
  it("accepts a sound stage and cleans its label", () => {
    const out = checkStage({ ...base, label: "  مراجعة   قانونية " }, ["contact"]);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.value.label).toBe("مراجعة قانونية");
      expect(out.value.slaDays).toBe(7);
      expect(out.value.active).toBe(true);
    }
  });
  it("refuses an empty or over-long label, in words", () => {
    expect(checkStage({ ...base, label: "  " }, [])).toMatchObject({ ok: false, field: "label" });
    expect(checkStage({ ...base, label: "ن".repeat(41) }, [])).toMatchObject({ ok: false, code: "invalid_label" });
  });
  it("refuses a weight or position outside its range", () => {
    expect(checkStage({ ...base, weightPct: 120 }, [])).toMatchObject({ ok: false, field: "weightPct" });
    expect(checkStage({ ...base, weightPct: 12.5 }, [])).toMatchObject({ ok: false, field: "weightPct" });
    expect(checkStage({ ...base, position: 0 }, [])).toMatchObject({ ok: false, field: "position" });
  });
  it("treats an empty SLA as «no deadline», not as zero days", () => {
    const out = checkStage({ ...base, slaDays: "" }, []);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.value.slaDays).toBeNull();
    expect(checkStage({ ...base, slaDays: 0 }, [])).toMatchObject({ ok: false, field: "slaDays" });
    expect(checkStage({ ...base, slaDays: 400 }, [])).toMatchObject({ ok: false, field: "slaDays" });
  });
  it("refuses a duplicate key on add but not on edit", () => {
    expect(checkStage({ ...base, key: "quote" }, ["quote"])).toMatchObject({ ok: false, code: "key_exists" });
    expect(checkStage({ ...base, key: "quote" }, ["quote"], "quote").ok).toBe(true);
  });
  it("protects the two terminal rungs from being paused or reweighted", () => {
    expect(checkStage({ label: "ربح", weightPct: 100, position: 7, active: false }, [], "won"))
      .toMatchObject({ ok: false, code: "terminal_stage", field: "active" });
    expect(checkStage({ label: "ربح", weightPct: 80, position: 7 }, [], "won"))
      .toMatchObject({ ok: false, field: "weightPct" });
    expect(checkStage({ label: "خسارة", weightPct: 5, position: 8 }, [], "lost"))
      .toMatchObject({ ok: false, field: "weightPct" });
    // relabelling a terminal rung is allowed — the KEY is the identity, not the word
    expect(checkStage({ label: "إغلاق ناجح", weightPct: 100, position: 7 }, [], "won").ok).toBe(true);
  });
});

describe("deleting a stage", () => {
  it("refuses the terminal rungs", () => {
    expect(checkStageDelete("won", 0)).toMatchObject({ ok: false, code: "terminal_stage" });
  });
  it("refuses a rung that still holds opportunities, and says to pause it instead", () => {
    const out = checkStageDelete("quote", 3);
    expect(out).toMatchObject({ ok: false, code: "stage_in_use" });
    if (!out.ok) expect(out.reason).toContain("أوقفها");
  });
  it("allows an empty custom rung", () => {
    expect(checkStageDelete("legal_review", 0)).toEqual({ ok: true });
  });
});

describe("a paused stage never traps the deals already on it", () => {
  it("is selectable for a line already there, and for nobody else", () => {
    const paused = stage({ key: "quote", active: false });
    expect(isStageSelectable(paused)).toBe(false);
    expect(isStageSelectable(paused, "quote")).toBe(true);
    expect(isStageSelectable(stage(), "contact")).toBe(true);
    expect(isStageSelectable(undefined, "quote")).toBe(false);
  });
});

describe("stageSlaState — «متأخرة» is per stage, and silence is not a deadline", () => {
  it("goes late on the SLA day, not after it", () => {
    expect(stageSlaState(stage({ slaDays: 14 }), 13).late).toBe(false);
    expect(stageSlaState(stage({ slaDays: 14 }), 14)).toMatchObject({ late: true, overBy: 0 });
    expect(stageSlaState(stage({ slaDays: 14 }), 20)).toMatchObject({ late: true, overBy: 6 });
  });
  it("never goes late without an SLA", () => {
    expect(stageSlaState(stage({ slaDays: null }), 900)).toMatchObject({ late: false, sla: null });
  });
  it("never calls a finished deal late", () => {
    expect(stageSlaState(stage({ key: "won", terminal: "won", slaDays: 1 }), 400).late).toBe(false);
  });
  it("treats a missing stage and rubbish input as not late", () => {
    expect(stageSlaState(undefined, 40).late).toBe(false);
    expect(stageSlaState(stage(), "x")).toMatchObject({ days: 0, late: false });
  });
});

describe("the team directory", () => {
  it("accepts a company address and rejects the shapes people actually mistype", () => {
    expect(isEmailShaped("sara@lean.sa")).toBe(true);
    expect(isEmailShaped("sara@lean")).toBe(false);
    expect(isEmailShaped("sara lean.sa")).toBe(false);
    expect(isEmailShaped("")).toBe(false);
  });
  it("requires a name, a shaped email and a known role", () => {
    expect(checkMember({ name: "", email: "a@b.co", role: "sales" })).toMatchObject({ field: "name" });
    expect(checkMember({ name: "سارة", email: "nope", role: "sales" })).toMatchObject({ field: "email" });
    expect(checkMember({ name: "سارة", email: "a@b.co", role: "ceo" })).toMatchObject({ field: "role" });
    const ok = checkMember({ name: " سارة  العتيبي ", email: " Sara@Lean.SA ", role: "support", divisionId: 3 });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value).toMatchObject({ name: "سارة العتيبي", email: "sara@lean.sa", role: "support", divisionId: 3, active: true });
  });
});

describe("divisions — the company's own units, not the market sector", () => {
  it("requires a unique name", () => {
    expect(checkDivision({ name: "  " }, [])).toMatchObject({ field: "name" });
    expect(checkDivision({ name: "الصحة" }, ["الصحة"])).toMatchObject({ code: "name_exists" });
    expect(checkDivision({ name: "الصحة" }, ["الصحة"], null, "الصحة").ok).toBe(true);
  });
  it("only accepts an active team member as its owner", () => {
    expect(checkDivision({ name: "الصحة", ownerMemberId: 4 }, [], null)).toMatchObject({ code: "unknown_member" });
    expect(checkDivision({ name: "الصحة", ownerMemberId: 4 }, [], { id: 4, active: false })).toMatchObject({ code: "inactive_member" });
    const ok = checkDivision({ name: "الصحة", ownerMemberId: 4 }, [], { id: 4, active: true });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.ownerMemberId).toBe(4);
  });
  it("refuses to delete a division that still owns products or people", () => {
    expect(checkDivisionDelete(2, 0)).toMatchObject({ code: "division_in_use" });
    expect(checkDivisionDelete(0, 1)).toMatchObject({ code: "division_in_use" });
    expect(checkDivisionDelete(0, 0)).toEqual({ ok: true });
  });
});

describe("escalation and «طلب دعم» point at a real person, by role", () => {
  const manager = { id: 1, role: "manager", active: true };
  const support = { id: 2, role: "support", active: true };
  const seller = { id: 3, role: "sales", active: true };
  it("accepts an escalation to a manager and a support request to support", () => {
    expect(checkEscalation({ kind: "escalation", memberId: 1, reason: "العميل ينتظر ردًا" }, manager).ok).toBe(true);
    expect(checkEscalation({ kind: "support", memberId: 2, reason: "تكامل متعثر" }, support).ok).toBe(true);
  });
  it("refuses a support request aimed at a seller, in words that name the right audience", () => {
    const out = checkEscalation({ kind: "support", memberId: 3, reason: "x" }, seller);
    expect(out).toMatchObject({ ok: false, code: "wrong_role" });
    if (!out.ok) expect(out.reason).toContain("الدعم الفني");
  });
  it("refuses an unknown or paused recipient", () => {
    expect(checkEscalation({ kind: "escalation", memberId: 9, reason: "x" }, null)).toMatchObject({ code: "unknown_member" });
    expect(checkEscalation({ kind: "escalation", memberId: 1, reason: "x" }, { ...manager, active: false }))
      .toMatchObject({ code: "inactive_member" });
  });
  it("requires a reason — the recipient reads it first", () => {
    expect(checkEscalation({ kind: "escalation", memberId: 1, reason: "   " }, manager)).toMatchObject({ field: "reason" });
  });
  it("refuses a kind nobody defined", () => {
    expect(checkEscalation({ kind: "shout", memberId: 1, reason: "x" }, manager)).toMatchObject({ field: "kind" });
  });
});

describe("the browser runs the same rules", () => {
  it("carries no reference the page does not define", () => {
    expect(checkConfigDomainClosure()).toEqual([]);
  });
  it("evaluates, and decides identically to Node", () => {
    const api = new Function(CONFIG_DOMAIN_JS +
      "\nreturn { checkStage, stageSlaState, checkEscalation, checkMember, isStageSelectable };")();
    expect(api.checkStage({ label: "مراجعة", weightPct: 70, position: 5 }, []).ok).toBe(true);
    expect(api.checkStage({ label: "", weightPct: 70, position: 5 }, []).field).toBe("label");
    expect(api.stageSlaState({ slaDays: 14, terminal: null }, 14).late).toBe(true);
    expect(api.checkMember({ name: "س", email: "x@y.co", role: "sales" }).ok).toBe(true);
    expect(api.checkEscalation({ kind: "support", memberId: 3, reason: "x" }, { id: 3, role: "sales", active: true }).code)
      .toBe("wrong_role");
    expect(api.isStageSelectable({ key: "quote", active: false }, "quote")).toBe(true);
  });
});
