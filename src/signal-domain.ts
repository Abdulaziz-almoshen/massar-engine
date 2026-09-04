// signal-domain.ts — THE BUSINESS TIER for «مؤشرات العميل»: how serious this person is, which
// way the conversation is moving, and what the ledger says about both.
//
// WHY THIS FILE EXISTS. The client record answered «كيف تسير المحادثة؟» with paragraphs: a model
// summary, quoted buying signals, quoted objections, a verdict, its evidence, a next action and a
// justification for it — seven prose blocks the reader had to assemble into a judgement themselves.
// The founder's instruction: signals, not text. «We need indicators of what the client is
// interested in, how serious they are, and what the AI recommends as the next action.»
//
// A number needs a source or it is decoration. So every point below is earned by something the
// ledger WITNESSED — a message the customer typed, a tag an operator confirmed, an outcome a human
// recorded, a silence the clock measured. Nothing here asks a model anything: a score whose value
// changes when a prompt changes cannot be argued with, and this one is meant to be argued with.
// `factors` carries the itemised reason, so the meter is auditable rather than oracular.
//
// SERVER-ONLY, like interest.ts: it is not in `DOMAIN_FNS`, because the record page receives the
// computed read in its payload and only draws it. Shipping the rules to the browser would widen
// ADR-0001's closure contract for no second reader.
//
// `now` IS A PARAMETER, never `Date.now()` inside. Silence and momentum are the two signals that
// depend on the clock, and a rule that reads the clock itself cannot be tested at the boundary
// where it matters — the day it flips.

import { pluralizeArabic } from "./opps-domain.js";

export type SignalTurn = { role: "customer" | "agent" | "system"; text: string; ts: number };
export type SignalTag = { product: string; level: "hot" | "warm" | "cold"; ts: number };

export type SeriousnessInput = {
  transcript: readonly SignalTurn[];
  tags: readonly SignalTag[];
  /** The human-recorded outcome from tracker.Contact — a FACT, and the heaviest evidence here. */
  outcome?: string;
  optedOut?: boolean;
  /** True when the text is our own button title echoed back by a tap, not the customer writing. */
  isButtonEcho: (text: string) => boolean;
  now: number;
};

/** One earned (or forfeited) component of the score, carrying WHAT in the ledger produced it. A
 *  factor with no evidence sentence is not admitted: that is the whole contract of this module. */
export type SignalFactor = {
  key: string;
  label: string;
  points: number;
  evidence: string;
};

export type SeriousnessBand = "cold" | "watch" | "serious" | "ready";
export type Momentum = "rising" | "steady" | "cooling" | "silent" | "none";

export type SeriousnessRead = {
  score: number;
  band: SeriousnessBand;
  bandLabel: string;
  /** Why the meter reads what it reads — positives first, then what pulled it down. */
  factors: SignalFactor[];
  momentum: Momentum;
  momentumLabel: string;
  /** Median minutes between our message and their reply. Null when they never replied to one. */
  replyMinutes: number | null;
  /** Whole days since the customer last spoke. Null when they have never spoken. */
  daysSilent: number | null;
  /** Messages they typed themselves — taps and platform boilerplate excluded. */
  typedTurns: number;
};

/** The sandbox handshake Gupshup forces on a new contact. Duplicated deliberately from insights.ts
 *  rather than imported: this module must stay free of that file's OpenAI client, and a two-line
 *  regex is a cheaper coupling than a network adapter. Kept in step by tests on both sides. */
const ACTIVATION_RE = /^\s*(?:proxy\b|بروكسي(?:\s|$))[\s\S]{0,40}$/i;

/**
 * A COMMERCIAL ask — the customer moving the conversation toward a transaction in their own words.
 *
 * These are the sentences that separate someone reading from someone buying, and they are the
 * single heaviest positive here. Deliberately concrete nouns and verbs, not sentiment: «ممتاز»
 * is politeness, «كم السعر» is a step. Each alternative below is a phrase real prospects typed in
 * this product's own transcripts, not an imagined vocabulary.
 */
const COMMERCIAL_RE = /(?:كم\s*(?:السعر|التكلفة|يكلف)|السعر|التكلفة|عرض\s*سعر|عرض\s*فني|فاتورة|اشتراك|باقة|عقد|تجربة|ديمو|عرض\s*تعريفي|اجتماع|موعد|زيارة|كلمني|اتصل\s*(?:بي|فينا)|رقم\s*(?:التواصل|الجوال)|نبدأ|البدء|التنفيذ|كيف\s*(?:نبدأ|نشترك)|التكامل|ربط\s*(?:النظام|الأنظمة))/;

/** An explicit question from the customer. A prospect who asks is a prospect who is evaluating. */
const QUESTION_RE = /[؟?]/;

const BANDS: { min: number; band: SeriousnessBand; label: string }[] = [
  { min: 70, band: "ready", label: "جاهز للإغلاق" },
  { min: 45, band: "serious", label: "جاد" },
  { min: 20, band: "watch", label: "يستحق المتابعة" },
  { min: 0, band: "cold", label: "بارد" },
];

export function bandOf(score: number): { band: SeriousnessBand; label: string } {
  const hit = BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
  return { band: hit.band, label: hit.label };
}

const DAY_MS = 24 * 3600e3;

/** ONE numeral system. Every digit this module puts into an Arabic sentence is Arabic-Indic, the
 *  same as the portal's own `fmtN` — a mixed-numeral screen is the defect `check-numerals` exists
 *  to stop, and a server-composed sentence lands on that screen too. */
function arN(value: number): string {
  return Number(value || 0).toLocaleString("ar-SA");
}

function arDays(n: number): string {
  return pluralizeArabic(n, "يوم", "يومين", "أيام", "يومًا", arN);
}

/** Median rather than mean: one prospect who answered in four minutes and again three days later
 *  has a mean of a day and a half, which describes neither reply. */
function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Minutes from each of our messages to the customer's next reply.
 *
 * Only the FIRST customer turn after one of ours counts. A prospect who sends three messages in a
 * row is answering once, and counting the second and third as separate sub-minute replies would
 * report a responsiveness nobody demonstrated.
 */
export function replyLatencies(transcript: readonly SignalTurn[]): number[] {
  const out: number[] = [];
  let askedAt: number | null = null;
  for (const turn of transcript) {
    if (turn.role === "agent") askedAt = turn.ts;
    else if (turn.role === "customer" && askedAt !== null) {
      const minutes = Math.round((turn.ts - askedAt) / 60e3);
      if (minutes >= 0) out.push(minutes);
      askedAt = null;
    }
  }
  return out;
}

/**
 * Which way the conversation is going, from the customer's own message cadence.
 *
 * Compares the last 7 days against the 7 before them. This answers the question the record could
 * not: two prospects can both read «مهتم» while one is accelerating and the other went quiet a
 * fortnight ago, and the difference decides who gets called today.
 *
 * `silent` outranks the comparison: a 14-day gap is not «ثابت», it is a lapsed conversation, and a
 * ratio of zero to zero would otherwise report it as steady.
 */
export function readMomentum(transcript: readonly SignalTurn[], now: number): { momentum: Momentum; label: string } {
  const spoken = transcript.filter((t) => t.role === "customer");
  if (!spoken.length) return { momentum: "none", label: "لم يتكلم بعد" };
  const last = spoken[spoken.length - 1].ts;
  if (now - last >= 14 * DAY_MS) return { momentum: "silent", label: "صامت" };
  const recent = spoken.filter((t) => t.ts >= now - 7 * DAY_MS).length;
  const prior = spoken.filter((t) => t.ts >= now - 14 * DAY_MS && t.ts < now - 7 * DAY_MS).length;
  if (recent > prior) return { momentum: "rising", label: "يتصاعد" };
  if (recent < prior) return { momentum: "cooling", label: "يفتر" };
  return { momentum: "steady", label: "ثابت" };
}

/**
 * Daily message counts for the activity chart — the shape of the conversation at a glance.
 *
 * Every day in the window is emitted, INCLUDING the empty ones. A chart drawn only from days that
 * carry messages compresses a three-week silence into the gap between two adjacent bars and shows
 * a healthy rhythm that never happened. The silence is the signal.
 */
/** The same chart, from exact per-day counts instead of from a resident transcript.
 *
 *  Shares activityByDay's bucket construction deliberately: every day in the window is present,
 *  empty ones included, in the identical shape. A chart whose bars appear only on days that had
 *  traffic reads as a different chart, and the one thing this change must not do is redraw a
 *  shipped surface while claiming to only make it accurate. */
export function activityFromCounts(
  counts: readonly { day: number; inbound: number; outbound: number }[],
  now: number,
  days: number,
): { day: number; inbound: number; outbound: number }[] {
  const span = Math.max(1, Math.floor(days));
  const startOfToday = Math.floor(now / DAY_MS) * DAY_MS;
  const buckets = new Map<number, { day: number; inbound: number; outbound: number }>();
  for (let i = span - 1; i >= 0; i--) {
    const day = startOfToday - i * DAY_MS;
    buckets.set(day, { day, inbound: 0, outbound: 0 });
  }
  for (const c of counts) {
    const b = buckets.get(c.day);
    if (b) { b.inbound += c.inbound; b.outbound += c.outbound; }
  }
  return [...buckets.values()];
}

export function activityByDay(
  transcript: readonly SignalTurn[],
  now: number,
  days: number,
): { day: number; inbound: number; outbound: number }[] {
  const span = Math.max(1, Math.floor(days));
  const startOfToday = Math.floor(now / DAY_MS) * DAY_MS;
  const buckets = new Map<number, { day: number; inbound: number; outbound: number }>();
  for (let i = span - 1; i >= 0; i--) {
    const day = startOfToday - i * DAY_MS;
    buckets.set(day, { day, inbound: 0, outbound: 0 });
  }
  for (const turn of transcript) {
    if (turn.role === "system") continue;
    const day = Math.floor(turn.ts / DAY_MS) * DAY_MS;
    const bucket = buckets.get(day);
    if (!bucket) continue;
    if (turn.role === "customer") bucket.inbound++;
    else bucket.outbound++;
  }
  return [...buckets.values()];
}

/**
 * How serious this prospect is, 0–100, from what the ledger witnessed.
 *
 * The ceiling is 100 and the floor is 0, and both are reached: a clamped score is honest where a
 * raw sum is not, because «١٢٠٪ جاد» tells a reader the scale is invented.
 */
export function readSeriousness(input: SeriousnessInput): SeriousnessRead {
  const { now } = input;
  const transcript = input.transcript ?? [];
  const tags = input.tags ?? [];
  const conversation = transcript.filter((t) => t.role !== "system");
  const spoken = conversation.filter((t) => t.role === "customer");
  // What they wrote THEMSELVES. A tap echoes one of our own approved titles back at us, and the
  // platform's activation handshake is not the customer speaking at all — counting either as a
  // sentence is how a contact who never wrote a word came to read as engaged.
  const typed = spoken.filter((t) => t.text.trim() && !input.isButtonEcho(t.text) && !ACTIVATION_RE.test(t.text));
  const lastSpoke = spoken.length ? spoken[spoken.length - 1].ts : null;
  const daysSilent = lastSpoke === null ? null : Math.floor((now - lastSpoke) / DAY_MS);
  const replyMinutes = median(replyLatencies(conversation));
  const factors: SignalFactor[] = [];
  const add = (key: string, label: string, points: number, evidence: string) =>
    factors.push({ key, label, points, evidence });

  // OPT-OUT ENDS THE QUESTION. Not a penalty among others: a person who asked us to stop is not a
  // weakly-serious prospect, they are not a prospect, and a meter that renders them at 30 invites
  // exactly the follow-up the opt-out forbids.
  if (input.optedOut) {
    const read = bandOf(0);
    return {
      score: 0, band: read.band, bandLabel: read.label,
      factors: [{ key: "opted_out", label: "أوقف الرسائل", points: 0, evidence: "طلب إيقاف الرسائل — لا متابعة." }],
      momentum: "silent", momentumLabel: "أوقف الرسائل",
      replyMinutes, daysSilent, typedTurns: typed.length,
    };
  }

  // 1 — THEY WROTE BACK. The first real threshold in any conversation.
  if (typed.length >= 3) {
    add("depth", "حوار مكتمل", 25, "كتب " + pluralizeArabic(typed.length, "رسالة", "رسالتين", "رسائل", "رسالة", arN) + " بكلماته.");
  } else if (typed.length === 2) {
    add("depth", "ردّ مرتين", 16, "كتب رسالتين بكلماته.");
  } else if (typed.length === 1) {
    add("depth", "ردّ مرة", 9, "كتب رسالة واحدة بكلماته.");
  } else if (spoken.length) {
    add("taps_only", "أزرار فقط", 3, "تفاعل بالأزرار ولم يكتب بكلماته — لا نعرف احتياجه بعد.");
  }

  // 2 — A COMMERCIAL ASK, quoted. The heaviest earned signal, and the one worth reading verbatim,
  // so the evidence carries the customer's actual clause rather than the rule's name.
  const asking = typed.find((t) => COMMERCIAL_RE.test(t.text));
  if (asking) add("commercial", "طلب تجاري", 25, "قال: «" + clip(asking.text, 90) + "»");

  // 3 — THEY ASKED SOMETHING. Weaker than a commercial ask and deliberately not additive with it
  // at full weight: a priced question is one step, not two.
  if (typed.some((t) => QUESTION_RE.test(t.text))) add("question", "طرح سؤالًا", 10, "سأل بنفسه داخل المحادثة.");

  // 4 — A CONFIRMED INTEREST TAG. A human or the tagging tool naming a product, which outranks any
  // reading of the same transcript.
  const hottest = [...tags].sort((a, b) => rank(b.level) - rank(a.level))[0];
  if (hottest?.level === "hot") add("tag", "وسم نية مرتفعة", 15, "وسم مؤكد: " + hottest.product + " · نية مرتفعة.");
  else if (hottest?.level === "warm") add("tag", "وسم اهتمام", 8, "وسم مؤكد: " + hottest.product + " · مهتم.");

  // 5 — A RECORDED OUTCOME. A human wrote this down after speaking to them; it is the strongest
  // evidence on the record and the only factor here that no amount of typing can produce.
  if (input.outcome === "scheduled") add("outcome", "موعد محدد", 20, "سُجّل موعد مع هذه الجهة.");
  else if (input.outcome === "interested") add("outcome", "مفروز مهتمًا", 12, "فُرز مهتمًا في السجل.");
  else if (input.outcome === "handoff") add("outcome", "طلب مختصًا", 12, "طلب التحدث إلى مختص.");

  // 6 — SPEED. Answering in minutes is a different level of attention from answering in days, and
  // it is the one signal here that no single message can fake.
  if (replyMinutes !== null && replyMinutes <= 60) add("speed", "ردّ سريع", 10, "وسيط ردّه أقل من ساعة.");
  else if (replyMinutes !== null && replyMinutes <= 6 * 60) add("speed", "ردّ خلال ساعات", 5, "وسيط ردّه خلال ساعات.");

  // 7 — SILENCE, subtracted. Everything above is a photograph of the past; this is the only factor
  // that asks whether the past is still true.
  if (daysSilent !== null && daysSilent >= 14) add("silence", "صمت طويل", -20, "لم يتكلم منذ " + arDays(daysSilent) + ".");
  else if (daysSilent !== null && daysSilent >= 7) add("silence", "صمت أسبوع", -12, "لم يتكلم منذ " + arDays(daysSilent) + ".");
  else if (daysSilent !== null && daysSilent >= 3) add("silence", "صمت أيام", -6, "لم يتكلم منذ " + arDays(daysSilent) + ".");

  // 8 — A RECORDED REFUSAL. Not the opt-out (handled above, and sacred), but a human filing this
  // person as closed or uninterested. It empties the meter rather than denting it: the alternative
  // is a «جاد» band on somebody the team has already written off.
  if (input.outcome === "not_interested" || input.outcome === "stopped" || input.outcome === "closed") {
    const sum = factors.reduce((n, f) => n + f.points, 0);
    add("refused", "لا يرغب في التواصل", -Math.max(sum, 0), "فُرز على أنه لا يرغب في المتابعة.");
  }

  const raw = factors.reduce((n, f) => n + f.points, 0);
  const score = Math.max(0, Math.min(100, raw));
  const read = bandOf(score);
  const move = readMomentum(conversation, now);
  return {
    score, band: read.band, bandLabel: read.label,
    // Positives first, then the deductions: the reader is asking «why this number», and the
    // subtractions only make sense against what was earned.
    factors: [...factors].sort((a, b) => b.points - a.points),
    momentum: move.momentum, momentumLabel: move.label,
    replyMinutes, daysSilent, typedTurns: typed.length,
  };
}

function rank(level: string): number {
  return level === "hot" ? 3 : level === "warm" ? 2 : 1;
}

function clip(text: string, max: number): string {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
