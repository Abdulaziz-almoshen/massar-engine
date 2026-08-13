import OpenAI from "openai";
import { cfg } from "./config.js";
import * as db from "./db.js";
import type { Contact } from "./tracker.js";
import type { EntityRow } from "./db.js";

// ---------------------------------------------------------------------------
// فهم المساعد — the honest intelligence layer. Reads ONE contact's own ledger
// (transcript, tags, statuses, attrs) and produces labeled, sourced signals:
// intent level, buying signals, objections, next best action + best moment.
// No invented probabilities, no cross-contact data, ZERO outbound capability.
// Cached in Postgres keyed by a transcript-length watermark.
// ---------------------------------------------------------------------------

const client = new OpenAI({ apiKey: cfg.openaiKey, timeout: 20_000, maxRetries: 1 });

export type Insights = {
  summary: string;
  intent: "high" | "medium" | "low" | "none";
  signals: string[];
  objections: string[];
  product_interest: { product: string; level: "high" | "medium" | "low" }[];
  next_action: string;
  why: string;
  best_time: string;
  learning?: boolean;          // < 2 customer messages — mirror the reference's "Learning…"
  // Win/Loss attribution («لماذا بعنا ولماذا لم نبع») — evidence-quoted, never invented.
  deal_state?: "won" | "lost" | "stalled" | "active";
  stage?: string;
  stage_reason?: string;
  loss_cause?: string;         // from LOSS_TAXONOMY (empty unless lost/stalled)
  win_drivers?: string[];      // what moved this deal forward (verbatim-anchored)
  evidence?: string;           // the customer quote that proves the call
  fix_suggestion?: string;     // what would likely have won/revived it
};

export const SALES_STAGES = ["تعارف", "تشخيص الاحتياج", "عرض الحل", "معالجة الاعتراض", "تنسيق العرض التعريفي", "الإغلاق"] as const;
export const LOSS_TAXONOMY = ["التكلفة", "التوقيت", "عدم ملاءمة الخدمة", "عدم وضوح التواصل", "عدم وضوح الملف التعريفي", "لا استجابة", "عدم ملاءمة الجهة", "طلب التواصل مع مختص"] as const;

/** The service names in `PRODUCTS` (agent.ts) — keep in step when the catalogue changes. */
export const SERVICE_CATALOGUE = ["الإجازات المرضية", "فحص الموظفين", "التقارير الطبية", "خدمات التطعيمات", "الشهادات الصحية", "تكامل الأنظمة (HIS/ERP)"] as const;
export const OTHER_SERVICE = "خدمة أخرى";

// The model describes what the customer asked about in its own words, so one service arrives
// under many names («نظام الإجازات المرضية», «ربط وإصدار الإجازات المرضية عبر النظام الحالي»,
// «إجراءات الإجازات المرضية الإلكترونية» …). Left raw, the market verdict splits one service
// across a dozen rows and invents services the catalogue does not contain. Loss causes and
// stages are already clamped to a closed list; services now are too. First pattern wins, so
// the list is ordered by which noun is the subject when a phrase names two.
const SERVICE_PATTERNS: [RegExp, string][] = [
  // A phrase that OPENS with integration is about integration, whatever it integrates:
  // «تكامل خدمة الإجازات المرضية مع سجل التطعيمات» is an integration deal, while
  // «الإجازات المرضية مع تكامل HIS» is a sick-leave deal. Anchored, so it only wins when leading.
  [/^\s*(?:تكامل|الربط|ربط)\b/, "تكامل الأنظمة (HIS/ERP)"],
  [/إجاز|مرضي/, "الإجازات المرضية"],
  [/تطعيم|NVR|السجل الوطني/i, "خدمات التطعيمات"],
  [/شهاد/, "الشهادات الصحية"],
  // تقارير before فحص: «تقارير طبية عن الموظفين» is a reports deal, and «الموظفين» alone
  // would otherwise capture it for فحص الموظفين.
  [/تقرير|تقارير/, "التقارير الطبية"],
  [/فحص|الموظفين/, "فحص الموظفين"],
  [/تكامل|ربط|الربط|HIS|ERP|واجهات/i, "تكامل الأنظمة (HIS/ERP)"],
];

/** The sandbox handshake Gupshup forces on every new contact — shared with the agent so the
 *  guard and the interaction log always agree on what counts as platform plumbing. */
export const SANDBOX_ACTIVATION_RE = /^\s*(?:proxy\b|بروكسي(?:\s|$))[\s\S]{0,40}$/i;

/** Apply the clamp on the way OUT of the cache as well. Rows written before it existed still
 *  hold free text, and the portal's chips, filters and boards all read those rows directly —
 *  normalising only at the aggregate left «باقات NVR لتغطية 8 مواقع» on the campaign row. */
export function normalizeCached<T extends { product_interest?: { product: string; level: string }[] }>(d: T): T {
  if (!d || !Array.isArray(d.product_interest)) return d;
  // Two readings can collapse onto one service («نظام الإجازات المرضية» low + «إصدار الإجازات
  // المرضية» high). Keeping the first would discard the hotter signal — and that level drives
  // the chip colour — so merge on the strongest.
  const rank = { high: 3, medium: 2, low: 1 } as Record<string, number>;
  const best = new Map<string, { product: string; level: string }>();
  for (const p of d.product_interest) {
    const product = canonicalService(p.product);
    if (!product) continue;
    const prev = best.get(product);
    if (!prev || (rank[p.level] ?? 0) > (rank[prev.level] ?? 0)) best.set(product, { ...p, product });
  }
  return { ...d, product_interest: [...best.values()] as typeof d.product_interest };
}

/** Map a free-text service mention onto the catalogue; anything unrecognised shares one
 *  honest bucket rather than becoming a service Lean does not sell. */
export function canonicalService(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  if ((SERVICE_CATALOGUE as readonly string[]).includes(s)) return s;
  for (const [re, name] of SERVICE_PATTERNS) if (re.test(s)) return name;
  return OTHER_SERVICE;
}

const SYSTEM = [
  "أنت محلل مبيعات لدى لِين لخدمات الأعمال. حلّل محادثة واتساب واحدة بين مساعد المبيعات وممثل منشأة صحية، مستندًا إلى نص المحادثة وتصنيفات الاهتمام وحالة التسليم وبيانات الجهة المتاحة.",
  "استخرج فقط ما تدعمه المحادثة نصًا. لا تستنتج نية أو اعتراضًا دون دليل، واكتب بفصحى واضحة وموجزة.",
  "intent: high = طلب صريح للسعر أو بدء الاشتراك أو تنسيق موعد؛ medium = أسئلة محددة عن المتطلبات أو التفاصيل؛ low = ردود عامة لا تدل على تقدم؛ none = لا توجد إشارة مدعومة نصيًا.",
  "next_action: إجراء واحد محدد ينفذه مدير المبيعات الآن، مثل «تواصل اليوم لمناقشة باقة المنشآت» أو «أرسل عرض الأسعار التفصيلي». why: سطر موجز يربط الإجراء بكلام ممثل المنشأة.",
  "best_time: حدّد نافذة تواصل واقعية ضمن أيام العمل في السعودية من ٩ص إلى ٥م، استنادًا إلى أوقات رسائل ممثل المنشأة عند توفرها. عند غياب الدليل، اقترح صباح يوم العمل التالي.",
  "stage: حدّد أين يقف العميل على مسار البيع، واختر حصريًا من: تعارف · تشخيص الاحتياج · عرض الحل · معالجة الاعتراض · تنسيق العرض التعريفي · الإغلاق. stage_reason: سطر واحد يبرر الاختيار من كلام العميل.",
  "حكم الصفقة deal_state: won = التزم صراحة بالاشتراك/الاجتماع النهائي؛ lost = رفض نهائيًا أو انسحب؛ stalled = توقف التفاعل بعد اهتمام (صمت > يومين بعد آخر رسالة منا)؛ active = الحوار مستمر طبيعيًا.",
  "إذا كانت deal_state تساوي lost أو stalled، فاختر loss_cause حصرًا من: التكلفة، التوقيت، عدم ملاءمة الخدمة، عدم وضوح التواصل، عدم وضوح الملف التعريفي، لا استجابة، عدم ملاءمة الجهة، طلب التواصل مع مختص. اجعل evidence اقتباسًا حرفيًا من ممثل المنشأة، أو وصفًا دقيقًا لغياب الرد، واجعل fix_suggestion إجراءً واقعيًا قد يدعم استئناف الصفقة أو إغلاقها.",
  "إذا كانت deal_state تساوي won، أو active مع تقدم واضح، فاجعل win_drivers عوامل مدعومة نصيًا أسهمت في تقدم الصفقة، مثل سرعة الاستجابة أو وضوح الملف أو ملاءمة التكلفة أو الحاجة التشغيلية.",
  `product_interest.product: اسم الخدمة كما هو في كتالوج لِين حصرًا، واحد من: ${SERVICE_CATALOGUE.join("، ")}. لا تصف الخدمة بعبارة من عندك ولا تدمج خدمتين في اسم واحد؛ إن ذكر ممثل المنشأة أكثر من خدمة فأدرج كل واحدة في عنصر مستقل. وإن كان ما سأل عنه خارج الكتالوج فاكتب «${OTHER_SERVICE}».`,
  'أعد JSON فقط: {"summary":"سطر واحد","intent":"high|medium|low|none","signals":["..."],"objections":["..."],"product_interest":[{"product":"...","level":"high|medium|low"}],"next_action":"...","why":"...","best_time":"...","deal_state":"won|lost|stalled|active","stage":"واحدة من المراحل الست","stage_reason":"سبب قصير","loss_cause":"","win_drivers":["..."],"evidence":"اقتباس حرفي","fix_suggestion":""}',
].join("\n");

/** Can we legally message this contact RIGHT NOW, and if not, why?
 *
 *  WhatsApp accepts a free-form (session) message only inside 24 hours of the customer's own last
 *  message. Outside it, only a Meta-approved template. The launch path sends session messages, so
 *  the founder's campaign to two contacts who had last written 33h earlier failed with
 *  «Re-engagement message» — and the screen had told him nothing beforehand.
 *
 *  Every comparable tool discovers this at SEND time (Twilio 63016, WATI campaign errors,
 *  respond.io has it as an open feature request). Gupshup's own Campaign Manager designs it out by
 *  building campaigns from approved templates. We can at least refuse to fire into a closed window.
 *
 *  UNKNOWN is deliberately NOT merged into CLOSED: "never wrote to us" and "wrote 30 hours ago" are
 *  different problems with different fixes, and collapsing them hides the consent question. */
export type WindowState = "open" | "closed" | "unknown";
export const SESSION_WINDOW_MS = 24 * 3600e3;

export function windowState(c: Contact | undefined, now = Date.now()): {
  state: WindowState; lastInboundAt: number | null; hoursLeft: number | null; reason: string;
} {
  // Only the CUSTOMER's own turns open the window — an agent or system turn never does.
  const inbound = (c?.transcript || []).filter((t) => t.role === "customer");
  if (!inbound.length) {
    return { state: "unknown", lastInboundAt: null, hoursLeft: null,
      reason: "لم يراسلنا من قبل — لا نافذة مفتوحة ولا تأكيد على رغبته في التواصل." };
  }
  const last = inbound.reduce((m, t) => Math.max(m, t.ts), 0);
  const age = now - last;
  if (age < SESSION_WINDOW_MS) {
    return { state: "open", lastInboundAt: last, hoursLeft: Math.floor((SESSION_WINDOW_MS - age) / 3600e3),
      reason: "راسلَنا خلال ٢٤ ساعة — الرسالة الحرة مسموحة الآن." };
  }
  return { state: "closed", lastInboundAt: last, hoursLeft: 0,
    reason: "آخر رسالة منه تجاوزت ٢٤ ساعة — واتساب لا يقبل إلا قالبًا معتمدًا." };
}

/** Split a target list into what can actually be sent now. Arithmetic over the ledger: no network,
 *  no send, and it produces the exact «needs a template» cohort that prices the WABA migration. */
export function reachability(contacts: (Contact | undefined)[], now = Date.now()) {
  const open: string[] = [], closed: string[] = [], unknown: string[] = [];
  let soonestExpiryHours: number | null = null;
  for (const c of contacts) {
    const w = windowState(c, now);
    const phone = c?.phone ?? "";
    if (w.state === "open") {
      open.push(phone);
      if (w.hoursLeft !== null && (soonestExpiryHours === null || w.hoursLeft < soonestExpiryHours)) soonestExpiryHours = w.hoursLeft;
    } else if (w.state === "closed") closed.push(phone);
    else unknown.push(phone);
  }
  return { open, closed, unknown, soonestExpiryHours, sendable: open.length, total: contacts.length };
}

/** What the CONVERSATION actually was — not what we hold on file about the person.
 *
 *  The founder's words on seeing «١٠٠٪ اكتمال السياق»: «this doesnt represent the real interaction
 *  make it reflect the agent and customer feedback». He was right, and the live data proves it: one
 *  contact scores near-full on context completeness with 14 customer turns and 11 interest tags,
 *  while the longest thing that customer ever typed is «ماني مهتم لا تتصل علي». A checklist of
 *  fields we possess cannot see a refusal.
 *
 *  Everything here is computed from the transcript — no model call, no estimate, no score out of
 *  100. It reports counts, a state, and the customer's own most substantive sentence as the
 *  evidence, per the standing rule that an intelligence surface must justify its reading with the
 *  customer's own words. */
export type InteractionRead = {
  customerTurns: number;
  agentTurns: number;
  typedTurns: number;          // customer messages that are NOT a button echo — their own words
  tappedTurns: number;         // button taps
  customerWords: number;
  agentWords: number;
  state: "no_reply" | "taps_only" | "awaiting_customer" | "reciprocal" | "one_sided" | "refused";
  stateLabel: string;
  stateReason: string;
  voice: { text: string; ts: number } | null;   // longest thing they said in their own words
  lastSpeaker: "customer" | "agent" | null;
  hoursSinceCustomer: number | null;
  openQuestion: boolean;       // the agent's last message ended in a question nobody answered
};

export function interactionRead(c: Contact, isButtonEcho: (t: string) => boolean): InteractionRead {
  const turns = (c.transcript || []).filter((t) => t.role !== "system");
  const cust = turns.filter((t) => t.role === "customer");
  const agent = turns.filter((t) => t.role === "agent");
  // A tap echoes an approved title verbatim; anything else is the customer speaking for themselves.
  // Exclude the sandbox activation boilerplate — «Proxy Massar» is the platform talking, not the
  // customer, and it was being surfaced as one contact's most substantive sentence.
  const typed = cust.filter((t) => t.text.trim() && !isButtonEcho(t.text) && !SANDBOX_ACTIVATION_RE.test(t.text));
  const words = (list: typeof turns) => list.reduce((n, t) => n + t.text.trim().split(/\s+/).filter(Boolean).length, 0);
  // Strip our own bookkeeping markers before measuring what the agent actually said.
  const clean = (t: string) => t.replace(/\[[^\]]*\]/g, " ").trim();
  const voiceTurn = [...typed].sort((a, b) => b.text.length - a.text.length)[0] ?? null;
  const last = turns.length ? turns[turns.length - 1] : null;
  const lastCust = cust.length ? cust[cust.length - 1] : null;
  const hoursSinceCustomer = lastCust ? Math.floor((Date.now() - lastCust.ts) / 3600e3) : null;
  const lastAgent = agent.length ? agent[agent.length - 1] : null;
  const openQuestion = Boolean(last?.role === "agent" && lastAgent && /؟/.test(clean(lastAgent.text)));

  // An explicit refusal in the customer's OWN words. Deliberately narrow and anchored — these are
  // statements of disinterest, not the opt-out path (which is handled pre-LLM and is sacred).
  // Anchored to end-of-clause. The first version matched «ما نبغى نتأخر» (we don't want to be late),
  // «لا نحتاج وقت طويل» (we don't need long) and — worst — «مو مهتم بالسعر بقدر الجودة» (not
  // interested in price so much as quality), a BUYING signal, all labelled «رفض صريح». A bare
  // negation plus a verb is not a refusal; a refusal ends the thought.
  // Anchoring alone was wrong in the other direction: «لسنا مهتمين» failed because «مهتمين» carries
  // a plural suffix, so «مهتم» was not at end-of-clause. Arabic inflects — the anchor must sit after
  // the suffix, not after the stem. Same family as the «لم» inside «الملف» trap.
  const EOC = "(?=\\s*($|[.،؛!؟]))";
  // «ه» for «ة» is ordinary Saudi typing, and an intensifier commonly follows («نهائيا», «ابد»).
  // Found by adversarial review, not by imagination — these are forms real people type.
  const MUHTAM = "مهتم(ين|ون|ة|ه|ات|ًا|ا)?";
  const INTENSIFIER = "(نهائيا|نهائيًا|ابد|أبدًا|أبدا|خالص|مرة)?";
  const REFUSAL = new RegExp(
    // A short demonstrative may follow («لست مهتم بهذا»), but not a comparative clause
    // («مو مهتم بالسعر بقدر الجودة» — a buying signal, not a refusal).
    "(ما\\s?ني|ماني|مو|لست|لسنا|لسنَا|غير)\\s*" + MUHTAM + "\\s*" + INTENSIFIER + "\\s*(شكرا|شكرًا|بهذا|بهذه|بذلك|فيه|فيها)?" + EOC +
    "|لا\\s*(تتصل|تراسل|ترسل|تكلم)" +
    "|(ما|لا)\\s*(نبغى|نحتاج|نبي)" + EOC);
  const refusal = typed.some((t) => REFUSAL.test(t.text));

  let state: InteractionRead["state"], stateLabel: string, stateReason: string;
  if (!cust.length) {
    state = "no_reply"; stateLabel = "لم يردّ";
    stateReason = "أُرسلت الرسالة ولم تصل أي استجابة بعد.";
  } else if (!typed.length) {
    state = "taps_only"; stateLabel = "ضغط أزرار فقط";
    stateReason = "تفاعل بالأزرار ولم يكتب بكلماته — لا نعرف احتياجه بعد.";
  } else if (openQuestion) {
    state = "awaiting_customer"; stateLabel = "سؤال بلا إجابة";
    stateReason = "آخر رسالة سؤال من المساعد، ولم يردّ عليه" +
      (hoursSinceCustomer !== null ? ` منذ ${arHours(hoursSinceCustomer)}.` : ".");
  } else if (refusal) {
    // A turn-taking count called one contact «حوار متبادل» in teal directly above their own words:
    // «ماني مهتم لا تتصل علي». A panel that contradicts the quote beneath it is decoration. What the
    // customer SAID outranks how many times they said something.
    state = "refused"; stateLabel = "رفض صريح";
    stateReason = "العميل رفض بكلماته — اقرأ نصّه أدناه قبل أي متابعة.";
  } else if (typed.length >= 2 && cust.length >= 3) {
    state = "reciprocal"; stateLabel = "حوار متبادل";
    stateReason = "كتب بكلماته أكثر من مرة، والحوار يسير في الاتجاهين.";
  } else {
    state = "one_sided"; stateLabel = "من طرف واحد";
    stateReason = "المساعد يتكلم أكثر مما يتكلم العميل.";
  }

  return {
    customerTurns: cust.length, agentTurns: agent.length,
    typedTurns: typed.length, tappedTurns: cust.length - typed.length,
    customerWords: words(cust), agentWords: agent.reduce((n, t) => n + clean(t.text).split(/\s+/).filter(Boolean).length, 0),
    state, stateLabel, stateReason,
    voice: voiceTurn ? { text: voiceTurn.text, ts: voiceTurn.ts } : null,
    lastSpeaker: last ? (last.role as "customer" | "agent") : null,
    hoursSinceCustomer, openQuestion,
  };
}

/** Arabic hour agreement: 3–10 take the plural, 11+ the singular accusative. */
function arHours(h: number): string {
  if (h < 1) return "أقل من ساعة";
  if (h === 1) return "ساعة";
  if (h === 2) return "ساعتين";
  if (h < 11) return `${h} ساعات`;
  if (h < 48) return `${h} ساعة`;
  const d = Math.floor(h / 24);
  return d === 1 ? "يوم" : d === 2 ? "يومين" : d < 11 ? `${d} أيام` : `${d} يومًا`;
}

/** Deterministic completeness of what the platform knows about this person (0–100). */
export function contextScore(c: Contact, entity: EntityRow | null): { score: number; parts: { label: string; got: boolean; pts: number }[] } {
  const inbound = (c.transcript || []).filter((t) => t.role === "customer").length;
  const parts = [
    { label: "اسم ممثل المنشأة متاح", got: Boolean(c.waName || entity?.name), pts: 15 },
    { label: "مطابقة مع جهة استهداف مستوردة", got: Boolean(entity), pts: 10 },
    { label: "بيانات التصنيف (المدينة/الحجم/القطاع)", got: Object.keys(entity?.attrs ?? {}).length >= 2, pts: 10 },
    { label: "محادثة مكتملة الحد الأدنى (رسالتان أو أكثر)", got: inbound >= 2, pts: 20 },
    { label: "ردّ على حملة", got: Boolean((c.statusTimes || {}).replied || inbound >= 1), pts: 10 },
    { label: "اهتمام مصنّف", got: (c.tags || []).length > 0, pts: 15 },
    { label: "تفاعل خلال ٣ أيام", got: Date.now() - (c.lastEventAt || 0) < 72 * 3600e3, pts: 10 },
    { label: "استلم الملف التعريفي", got: (c.transcript || []).some((t) => t.text.includes("أُرسل الملف التعريفي") || t.text.includes("[مرفق")), pts: 10 },
  ];
  return { score: parts.reduce((s, p) => s + (p.got ? p.pts : 0), 0), parts };
}

/** Merged chronological story of this person across everything we hold. */
export function buildTimeline(c: Contact): { ts: number; kind: string; title: string; meta?: string }[] {
  const ev: { ts: number; kind: string; title: string; meta?: string }[] = [];
  // Conversations opened before the activation guard existed still carry the sandbox handshake:
  // the customer was forced to type «proxy <bot>», and the assistant answered it as if it were a
  // service enquiry. We do not rewrite what was said — we name it, so the log stops reading as
  // the assistant asking a real customer about a product that never existed.
  const firstCustomer = (c.transcript || []).find((t) => t.role === "customer");
  const openedWithActivation = Boolean(firstCustomer && SANDBOX_ACTIVATION_RE.test(firstCustomer.text));
  const replyToActivation = openedWithActivation
    ? (c.transcript || []).find((t) => t.role === "agent" && t.ts >= (firstCustomer as any).ts)
    : undefined;
  for (const t of c.transcript || []) {
    if (t === firstCustomer && openedWithActivation) {
      ev.push({ ts: t.ts, kind: "sys", title: t.text.slice(0, 90), meta: "تفعيل تقني من منصة الاختبار — ليست رسالة من العميل" });
      continue;
    }
    if (t === replyToActivation) {
      ev.push({ ts: t.ts, kind: "sys", title: t.text.slice(0, 90), meta: "ردّ قبل ضبط التفعيل — لا يُحتسب ضمن الحوار" });
      continue;
    }
    if (t.role === "customer") ev.push({ ts: t.ts, kind: "in", title: t.text.slice(0, 90), meta: "واتساب · وارد" });
    else if (t.role === "agent") {
      const isFile = t.text.includes("[مرفق") || t.text.includes("أُرسل الملف التعريفي");
      // Buttons are not a campaign — the assistant attaches them to ordinary replies too, so
      // labelling every one «حملة» told the profile a blast had gone out when none had.
      const hasButtons = t.text.includes("[أزرار:");
      ev.push({ ts: t.ts, kind: isFile ? "file" : hasButtons ? "camp" : "out", title: t.text.slice(0, 90), meta: hasButtons ? "المساعد · أزرار" : isFile ? "ملف" : "المساعد" });
    } else ev.push({ ts: t.ts, kind: "sys", title: t.text.slice(0, 90), meta: "نظام" });
  }
  for (const [k, ts] of Object.entries(c.statusTimes || {})) {
    const names: Record<string, string> = { sent: "أُرسلت الرسالة", delivered: "وصلت", read: "شوهدت", replied: "أول ردّ", failed: "فشل الإرسال" };
    if (names[k]) ev.push({ ts: Number(ts), kind: "st", title: names[k], meta: "حالة التسليم" });
  }
  // Tags are a label we derived, not something the customer did. «سجل التفاعل» is a record of
  // touchpoints, so a tag only belongs on it anchored to the message that produced it — never
  // at the moment an operator corrected it, which would move the customer's history forward.
  for (const tg of c.tags || []) {
    const spoken = (c.transcript || []).filter((t) => t.role === "customer" && t.ts <= tg.ts).pop();
    const level = tg.level === "hot" ? "نية مرتفعة" : tg.level === "warm" ? "مهتم" : "اهتمام منخفض";
    // No preceding customer message (a curated tag on someone who never replied, or an early tag
    // on a thread whose hydration capped the transcript) — show it at its own time rather than
    // dropping it. The card promises to list وسوم; silently omitting one is evidence loss.
    ev.push(spoken
      ? { ts: spoken.ts, kind: "tag", title: `اهتمام: ${tg.product}`, meta: level + " · قراءة من هذه الرسالة" }
      : { ts: tg.ts, kind: "tag", title: `اهتمام: ${tg.product}`, meta: level + " · وسم مسجَّل" });
  }
  return ev.sort((a, b) => b.ts - a.ts).slice(0, 60);
}

export type WinLoss = {
  totals: { won: number; lost: number; stalled: number; active: number; learning: number };
  loss_causes: { cause: string; count: number; example: string; products: string[] }[];
  win_drivers: { driver: string; count: number }[];
  by_product: { product: string; won: number; lost: number; stalled: number; active: number }[];
};

/** Aggregate «لماذا نكسب ولماذا نخسر» over CACHED reads only (no LLM calls here). */
export async function winLossBoard(isTest?: (phone: string) => boolean): Promise<WinLoss> {
  const all = await db.listInsights();
  const rows = isTest ? all.filter((r) => !isTest(r.phone)) : all;
  const totals = { won: 0, lost: 0, stalled: 0, active: 0, learning: 0 };
  const causes = new Map<string, { count: number; example: string; products: Set<string> }>();
  const drivers = new Map<string, number>();
  const prod = new Map<string, { won: number; lost: number; stalled: number; active: number }>();
  for (const r of rows) {
    const d = r.data as Insights;
    if (!d || d.learning) { totals.learning++; continue; }
    const ds = d.deal_state ?? "active";
    totals[ds] = (totals[ds] ?? 0) + 1;
    // Normalise here too, not only on the way in: rows cached before the clamp existed still
    // hold free text, and re-reading them would mean an LLM call per contact.
    const products = [...new Set((d.product_interest ?? []).map((p) => canonicalService(p.product)).filter(Boolean))];
    for (const p of products) {
      const row = prod.get(p) ?? { won: 0, lost: 0, stalled: 0, active: 0 };
      row[ds] = (row[ds] ?? 0) + 1;
      prod.set(p, row);
    }
    if ((ds === "lost" || ds === "stalled") && d.loss_cause) {
      const c = causes.get(d.loss_cause) ?? { count: 0, example: "", products: new Set<string>() };
      c.count++;
      if (!c.example && d.evidence) c.example = d.evidence;
      products.forEach((p) => c.products.add(p));
      causes.set(d.loss_cause, c);
    }
    for (const w of d.win_drivers ?? []) drivers.set(w, (drivers.get(w) ?? 0) + 1);
  }
  return {
    totals,
    loss_causes: [...causes.entries()].map(([cause, c]) => ({ cause, count: c.count, example: c.example, products: [...c.products].slice(0, 3) })).sort((a, b) => b.count - a.count).slice(0, 8),
    win_drivers: [...drivers.entries()].map(([driver, count]) => ({ driver, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    // «خدمة أخرى» is our own catch-all, not something Lean sells — a market verdict BY SERVICE
    // must not list it as one. The readings behind it still count in `totals`.
    by_product: [...prod.entries()].filter(([product]) => product !== OTHER_SERVICE)
      .map(([product, r]) => ({ product, ...r })).sort((a, b) => (b.won + b.lost) - (a.won + a.lost)),
  };
}

export async function getInsights(c: Contact, entity: EntityRow | null, force = false): Promise<Insights> {
  const turns = (c.transcript || []).length;
  const inbound = (c.transcript || []).filter((t) => t.role === "customer").length;
  if (inbound < 2) {
    return { summary: "لا تزال قراءة المساعد قيد التعلّم لهذه الجهة، لوجود أقل من رسالتين واردتين.", intent: "none", signals: [], objections: [], product_interest: (c.tags || []).map((t) => ({ product: t.product, level: t.level === "hot" ? "high" as const : t.level === "warm" ? "medium" as const : "low" as const })), next_action: inbound === 1 ? "انتظر مزيدًا من سياق المحادثة، أو تابع برسالة مهنية بعد يوم عمل" : "أدرج الجهة في حملة تعريفية", why: "لا يتوفر سياق كافٍ لتحليل المحادثة حتى الآن.", best_time: "صباح يوم العمل القادم (٩–١١ص)", learning: true };
  }
  if (!force) {
    const cached = await db.getInsightsRow(c.phone);
    if (cached && cached.turns_at === turns) {
      // Silence is itself a signal: a conversation that has gone quiet past the stall window
      // must be re-read once so an "active" verdict can become "stalled".
      const quietMs = Date.now() - (c.lastEventAt || 0);
      const staleRead = Date.now() - (cached.computed_at || 0);
      const prev = cached.data as Insights;
      const needsStallCheck = quietMs > 48 * 3600e3 && prev.deal_state === "active" && staleRead > 24 * 3600e3;
      if (!needsStallCheck) return prev;
    }
  }
  const convo = (c.transcript || []).map((t) => `${t.role === "customer" ? "ممثل المنشأة" : t.role === "agent" ? "المساعد" : "نظام"}: ${t.text}`).join("\n").slice(-8000);
  const tags = (c.tags || []).map((t) => `${t.product}:${t.level}`).join(", ") || "لا تصنيفات اهتمام";
  const attrs = entity ? Object.entries(entity.attrs).map(([k, v]) => `${k}: ${v}`).join("، ") : "غير مسجّلة ضمن جهات الاستهداف";
  const times = (c.transcript || []).filter((t) => t.role === "customer").slice(-5).map((t) => new Date(t.ts).toISOString()).join(", ");
  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await client.chat.completions.create({
    model: cfg.openaiModel || "gpt-5.6-terra",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `ممثل المنشأة: ${c.waName || "غير معروف"} — ${entity?.name || ""}\nبيانات الجهة: ${attrs}\nالوسوم: ${tags}\nأوقات آخر رسائل ممثل المنشأة (UTC): ${times}\n\n--- المحادثة ---\n${convo}` },
    ],
    response_format: { type: "json_object" },
    ...((cfg.openaiModel || "gpt-5.6-terra").startsWith("gpt-5") ? { reasoning_effort: "none" } : {}),
  } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
  } catch (e) {
    console.error(JSON.stringify({ at: "insights", msg: "llm unavailable — degraded read", err: String(e).slice(0, 150) }));
    // Degraded, NOT cached: identity/timeline/context stay fully usable; next visit retries.
    return {
      summary: "قراءة المساعد غير متاحة مؤقتًا. يظل سجل التفاعل ومؤشر اكتمال السياق متاحين أدناه.",
      intent: "none", signals: [], objections: [],
      product_interest: (c.tags || []).map((t) => ({ product: t.product, level: t.level === "hot" ? "high" as const : t.level === "warm" ? "medium" as const : "low" as const })),
      next_action: "أعد المحاولة عبر «تحديث قراءة المساعد»", why: "تعذّر الوصول إلى محرك التحليل.", best_time: "",
    };
  }
  let parsed: Partial<Insights> = {};
  try { parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}"); } catch { /* fall through to safe shape */ }
  const lvl = (x: unknown): "high" | "medium" | "low" => x === "high" ? "high" : x === "low" ? "low" : "medium";
  const ds = ["won", "lost", "stalled", "active"].includes(String(parsed.deal_state)) ? parsed.deal_state as Insights["deal_state"] : "active";
  const lc = (LOSS_TAXONOMY as readonly string[]).includes(String(parsed.loss_cause)) ? String(parsed.loss_cause) : "";
  const out: Insights = {
    summary: String(parsed.summary || "").slice(0, 200) || "لا يتوفر ملخص.",
    intent: ["high", "medium", "low", "none"].includes(String(parsed.intent)) ? parsed.intent as Insights["intent"] : "none",
    signals: (Array.isArray(parsed.signals) ? parsed.signals : []).slice(0, 5).map((s) => String(s).slice(0, 120)),
    objections: (Array.isArray(parsed.objections) ? parsed.objections : []).slice(0, 5).map((s) => String(s).slice(0, 120)),
    product_interest: (Array.isArray(parsed.product_interest) ? parsed.product_interest : []).slice(0, 4)
      .map((p: any) => ({ product: canonicalService(String(p?.product ?? "")), level: lvl(p?.level) })).filter((p) => p.product),
    next_action: String(parsed.next_action || "").slice(0, 160) || "راجع المحادثة للتحقق من الإجراء المناسب.",
    why: String(parsed.why || "").slice(0, 200),
    best_time: String(parsed.best_time || "").slice(0, 100) || "صباح يوم العمل القادم (٩–١١ص)",
    deal_state: ds,
    stage: (SALES_STAGES as readonly string[]).includes(String(parsed.stage)) ? String(parsed.stage) : (ds === "won" ? "الإغلاق" : "تعارف"),
    stage_reason: String(parsed.stage_reason || "").slice(0, 160),
    loss_cause: (ds === "lost" || ds === "stalled") ? lc : "",
    win_drivers: (Array.isArray(parsed.win_drivers) ? parsed.win_drivers : []).slice(0, 4).map((x) => String(x).slice(0, 100)),
    evidence: String(parsed.evidence || "").slice(0, 200),
    fix_suggestion: String(parsed.fix_suggestion || "").slice(0, 180),
  };
  db.saveInsights(c.phone, out, turns);
  console.log(JSON.stringify({ at: "insights", msg: "computed", phone: c.phone, turns, intent: out.intent }));
  return out;
}
