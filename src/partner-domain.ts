// partner-domain.ts — sales and marketing partners (client A, BRD v1.0 §17 BR-PRT-001..004, slice S5).
//
// A partner is a contracted company that does the FIRST contact with customers for a product. Lean sets
// it a weekly contact target per product (BR-PRT-001), the partner records what each contact came to —
// interested, not interested, no reply — and the screen measures that against the target (BR-PRT-002).
// The partner's job ENDS at interest: an «مهتم» result hands the customer to the sales team as an
// opportunity whose source is that partner, and from then on the result is the sales team's record, not
// the partner's to change (BR-PRT-003). Follow-up is per contracted company, with the per-product and
// per-customer detail beneath it (BR-PRT-004).
//
// PURE. The functions in DOMAIN_FNS are serialised into the page, so the result sheet, the paste preview
// and the server refuse the same line with the same sentence. They may reference only their parameters
// and the injected constants.

// ---------------------------------------------------------------------------------------- vocabulary

export const PARTNER_KINDS = ["sales", "marketing"] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number];
export const PARTNER_KIND_LABELS: Readonly<Record<PartnerKind, string>> = { sales: "شريك مبيعات", marketing: "شريك تسويق" };

export const PARTNER_STATUSES = ["active", "paused"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
export const PARTNER_STATUS_LABELS: Readonly<Record<PartnerStatus, string>> = { active: "نشط", paused: "موقوف" };

/** What one contact came to. The BRD's own three (BR-PRT-002). */
export const PARTNER_RESULTS = ["interested", "not_interested", "no_reply"] as const;
export type PartnerResult = (typeof PARTNER_RESULTS)[number];
export const PARTNER_RESULT_LABELS: Readonly<Record<PartnerResult, string>> = { interested: "مهتم", not_interested: "غير مهتم", no_reply: "لم يرد" };

export const PARTNER_NAME_MAX = 120;
export const PARTNER_CONTACT_MAX = 80;
export const PARTNER_EMAIL_MAX = 120;
export const PARTNER_NOTE_MAX = 500;
export const PARTNER_TARGET_MAX = 100000;
export const RESULT_NAME_MAX = 120;
export const RESULT_NOTE_MAX = 500;
/** One paste or one request records at most this many contacts; a week's sheet from one partner is far below. */
export const RESULTS_BATCH_MAX = 500;

// ---------------------------------------------------------------------------------------- dates

/** A calendar day typed by a person, «YYYY-MM-DD», that exists. */
export function isIsoDay(s: unknown): boolean {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var y = Number(s.slice(0, 4)), m = Number(s.slice(5, 7)), d = Number(s.slice(8, 10));
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
  var dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** The Sunday that starts the week holding this day. Saudi working weeks run Sunday to Thursday, which is
 *  the week the prototype's «18 – 22 مايو» label names. */
export function weekStartOf(day: string): string {
  var dt = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))));
  dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
  return dt.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  var dt = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function isWeekStart(day: unknown): boolean {
  return isIsoDay(day) && weekStartOf(day as string) === day;
}

// ---------------------------------------------------------------------------------------- the rules

export type Check<T> = { ok: true; value: T } | { ok: false; field: string; reason: string };

export type PartnerValue = { name: string; kind: PartnerKind; contactName: string | null; phone: string | null; email: string | null; note: string | null };

/** BR-PRT-004: the partner is the contracted company. A name and a kind; the rest is how to reach it. */
export function checkPartner(input: { name?: unknown; kind?: unknown; contactName?: unknown; phone?: unknown; email?: unknown; note?: unknown }): Check<PartnerValue> {
  var t = function (v: unknown) { return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : ""; };
  var name = t(input.name), kind = t(input.kind), contact = t(input.contactName), phone = t(input.phone), email = t(input.email), note = t(input.note);
  if (name.length < 2) return { ok: false, field: "name", reason: "اكتب اسم الشريك" };
  if (name.length > PARTNER_NAME_MAX) return { ok: false, field: "name", reason: "اسم الشريك أطول من " + PARTNER_NAME_MAX + " حرفًا" };
  if (PARTNER_KINDS.indexOf(kind as PartnerKind) < 0) return { ok: false, field: "kind", reason: "اختر نوع الشريك" };
  if (contact.length > PARTNER_CONTACT_MAX) return { ok: false, field: "contactName", reason: "اسم المسؤول أطول من " + PARTNER_CONTACT_MAX + " حرفًا" };
  if (phone) {
    var digits = phone.replace(/[٠-٩]/g, function (c) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(c)); }).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return { ok: false, field: "phone", reason: "رقم الهاتف غير صالح" };
  }
  if (email && (email.length > PARTNER_EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))) return { ok: false, field: "email", reason: "البريد الإلكتروني غير صالح" };
  if (note.length > PARTNER_NOTE_MAX) return { ok: false, field: "note", reason: "الملاحظة أطول من " + PARTNER_NOTE_MAX + " حرفًا" };
  return { ok: true, value: { name: name, kind: kind as PartnerKind, contactName: contact || null, phone: phone || null, email: email || null, note: note || null } };
}

/** BR-PRT-001: a weekly contact target for one product. Zero removes the target. */
export function checkTarget(input: { product?: unknown; target?: unknown }, products: readonly string[]): Check<{ product: string; target: number }> {
  var product = typeof input.product === "string" ? input.product : "";
  if (products.indexOf(product) < 0) return { ok: false, field: "product", reason: "منتج غير معروف" };
  var raw = input.target;
  var s = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (s === "") return { ok: true, value: { product: product, target: 0 } };
  if (!/^\d+$/.test(s)) return { ok: false, field: "target", reason: "المستهدف عدد صحيح من المنشآت" };
  var n = Number(s);
  if (n > PARTNER_TARGET_MAX) return { ok: false, field: "target", reason: "المستهدف أكبر من الحد المسموح" };
  return { ok: true, value: { product: product, target: n } };
}

export type ResultValue = { product: string; accountName: string; phone: string; result: PartnerResult; contactedOn: string; note: string | null };

/** One recorded contact. The phone is required: it is how the customer joins its account, its
 *  conversations and the opportunity the interest becomes. Saudi mobile lengths as the account form. */
export function checkResult(input: { product?: unknown; accountName?: unknown; phone?: unknown; result?: unknown; contactedOn?: unknown; note?: unknown },
  products: readonly string[], today: string): Check<ResultValue> {
  var t = function (v: unknown) { return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : ""; };
  var product = typeof input.product === "string" ? input.product : "";
  if (products.indexOf(product) < 0) return { ok: false, field: "product", reason: "اختر المنتج" };
  var name = t(input.accountName);
  if (name.length < 2) return { ok: false, field: "accountName", reason: "اكتب اسم المنشأة" };
  if (name.length > RESULT_NAME_MAX) return { ok: false, field: "accountName", reason: "اسم المنشأة أطول من " + RESULT_NAME_MAX + " حرفًا" };
  var digits = t(input.phone).replace(/[٠-٩]/g, function (c) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(c)); }).replace(/[۰-۹]/g, function (c) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)); }).replace(/\D/g, "");
  if (!digits) return { ok: false, field: "phone", reason: "اكتب رقم جوال المنشأة" };
  if (digits.length < 8 || digits.length > 15) return { ok: false, field: "phone", reason: "رقم غير صالح — عدد الأرقام غير صحيح" };
  if (digits.indexOf("05") === 0 && digits.length !== 10) return { ok: false, field: "phone", reason: "رقم الجوال السعودي يبدأ بـ05 ويتكون من 10 أرقام" };
  if (digits.indexOf("9665") === 0 && digits.length !== 12) return { ok: false, field: "phone", reason: "رقم الجوال السعودي الدولي يتكون من 12 رقمًا (9665…)" };
  // «5…» without its zero is 9 digits; a 10-digit «5…» is a typo that would open an account on a number no
  // conversation will ever match.
  if (digits.charAt(0) === "5" && digits.length !== 9 && digits.length < 11) return { ok: false, field: "phone", reason: "رقم الجوال السعودي بدون الصفر يتكون من 9 أرقام" };
  var result = t(input.result);
  if (PARTNER_RESULTS.indexOf(result as PartnerResult) < 0) return { ok: false, field: "result", reason: "اختر نتيجة التواصل" };
  var on = t(input.contactedOn);
  if (!isIsoDay(on)) return { ok: false, field: "contactedOn", reason: "تاريخ التواصل غير صالح" };
  if (on > today) return { ok: false, field: "contactedOn", reason: "تاريخ التواصل في المستقبل" };
  var note = t(input.note);
  if (note.length > RESULT_NOTE_MAX) return { ok: false, field: "note", reason: "الملاحظة أطول من " + RESULT_NOTE_MAX + " حرفًا" };
  return { ok: true, value: { product: product, accountName: name, phone: digits, result: result as PartnerResult, contactedOn: on, note: note || null } };
}

/** BR-PRT-003: once an interest has been handed to sales, the partner's record of it is closed. */
export function canChangeResult(row: { oppId: number | null }): boolean {
  return row.oppId == null;
}

/** Reads a result word the way a partner's sheet writes it. Unknown words are null, never guessed. */
export function resultFromWord(word: unknown): PartnerResult | null {
  var w = String(word == null ? "" : word).trim().toLowerCase().replace(/[ً-ْ]/g, "").replace(/\s+/g, " ");
  if (w === "مهتم" || w === "مهتمة" || w === "interested" || w === "نعم") return "interested";
  if (w === "غير مهتم" || w === "غير مهتمة" || w === "not interested" || w === "not_interested" || w === "لا" || w === "رفض") return "not_interested";
  if (w === "لم يرد" || w === "لم ترد" || w === "لا يرد" || w === "no reply" || w === "no_reply" || w === "لا رد" || w === "بدون رد") return "no_reply";
  return null;
}

export type PasteLine = { line: number; accountName: string; phone: string; result: string; note: string };

/** «الاسم، الجوال، النتيجة[، ملاحظة]» per line. A line copied from a spreadsheet is split on its TABS only, so a
 *  comma inside a name («مستشفى, فرع الرياض») stays in the name; a typed line is split on a comma, an Arabic
 *  comma or either semicolon. A header naming the columns on the first non-empty line is skipped. The lines are
 *  only SPLIT here; checkResult judges each, so the preview and the server say the same thing. */
export function splitPasteLines(textIn: unknown): PasteLine[] {
  var s = typeof textIn === "string" ? textIn : "";
  var out: PasteLine[] = [];
  var lines = s.split(/\r?\n/);
  var seenFirst = false;
  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i].trim();
    if (!raw) continue;
    var parts = (lines[i].indexOf("\t") >= 0 ? lines[i].split("\t") : raw.split(/،|;|؛|,/)).map(function (p) { return p.trim(); });
    var r = String(parts[2] || "").trim();
    var first = !seenFirst; seenFirst = true;
    if (first && /اسم|منشأة|المنشأة|العميل|name/i.test(parts[0] || "") && /جوال|هاتف|phone|رقم/i.test(parts[1] || "")) continue;
    var mapped = resultFromWord(r);
    out.push({ line: i + 1, accountName: parts[0] || "", phone: parts[1] || "", result: mapped || r, note: parts.slice(3).join("، ") });
  }
  return out;
}

// ---------------------------------------------------------------------------------------- the week

export type TargetRow = { partnerId: number; product: string; target: number };
export type ResultRow = { partnerId: number; product: string; phone: string; result: string; contactedOn: string; oppId: number | null; createdAt?: number };
export type WeekLine = { target: number; contacted: number; contactedTargeted: number; interested: number; notInterested: number; noReply: number; handedOver: number; pct: number | null };

/**
 * BR-PRT-002 for one set of targets and results (already filtered to a week, a partner and a product as the
 * caller wants). «تم التواصل» counts contacts per partner, product and customer, not attempts: a phone reached
 * twice in the week for one product is one contact, and its result is the latest one recorded that week (a
 * no-reply on Sunday that became interested on Tuesday is interested) — except that an interest already handed
 * to sales stands: the partner's part ended there, and a later «غير مهتم» must not take it off the week.
 * Achievement is the contacts made FOR TARGETED products ÷ the target, so ten contacts for an untargeted product
 * cannot fill a target nobody worked on. It may pass 100٪; it is null only when there is no target.
 */
export function summarizeWeek(targets: readonly TargetRow[], results: readonly ResultRow[]): WeekLine {
  var target = 0;
  var targeted: Record<string, boolean> = {};
  for (var i = 0; i < targets.length; i++) {
    var tv = Number(targets[i].target) || 0;
    target += tv;
    if (tv > 0) targeted[targets[i].partnerId + "|" + targets[i].product] = true;
  }
  var latest: Record<string, ResultRow> = {};
  for (var j = 0; j < results.length; j++) {
    var r = results[j];
    var key = r.partnerId + "|" + r.product + "|" + r.phone;
    var cur = latest[key];
    var newer = !cur || r.contactedOn > cur.contactedOn || (r.contactedOn === cur.contactedOn && (r.createdAt || 0) > (cur.createdAt || 0));
    if (!cur || (cur.oppId == null && (r.oppId != null || newer))) latest[key] = r;
  }
  var line = { target: target, contacted: 0, contactedTargeted: 0, interested: 0, notInterested: 0, noReply: 0, handedOver: 0, pct: null as number | null };
  for (var k in latest) {
    var x = latest[k];
    line.contacted++;
    if (targeted[x.partnerId + "|" + x.product]) line.contactedTargeted++;
    if (x.result === "interested") line.interested++;
    else if (x.result === "not_interested") line.notInterested++;
    else line.noReply++;
    if (x.oppId != null) line.handedOver++;
  }
  line.pct = target > 0 ? Math.round((line.contactedTargeted / target) * 100) : null;
  return line;
}

// ---------------------------------------------------------------------------------------- the seam

const DOMAIN_FNS = [isIsoDay, weekStartOf, addDays, isWeekStart, checkPartner, checkTarget, checkResult, canChangeResult, resultFromWord, splitPasteLines, summarizeWeek] as const;

export const PARTNER_DOMAIN_JS: string = [
  "/* ===== partner-domain (generated from src/partner-domain.ts — do not edit here) ===== */",
  "var PARTNER_KINDS = " + JSON.stringify(PARTNER_KINDS) + ";",
  "var PARTNER_KIND_LABELS = " + JSON.stringify(PARTNER_KIND_LABELS) + ";",
  "var PARTNER_STATUSES = " + JSON.stringify(PARTNER_STATUSES) + ";",
  "var PARTNER_STATUS_LABELS = " + JSON.stringify(PARTNER_STATUS_LABELS) + ";",
  "var PARTNER_RESULTS = " + JSON.stringify(PARTNER_RESULTS) + ";",
  "var PARTNER_RESULT_LABELS = " + JSON.stringify(PARTNER_RESULT_LABELS) + ";",
  "var PARTNER_NAME_MAX = " + PARTNER_NAME_MAX + ";",
  "var PARTNER_CONTACT_MAX = " + PARTNER_CONTACT_MAX + ";",
  "var PARTNER_EMAIL_MAX = " + PARTNER_EMAIL_MAX + ";",
  "var PARTNER_NOTE_MAX = " + PARTNER_NOTE_MAX + ";",
  "var PARTNER_TARGET_MAX = " + PARTNER_TARGET_MAX + ";",
  "var RESULT_NAME_MAX = " + RESULT_NAME_MAX + ";",
  "var RESULT_NOTE_MAX = " + RESULT_NOTE_MAX + ";",
  "var RESULTS_BATCH_MAX = " + RESULTS_BATCH_MAX + ";",
  ...DOMAIN_FNS.map((fn) => fn.toString()),
].join("\n");
