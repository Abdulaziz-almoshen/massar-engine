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
};

const SYSTEM = [
  "أنت محلل مبيعات في لِين للصحة الرقمية. ستقرأ محادثة واتساب واحدة بين مساعد بيع آلي وعميل منشأة صحية، مع وسوم الاهتمام وحالة التسليم وبيانات الجهة إن وجدت.",
  "أخرج فقط ما تدعمه المحادثة نصًا — لا تخترع نية أو اعتراضًا لم يظهر. اكتب بالعربية الفصحى المبسطة وباختصار شديد.",
  "intent: high = طلب سعرًا/بدء اشتراك/موعدًا صراحة؛ medium = أسئلة جدية عن التفاصيل؛ low = ردود مجاملة أو فتور؛ none = لا إشارة.",
  "next_action: خطوة عملية واحدة يقوم بها مدير المبيعات البشري الآن (مثال: «اتصل اليوم واعرض باقة المنشآت» أو «أرسل عرض الأسعار المفصل»). why: سطر يشرح السبب من كلام العميل.",
  "best_time: اقترح نافذة تواصل واقعية (أيام عمل السعودية، ٩ص–٥م) مبنية على أوقات رسائل العميل إن ظهرت، وإلا فاقترح صباح يوم العمل التالي.",
  'أعد JSON فقط: {"summary":"سطر واحد يلخص وضع هذا العميل","intent":"high|medium|low|none","signals":["إشارة شراء حرفية قصيرة"],"objections":["اعتراض ظهر نصًا"],"product_interest":[{"product":"اسم المنتج","level":"high|medium|low"}],"next_action":"...","why":"...","best_time":"..."}',
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
    { label: "استلم الملف التعريفي", got: (c.transcript || []).some((t) => t.text.includes("أُرسل الملف التعريفي") || t.text.includes("[مرفق:")), pts: 10 },
  ];
  return { score: parts.reduce((s, p) => s + (p.got ? p.pts : 0), 0), parts };
}

/** Merged chronological story of this person across everything we hold. */
export function buildTimeline(c: Contact): { ts: number; kind: string; title: string; meta?: string }[] {
  const ev: { ts: number; kind: string; title: string; meta?: string }[] = [];
  for (const t of c.transcript || []) {
    if (t.role === "customer") ev.push({ ts: t.ts, kind: "in", title: t.text.slice(0, 90), meta: "واتساب · وارد" });
    else if (t.role === "agent") {
      const isFile = t.text.includes("[مرفق:") || t.text.includes("أُرسل الملف التعريفي");
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

export async function getInsights(c: Contact, entity: EntityRow | null, force = false): Promise<Insights> {
  const turns = (c.transcript || []).length;
  const inbound = (c.transcript || []).filter((t) => t.role === "customer").length;
  if (inbound < 2) {
    return { summary: "المساعد ما زال يتعلّم هذا العميل — أقل من رسالتين واردتين.", intent: "none", signals: [], objections: [], product_interest: (c.tags || []).map((t) => ({ product: t.product, level: t.level === "hot" ? "high" as const : t.level === "warm" ? "medium" as const : "low" as const })), next_action: inbound === 1 ? "انتظر اكتمال الحوار أو تابع برسالة لطيفة بعد يوم" : "أدرج العميل في حملة تعريفية", why: "لا تتوفر محادثة كافية للقراءة بعد.", best_time: "صباح يوم العمل القادم (٩–١١ص)", learning: true };
  }
  if (!force) {
    const cached = await db.getInsightsRow(c.phone);
    if (cached && cached.turns_at === turns) return cached.data as Insights;
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
  };
  db.saveInsights(c.phone, out, turns);
  console.log(JSON.stringify({ at: "insights", msg: "computed", phone: c.phone, turns, intent: out.intent }));
  return out;
}
