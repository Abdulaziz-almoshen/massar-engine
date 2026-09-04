// sales-domain.ts — THE BUSINESS TIER for the commercial engine: stages, stalls and targets.
//
// WHY THIS FILE EXISTS. `opps-domain.ts` owns what a single opportunity line is worth. This file
// owns everything a sales ORGANISATION asks: which rung a deal is on and how likely it is to close,
// whose desk a stalled deal is sitting on, and how a quarter's number compares to its target.
//
// It exists now because the plan discovered the engine could not answer the one question a targets
// model rests on. `opportunities.stage_at` is the moment the stage LAST MOVED and is overwritten by
// every later edit; `close_on` is a PLANNED date. So "which deals were won in Q1" had no answer.
// The append-only stage-event ledger fixes that, and these are the rules that read it.
//
// SOURCE OF THE STAGES. Not invented here. `docs/artifacts/masar-archive/` recovered Lean's own
// eight-stage model with its probability weights, lost inside the company and found in an archive.
// Four of the eight already existed in `opps-domain.ts` with byte-identical Arabic labels — the
// prototype and the lost document came from the same thinking — so the migration adds two stages
// rather than reclassifying anything.
//
// SAME TWO-RUNTIME CONSTRAINT AS opps-domain.ts, and it is load-bearing: every function in
// DOMAIN_FNS must be SELF-CONTAINED. It may reference only its own parameters and the constants
// injected alongside it. A helper that resolves in Node and not in the browser is a blank page.
// `checkSalesDomainClosure()` asserts exactly that at boot.

/** One rung of the ladder. `weightPct` is what makes a forecast possible at all: six unweighted
 *  stages cannot produce the number a sales director is measured on. */
export type SalesStage = {
  readonly key: "contact" | "discover" | "present" | "tech" | "quote" | "negotiate" | "won" | "lost";
  readonly label: string;
  readonly weightPct: number;
  readonly position: number;
  /** What must be true to LEAVE this stage. Recovered verbatim from the archive; it is the
   *  difference between a stage a rep guesses at and one they can be held to. */
  readonly exitCriterion: string;
};

export const SALES_STAGES: readonly SalesStage[] = [
  { key: "contact",   label: "تواصل أولي",        weightPct: 10,  position: 1, exitCriterion: "وصلنا لصاحب القرار وأبدى اهتمامًا مبدئيًا" },
  { key: "discover",  label: "اكتشاف الحاجة",      weightPct: 25,  position: 2, exitCriterion: "تأكدت الحاجة والحجم وصاحب القرار والميزانية" },
  { key: "present",   label: "عرض المنتج",         weightPct: 45,  position: 3, exitCriterion: "تم تقديم المنتج وقبول العميل للقيمة" },
  { key: "tech",      label: "التقييم التقني",      weightPct: 65,  position: 4, exitCriterion: "اجتاز التكامل مع صحة/صحتي ومتطلبات الأمن" },
  { key: "quote",     label: "عرض السعر",          weightPct: 80,  position: 5, exitCriterion: "تم إرسال عرض سعر مقبول مبدئيًا" },
  { key: "negotiate", label: "التفاوض والاعتماد",   weightPct: 90,  position: 6, exitCriterion: "توافق على الشروط ودخول التعاقد/المشتريات" },
  { key: "won",       label: "إغلاق – ربح",        weightPct: 100, position: 7, exitCriterion: "تم التوقيع والاعتماد" },
  { key: "lost",      label: "إغلاق – خسارة",      weightPct: 0,   position: 8, exitCriterion: "اعتذر العميل (سجّل السبب)" },
];

/** The six live stage keys, mapped forward. Every one maps to ITSELF — `discover` and `quote` are
 *  genuinely new, so no existing row is reclassified and no rep's board changes under them.
 *  Kept as an explicit table rather than an identity function because the migration has to be
 *  auditable, and because `negotiate` needs a human to check whether some of its rows are really
 *  the newly separated `quote`. */
export const LEGACY_STAGE_MAP: Readonly<Record<string, string>> = {
  contact: "contact", present: "present", tech: "tech",
  negotiate: "negotiate", won: "won", lost: "lost",
};

/** The two rungs where deals actually stall, and why. The archive states it plainly: they stall
 *  because RESPONSIBILITY CROSSES A DEPARTMENT BOUNDARY and nobody can see whose desk the deal is
 *  on. `opps-domain.ts` independently hardcoded the same two months earlier. */
export const STALL_STAGES: readonly string[] = ["tech", "negotiate"];
export const STALL_DAYS = 14;

/** الإدارة المسؤولة — who owes the next move. The whole differentiator is that this is a first-class
 *  field on an open action rather than a note nobody can query. */
export const DEPARTMENTS: readonly string[] = [
  "إدارة المنتج", "المبيعات", "التقنية", "القانونية", "المشتريات", "أمن المعلومات",
];

/** What an outcome MEANS, which decides its colour and whether the deal moves. Paired with a label
 *  everywhere it renders — status is never encoded by colour alone. */
export type OutcomeKind = "advance" | "needs_action" | "lost";

export type StageOutcome = {
  readonly stage: string;
  readonly key: string;
  readonly label: string;
  readonly reason: string;
  readonly nextAction: string;
  readonly kind: OutcomeKind;
  /** Which department the next action lands on. Empty means it stays with sales. */
  readonly dept: string;
};

/** نتيجة المرحلة + سبب النتيجة + الإجراء, recovered from the archive. Dependent on stage: the list a
 *  rep sees changes with the rung they are on, which is the difference between a picklist that
 *  guides the conversation and one that is ignored. */
export const STAGE_OUTCOMES: readonly StageOutcome[] = [
  { stage: "contact", key: "interested", label: "مهتم", reason: "رأى قيمة أولية", nextAction: "انتقال للاكتشاف", kind: "advance", dept: "" },
  { stage: "contact", key: "deferred", label: "مؤجّل", reason: "مشغول أو ليست أولوية", nextAction: "إعادة جدولة تواصل", kind: "needs_action", dept: "المبيعات" },
  { stage: "contact", key: "gatekeeper", label: "لم نصل لصاحب القرار", reason: "البوابة موظف غير مخوّل", nextAction: "تحديد صاحب القرار", kind: "needs_action", dept: "المبيعات" },
  { stage: "contact", key: "not_interested", label: "غير مهتم", reason: "لا حاجة مدركة", nextAction: "إغلاق – خسارة", kind: "lost", dept: "" },

  { stage: "discover", key: "need_confirmed", label: "حاجة مؤكدة", reason: "ألم واضح وميزانية", nextAction: "انتقال للعرض", kind: "advance", dept: "" },
  { stage: "discover", key: "need_partial", label: "حاجة غير مكتملة", reason: "نقص معلومات أو صاحب قرار", nextAction: "اجتماع استكشاف إضافي", kind: "needs_action", dept: "المبيعات" },
  { stage: "discover", key: "no_budget", label: "لا ميزانية حاليًا", reason: "قيد مالي أو دورة ميزانية", nextAction: "متابعة مجدولة لاحقًا", kind: "needs_action", dept: "المبيعات" },
  { stage: "discover", key: "no_need", label: "لا حاجة فعلية", reason: "الوضع الحالي كافٍ", nextAction: "إغلاق – خسارة", kind: "lost", dept: "" },

  { stage: "present", key: "accepted", label: "مقبول", reason: "القيمة والتكامل مقنعان", nextAction: "انتقال للتقييم التقني", kind: "advance", dept: "" },
  { stage: "present", key: "needs_tech_clarity", label: "يحتاج توضيح تقني", reason: "أسئلة اعتماد أو تكامل صحتي", nextAction: "إرسال توضيح ووثائق التكامل", kind: "needs_action", dept: "التقنية" },
  { stage: "present", key: "value_objection", label: "اعتراض على الجدوى", reason: "لم يرَ فرقًا عن نظامه", nextAction: "معالجة اعتراض بحالة استخدام", kind: "needs_action", dept: "إدارة المنتج" },
  { stage: "present", key: "rejected", label: "مرفوض", reason: "لا ملاءمة", nextAction: "إغلاق – خسارة", kind: "lost", dept: "" },

  { stage: "tech", key: "passed", label: "اجتاز التقييم", reason: "التكامل والأمن مقبولان", nextAction: "انتقال لعرض السعر", kind: "advance", dept: "" },
  { stage: "tech", key: "awaiting_tech", label: "بانتظار الجهة التقنية", reason: "مُحال ولم يُرد", nextAction: "تحديد سقف زمني ومتابعة", kind: "needs_action", dept: "التقنية" },
  { stage: "tech", key: "extra_security", label: "متطلبات أمن إضافية", reason: "اشتراطات أمن معلومات", nextAction: "تجهيز مستندات الامتثال", kind: "needs_action", dept: "أمن المعلومات" },
  { stage: "tech", key: "integration_failed", label: "فشل التكامل", reason: "قيد تقني غير قابل للحل", nextAction: "إغلاق – خسارة (تكامل)", kind: "lost", dept: "" },

  { stage: "quote", key: "price_accepted", label: "مقبول", reason: "السعر ضمن التوقع", nextAction: "انتقال للتفاوض", kind: "advance", dept: "" },
  { stage: "quote", key: "repackage", label: "يحتاج تعديل الباقة", reason: "نطاق أوسع أو أضيق", nextAction: "إعادة تسعير الباقة", kind: "needs_action", dept: "إدارة المنتج" },
  { stage: "quote", key: "price_objection", label: "اعتراض سعري", reason: "تكلفة عالية مدركة", nextAction: "إعادة ربط بالقيمة قبل الخصم", kind: "needs_action", dept: "المبيعات" },
  { stage: "quote", key: "competitor", label: "مقارنة بمنافس", reason: "يوازن عروضًا أخرى", nextAction: "تمييز تنافسي ودليل قيمة", kind: "needs_action", dept: "إدارة المنتج" },

  { stage: "negotiate", key: "agreed", label: "متفق مبدئيًا", reason: "توافق على الشروط", nextAction: "تجهيز التعاقد", kind: "advance", dept: "القانونية" },
  { stage: "negotiate", key: "contract_edit", label: "يحتاج تعديل العقد", reason: "بنود قانونية أو مدة", nextAction: "مراجعة وتعديل مع القانونية", kind: "needs_action", dept: "القانونية" },
  { stage: "negotiate", key: "awaiting_procurement", label: "بانتظار المشتريات", reason: "دورة موافقات داخلية", nextAction: "متابعة مسار المشتريات", kind: "needs_action", dept: "المشتريات" },
  { stage: "negotiate", key: "budget_cycle", label: "مرتبط بدورة الميزانية", reason: "قيد زمني مالي", nextAction: "جدولة إغلاق حسب الميزانية", kind: "needs_action", dept: "المبيعات" },

  { stage: "won", key: "signed", label: "ربح", reason: "توقيع واعتماد", nextAction: "بدء التفعيل فورًا", kind: "advance", dept: "إدارة المنتج" },
  { stage: "lost", key: "lost_price", label: "خسارة – السعر", reason: "تكلفة غير مقبولة", nextAction: "تسجيل ومراجعة تسعير", kind: "lost", dept: "" },
  { stage: "lost", key: "lost_competitor", label: "خسارة – منافس", reason: "اختار بديلاً", nextAction: "تسجيل وتحليل تنافسي", kind: "lost", dept: "" },
  { stage: "lost", key: "lost_deferred", label: "خسارة – تأجيل", reason: "أُجّل لسنة قادمة", nextAction: "إعادة تفعيل مجدولة", kind: "lost", dept: "" },
  { stage: "lost", key: "lost_integration", label: "خسارة – تكامل", reason: "فشل التكامل التقني", nextAction: "تسجيل ومراجعة تقنية", kind: "lost", dept: "" },
];

/** Riyadh is UTC+3 and Saudi Arabia has never observed daylight saving, so a fixed offset is not an
 *  approximation here — it is exact. That is why this file needs no timezone database. */
export const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

/** RAG, from the archive. Fixed in one place so three screens cannot disagree. */
export const RAG_GREEN_PCT = 70;
export const RAG_AMBER_PCT = 50;

// ---------------------------------------------------------------------------
// Rules. Every function below is self-contained — see the header constraint.
// ---------------------------------------------------------------------------

/** Weight of a stage as a fraction. Unknown stages weigh nothing: a forecast must never inflate
 *  itself on a value it cannot explain. */
export function stageWeight(stageKey: string, stages: readonly SalesStage[]): number {
  for (const s of stages) if (s.key === stageKey) return s.weightPct / 100;
  return 0;
}

export function isTerminalStage(stageKey: string): boolean {
  return stageKey === "won" || stageKey === "lost";
}

/** A deal is stalled when it has sat on one of the two crossing-point rungs past the window. The
 *  clock is days in the CURRENT stage, not age of the deal — an old deal moving steadily is healthy
 *  and an young one stuck at technical evaluation is not. */
export function isStalled(stageKey: string, daysInStage: number, stallStages: readonly string[], stallDays: number): boolean {
  if (daysInStage < stallDays) return false;
  for (const s of stallStages) if (s === stageKey) return true;
  return false;
}

/** The weighted value one open deal contributes to a forecast. Terminal deals contribute nothing:
 *  a won deal is `achieved`, not `forecast`, and counting it in both is how a pipeline lies. */
export function weightedValue(
  salePrice: number, quantity: number, years: number, discountPercent: number,
  stageKey: string, stages: readonly SalesStage[],
): number {
  if (stageKey === "won" || stageKey === "lost") return 0;
  const price = Number(salePrice) || 0;
  const qty = Number(quantity) || 1;
  const yrs = Number(years) || 1;
  const disc = Number(discountPercent) || 0;
  let weight = 0;
  for (const s of stages) if (s.key === stageKey) weight = s.weightPct / 100;
  return Math.round(price * qty * yrs * (1 - disc / 100) * weight);
}

/** Which fiscal quarter a moment falls in, in RIYADH LOCAL TIME.
 *
 *  This is the function the whole targets model rests on and the one most likely to be silently
 *  wrong. A deal won at 23:30 on 31 March in Riyadh is 20:30Z — read in UTC it lands in the wrong
 *  quarter, and someone's number moves. Boundaries are half-open: a moment exactly at the boundary
 *  belongs to the quarter it opens.
 *
 *  `fiscalStartMonth` is 1-12 and 1 means the fiscal year is the calendar year. The year returned
 *  is labelled by the calendar year the fiscal year STARTS in. */
export function riyadhFiscalPeriod(atMs: number, fiscalStartMonth: number): { year: number; quarter: number } {
  const local = new Date(Number(atMs) + 3 * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1;
  const start = Number(fiscalStartMonth) || 1;
  let offset = m - start;
  let year = y;
  if (offset < 0) { offset += 12; year -= 1; }
  return { year: year, quarter: Math.floor(offset / 3) + 1 };
}

/** The inverse of riyadhFiscalPeriod: the half-open bounds of one fiscal quarter, as epoch ms.
 *  [start, end) — a moment exactly at `end` belongs to the NEXT quarter, which is the property that
 *  stops a deal being counted twice or not at all on a boundary.
 *
 *  Lives here rather than in a query so that the bucketing and the bounds cannot disagree: the same
 *  fixed +03:00 offset defines both, and a test asserts they round-trip. */
export function riyadhPeriodBounds(year: number, quarter: number, fiscalStartMonth: number): { startMs: number; endMs: number } {
  const start = Number(fiscalStartMonth) || 1;
  const q = Number(quarter) || 1;
  const monthIndex = (start - 1) + (q - 1) * 3;
  const sy = Number(year) + Math.floor(monthIndex / 12);
  const sm = monthIndex % 12;
  const ey = Number(year) + Math.floor((monthIndex + 3) / 12);
  const em = (monthIndex + 3) % 12;
  return {
    startMs: Date.UTC(sy, sm, 1, 0, 0, 0, 0) - 3 * 60 * 60 * 1000,
    endMs: Date.UTC(ey, em, 1, 0, 0, 0, 0) - 3 * 60 * 60 * 1000,
  };
}

/** attainment — the plain question: how much of the target has actually been won.
 *  Returns null rather than 0 when there is no target, because "no target set" and "zero percent of
 *  target" are different facts and a screen that renders them the same is lying. */
export function attainmentPct(achieved: number, target: number): number | null {
  const t = Number(target) || 0;
  if (t <= 0) return null;
  return (Number(achieved) || 0) / t * 100;
}

/** coverage — achieved plus what the weighted pipeline suggests is still coming. Answers "are we
 *  going to make it", where attainment answers "have we made it". Different questions, different
 *  numbers, and conflating them is why the plan's original single "%" was ambiguous. */
export function coveragePct(achieved: number, weightedOpen: number, target: number): number | null {
  const t = Number(target) || 0;
  if (t <= 0) return null;
  return ((Number(achieved) || 0) + (Number(weightedOpen) || 0)) / t * 100;
}

/** How much of the period has elapsed, 0..1, in Riyadh local time. RAG compares attainment against
 *  THIS rather than against the whole period — otherwise every product on the board is red in the
 *  first week of a quarter and the colour stops meaning anything. */
export function periodElapsedFraction(nowMs: number, startMs: number, endMs: number): number {
  const s = Number(startMs) || 0;
  const e = Number(endMs) || 0;
  if (e <= s) return 1;
  const n = Number(nowMs) || 0;
  if (n <= s) return 0;
  if (n >= e) return 1;
  return (n - s) / (e - s);
}

/** The colour, and the reason it is a separate function from the percentage: a screen must never
 *  compute this twice and disagree with itself. Pace-adjusted — 40% attainment one week into a
 *  quarter is ahead, and the same number in the final week is not.
 *
 *  Returns a key, never a colour value. The presentation tier owns hue; this tier owns meaning. */
export function ragKey(attainment: number | null, elapsedFraction: number): "none" | "good" | "warn" | "bad" {
  if (attainment === null) return "none";
  const elapsed = Number(elapsedFraction);
  const frac = elapsed > 0 ? elapsed : 0.0001;
  const pace = Number(attainment) / frac;
  if (pace >= 70) return "good";
  if (pace >= 50) return "warn";
  return "bad";
}

/** Absence told apart from silence. The PM outcome view's whole credibility rests on this: an
 *  account nobody contacted and an account nobody RECORDED contacting look identical in a ledger,
 *  and reporting them as one number is how a working system gets called broken. */
export function contactState(engagementCount: number, hasOwner: boolean): "untouched" | "unrecorded" | "worked" {
  if (Number(engagementCount) > 0) return "worked";
  return hasOwner ? "unrecorded" : "untouched";
}

// ---------------------------------------------------------------------------
// The seam that carries all of the above into the browser.
// ---------------------------------------------------------------------------

const DOMAIN_FNS = [
  stageWeight, isTerminalStage, isStalled, weightedValue,
  riyadhFiscalPeriod, riyadhPeriodBounds, attainmentPct, coveragePct, periodElapsedFraction, ragKey, contactState,
] as const;

export const SALES_DOMAIN_JS: string = [
  "/* ===== sales-domain (generated from src/sales-domain.ts — do not edit here) ===== */",
  "var SALES_STAGES = " + JSON.stringify(SALES_STAGES) + ";",
  "var STAGE_OUTCOMES = " + JSON.stringify(STAGE_OUTCOMES) + ";",
  "var DEPARTMENTS = " + JSON.stringify(DEPARTMENTS) + ";",
  "var STALL_STAGES = " + JSON.stringify(STALL_STAGES) + ";",
  "var STALL_DAYS = " + String(STALL_DAYS) + ";",
  "var RAG_GREEN_PCT = " + String(RAG_GREEN_PCT) + ";",
  "var RAG_AMBER_PCT = " + String(RAG_AMBER_PCT) + ";",
  ...DOMAIN_FNS.map((fn) => fn.toString()),
].join("\n");

/** Same boot assertion as opps-domain: a shipped function that references anything outside its own
 *  parameters and the injected constants compiles cleanly, passes in Node, and throws in the
 *  browser — which is a blank page. Returns the offenders rather than throwing. */
export function checkSalesDomainClosure(): string[] {
  const allowed = new Set<string>([
    "SALES_STAGES", "STAGE_OUTCOMES", "DEPARTMENTS", "STALL_STAGES", "STALL_DAYS",
    "RAG_GREEN_PCT", "RAG_AMBER_PCT",
    ...DOMAIN_FNS.map((fn) => fn.name),
    "Number", "String", "Math", "Date", "Object", "Array", "JSON", "Boolean", "Set",
  ]);
  const bad: string[] = [];
  for (const fn of DOMAIN_FNS) {
    const src = fn.toString();
    // Strip PROPERTY accesses before scanning. `Date.UTC` is a member of an allowed global, not a
    // free reference to a module-scope `UTC`, and treating it as one made the check fail on
    // correct code — a guard that cries wolf gets widened until it guards nothing.
    const body = src.slice(src.indexOf("{")).replace(/\.\s*[A-Za-z_$][A-Za-z0-9_$]*/g, "");
    const idents = body.match(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g) || [];
    for (const id of idents) {
      // Only module-scope constants are a risk; locals and params resolve fine. Upper-case-initial
      // identifiers are the injected constants and the globals above, so those are what we check.
      if (/^[A-Z]/.test(id) && !allowed.has(id) && !bad.includes(id)) bad.push(id);
    }
  }
  return bad;
}
