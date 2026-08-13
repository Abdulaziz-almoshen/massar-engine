import type { Contact } from "./tracker.js";
import type { Insights } from "./insights.js";

// ---------------------------------------------------------------------------
// Behavioural segmentation — «التقسيم وإعادة الاستهداف»
//
// Built to the market study in .orbit/artifacts/segmentation/BENCHMARK.md (11 platforms).
// The five primitives every serious tool exposes, and the only ones we implement:
//   1. an event did / did NOT happen        (Klaviyo: "What someone has done (or not done)")
//   2. a relative time window                (in the last N days · before · over all time)
//   3. frequency                             (at least once · zero times)
//   4. AND/OR grouping
//   5. live membership — evaluated on read, never a stored snapshot
//
// Two things are deliberately NOT copied from the tools benchmarked:
//   · WATI and AiSensy split the model — behaviour lives in per-campaign analytics, attributes
//     in the segment builder, and the two never join, so «read the product-X message AND no
//     reply for 5 days AND not messaged in 7 days» cannot be expressed at all. Here a segment
//     is ONE object over the ledger, so behaviour and attributes compose.
//   · Email semantics. WhatsApp gives delivered / read / replied, and «read» is lossy because a
//     customer can disable receipts. We never call it «فُتحت».
// ---------------------------------------------------------------------------

/** What happened to this contact. Named for the ledger, not for an email tool. */
export type SignalKind =
  | "delivered"      // the message reached the device
  | "read"           // blue ticks — lossy by design, the customer may disable it
  | "replied"        // they sent us anything back
  | "failed"         // delivery failed
  | "interest"       // an interest tag was recorded
  | "meeting"        // a human recorded a booked meeting
  | "opted_out";     // they asked us to stop

export type Comparator = "happened" | "never_happened";

export type Condition = {
  signal: SignalKind;
  comparator: Comparator;
  /** Bound to the last N days. Omit for «over all time». */
  withinDays?: number;
  /** Happened MORE than N days ago — Klaviyo's «Before». This is what «لم يردّ منذ ٥ أيام»
   *  actually measures: the SILENCE is the age of the last positive signal, not a window on
   *  the absence. Bounding the negative instead matched people who had been read six days ago
   *  as «never read», which is the opposite of the truth. */
  beforeDays?: number;
  /** «at least N times» — defaults to 1. Only meaningful with comparator "happened". */
  atLeast?: number;
  /** Restrict to one service, matching the catalogue name. */
  product?: string;
};

export type SegmentDef = {
  match: "all" | "any";          // Customer.io's «All» / «At least one»
  conditions: Condition[];
  /** Exclude anyone messaged within this many days — the suppression the split-model tools lack. */
  cooldownDays?: number;
  /** Ignore contacts newer than this. See TENURE below. */
  minTenureDays?: number;
};

export const DEFAULT_WINDOW_DAYS = 5;   // Klaviyo ships this exact window for this exact case
export const WINDOW_MIN = 3;
export const WINDOW_MAX = 14;
/** Meta caps marketing templates at 2 per person per 24h ACROSS ALL BUSINESSES (error 131049),
 *  so a two-day floor is the product's own courtesy margin, not a platform limit. */
export const DEFAULT_COOLDOWN_DAYS = 2;

const DAY = 86_400_000;

// --------------------------------------------------------------------------- signals

function lastCustomerTurn(c: Contact): number {
  let ts = 0;
  for (const t of c.transcript || []) if (t.role === "customer" && t.ts > ts) ts = t.ts;
  return ts;
}

/** Every timestamp at which `signal` occurred for this contact. The ledger only keeps the
 *  latest delivery status per contact, so those yield at most one — stated rather than hidden,
 *  because it means «at least 3 times» is only meaningful for interest and replies today. */
function occurrences(c: Contact, signal: SignalKind, product?: string): number[] {
  const st = c.statusTimes || {};
  switch (signal) {
    case "delivered": return st.delivered ? [Number(st.delivered)] : [];
    case "read":      return st.read ? [Number(st.read)] : [];
    case "failed":    return st.failed ? [Number(st.failed)] : [];
    case "opted_out": return c.optedOut ? [c.lastEventAt || 0] : [];
    case "replied": {
      const turns = (c.transcript || []).filter((t) => t.role === "customer").map((t) => t.ts);
      if (turns.length) return turns;
      return st.replied ? [Number(st.replied)] : [];
    }
    case "interest":
      return (c.tags || []).filter((t) => !product || t.product === product).map((t) => t.ts);
    case "meeting": {
      // A booked meeting is NOT on contact.outcome — /admin/contact/outcome writes it as an
      // event and a transcript marker «[نتيجة بشرية: meeting_booked]». Read it where it lives,
      // and honour a later «clear» that revokes it.
      let booked = 0, cleared = 0;
      for (const t of c.transcript || []) {
        // role must be "system": tracker.recordSystem writes these markers, and a CUSTOMER who
        // types «[نتيجة بشرية: meeting_booked]» must not be able to remove themselves from a
        // follow-up segment. Reading every role made the marker forgeable by the person it judges.
        if (t.role !== "system") continue;
        if (t.text.includes("[نتيجة بشرية: meeting_booked]")) booked = Math.max(booked, t.ts);
        if (t.text.includes("[أُزيلت النتيجة البشرية]")) cleared = Math.max(cleared, t.ts);
      }
      return booked && booked > cleared ? [booked] : [];
    }
  }
}

function conditionHolds(c: Contact, cond: Condition, now: number): boolean {
  const all = occurrences(c, cond.signal, cond.product);
  let scoped = all.filter((ts) => ts > 0);
  if (cond.withinDays) scoped = scoped.filter((ts) => now - ts <= cond.withinDays! * DAY);
  if (cond.beforeDays) scoped = scoped.filter((ts) => now - ts > cond.beforeDays! * DAY);
  if (cond.comparator === "never_happened") return scoped.length === 0;
  return scoped.length >= Math.max(1, cond.atLeast || 1);
}

// --------------------------------------------------------------------------- evaluation

export type MatchResult = {
  matched: Contact[];
  /** Excluded by the cooldown — surfaced, never silently dropped. */
  suppressed: { phone: string; name: string; reason: string }[];
  /** Too new to satisfy a «no X in N days» condition. See TENURE. */
  tooNew: { phone: string; name: string }[];
};

/** TENURE: Customer.io documents this trap explicitly — a contact added today cannot satisfy
 *  «has not replied in 5 days», because they have not existed for 5 days. Left unguarded, the
 *  founder's first segment returns an empty set and reads as a broken feature. We separate
 *  those contacts out and report them, rather than counting or hiding them. */
export function requiredTenureDays(def: SegmentDef): number {
  if (def.minTenureDays != null) return def.minTenureDays;
  let need = 0;
  for (const c of def.conditions) {
    // Only a condition that REQUIRES elapsed time creates a tenure floor. «لم يردّ خلال ٥ أيام»
    // does; «لم يردّ قبل أكثر من ٣٠ يومًا» is trivially true for a new contact and must not.
    if (c.comparator === "never_happened" && c.withinDays) need = Math.max(need, c.withinDays);
    if (c.comparator === "happened" && c.beforeDays) need = Math.max(need, c.beforeDays);
  }
  return need;
}

export function evaluate(def: SegmentDef, contacts: Contact[], now = Date.now()): MatchResult {
  const tenure = requiredTenureDays(def);
  const cooldown = def.cooldownDays ?? DEFAULT_COOLDOWN_DAYS;
  const res: MatchResult = { matched: [], suppressed: [], tooNew: [] };

  for (const c of contacts) {
    // Opt-out is absolute and is never a segmentable audience, whatever the conditions say.
    if (c.optedOut) continue;

    const name = c.waName || c.phone;
    const results = def.conditions.map((cond) => conditionHolds(c, cond, now));
    const hit = def.match === "any" ? results.some(Boolean) : results.every(Boolean);

    // Tenure is a reason a contact could not YET qualify — so it is only interesting when the
    // contact does NOT match. Checking it first discarded contacts that already qualified via a
    // tenure-free branch of an «أي شرط» segment (a failed delivery an hour ago is a real match).
    const tooYoung = tenure > 0 && c.firstSeenAt && now - c.firstSeenAt < tenure * DAY;
    if (!hit) {
      if (tooYoung) res.tooNew.push({ phone: c.phone, name });
      continue;
    }
    if (tooYoung && def.match === "all") { res.tooNew.push({ phone: c.phone, name }); continue; }

    // The suppression WATI and AiSensy cannot express: do not message someone we just messaged.
    const lastOut = Math.max(Number((c.statusTimes || {}).sent || 0), Number((c.statusTimes || {}).delivered || 0));
    if (cooldown > 0 && lastOut && now - lastOut < cooldown * DAY) {
      const hours = Math.round((now - lastOut) / 3_600_000);
      res.suppressed.push({ phone: c.phone, name, reason: `رُوسلت قبل ${hours} ساعة` });
      continue;
    }
    res.matched.push(c);
  }
  return res;
}

/** Days of silence since the customer last spoke — what «لم يردّ منذ ٥ أيام» actually measures. */
export function daysSilent(c: Contact, now = Date.now()): number | null {
  const last = lastCustomerTurn(c) || Number((c.statusTimes || {}).delivered || 0);
  return last ? Math.floor((now - last) / DAY) : null;
}

// --------------------------------------------------------------------------- presets

/** The market's own vocabulary, not invented Arabic. Sources in the benchmark:
 *  WATI names «Ignored» and «Read only (didn't reply)»; AiSensy «Replied Audience»;
 *  HubSpot «Unengaged»; Attentive «Winback». The last preset has no competitor equivalent —
 *  no benchmarked tool joins an AI-read buying intent to a missing human outcome. */
export type Preset = { id: string; label: string; hint: string; def: SegmentDef };

export function presets(windowDays = DEFAULT_WINDOW_DAYS): Preset[] {
  return [
    {
      id: "read_no_reply",
      label: "قُرئت ولم يُردّ عليها",
      hint: `وصلت الرسالة وفُتحت، ولم يصل ردّ خلال ${windowDays} أيام.`,
      def: { match: "all", conditions: [
        { signal: "read", comparator: "happened", beforeDays: windowDays },
        { signal: "replied", comparator: "never_happened" },
      ] },
    },
    {
      id: "delivered_no_read",
      label: "وصلت ولم تُقرأ",
      hint: `سُلّمت الرسالة ولم تُفتح خلال ${windowDays} أيام. راجعوا التوقيت وصياغة السطر الأول.`,
      def: { match: "all", conditions: [
        { signal: "delivered", comparator: "happened", beforeDays: windowDays },
        { signal: "read", comparator: "never_happened" },
      ] },
    },
    {
      id: "lapsed",
      label: "ردّ ثم انقطع",
      hint: `تفاعل معنا سابقًا ثم توقف منذ ${windowDays} أيام أو أكثر.`,
      def: { match: "all", conditions: [
        { signal: "replied", comparator: "happened" },
        { signal: "replied", comparator: "never_happened", withinDays: windowDays },
      ] },
    },
    {
      id: "interested_no_meeting",
      label: "مهتم بلا موعد",
      hint: "سجّل المساعد اهتمامًا واضحًا ولم يُحجز اجتماع بعد. لا تملك أي منصة أخرى هذه الفئة.",
      def: { match: "all", conditions: [
        { signal: "interest", comparator: "happened" },
        { signal: "meeting", comparator: "never_happened" },
      ] },
    },
    {
      id: "undelivered",
      label: "لم تُسلَّم",
      hint: "فشل التسليم. تحققوا من الأرقام قبل إعادة المحاولة.",
      def: { match: "all", conditions: [{ signal: "failed", comparator: "happened" }] },
    },
  ];
}

/** Human-readable Arabic for one condition — the builder shows this, never JSON. */
export function describe(cond: Condition): string {
  // Arabic negation is not a prefix. «لم» takes the jussive, so «لم وصل ردّ» is wrong —
  // each signal carries both forms rather than being assembled from one.
  const POS: Record<SignalKind, string> = {
    delivered: "وصلت الرسالة", read: "قُرئت الرسالة", replied: "وصل ردّ",
    failed: "فشل التسليم", interest: "سُجّل اهتمام", meeting: "حُجز موعد", opted_out: "طلب الإيقاف",
  };
  const NEG: Record<SignalKind, string> = {
    delivered: "لم تصل الرسالة", read: "لم تُقرأ الرسالة", replied: "لم يصل ردّ",
    failed: "لم يفشل التسليم", interest: "لم يُسجَّل اهتمام", meeting: "لم يُحجز موعد", opted_out: "لم يطلب الإيقاف",
  };
  const base = cond.comparator === "never_happened" ? NEG[cond.signal] : POS[cond.signal];
  const prod = cond.product ? ` عن خدمة ${cond.product}` : "";
  // Arabic number agreement: 3-10 take the plural («٥ أيام»), 11+ the singular accusative
  // («١٤ يومًا»). «14 أيام» is the kind of error the founder reads as carelessness.
  const days = (n: number) => (n >= 11 ? `${n} يومًا` : `${n} أيام`);
  const win = cond.withinDays ? ` خلال آخر ${days(cond.withinDays)}`
    : cond.beforeDays ? ` قبل أكثر من ${days(cond.beforeDays)}` : "";
  const times = cond.comparator === "happened" && (cond.atLeast || 1) > 1 ? ` ${cond.atLeast} مرات على الأقل` : "";
  return `${base}${prod}${win}${times}`;
}

export function describeSegment(def: SegmentDef): string {
  const joiner = def.match === "any" ? " أو " : "، و";
  return def.conditions.map(describe).join(joiner);
}
