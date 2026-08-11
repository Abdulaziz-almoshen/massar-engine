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
  loss_cause?: string;         // from LOSS_TAXONOMY (empty unless lost/stalled)
  win_drivers?: string[];      // what moved this deal forward (verbatim-anchored)
  evidence?: string;           // the customer quote that proves the call
  fix_suggestion?: string;     // what would likely have won/revived it
};

export const LOSS_TAXONOMY = ["السعر", "التوقيت", "منتج غير مناسب", "تواصل غير واضح", "الملف غير واضح", "لا استجابة", "جهة غير مناسبة", "طلب تدخلًا بشريًا"] as const;

const SYSTEM = [
  "أنت محلل مبيعات في لِين للصحة الرقمية. ستقرأ محادثة واتساب واحدة بين مساعد بيع آلي وعميل منشأة صحية، مع وسوم الاهتمام وحالة التسليم وبيانات الجهة إن وجدت.",
  "أخرج فقط ما تدعمه المحادثة نصًا — لا تخترع نية أو اعتراضًا لم يظهر. اكتب بالعربية الفصحى المبسطة وباختصار شديد.",
  "intent: high = طلب سعرًا/بدء اشتراك/موعدًا صراحة؛ medium = أسئلة جدية عن التفاصيل؛ low = ردود مجاملة أو فتور؛ none = لا إشارة.",
  "next_action: خطوة عملية واحدة يقوم بها مدير المبيعات البشري الآن (مثال: «اتصل اليوم واعرض باقة المنشآت» أو «أرسل عرض الأسعار المفصل»). why: سطر يشرح السبب من كلام العميل.",
  "best_time: اقترح نافذة تواصل واقعية (أيام عمل السعودية، ٩ص–٥م) مبنية على أوقات رسائل العميل إن ظهرت، وإلا فاقترح صباح يوم العمل التالي.",
  "حكم الصفقة deal_state: won = التزم صراحة بالاشتراك/الاجتماع النهائي؛ lost = رفض نهائيًا أو انسحب؛ stalled = توقف التفاعل بعد اهتمام (صمت > يومين بعد آخر رسالة منا)؛ active = الحوار مستمر طبيعيًا.",
  "إن كانت lost أو stalled: اختر loss_cause حصريًا من: السعر، التوقيت، منتج غير مناسب، تواصل غير واضح، الملف غير واضح، لا استجابة، جهة غير مناسبة، طلب تدخلًا بشريًا — والدليل evidence اقتباس حرفي من كلام العميل (أو صف الصمت)، وfix_suggestion خطوة كانت سترجّح الكسب.",
  "إن كانت won أو active مع تقدم: win_drivers نقاط حرفية حرّكت الصفقة (سرعة الرد، الملف، السعر المناسب، الحاجة الملحّة…).",
  'أعد JSON فقط: {"summary":"سطر واحد","intent":"high|medium|low|none","signals":["..."],"objections":["..."],"product_interest":[{"product":"...","level":"high|medium|low"}],"next_action":"...","why":"...","best_time":"...","deal_state":"won|lost|stalled|active","loss_cause":"","win_drivers":["..."],"evidence":"اقتباس حرفي","fix_suggestion":""}',
].join("\n");

/** Deterministic completeness of what the platform knows about this person (0–100). */
export function contextScore(c: Contact, entity: EntityRow | null): { score: number; parts: { label: string; got: boolean; pts: number }[] } {
  const inbound = (c.transcript || []).filter((t) => t.role === "customer").length;
  const parts = [
    { label: "الاسم معروف", got: Boolean(c.waName || entity?.name), pts: 15 },
    { label: "مطابقة جهة مستوردة", got: Boolean(entity), pts: 10 },
    { label: "شرائح (مدينة/حجم/قطاع)", got: Object.keys(entity?.attrs ?? {}).length >= 2, pts: 10 },
    { label: "محادثة فعلية (رسالتان+)", got: inbound >= 2, pts: 20 },
    { label: "ردّ على حملة", got: Boolean((c.statusTimes || {}).replied || inbound >= 1), pts: 10 },
    { label: "اهتمام موسوم", got: (c.tags || []).length > 0, pts: 15 },
    { label: "نشاط خلال ٣ أيام", got: Date.now() - (c.lastEventAt || 0) < 72 * 3600e3, pts: 10 },
    { label: "استلم الملف التعريفي", got: (c.transcript || []).some((t) => t.text.includes("أُرسل الملف التعريفي") || t.text.includes("[مرفق")), pts: 10 },
  ];
  return { score: parts.reduce((s, p) => s + (p.got ? p.pts : 0), 0), parts };
}

/** Merged chronological story of this person across everything we hold. */
export function buildTimeline(c: Contact): { ts: number; kind: string; title: string; meta?: string }[] {
  const ev: { ts: number; kind: string; title: string; meta?: string }[] = [];
  for (const t of c.transcript || []) {
    if (t.role === "customer") ev.push({ ts: t.ts, kind: "in", title: t.text.slice(0, 90), meta: "واتساب · وارد" });
    else if (t.role === "agent") {
      const isFile = t.text.includes("[مرفق") || t.text.includes("أُرسل الملف التعريفي");
      const isCamp = t.text.includes("[أزرار:");
      ev.push({ ts: t.ts, kind: isFile ? "file" : isCamp ? "camp" : "out", title: t.text.slice(0, 90), meta: isCamp ? "حملة" : isFile ? "ملف" : "المساعد" });
    } else ev.push({ ts: t.ts, kind: "sys", title: t.text.slice(0, 90), meta: "نظام" });
  }
  for (const [k, ts] of Object.entries(c.statusTimes || {})) {
    const names: Record<string, string> = { sent: "أُرسلت الرسالة", delivered: "وصلت", read: "شوهدت", replied: "أول ردّ", failed: "فشل الإرسال" };
    if (names[k]) ev.push({ ts: Number(ts), kind: "st", title: names[k], meta: "حالة التسليم" });
  }
  for (const tg of c.tags || []) ev.push({ ts: tg.ts, kind: "tag", title: `اهتمام: ${tg.product}`, meta: tg.level === "hot" ? "نية مرتفعة" : tg.level === "warm" ? "مهتم" : "فاتر" });
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
    const products = (d.product_interest ?? []).map((p) => p.product);
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
    by_product: [...prod.entries()].map(([product, r]) => ({ product, ...r })).sort((a, b) => (b.won + b.lost) - (a.won + a.lost)),
  };
}

export async function getInsights(c: Contact, entity: EntityRow | null, force = false): Promise<Insights> {
  const turns = (c.transcript || []).length;
  const inbound = (c.transcript || []).filter((t) => t.role === "customer").length;
  if (inbound < 2) {
    return { summary: "المساعد ما زال يتعلّم هذا العميل — أقل من رسالتين واردتين.", intent: "none", signals: [], objections: [], product_interest: (c.tags || []).map((t) => ({ product: t.product, level: t.level === "hot" ? "high" as const : t.level === "warm" ? "medium" as const : "low" as const })), next_action: inbound === 1 ? "انتظر اكتمال الحوار أو تابع برسالة لطيفة بعد يوم" : "أدرج العميل في حملة تعريفية", why: "لا تتوفر محادثة كافية للقراءة بعد.", best_time: "صباح يوم العمل القادم (٩–١١ص)", learning: true };
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
  const convo = (c.transcript || []).map((t) => `${t.role === "customer" ? "العميل" : t.role === "agent" ? "المساعد" : "نظام"}: ${t.text}`).join("\n").slice(-8000);
  const tags = (c.tags || []).map((t) => `${t.product}:${t.level}`).join(", ") || "لا وسوم";
  const attrs = entity ? Object.entries(entity.attrs).map(([k, v]) => `${k}: ${v}`).join("، ") : "غير مستورد";
  const times = (c.transcript || []).filter((t) => t.role === "customer").slice(-5).map((t) => new Date(t.ts).toISOString()).join(", ");
  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await client.chat.completions.create({
    model: cfg.openaiModel || "gpt-5.6-terra",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `العميل: ${c.waName || "غير معروف"} — ${entity?.name || ""}\nبيانات الجهة: ${attrs}\nالوسوم: ${tags}\nأوقات آخر رسائل العميل (UTC): ${times}\n\n--- المحادثة ---\n${convo}` },
    ],
    response_format: { type: "json_object" },
    ...((cfg.openaiModel || "gpt-5.6-terra").startsWith("gpt-5") ? { reasoning_effort: "none" } : {}),
  } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
  } catch (e) {
    console.error(JSON.stringify({ at: "insights", msg: "llm unavailable — degraded read", err: String(e).slice(0, 150) }));
    // Degraded, NOT cached: identity/timeline/context stay fully usable; next visit retries.
    return {
      summary: "قراءة المساعد غير متاحة مؤقتًا — السجل واكتمال السياق أدناه كاملان.",
      intent: "none", signals: [], objections: [],
      product_interest: (c.tags || []).map((t) => ({ product: t.product, level: t.level === "hot" ? "high" as const : t.level === "warm" ? "medium" as const : "low" as const })),
      next_action: "أعد المحاولة بزر «تحديث قراءة المساعد»", why: "تعذّر الوصول لمحرك القراءة.", best_time: "",
    };
  }
  let parsed: Partial<Insights> = {};
  try { parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}"); } catch { /* fall through to safe shape */ }
  const lvl = (x: unknown): "high" | "medium" | "low" => x === "high" ? "high" : x === "low" ? "low" : "medium";
  const ds = ["won", "lost", "stalled", "active"].includes(String(parsed.deal_state)) ? parsed.deal_state as Insights["deal_state"] : "active";
  const lc = (LOSS_TAXONOMY as readonly string[]).includes(String(parsed.loss_cause)) ? String(parsed.loss_cause) : "";
  const out: Insights = {
    summary: String(parsed.summary || "").slice(0, 200) || "لا يوجد ملخص.",
    intent: ["high", "medium", "low", "none"].includes(String(parsed.intent)) ? parsed.intent as Insights["intent"] : "none",
    signals: (Array.isArray(parsed.signals) ? parsed.signals : []).slice(0, 5).map((s) => String(s).slice(0, 120)),
    objections: (Array.isArray(parsed.objections) ? parsed.objections : []).slice(0, 5).map((s) => String(s).slice(0, 120)),
    product_interest: (Array.isArray(parsed.product_interest) ? parsed.product_interest : []).slice(0, 4)
      .map((p: any) => ({ product: String(p?.product ?? "").slice(0, 60), level: lvl(p?.level) })).filter((p) => p.product),
    next_action: String(parsed.next_action || "").slice(0, 160) || "راجع المحادثة يدويًا.",
    why: String(parsed.why || "").slice(0, 200),
    best_time: String(parsed.best_time || "").slice(0, 100) || "صباح يوم العمل القادم (٩–١١ص)",
    deal_state: ds,
    loss_cause: (ds === "lost" || ds === "stalled") ? lc : "",
    win_drivers: (Array.isArray(parsed.win_drivers) ? parsed.win_drivers : []).slice(0, 4).map((x) => String(x).slice(0, 100)),
    evidence: String(parsed.evidence || "").slice(0, 200),
    fix_suggestion: String(parsed.fix_suggestion || "").slice(0, 180),
  };
  db.saveInsights(c.phone, out, turns);
  console.log(JSON.stringify({ at: "insights", msg: "computed", phone: c.phone, turns, intent: out.intent }));
  return out;
}
