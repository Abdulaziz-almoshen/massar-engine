// opp-work-domain.ts — the work recorded ON an opportunity (client A, BRD v1.0 §15, slice S3): why a deal
// was lost (BR-OPP-006, BRULE-009, BR-RPT-003), the meetings, calls and next actions around it
// (BR-OPP-003), and the quotes sent for it (BR-OPP-004).
//
// PURE. The functions in DOMAIN_FNS are serialised into the page through Function.prototype.toString(),
// so the lost-reason dialog, the activity form and the quote form refuse input with the same sentence the
// server does. They may reference only their parameters and the injected constants.

import { STAGE_OUTCOMES } from "./sales-domain.js";

// ------------------------------------------------------------------------------------------ loss reasons

/** The reasons a person picks when closing a line as lost. They ARE the ladder's «lost» outcomes (one
 *  vocabulary: «الخسائر حسب السبب» reads these keys from the stage ledger, whether a rep recorded the
 *  outcome from /rep or an admin closed the line on the board). The label drops the «خسارة – » prefix
 *  because the dialog's title already says it. */
export const LOSS_REASONS: readonly { key: string; label: string; hint: string }[] = STAGE_OUTCOMES
  .filter((o) => o.stage === "lost")
  .map((o) => ({ key: o.key, label: o.label.replace(/^خسارة\s*[–-]\s*/, ""), hint: o.reason }));

/** Every key a stored lost_reason may carry and its label: the admin picker's set plus the lost-kind
 *  outcomes a rep records on earlier rungs («غير مهتم», «فشل التكامل»…), which also close a line. */
export const LOSS_REASON_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  STAGE_OUTCOMES.filter((o) => o.kind === "lost").map((o) => [o.key, o.label.replace(/^خسارة\s*[–-]\s*/, "")]));

export const LOSS_OTHER_KEY = "lost_other";
export const LOSS_NOTE_MAX = 300;

/** BRULE-009: a line closed as lost carries a reason from the list; «سبب آخر» carries a sentence too. */
export function checkLossReason(reason: unknown, note: unknown): { ok: true; reason: string; note: string | null } | { ok: false; field: string; message: string } {
  var r = typeof reason === "string" ? reason : "";
  var n = typeof note === "string" ? note.trim() : "";
  var known = false;
  for (var i = 0; i < LOSS_REASONS.length; i++) if (LOSS_REASONS[i].key === r) known = true;
  if (!r) return { ok: false, field: "lost_reason", message: "اختر سبب الخسارة — يُسجَّل في تقرير الخسائر" };
  if (!known && !Object.prototype.hasOwnProperty.call(LOSS_REASON_LABELS, r)) return { ok: false, field: "lost_reason", message: "سبب خسارة غير معروف" };
  if (r === LOSS_OTHER_KEY && !n) return { ok: false, field: "lost_note", message: "اكتب السبب في سطر" };
  if (n.length > LOSS_NOTE_MAX) return { ok: false, field: "lost_note", message: "الملاحظة أطول من " + LOSS_NOTE_MAX + " حرفًا" };
  return { ok: true, reason: r, note: n || null };
}

/** Whether a stage change closes a line as lost — the one move that must carry a reason. Re-saving a line
 *  that is already lost is not a close. */
export function isLossClose(fromStage: string, toStage: string): boolean {
  return toStage === "lost" && fromStage !== "lost";
}

// ------------------------------------------------------------------------------------------ activities

export const ACTIVITY_KINDS = ["meeting", "call", "presentation", "email", "note"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export const ACTIVITY_KIND_LABELS: Readonly<Record<ActivityKind, string>> = {
  meeting: "اجتماع", call: "مكالمة", presentation: "عرض تقديمي", email: "بريد", note: "ملاحظة",
};
export const ACTIVITY_SUMMARY_MAX = 600;
export const ACTIVITY_NEXT_MAX = 200;
export const ACTIVITY_OWNER_MAX = 80;

export type ActivityInput = { kind?: unknown; occurredOn?: unknown; summary?: unknown; nextStep?: unknown; nextOn?: unknown; owner?: unknown; dept?: unknown };
export type ActivityValue = { kind: ActivityKind; occurredOn: string; summary: string; nextStep: string | null; nextOn: string | null; owner: string | null; dept: string | null };

/** BR-OPP-003. Dates are calendar days (YYYY-MM-DD) as a person types them, compared as strings. A meeting
 *  may be logged for today or the past, not the future — a planned meeting is a NEXT STEP with a date.
 *  A next-step date needs the step it dates, and cannot precede the activity. */
export function checkActivity(input: ActivityInput, todayIso: string, departments: readonly string[]): { ok: true; value: ActivityValue } | { ok: false; field: string; message: string } {
  var src = input && typeof input === "object" ? input : {};
  var text = function (v: unknown) { return typeof v === "string" ? v.trim() : ""; };
  /* A REAL calendar day in a sane range: JavaScript rolls «2026-02-31» over to March, so the round trip is
     the test, not whether a Date could be built (review). */
  var isDay = function (s: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + "T00:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && s >= "2000-01-01" && s <= "2100-12-31";
  };
  var kind = text(src.kind);
  if (ACTIVITY_KINDS.indexOf(kind as ActivityKind) < 0) return { ok: false, field: "kind", message: "اختر نوع النشاط" };
  var on = text(src.occurredOn);
  if (!isDay(on)) return { ok: false, field: "occurredOn", message: "تاريخ النشاط مطلوب" };
  if (on > todayIso) return { ok: false, field: "occurredOn", message: "لا يُسجَّل نشاط بتاريخ قادم — اجعله خطوة تالية" };
  var summary = text(src.summary);
  if (!summary) return { ok: false, field: "summary", message: "اكتب ما دار في النشاط" };
  if (summary.length > ACTIVITY_SUMMARY_MAX) return { ok: false, field: "summary", message: "الملخص أطول من " + ACTIVITY_SUMMARY_MAX + " حرفًا" };
  var next = text(src.nextStep);
  if (next.length > ACTIVITY_NEXT_MAX) return { ok: false, field: "nextStep", message: "الخطوة التالية أطول من " + ACTIVITY_NEXT_MAX + " حرفًا" };
  var nextOn = text(src.nextOn);
  if (nextOn && !isDay(nextOn)) return { ok: false, field: "nextOn", message: "تاريخ الخطوة التالية غير صحيح" };
  if (nextOn && !next) return { ok: false, field: "nextStep", message: "اكتب الخطوة التي يخصّها هذا التاريخ" };
  if (nextOn && nextOn < on) return { ok: false, field: "nextOn", message: "موعد الخطوة التالية قبل تاريخ النشاط" };
  var owner = text(src.owner);
  if (owner.length > ACTIVITY_OWNER_MAX) return { ok: false, field: "owner", message: "اسم المسؤول أطول من " + ACTIVITY_OWNER_MAX + " حرفًا" };
  var dept = text(src.dept);
  if (dept && departments.indexOf(dept) < 0) return { ok: false, field: "dept", message: "إدارة غير معروفة" };
  return { ok: true, value: { kind: kind as ActivityKind, occurredOn: on, summary: summary, nextStep: next || null, nextOn: nextOn || null, owner: owner || null, dept: dept || null } };
}

// ------------------------------------------------------------------------------------------ quotes

export const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export const QUOTE_STATUS_LABELS: Readonly<Record<QuoteStatus, string>> = {
  draft: "مسودة", sent: "أُرسل للعميل", accepted: "قبله العميل", rejected: "رفضه العميل",
};
export const QUOTE_NOTE_MAX = 300;

export type QuoteInput = { salePrice?: unknown; years?: unknown; qty?: unknown; discount?: unknown; validUntil?: unknown; note?: unknown };
export type QuoteValue = { salePrice: number; years: number; qty: number; discount: number; validUntil: string | null; note: string | null };

/** BR-OPP-004. The same arithmetic as a line (سعر سنوي × سنوات × كمية × (1 − خصم)) so an accepted quote can
 *  become the line's value without a conversion. A validity date cannot be in the past. */
export function checkQuote(input: QuoteInput, todayIso: string): { ok: true; value: QuoteValue } | { ok: false; field: string; message: string } {
  var src = input && typeof input === "object" ? input : {};
  /* Decimal digits only: Number("0x10") is 16 and Number("1e3") is 1000, and neither is a price anyone typed. */
  var num = function (v: unknown) { return typeof v === "number" ? v : typeof v === "string" && /^\s*\d+(\.\d+)?\s*$/.test(v) ? Number(v) : NaN; };
  var price = num(src.salePrice);
  if (!(price > 0) || price > 1e10) return { ok: false, field: "salePrice", message: "أدخل السعر السنوي" };
  var years = src.years == null || src.years === "" ? 1 : num(src.years);
  if (!(years >= 1 && years <= 10 && Math.floor(years) === years)) return { ok: false, field: "years", message: "السنوات من 1 إلى 10" };
  var qty = src.qty == null || src.qty === "" ? 1 : num(src.qty);
  /* The line's own bounds (validateOppLine: qty ≤ 10,000, whole-percent discount in an INTEGER column), so an
     accepted quote can always become the line's price — 12.5% used to fail that write with a 500 (review). */
  if (!(qty >= 1 && qty <= 10000 && Math.floor(qty) === qty)) return { ok: false, field: "qty", message: "الكمية عدد صحيح من 1 إلى 10,000" };
  var discount = src.discount == null || src.discount === "" ? 0 : num(src.discount);
  if (!(discount >= 0 && discount <= 100 && Math.floor(discount) === discount)) return { ok: false, field: "discount", message: "الخصم نسبة صحيحة من 0 إلى 100٪" };
  if (src.validUntil != null && typeof src.validUntil !== "string") return { ok: false, field: "validUntil", message: "تاريخ الصلاحية غير صحيح" };
  var vu = typeof src.validUntil === "string" ? src.validUntil.trim() : "";
  var vd = vu ? new Date(vu + "T00:00:00Z") : null;
  if (vu && !(/^\d{4}-\d{2}-\d{2}$/.test(vu) && vd && !isNaN(vd.getTime()) && vd.toISOString().slice(0, 10) === vu && vu <= "2100-12-31")) return { ok: false, field: "validUntil", message: "تاريخ الصلاحية غير صحيح" };
  if (vu && vu < todayIso) return { ok: false, field: "validUntil", message: "تاريخ الصلاحية مضى" };
  if (src.note != null && typeof src.note !== "string") return { ok: false, field: "note", message: "الملاحظة نص" };
  var note = typeof src.note === "string" ? src.note.trim() : "";
  if (note.length > QUOTE_NOTE_MAX) return { ok: false, field: "note", message: "الملاحظة أطول من " + QUOTE_NOTE_MAX + " حرفًا" };
  return { ok: true, value: { salePrice: Math.round(price), years: years, qty: qty, discount: discount, validUntil: vu || null, note: note || null } };
}

/** A quote moves forward only: مسودة → أُرسل → قبله/رفضه. A decided quote is history, and a new price is a
 *  new quote — so «what did we offer in May» always has an answer. */
export function canMoveQuote(from: string, to: string): boolean {
  if (from === "draft") return to === "sent" || to === "rejected";
  if (from === "sent") return to === "accepted" || to === "rejected";
  return false;
}

// ------------------------------------------------------------------------------------------ the seam

const DOMAIN_FNS = [checkLossReason, isLossClose, checkActivity, checkQuote, canMoveQuote] as const;
const INJECTED = ["LOSS_REASONS", "LOSS_REASON_LABELS", "LOSS_OTHER_KEY", "LOSS_NOTE_MAX", "ACTIVITY_KINDS", "ACTIVITY_KIND_LABELS",
  "ACTIVITY_SUMMARY_MAX", "ACTIVITY_NEXT_MAX", "ACTIVITY_OWNER_MAX", "QUOTE_STATUSES", "QUOTE_STATUS_LABELS", "QUOTE_NOTE_MAX"] as const;

export const OPP_WORK_DOMAIN_JS: string = [
  "/* ===== opp-work-domain (generated from src/opp-work-domain.ts — do not edit here) ===== */",
  "var LOSS_REASONS = " + JSON.stringify(LOSS_REASONS) + ";",
  "var LOSS_REASON_LABELS = " + JSON.stringify(LOSS_REASON_LABELS) + ";",
  "var LOSS_OTHER_KEY = " + JSON.stringify(LOSS_OTHER_KEY) + ";",
  "var LOSS_NOTE_MAX = " + LOSS_NOTE_MAX + ";",
  "var ACTIVITY_KINDS = " + JSON.stringify(ACTIVITY_KINDS) + ";",
  "var ACTIVITY_KIND_LABELS = " + JSON.stringify(ACTIVITY_KIND_LABELS) + ";",
  "var ACTIVITY_SUMMARY_MAX = " + ACTIVITY_SUMMARY_MAX + ";",
  "var ACTIVITY_NEXT_MAX = " + ACTIVITY_NEXT_MAX + ";",
  "var ACTIVITY_OWNER_MAX = " + ACTIVITY_OWNER_MAX + ";",
  "var QUOTE_STATUSES = " + JSON.stringify(QUOTE_STATUSES) + ";",
  "var QUOTE_STATUS_LABELS = " + JSON.stringify(QUOTE_STATUS_LABELS) + ";",
  "var QUOTE_NOTE_MAX = " + QUOTE_NOTE_MAX + ";",
  ...DOMAIN_FNS.map((fn) => fn.toString()),
].join("\n");

export function checkOppWorkDomainClosure(): string[] {
  const problems: string[] = [];
  for (const fn of DOMAIN_FNS) {
    const src = fn.toString().replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ").replace(/"[^"\n]*"/g, '""');
    for (const id of src.match(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g) ?? []) {
      if (/^[A-Z][A-Z0-9_]+$/.test(id) && (INJECTED as readonly string[]).indexOf(id) === -1 && !/^(NaN|UTC|T00)$/.test(id)) problems.push(fn.name + " references " + id);
      if (/^(STAGE_OUTCOMES|calculateLineValue)$/.test(id)) problems.push(fn.name + " references " + id);
    }
  }
  return problems;
}
