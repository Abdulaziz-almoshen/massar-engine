// indicator-domain.ts — «مؤشرات استخدام العملاء»: what an indicator is, how an uploaded row finds its
// customer, and how indicators become campaign opportunities a product manager can argue with.
//
// WHY THIS MODULE EXISTS (client A's first feedback, BRD v1.0, 2026-09-15). The BRD's value journey
// runs «معرفة المنتج ← العملاء ← مؤشرات استخدام العملاء ← اكتشاف فرصة استهداف ← إنشاء حملة». Massar
// had every link except the third and fourth: usage data sat in spreadsheets, and targeting was
// «individual knowledge and effort» (BRD §3).
//
// THE DECISION THAT SHAPES EVERYTHING BELOW: an indicator carries a typed SIGNAL — what it MEANS for a
// customer to be in it. The prototype's form has a name, a description and a product; from those
// alone «analysis» could only be a model reading the description, i.e. a guess presented as a
// finding. DEC-02 in the BRD leaves «rule-based or AI scoring» open; this is rule-based, because every
// suggestion must say which indicators produced it and how many customers it touches (BR-IND-008,
// NFR-009), and a rule can say that exactly. AI scoring can be layered on later (Release 3).
//
// Pure: no I/O. The form rules are serialised into the page so the control the screen disables and
// the write the server refuses give the same reason in the same words.

import { normalizePhone } from "./audience.js";

export type Rejection = { ok: false; code: string; reason: string; field: string };

// ---------------------------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------------------------

export const INDICATOR_STATUSES: readonly string[] = ["active", "inactive", "draft"];
export const INDICATOR_STATUS_LABELS: Readonly<Record<string, string>> = {
  active: "نشط", inactive: "غير نشط", draft: "مسودة",
};

/** What membership means. The rules read these keys; the labels are what the manager chooses from. */
export const INDICATOR_SIGNALS: readonly string[] = ["high_usage", "usage_no_integration", "integrated", "uses", "not_using", "other"];
/* «usage_no_integration» exists because the client's own sample indicators are already the finished
   list — «استخدام مرتفع ولا يوجد ربط», «منشآت طبية ذات استخدام مرتفع بدون HIS» (BRD §10.1). Forcing
   that list into «high_usage» made the card claim «we don't know who is integrated» about a list
   whose whole definition is that nobody in it is. (UX review, 2026-09-15.) */
export const INDICATOR_SIGNAL_LABELS: Readonly<Record<string, string>> = {
  high_usage: "استخدام مرتفع للمنتج",
  usage_no_integration: "استخدام مرتفع دون ربط (القائمة جاهزة)",
  integrated: "مرتبطون تقنيًا بالمنتج",
  uses: "مشتركون في المنتج",
  not_using: "غير مشتركين في المنتج",
  other: "شريحة عامة (بلا اقتراح تلقائي)",
};

/** The same meanings, short enough for a table column. */
export const INDICATOR_SIGNAL_SHORT: Readonly<Record<string, string>> = {
  high_usage: "استخدام مرتفع", usage_no_integration: "مرتفع دون ربط", integrated: "مرتبطون تقنيًا", uses: "مشتركون", not_using: "غير مشتركين", other: "شريحة عامة",
};

export const CUSTOMER_TYPES: readonly string[] = ["medical", "company", "all"];
export const CUSTOMER_TYPE_LABELS: Readonly<Record<string, string>> = {
  medical: "منشآت طبية", company: "شركات", all: "جميع العملاء",
};

/** BR-CAM-001's objectives, keyed so a suggestion can prefill one. */
export const CAMPAIGN_OBJECTIVES: readonly string[] = ["subscriptions", "awareness", "non_subscribers", "reactivation", "cross_sell", "custom"];
export const CAMPAIGN_OBJECTIVE_LABELS: Readonly<Record<string, string>> = {
  subscriptions: "زيادة الاشتراكات", awareness: "تعريف بخدمة", non_subscribers: "استهداف غير المشتركين",
  reactivation: "إعادة التنشيط", cross_sell: "البيع المتقاطع", custom: "هدف مخصص",
};

export const INDICATOR_NAME_MAX = 80;
export const INDICATOR_DESC_MAX = 400;
export const INDICATOR_MEMBERS_MAX = 5000;
/** Data older than this is still used, but every suggestion built on it says so. */
export const INDICATOR_STALE_DAYS = 90;
/** DEC-03 default: a customer approached about a product is not suggested again for that product
 *  inside this window. Overridable by SUPPRESSION_DAYS; the screen states the number in force. */
export const DEFAULT_SUPPRESSION_DAYS = 30;

// ---------------------------------------------------------------------------------------------
// The form (serialised)
// ---------------------------------------------------------------------------------------------

export type IndicatorInput = {
  name?: unknown; description?: unknown; product?: unknown; signal?: unknown; customerType?: unknown;
  status?: unknown; periodFrom?: unknown; periodTo?: unknown; dataUpdatedAt?: unknown;
};
export type IndicatorValue = {
  name: string; description: string | null; product: string | null; signal: string; customerType: string;
  status: string; periodFrom: string | null; periodTo: string | null; dataUpdatedAt: string;
};

/** A calendar date as the form and the table hold it. Round-tripped through Date.UTC so «2026-02-31»
 *  is refused instead of silently becoming March 3rd. */
export function isIsoDate(v: unknown): boolean {
  const s = String(v == null ? "" : v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d && y >= 2000 && y <= 2100;
}

/** One gate for create, edit and draft. `products` is the live catalogue, so an indicator can never be
 *  linked to a product nothing else in Massar knows. A DRAFT needs only a name: it exists so a manager
 *  can stop halfway through a long upload, and refusing it for a missing product defeats that. */
export function checkIndicator(input: IndicatorInput, products: readonly string[], todayIso: string, asDraft: boolean): { ok: true; value: IndicatorValue } | Rejection {
  const name = String(input.name == null ? "" : input.name).replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, code: "invalid_name", reason: "اسم المؤشر مطلوب.", field: "name" };
  if (name.length > INDICATOR_NAME_MAX) return { ok: false, code: "invalid_name", reason: "اسم المؤشر 80 حرفًا كحدٍّ أقصى.", field: "name" };
  const description = String(input.description == null ? "" : input.description).trim();
  if (description.length > INDICATOR_DESC_MAX) return { ok: false, code: "invalid_description", reason: "الوصف 400 حرف كحدٍّ أقصى.", field: "description" };
  const product = String(input.product == null ? "" : input.product).trim();
  if (!product && !asDraft) return { ok: false, code: "invalid_product", reason: "اختر المنتج المرتبط.", field: "product" };
  if (product && products.indexOf(product) === -1) return { ok: false, code: "unknown_product", reason: "المنتج غير موجود في «المنتجات».", field: "product" };
  // The meaning is REQUIRED on a saved indicator: an unlabelled one feeds no rule, and a default of
  // «other» would let a manager believe Massar is analysing data it is silently ignoring.
  const signal = String(input.signal == null ? "" : input.signal) || (asDraft ? "other" : "");
  if (INDICATOR_SIGNALS.indexOf(signal) === -1) return { ok: false, code: "invalid_signal", reason: "حدّد ماذا يعني وجود العميل في هذا المؤشر.", field: "signal" };
  const customerType = String(input.customerType == null ? "" : input.customerType) || "all";
  if (CUSTOMER_TYPES.indexOf(customerType) === -1) return { ok: false, code: "invalid_customer_type", reason: "نوع العملاء غير معروف.", field: "customerType" };
  let status = asDraft ? "draft" : String(input.status == null ? "" : input.status) || "active";
  if (!asDraft && status === "draft") status = "active";
  if (INDICATOR_STATUSES.indexOf(status) === -1) return { ok: false, code: "invalid_status", reason: "حالة المؤشر غير معروفة.", field: "status" };
  const from = String(input.periodFrom == null ? "" : input.periodFrom).trim();
  const to = String(input.periodTo == null ? "" : input.periodTo).trim();
  if (from && !isIsoDate(from)) return { ok: false, code: "invalid_period", reason: "«من تاريخ» ليس تاريخًا صحيحًا.", field: "periodFrom" };
  if (to && !isIsoDate(to)) return { ok: false, code: "invalid_period", reason: "«إلى تاريخ» ليس تاريخًا صحيحًا.", field: "periodTo" };
  if (from && to && from > to) return { ok: false, code: "invalid_period", reason: "بداية فترة البيانات بعد نهايتها.", field: "periodTo" };
  // Required on a saved indicator, never defaulted: silently stamping today on data the manager did not
  // date would make old data look fresh to every suggestion built on it (QA, BR-IND-004).
  const updated = String(input.dataUpdatedAt == null ? "" : input.dataUpdatedAt).trim() || (asDraft ? todayIso : "");
  if (!updated) return { ok: false, code: "invalid_updated", reason: "تاريخ تحديث البيانات مطلوب.", field: "dataUpdatedAt" };
  if (!isIsoDate(updated)) return { ok: false, code: "invalid_updated", reason: "تاريخ تحديث البيانات ليس تاريخًا صحيحًا.", field: "dataUpdatedAt" };
  if (updated > todayIso) return { ok: false, code: "invalid_updated", reason: "تاريخ تحديث البيانات في المستقبل.", field: "dataUpdatedAt" };
  return { ok: true, value: { name, description: description || null, product: product || null, signal, customerType, status, periodFrom: from || null, periodTo: to || null, dataUpdatedAt: updated } };
}

/** Two indicators with one name make every suggestion reason ambiguous — «في «X» ولا يظهرون في «X»»
 *  was measured in review. Compared after folding, so «مستشفى»/«مستشفي» collide as a human would read them. */
export function isDuplicateIndicatorName(name: unknown, existing: readonly { id: number; name: string }[], currentId: number): boolean {
  const fold = function (v: unknown): string {
    return String(v == null ? "" : v).replace(/[\u064B-\u0652\u0670\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
      .toLowerCase().replace(/\s+/g, " ").trim();
  };
  const want = fold(name);
  if (!want) return false;
  for (let i = 0; i < existing.length; i++) if (existing[i].id !== currentId && fold(existing[i].name) === want) return true;
  return false;
}

/** A saved (non-draft) indicator must hold at least one customer — an empty active indicator is a row
 *  the opportunity rules read as «nobody», which is indistinguishable from «not measured». */
export function checkMemberCount(n: unknown, asDraft: boolean): { ok: true } | Rejection {
  const c = Number(n) || 0;
  if (c > INDICATOR_MEMBERS_MAX) return { ok: false, code: "too_many_members", reason: "5000 عميل كحدٍّ أقصى في المؤشر الواحد.", field: "members" };
  if (!asDraft && c < 1) return { ok: false, code: "no_members", reason: "أضف عميلًا واحدًا على الأقل — برفع ملف أو بالاختيار اليدوي.", field: "members" };
  return { ok: true };
}

/** Days since the data was measured, and whether a suggestion built on it must say it is old. */
export function indicatorFreshness(dataUpdatedAt: unknown, todayIso: string): { days: number | null; stale: boolean } {
  if (!isIsoDate(dataUpdatedAt) || !isIsoDate(todayIso)) return { days: null, stale: false };
  const a = Date.parse(String(dataUpdatedAt) + "T00:00:00Z"), b = Date.parse(todayIso + "T00:00:00Z");
  const days = Math.max(0, Math.round((b - a) / 86400000));
  return { days, stale: days > INDICATOR_STALE_DAYS };
}

/** Whether this indicator feeds new suggestions. BRULE-012: disabling stops new recommendations and
 *  keeps the history; a draft has not been approved as data yet. */
export function isIndicatorUsable(status: unknown): boolean {
  return status === "active";
}

// ---------------------------------------------------------------------------------------------
// Upload rows → customers (server only)
// ---------------------------------------------------------------------------------------------

export type RawIndicatorRow = { line: number; name: string; code: string; phone: string; value: string; period: string; note: string };
export type MatchEntity = { id: number; name: string; phone: string; code?: string | null };
export type MatchedRow = RawIndicatorRow & {
  status: "matched" | "review" | "unmatched";
  by: "phone" | "code" | "name" | null;
  entityId: number | null;
  candidates: { id: number; name: string; phone: string }[];
};

/** Arabic names are typed a dozen ways: «مستشفى» / «مستشفي», «الحياة» / «الحياه», «أ» / «ا», tatweel,
 *  harakat. Folding those is what lets one clinic match itself; nothing here guesses beyond spelling. */
export function foldArabicName(s: unknown): string {
  return String(s == null ? "" : s)
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const H_NAME = ["اسم العميل", "العميل", "اسم المنشاه", "المنشاه", "الاسم", "اسم", "الجهه", "name", "customer", "client", "company"];
const H_CODE = ["المعرف", "معرف العميل", "رقم العميل", "كود العميل", "الكود", "code", "customer id", "id"];
const H_PHONE = ["الجوال", "الهاتف", "رقم الجوال", "واتساب", "phone", "mobile", "whatsapp"];
const H_VALUE = ["قيمه المؤشر", "القيمه", "قيمه", "value"];
const H_PERIOD = ["الفتره", "فتره", "period"];
const H_NOTE = ["ملاحظات", "ملاحظه", "note", "notes"];

function headerIndex(folded: string[], cands: string[]): number {
  for (const c of cands) { const i = folded.indexOf(foldArabicName(c)); if (i >= 0) return i; }
  for (const c of cands) { const f = foldArabicName(c); const i = folded.findIndex((h) => h.length > 1 && h.includes(f)); if (i >= 0) return i; }
  return -1;
}

/** Rows from a grid (the first row MAY be a header). Without a recognisable header the prototype's own
 *  column order is assumed: name, code, value, period, note — and a cell shaped like a phone number is
 *  read as the phone wherever it sits. */
export function rowsFromGrid(grid: unknown[][]): { rows: RawIndicatorRow[]; headerFound: boolean } {
  const clean = grid.map((r) => (Array.isArray(r) ? r : []).map((c) => String(c == null ? "" : c).trim()))
    .filter((r) => r.some((c) => c));
  if (!clean.length) return { rows: [], headerFound: false };
  const folded = clean[0].map(foldArabicName);
  const iName = headerIndex(folded, H_NAME);
  const headerFound = iName >= 0;
  const idx = headerFound
    ? { name: iName, code: headerIndex(folded, H_CODE), phone: headerIndex(folded, H_PHONE), value: headerIndex(folded, H_VALUE), period: headerIndex(folded, H_PERIOD), note: headerIndex(folded, H_NOTE) }
    : { name: 0, code: 1, phone: -1, value: 2, period: 3, note: 4 };
  const body = headerFound ? clean.slice(1) : clean;
  const rows: RawIndicatorRow[] = [];
  const phoneShaped = (c: string) => normalizePhone(c).length >= 11 && /^[+\d\s\-()٠-٩]+$/.test(c);
  body.forEach((raw, k) => {
    let r = raw;
    let phone = "";
    if (!headerFound) {
      // Without a header the order is the prototype's (name, code, value, period, note), and a phone may
      // sit anywhere. It is taken OUT of the row before the order is applied — otherwise every column
      // after it shifted by one and the note was dropped (QA).
      const pi = r.findIndex((c, i) => i > 0 && phoneShaped(c));
      if (pi > 0) { phone = r[pi]; r = r.slice(0, pi).concat(r.slice(pi + 1)); }
    }
    const at = (i: number) => (i >= 0 && i < r.length ? r[i] : "");
    if (headerFound) phone = at(idx.phone);
    let code = at(idx.code);
    if (headerFound && idx.phone < 0) {
      const ph = r.find((c) => phoneShaped(c));
      if (ph) { phone = ph; if (code === ph) code = ""; }
    }
    const name = at(idx.name);
    if (!name && !phone && !code) return;
    // The downloadable template's example rows say so in their own name; they are not data.
    if (/\(مثال/.test(name)) return;
    rows.push({ line: k + (headerFound ? 2 : 1), name, code, phone, value: at(idx.value), period: at(idx.period), note: at(idx.note) });
  });
  return { rows, headerFound };
}

/** Pasted text → grid. Commas, tabs, semicolons and the Arabic comma all separate cells. */
export function gridFromText(text: unknown): string[][] {
  return String(text == null ? "" : text).split(/\r?\n/).map((l) => l.split(/[,\t;،؛]/));
}

/** BR-IND-003: every uploaded row lands in exactly one of three states, and only «مطابق» rows are ever
 *  saved without a human choosing. Identity order is strongest first:
 *    phone (the key every other Massar table joins on) → the customer code → the folded name.
 *  A name that folds to more than one customer, or only PARTLY matches, is «يحتاج مراجعة» with the
 *  candidates listed — the manager picks; the system does not. */
export function matchRows(rows: readonly RawIndicatorRow[], entities: readonly MatchEntity[]): MatchedRow[] {
  const byPhone = new Map<string, MatchEntity>();
  const byCode = new Map<string, MatchEntity[]>();
  const byName = new Map<string, MatchEntity[]>();
  for (const e of entities) {
    if (e.phone) byPhone.set(normalizePhone(e.phone), e);
    if (e.code) { const k = String(e.code).trim().toLowerCase(); byCode.set(k, (byCode.get(k) || []).concat(e)); }
    const f = foldArabicName(e.name);
    if (f) byName.set(f, (byName.get(f) || []).concat(e));
  }
  const brief = (e: MatchEntity) => ({ id: e.id, name: e.name, phone: e.phone });
  return rows.map((r) => {
    const ph = r.phone ? normalizePhone(r.phone) : "";
    if (ph && byPhone.has(ph)) { const e = byPhone.get(ph)!; return { ...r, status: "matched", by: "phone", entityId: e.id, candidates: [brief(e)] }; }
    const code = r.code.trim().toLowerCase();
    // Codes are free-form imported attributes, so two customers can carry the same one. That is a
    // question for a human, never «whichever loaded last».
    const byC = code ? byCode.get(code) || [] : [];
    if (byC.length === 1) return { ...r, status: "matched", by: "code", entityId: byC[0].id, candidates: [brief(byC[0])] };
    if (byC.length > 1) return { ...r, status: "review", by: null, entityId: null, candidates: byC.slice(0, 5).map(brief) };
    const f = foldArabicName(r.name);
    const exact = f ? byName.get(f) || [] : [];
    if (exact.length === 1) return { ...r, status: "matched", by: "name", entityId: exact[0].id, candidates: [brief(exact[0])] };
    if (exact.length > 1) return { ...r, status: "review", by: null, entityId: null, candidates: exact.slice(0, 5).map(brief) };
    if (f.length >= 3) {
      const partial: MatchEntity[] = [];
      for (const [k, list] of byName) if (k.includes(f) || f.includes(k)) partial.push(...list);
      if (partial.length) return { ...r, status: "review", by: null, entityId: null, candidates: partial.slice(0, 5).map(brief) };
    }
    return { ...r, status: "unmatched", by: null, entityId: null, candidates: [] };
  });
}

/** The code column a customer record may already carry from its own import. */
export function entityCodeOf(attrs: unknown): string | null {
  if (!attrs || typeof attrs !== "object") return null;
  const keys = ["المعرف", "معرف العميل", "رقم العميل", "كود العميل", "الكود", "code", "customer id", "Customer ID"];
  const a = attrs as Record<string, unknown>;
  for (const k of keys) if (a[k] != null && String(a[k]).trim()) return String(a[k]).trim();
  return null;
}

// ---------------------------------------------------------------------------------------------
// Indicators → campaign opportunities (server only)
// ---------------------------------------------------------------------------------------------

export type RuleIndicator = { id: number; name: string; product: string | null; signal: string; status: string; dataUpdatedAt: string; memberIds: readonly number[]; customerType?: string };
export type RuleEntity = { id: number; name: string; phone: string };
export type RuleProduct = { name: string; sector: string | null; eligible: boolean; why?: string };
export type Suggestion = {
  key: string;
  rule: "usage_without_integration" | "high_usage" | "cross_sell" | "non_subscribers" | "segment";
  objective: string;
  title: string;
  product: string;
  fromProduct: string | null;
  reason: string;
  indicators: { id: number; name: string; role: "include" | "exclude" }[];
  /** BRD §19.2 step 2 names «الشريحة» on the card: the customer type the source indicators share. */
  segment: string | null;
  entityIds: number[];
  count: number;
  excluded: { optedOut: number; recentlyTargeted: number; openOpportunity: number };
  dataUpdatedAt: string;
  stale: boolean;
  eligible: boolean;
  blockedWhy: string | null;
};
export type RuleContext = {
  indicators: readonly RuleIndicator[];
  entities: readonly RuleEntity[];
  products: readonly RuleProduct[];
  optedOutPhones: readonly string[];
  /** Non-test campaign targets actually sent (or of unknown outcome) — which phone was approached
   *  about which product, when. The caller may pre-filter to the window; this filters again. */
  recentTargets: readonly { phone: string; product: string; at: number }[];
  openOpportunities: readonly { phone: string; product: string }[];
  dismissedKeys: readonly string[];
  now: number;
  todayIso: string;
  suppressionDays: number;
};

export const SUGGESTION_LIMIT = 12;

function union(sets: readonly (readonly number[])[]): Set<number> {
  const s = new Set<number>();
  for (const a of sets) for (const x of a) s.add(x);
  return s;
}

/** Stable across reloads and indicator edits that do not change WHAT is suggested, so a dismissal or an
 *  adoption stays attached to the same suggestion. */
export function suggestionKey(rule: string, product: string, fromProduct: string | null, indicatorIds: readonly number[]): string {
  // WHAT is proposed is the rule and the products. The indicator ids stay out of the key (except for a
  // segment, which IS one indicator): adding a second high-usage indicator used to mint a «new»
  // suggestion and resurrect one the manager had dismissed (QA). A dismissal still lifts when the
  // customers behind it are replaced — the dismissal row records its indicator ids for that.
  return [rule, product, fromProduct || "", rule === "segment" ? [...indicatorIds].sort((a, b) => a - b).join(".") : ""].join("|");
}

/** BR-IND-007/008, BR-CAM-003, BR-MON-002. Five rules, strongest first. Every suggestion names the
 *  indicators it came from (and the ones it subtracted), the customers it would reach AFTER the three
 *  exclusions, and how many each exclusion removed — «0 after exclusions» is not shown, because a card
 *  that proposes a campaign to nobody is noise. Only ACTIVE indicators participate (BRULE-012). */
export function suggestOpportunities(ctx: RuleContext): Suggestion[] {
  const live = ctx.indicators.filter((i) => isIndicatorUsable(i.status) && i.product && i.memberIds.length);
  const entById = new Map(ctx.entities.map((e) => [e.id, e]));
  const productByName = new Map(ctx.products.map((p) => [p.name, p]));
  const opted = new Set(ctx.optedOutPhones.map((p) => normalizePhone(p)));
  const since = ctx.now - Math.max(0, ctx.suppressionDays) * 86400000;
  // Built ONCE. The first version scanned every campaign target for every audience member of every
  // candidate suggestion — measured at 3.4s for 5,000 customers and 5,000 targets, on the event loop
  // that also carries the WhatsApp webhook and «إيقاف».
  const byProduct = (rows: readonly { phone: string; product: string }[]) => {
    const m = new Map<string, Set<string>>();
    for (const r of rows) { const set = m.get(r.product) || new Set<string>(); set.add(normalizePhone(r.phone)); m.set(r.product, set); }
    return m;
  };
  const recent = byProduct(ctx.recentTargets.filter((t) => t.at >= since));
  const openOpps = byProduct(ctx.openOpportunities);
  const EMPTY = new Set<string>();
  const phoneOf = new Map(ctx.entities.map((e) => [e.id, normalizePhone(e.phone)]));
  const dismissed = new Set(ctx.dismissedKeys);
  const byProductSignal = (product: string, signal: string) => live.filter((i) => i.product === product && i.signal === signal);
  const products = [...new Set(live.map((i) => i.product as string))];
  const out: Suggestion[] = [];

  const finish = (s: Omit<Suggestion, "key" | "entityIds" | "count" | "excluded" | "dataUpdatedAt" | "stale" | "eligible" | "blockedWhy" | "segment">, audience: Set<number>, used: readonly RuleIndicator[]) => {
    const p = productByName.get(s.product);
    if (!p) return;
    const excluded = { optedOut: 0, recentlyTargeted: 0, openOpportunity: 0 };
    const ids: number[] = [];
    const rec = recent.get(s.product) || EMPTY, opp = openOpps.get(s.product) || EMPTY;
    for (const id of audience) {
      if (!entById.has(id)) continue;
      const ph = phoneOf.get(id) as string;
      if (opted.has(ph)) { excluded.optedOut++; continue; }
      if (rec.has(ph)) { excluded.recentlyTargeted++; continue; }
      if (opp.has(ph)) { excluded.openOpportunity++; continue; }
      ids.push(id);
    }
    if (!ids.length) return;
    const key = suggestionKey(s.rule, s.product, s.fromProduct, used.map((i) => i.id));
    if (dismissed.has(key)) return;
    const oldest = used.reduce((a, i) => (i.dataUpdatedAt < a ? i.dataUpdatedAt : a), used[0].dataUpdatedAt);
    ids.sort((a, b) => a - b);
    const types = [...new Set(used.filter((i) => s.indicators.some((x) => x.id === i.id && x.role === "include")).map((i) => i.customerType || "all"))];
    const segment = types.length === 1 && types[0] !== "all" ? types[0] : null;
    out.push({ ...s, key, segment, entityIds: ids, count: ids.length, excluded, dataUpdatedAt: oldest,
      stale: indicatorFreshness(oldest, ctx.todayIso).stale, eligible: p.eligible, blockedWhy: p.eligible ? null : (p.why || "لا يبيعه المساعد") });
  };
  const names = (list: readonly RuleIndicator[]) => [...new Set(list.map((i) => i.name))].map((n) => "«" + n + "»").join(" و");

  for (const product of products) {
    const high = byProductSignal(product, "high_usage");
    const ready = byProductSignal(product, "usage_no_integration");
    const integ = byProductSignal(product, "integrated");
    const uses = byProductSignal(product, "uses");
    const notUsing = byProductSignal(product, "not_using");
    const other = byProductSignal(product, "other");

    // 1a. The manager's list is ALREADY «high usage without integration». Anyone who also sits in an
    //     «integrated» indicator for the product is still subtracted: two sources disagreeing about
    //     one clinic is resolved in favour of not pitching integration to someone who has it.
    if (ready.length) {
      const integrated = union(integ.map((i) => i.memberIds));
      const aud = new Set([...union(ready.map((i) => i.memberIds))].filter((id) => !integrated.has(id)));
      finish({ rule: "usage_without_integration", objective: "subscriptions", product, fromProduct: null,
        title: "استخدام مرتفع دون ربط — " + product,
        reason: "استخدامهم مرتفع ولا يوجد لديهم ربط بحسب " + names(ready) + (integ.length ? "، بعد استبعاد من يظهر في " + names(integ) : "") + ".",
        indicators: [...ready.map((i) => ({ id: i.id, name: i.name, role: "include" as const })), ...integ.map((i) => ({ id: i.id, name: i.name, role: "exclude" as const }))] },
        aud, [...ready, ...integ]);
    }
    // 1b. High usage with no integration — BRD §10.1's first example, and Lean's own AE motion.
    if (high.length && integ.length) {
      const integrated = union(integ.map((i) => i.memberIds));
      const aud = new Set([...union(high.map((i) => i.memberIds))].filter((id) => !integrated.has(id)));
      finish({ rule: "usage_without_integration", objective: "subscriptions", product, fromProduct: null,
        title: "استخدام مرتفع دون ربط — " + product,
        reason: "استخدامهم مرتفع بحسب " + names(high) + " ولا يظهرون في " + names(integ) + "، فالحجم يُدار دون تكامل.",
        indicators: [...high.map((i) => ({ id: i.id, name: i.name, role: "include" as const })), ...integ.map((i) => ({ id: i.id, name: i.name, role: "exclude" as const }))] },
        aud, [...high, ...integ]);
    } else if (high.length && !ready.length) {
      // 2. High usage alone. Weaker, and it says why: with no integration indicator nobody can know who
      //    is already integrated, so the reason carries that caveat instead of implying it.
      finish({ rule: "high_usage", objective: "subscriptions", product, fromProduct: null,
        title: "توسيع الاستخدام — " + product,
        reason: "استخدامهم مرتفع بحسب " + names(high) + ". لا يوجد مؤشر «مرتبطون تقنيًا» لهذا المنتج، فقد يكون بعضهم مرتبطًا بالفعل.",
        indicators: high.map((i) => ({ id: i.id, name: i.name, role: "include" as const })) },
        union(high.map((i) => i.memberIds)), high);
    }

    // 3. Non-subscribers the manager has listed.
    if (notUsing.length) {
      finish({ rule: "non_subscribers", objective: "non_subscribers", product, fromProduct: null,
        title: "غير المشتركين — " + product,
        reason: "مدرجون بوصفهم غير مشتركين في «" + product + "» بحسب " + names(notUsing) + ".",
        indicators: notUsing.map((i) => ({ id: i.id, name: i.name, role: "include" as const })) },
        union(notUsing.map((i) => i.memberIds)), notUsing);
    }

    // 4. Cross-sell: customers who use THIS product, into another product of the same sector — but only
    //    where Massar holds evidence about the other product. «Not in any indicator of Q» is not proof
    //    of «does not use Q» unless Q has usage indicators at all.
    const users = [...high, ...ready, ...integ, ...uses];
    const from = productByName.get(product);
    if (users.length && from && from.sector) {
      const base = union(users.map((i) => i.memberIds));
      for (const q of ctx.products) {
        if (q.name === product || q.sector !== from.sector) continue;
        const qNot = byProductSignal(q.name, "not_using");
        const qUsers = [...byProductSignal(q.name, "high_usage"), ...byProductSignal(q.name, "usage_no_integration"), ...byProductSignal(q.name, "integrated"), ...byProductSignal(q.name, "uses")];
        if (qNot.length) {
          const not = union(qNot.map((i) => i.memberIds));
          finish({ rule: "cross_sell", objective: "cross_sell", product: q.name, fromProduct: product,
            title: "بيع متقاطع: " + product + " ← " + q.name,
            reason: "يستخدمون «" + product + "» ومدرجون غير مشتركين في «" + q.name + "»، من القطاع نفسه (" + from.sector + ").",
            indicators: [...users.map((i) => ({ id: i.id, name: i.name, role: "include" as const })), ...qNot.map((i) => ({ id: i.id, name: i.name, role: "include" as const }))] },
            new Set([...base].filter((id) => not.has(id))), [...users, ...qNot]);
        } else if (qUsers.length) {
          const already = union(qUsers.map((i) => i.memberIds));
          finish({ rule: "cross_sell", objective: "cross_sell", product: q.name, fromProduct: product,
            title: "بيع متقاطع: " + product + " ← " + q.name,
            reason: "يستخدمون «" + product + "» ولا يظهرون بين مستخدمي «" + q.name + "»، من القطاع نفسه (" + from.sector + ").",
            indicators: [...users.map((i) => ({ id: i.id, name: i.name, role: "include" as const })), ...qUsers.map((i) => ({ id: i.id, name: i.name, role: "exclude" as const }))] },
            new Set([...base].filter((id) => !already.has(id))), [...users, ...qUsers]);
        }
      }
    }

    // 5. A segment the manager defined without a machine-readable meaning. Offered as a segment, never
    //    dressed up as a finding.
    for (const i of other) {
      finish({ rule: "segment", objective: "awareness", product, fromProduct: null,
        title: "شريحة «" + i.name + "» — " + product,
        reason: "جميع عملاء مؤشر «" + i.name + "»، وهو شريحة عامة بلا دلالة تستخدمها القواعد.",
        indicators: [{ id: i.id, name: i.name, role: "include" }] }, new Set(i.memberIds), [i]);
    }
  }
  const rank: Record<string, number> = { usage_without_integration: 5, cross_sell: 4, non_subscribers: 3, high_usage: 2, segment: 1 };
  out.sort((a, b) => (Number(b.eligible) - Number(a.eligible)) || (rank[b.rule] - rank[a.rule]) || (b.count - a.count) || a.key.localeCompare(b.key));
  return out.slice(0, SUGGESTION_LIMIT);
}

// ---------------------------------------------------------------------------------------------
// Repeat targeting (server only) — BR-CAM-007, BRULE-011
// ---------------------------------------------------------------------------------------------

export type RepeatCampaign = { id: number; name: string; product: string | null; createdAt: number; test: boolean; phones: readonly string[] };
export type RepeatWarning = {
  windowDays: number;
  campaigns: { id: number; name: string; product: string | null; createdAt: number; sameProduct: boolean; overlap: number }[];
  overlapPhones: number;
  sameProductRecent: number;
};

/** A WARNING, never a block: the BRD says «تنبيه». A recent campaign for the same product is listed
 *  even with no shared recipient (the «same product and segment» half of BR-CAM-007); a campaign for
 *  another product is listed only when it reached some of the same customers. Rehearsals are ignored —
 *  a sandbox send to the team's own phones did not bother a customer. */
export function checkRepeatTargeting(product: string, phones: readonly string[], campaigns: readonly RepeatCampaign[], now: number, windowDays: number): RepeatWarning {
  const since = now - Math.max(0, windowDays) * 86400000;
  const want = new Set(phones.map((p) => normalizePhone(p)).filter(Boolean));
  const hit = new Set<string>();
  const list: RepeatWarning["campaigns"] = [];
  for (const c of campaigns) {
    if (c.test || c.createdAt < since) continue;
    let overlap = 0;
    for (const p of c.phones) { const n = normalizePhone(p); if (want.has(n)) { overlap++; hit.add(n); } }
    const sameProduct = !!product && c.product === product;
    if (sameProduct || overlap > 0) list.push({ id: c.id, name: c.name, product: c.product, createdAt: c.createdAt, sameProduct, overlap });
  }
  list.sort((a, b) => b.createdAt - a.createdAt);
  return { windowDays, campaigns: list, overlapPhones: hit.size, sameProductRecent: list.filter((c) => c.sameProduct).length };
}

// ---------------------------------------------------------------------------------------------
// The seam into the browser
// ---------------------------------------------------------------------------------------------

const DOMAIN_FNS = [isIsoDate, checkIndicator, checkMemberCount, indicatorFreshness, isIndicatorUsable, isDuplicateIndicatorName] as const;

export const INDICATOR_DOMAIN_JS: string = [
  "/* ===== indicator-domain (generated from src/indicator-domain.ts — do not edit here) ===== */",
  "var INDICATOR_STATUSES = " + JSON.stringify(INDICATOR_STATUSES) + ";",
  "var INDICATOR_STATUS_LABELS = " + JSON.stringify(INDICATOR_STATUS_LABELS) + ";",
  "var INDICATOR_SIGNALS = " + JSON.stringify(INDICATOR_SIGNALS) + ";",
  "var INDICATOR_SIGNAL_LABELS = " + JSON.stringify(INDICATOR_SIGNAL_LABELS) + ";",
  "var INDICATOR_SIGNAL_SHORT = " + JSON.stringify(INDICATOR_SIGNAL_SHORT) + ";",
  "var CUSTOMER_TYPES = " + JSON.stringify(CUSTOMER_TYPES) + ";",
  "var CUSTOMER_TYPE_LABELS = " + JSON.stringify(CUSTOMER_TYPE_LABELS) + ";",
  "var CAMPAIGN_OBJECTIVES = " + JSON.stringify(CAMPAIGN_OBJECTIVES) + ";",
  "var CAMPAIGN_OBJECTIVE_LABELS = " + JSON.stringify(CAMPAIGN_OBJECTIVE_LABELS) + ";",
  "var INDICATOR_NAME_MAX = " + INDICATOR_NAME_MAX + ";",
  "var INDICATOR_DESC_MAX = " + INDICATOR_DESC_MAX + ";",
  "var INDICATOR_MEMBERS_MAX = " + INDICATOR_MEMBERS_MAX + ";",
  "var INDICATOR_STALE_DAYS = " + INDICATOR_STALE_DAYS + ";",
  ...DOMAIN_FNS.map((fn) => fn.toString()),
].join("\n");

/** A serialised function may reference only its parameters, its own helpers and the constants injected
 *  above — otherwise it works in Node and throws in the page. Asserted by the unit test. */
export function checkIndicatorDomainClosure(): string[] {
  const injected = ["INDICATOR_STATUSES", "INDICATOR_STATUS_LABELS", "INDICATOR_SIGNALS", "INDICATOR_SIGNAL_LABELS",
    "CUSTOMER_TYPES", "CUSTOMER_TYPE_LABELS", "CAMPAIGN_OBJECTIVES", "CAMPAIGN_OBJECTIVE_LABELS",
    "INDICATOR_NAME_MAX", "INDICATOR_DESC_MAX", "INDICATOR_MEMBERS_MAX", "INDICATOR_STALE_DAYS"];
  const problems: string[] = [];
  for (const fn of DOMAIN_FNS) {
    const src = fn.toString().replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ").replace(/"[^"\n]*"/g, '""');
    for (const id of src.match(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g) ?? []) {
      if (/^[A-Z][A-Z0-9_]+$/.test(id) && injected.indexOf(id) === -1 && !/^(NaN|UTC)$/.test(id)) problems.push(fn.name + " references " + id);
    }
  }
  return problems;
}
