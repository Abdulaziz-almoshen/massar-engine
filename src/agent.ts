import OpenAI from "openai";
import { cfg } from "./config.js";
import * as gupshup from "./gupshup.js";
import * as tracker from "./tracker.js";
import * as db from "./db.js";
import type { Contact } from "./tracker.js";
import { SANDBOX_ACTIVATION_RE, SERVICE_CATALOGUE } from "./insights.js";
import * as templates from "./templates.js";
import * as accounts from "./accounts.js";
import * as productlock from "./productlock.js";

// ---------------------------------------------------------------------------
// The Arabic AI salesperson — full-capability edition.
// Persona: consultative closer (confident, warm, momentum-driven), MSA Arabic,
// short messages, light emoji, and a hard product rule: NEVER dead-end — every
// message ends with a question or quick-reply buttons, and a "no" pivots to the
// next best product for the customer's segment.
// Capabilities: text · quick-reply buttons · image/PDF assets (registry-gated).
// Hard rules stay in CODE: opt-out short-circuit, turn cap, human takeover.
// KB below mirrors the معرفة المنتج taxonomy; the KB-module feed replaces it.
// ---------------------------------------------------------------------------

const client = new OpenAI({ apiKey: cfg.openaiKey });

let model = cfg.openaiModel;
const MODEL_PREFS = [
  /^gpt-5\.6.*terra/i,
  /^gpt-5\.6(?!.*(luna|sol))/i,
  /^gpt-5\.6/i,
  /^gpt-5(?!\.)/i,
  /^gpt-4\.1$/i,
  /^gpt-4o$/i,
];

export async function initModel(): Promise<string> {
  if (model) return model;
  try {
    const list = await client.models.list();
    const ids = list.data.map((m) => m.id);
    for (const pref of MODEL_PREFS) {
      const hit = ids.find((id) => pref.test(id));
      if (hit) { model = hit; break; }
    }
    if (!model) model = "gpt-4.1";
    console.log(JSON.stringify({ at: "agent", msg: "model selected", model }));
  } catch (e) {
    model = "gpt-4.1";
    console.error(JSON.stringify({ at: "agent", msg: "model list failed, using fallback", model, err: String(e) }));
  }
  return model;
}
export function currentModel() { return model || "(not initialized)"; }

// ------------------------------ assets registry ------------------------------

type Asset = { id: string; type: "image" | "document"; url: string; filename?: string; caption?: string; label?: string };
let productAssets: { product: string; url: string; filename: string }[] = [];
function assets(): Asset[] {
  try { return JSON.parse(cfg.assetsJson) as Asset[]; } catch { return []; }
}

// ------------------------------ product knowledge (seed → KB module later) ---

type Product = {
  name: string; pitch: string; efficiency: string[]; bestFor: string[];
  pricing: string; faq: [string, string][]; objections: [string, string][];
};

const PRODUCTS: Product[] = [
  {
    name: "الإجازات المرضية",
    pitch: "يُمكّن منشأتكم من إصدار الإجازات المرضية وإدارتها إلكترونيًا، بتوثيق رسمي وتكامل مباشر مع HIS وERP، والتفعيل خلال 5 أيام عمل.",
    efficiency: [
      "يقلّل زمن إصدار الإجازة بنسبة 70%، من إجراءات ورقية إلى دقائق",
      "يلغي الإدخال المزدوج، إذ تُصدر الإجازة من نظام المنشأة مباشرة",
      "يوفر توثيقًا رسميًا فوريًا يحد من التلاعب والمراجعات اليدوية",
      "لوحة متابعة لحظية لكل الإصدارات والفروع",
    ],
    bestFor: ["مجمعات طبية", "مراكز طبية", "مستشفيات", "مراكز أسنان"],
    pricing: "الباقة القياسية (فرع واحد): 18,000 ر.س سنويًا · باقة المؤسسات (حتى 10 فروع): 95,000 ر.س سنويًا",
    faq: [
      ["هل الخدمة معتمدة؟", "نعم، الخدمة معتمدة رسميًا لدى الجهات التنظيمية، ويمكن التحقق من اعتمادها."],
      ["كم يستغرق الربط؟", "يكتمل التفعيل خلال 5 أيام عمل للأنظمة المدعومة."],
      ["هل توجد تجربة؟", "نعم، تتوفر بيئة تجريبية لمدة 14 يومًا."],
    ],
    objections: [
      ["التكلفة مرتفعة", "وضّح أثر التكلفة مقابل ساعات العمل والمعاملات الورقية والمراجعات، ثم اعرض تنسيق دراسة العائد وفق حجم تشغيل المنشأة."],
      ["لدينا نظام قائم", "يتكامل الحل مع نظامكم القائم دون استبداله، مما يتيح التوثيق الرسمي ويقلل الإدخال المزدوج."],
    ],
  },
  {
    name: "فحص الموظفين",
    pitch: "يُمكّن منشأتكم من إدارة فحوصات اللياقة الطبية للموظفين بقوالب معتمدة، وتقارير جماعية، وربط مباشر بملف الموظف.",
    efficiency: [
      "يدعم الامتثال لمتطلبات العمل دون متابعة المعاملات الورقية",
      "يُنشئ تقارير جماعية جاهزة للجهات",
      "يربط نتيجة الفحص بملف الموظف تلقائيًا",
    ],
    bestFor: ["مستشفيات", "مجمعات طبية", "شركات ذات كثافة توظيف"],
    pricing: "اشتراك سنوي بتسعير لكل فحص، يحدده المختص وفق الحجم",
    faq: [["هل تشمل فحوصات ما قبل التوظيف؟", "نعم، تشمل فحوصات ما قبل التوظيف والفحوصات الدورية."]],
    objections: [["ننّفذ الإجراءات يدويًا حاليًا", "تساهم أتمتة الفحوصات في تقليل العمل اليدوي، وتوثيق الإجراءات، ودعم الامتثال."]],
  },
  {
    name: "التقارير الطبية",
    pitch: "يُمكّن منشأتكم من إصدار تقارير طبية معتمدة إلكترونيًا خلال دقائق، بتوقيع رقمي وأرشفة مركزية ومشاركة آمنة.",
    efficiency: [
      "يقلل مدة الإصدار من أيام إلى دقائق",
      "يوحّد الملفات في أرشيف مركزي قابل للبحث",
      "يتيح مشاركة آمنة تدعم حماية خصوصية المريض",
    ],
    bestFor: ["مراكز طبية", "مختبرات", "عيادات"],
    pricing: "اشتراك سنوي يحدده المختص وفق الحجم",
    faq: [["هل التوقيع معتمد؟", "نعم، تتضمن الخدمة توقيعًا إلكترونيًا معتمدًا نظامًا."]],
    objections: [["حجم منشأتنا صغير", "تتوفر باقات تناسب المنشآت الصغيرة، ويسعدنا تحديد الأنسب وفق حجم التشغيل ومتطلباتكم."]],
  },
  {
    name: "خدمات التطعيمات",
    pitch: "يُمكّن منشأتكم من إدارة التطعيمات وتوثيقها عبر سجل موحّد، وتنبيهات للجرعات، وتقارير امتثال.",
    efficiency: ["توثيق لحظي لكل جرعة", "تنبيهات آلية للجرعات القادمة", "تقارير امتثال جاهزة"],
    bestFor: ["مراكز صحية", "صيدليات"],
    pricing: "اشتراك سنوي يحدده المختص",
    faq: [],
    objections: [],
  },
  {
    name: "الشهادات الصحية",
    pitch: "يُمكّن منشأتكم من إصدار الشهادات الصحية إلكترونيًا، مع تحقق QR وسجل مركزي ودون معاملات ورقية.",
    efficiency: ["يختصر الإصدار من أيام إلى دقائق", "يدعم التحقق عبر QR ويحد من التلاعب", "سجل مركزي لكل الشهادات"],
    bestFor: ["صيدليات", "مراكز طبية"],
    pricing: "اشتراك سنوي يحدده المختص",
    faq: [],
    objections: [],
  },
  {
    name: "تكامل الأنظمة (HIS/ERP)",
    pitch: "يُمكّن منشأتكم من استخدام خدمات لِين داخل أنظمتها القائمة، عبر واجهات جاهزة، وتنفيذ خلال أسبوعين، ودعم مخصص.",
    efficiency: ["يلغي الإدخال المزدوج", "يُنفّذ خلال أسبوعين عبر واجهات جاهزة", "يوفر دعمًا فنيًا مخصصًا"],
    bestFor: ["مستشفيات", "مجمعات كبيرة"],
    pricing: "مشروع تكامل واشتراك سنوي، يحدده المختص",
    faq: [],
    objections: [],
  },
];

// The analyst clamps every extracted service name to SERVICE_CATALOGUE. That list and this one
// are two copies of the same truth, so drift files a real service as «خدمة أخرى» on every board.
// LOG, NEVER THROW: this module is imported before the server listens, so throwing here would
// crash-loop the engine — no /health, no webhook, and no opt-out processing — which is far worse
// than one mislabelled row on a dashboard. `npm run check:catalogue` fails loudly in CI instead.
export function catalogueDrift(): string[] {
  return PRODUCTS.map((p) => p.name).filter((n) => !(SERVICE_CATALOGUE as readonly string[]).includes(n));
}
{
  const drift = catalogueDrift();
  if (drift.length) {
    console.error(JSON.stringify({ at: "agent", level: "error",
      msg: "service catalogue drift — present in PRODUCTS but missing from SERVICE_CATALOGUE (insights.ts); these will be filed as «خدمة أخرى» on every board",
      services: drift }));
  }
}

// Segment → next-best pivot when the current product gets a "no".
const PIVOTS = [
  "إذا لم تلائم خدمة «الإجازات المرضية» احتياج المنشأة، استكشف ملاءمة «فحص الموظفين» للجهات ذات كثافة التوظيف، أو «التقارير الطبية» للعيادات والمختبرات.",
  "إذا لم تلائم الخدمة منشأة كبيرة أو مستشفى، استكشف احتياج «تكامل الأنظمة»، واسأل عن أثر الإدخال المزدوج قبل تقديمه.",
  "للصيدليات، استكشف أولًا ملاءمة «الشهادات الصحية»، ثم «خدمات التطعيمات» بحسب الاحتياج.",
  "لا تعرض أكثر من خدمتين بديلتين في المحادثة الواحدة. بعد ذلك، اقترح التنسيق مع مختص المبيعات.",
];

// When a product is locked, the operational knowledge is NARROWED to it. Founder review
// 2026-08-16: the prompt-level lock stopped the wrong FILE but left every other product's pricing
// and features sitting in context, one sentence away from being quoted. A model cannot quote a
// price it was never given — so scope the knowledge, do not just forbid its use.
function productBlock(locked?: string | null): string {
  const list = locked ? PRODUCTS.filter((p) => p.name === locked) : PRODUCTS;
  return (list.length ? list : PRODUCTS).map((p) => [
    `### ${p.name}`,
    `العرض: ${p.pitch}`,
    `الكفاءة: ${p.efficiency.join(" · ")}`,
    `الأنسب لـ: ${p.bestFor.join("، ")}`,
    `التسعير المسموح ذكره: ${p.pricing}`,
    ...(p.faq.length ? [`أسئلة: ${p.faq.map(([q, a]) => `«${q}» → ${a}`).join(" | ")}`] : []),
    ...(p.objections.length ? [`اعتراضات: ${p.objections.map(([o, r]) => `«${o}» → ${r}`).join(" | ")}`] : []),
  ].join("\n")).join("\n\n");
}

let hubKb: { product: string; md: string }[] = [];
/**
 * Seed the knowledge and assets the agent normally loads from Postgres at boot.
 *
 * Exists for the offline eval harness (scripts/eval-agent.mjs), which runs the real agent with no
 * database. Without it the prompt carries no approved knowledge and `send_asset` finds no file, so
 * the model flounders and the canned fallback fires on almost every turn — an artefact that would
 * make the eval measure the harness rather than the agent. Production still calls refreshKb().
 */
export function seedKnowledge(
  kb: { product: string; md: string }[],
  assetsIn: { product: string; url: string; filename: string }[],
): void {
  hubKb = kb;
  productAssets = assetsIn;
}

export async function refreshKb(): Promise<number> {
  try {
    productAssets = (await db.listAssets()).filter((a) => !a.product.startsWith("__")).map((a) => ({
      product: a.product, url: `${cfg.publicBaseUrl}/assets/${a.public_id}.pdf`, filename: a.filename }));
    hubKb = (await db.listKb()).map((r) => ({ product: r.product, md: r.md }));
    console.log(JSON.stringify({ at: "agent", msg: "hub kb refreshed", products: hubKb.map((h) => h.product) }));
  } catch (e) { console.error(JSON.stringify({ at: "agent", msg: "hub kb refresh failed", err: String(e).slice(0, 200) })); }
  return hubKb.length;
}

// Exported for scripts/check-ae-prompt.mjs — the prompt is the product here, so it is asserted
// like code rather than eyeballed.
export function systemPrompt(contact: Contact): string {
  // Count within THIS campaign conversation, not for all time — the same reason the turn cap does.
  const campaignAt = (contact.transcript || [])
    .filter((t) => t.role === "agent" && templates.isCampaignTurn(t.text))
    .reduce((m, t) => Math.max(m, t.ts), 0);
  const since = (contact.transcript || []).filter((t) => t.ts >= campaignAt);
  const inbound = since.filter((t) => t.role === "customer").length;
  const hasSignal = (contact.tags || []).length > 0 || contact.outcome === "interested";

  // Has the customer actually told us anything about their operation yet? §8 names three
  // categories — size, current system, pain. The model treated «send me the file» as
  // qualification and asked for an appointment on the first message; a discovery fact is the
  // objective test of whether it has earned that ask.
  // A fact is something the customer DISCLOSED about their own operation. Matching bare keywords
  // counted questions as disclosures: «وش النظام اللي تشتغلون عليه؟» and «كم عدد خدماتكم؟» both
  // opened the gate, and «عندي مشكلة في نظام صحة» — a complaint about the platform, not a
  // disclosure — scored two. So: drop interrogative sentences first, then require a first-person
  // marker («عندنا», «لدينا», «نستخدم») or a bare number next to the noun.
  const sentences = since.filter((t) => t.role === "customer").flatMap((t) => t.text.split(/[.؟?!\n]+/));
  // Drop interrogatives, and drop anything about منصة صحة itself: «عندي مشكلة في نظام صحة» is a
  // platform complaint, which §10 routes to a human — it is not a disclosure about how this
  // facility operates, and must not earn the right to ask for a meeting.
  const statements = sentences.filter((x) => {
    const v = x.trim();
    if (!v) return false;
    // NOT \b — JS word boundaries need an ASCII word char, so «وش » never matched and every
    // question survived into the disclosure set. Same trap as SANDBOX_ACTIVATION_RE.
    if (/^\s*(وش|كم|هل|متى|أي|ما|مين|كيف|ليه|لماذا|ايش|إيش)(?=\s|$)/.test(v)) return false;
    if (/(نظام|منصة)\s*صحة/.test(v)) return false;
    return true;
  });
  // TWO strings, because they answer opposed questions. `disclosed` is what the customer TOLD us —
  // questions stripped, since a question is not a disclosure. `asked` is everything they said, raw,
  // because INTENT («كم السعر؟») lives in exactly the sentences the disclosure filter removes.
  // Reading intent off the filtered string is what made the \b fix strip «كم السعر؟» before the
  // commercial escape could see it — the founder's «asks before answering» complaint, regressed.
  const disclosed = statements.join(" · ");
  const asked = since.filter((t) => t.role === "customer").map((t) => t.text).join(" · ");
  const said = disclosed;
  const MINE = "(?:عندنا|لدينا|نملك|نستخدم|نشتغل|نعمل|فروعنا|نظامنا|منشأتنا|عندي|لدي)";
  const knowsSize = new RegExp(`${MINE}[^·]{0,25}(فرع|فروع|موقع|مواقع)|\\d+\\s*(فرع|فروع|موقع|مواقع)`).test(said);
  const knowsSystem = new RegExp(`\\b(HIS|ERP)\\b|${MINE}[^·]{0,25}(نظام|برنامج)|(ورقي|يدوي|يدويًا)`, "i").test(said);
  const knowsPain = new RegExp(`${MINE}[^·]{0,30}(تأخير|مشكلة|بطء|بطيء|صعوبة|أخطاء|خطأ)|(إدخال\\s*مزدوج|مزدوج|إعادة\\s*الإدخال)`).test(said);
  const discoveryFacts = [knowsSize, knowsSystem, knowsPain].filter(Boolean).length;

  // WHAT HAS ALREADY BEEN SENT. Without this the agent re-sent the same PDF and asked a slightly
  // different question — it had no idea it had already delivered. Read from its own record.
  // Both marker shapes: the current «[مرفق في نفس الرسالة: X]» and the older
  // «[أُرسل الملف التعريفي: X]» still present in live transcripts. Recognising only the current
  // one meant an asset sent yesterday could be sent again today.
  const sentAssets = [...new Set((contact.transcript || [])
    .filter((t) => t.role === "agent")
    .flatMap((t) => [
      (t.text.match(/\[مرفق في نفس الرسالة:\s*([^\]]+)\]/) || [])[1],
      (t.text.match(/\[أُرسل الملف التعريفي:\s*([^\]]+)\]/) || [])[1],
    ])
    .map((x) => (x || "").trim())
    .filter(Boolean)
    // Filenames are an implementation detail; the model should reason about the SERVICE.
    .map((x) => x.replace(/\.(pdf|docx?|pptx?)$/i, "").replace(/^_+/, "")))];

  // WHAT THIS TURN IS FOR. «Every message must move the lead one step forward» — so the objective
  // is derived from what is still unknown, in the founder's own priority order, rather than left
  // to the model to pick (it kept picking «do you use HIS?» twice).
  const knowsType = /منشأة|مستشفى|مجمع|عيادة|مركز|صيدلية|مزود|مزوّد|شركة\s*نظام|vendor/i.test(said);
  const knowsService = /(تطعيم|NVR|السجل الوطني)|(إجاز|مرضي)/i.test(said);
  // A strict ladder re-interrogates a customer who volunteers everything at once: «عندنا ٢٠ فرع
  // ونستخدم HIS ونبغى NVR وكم السعر؟» still scored «ask what kind of facility», because «فرع» is
  // not in the type list. Two escapes: an explicit commercial ask outranks discovery, and enough
  // disclosed facts make the remaining gap something to CONFIRM in passing, not to interrogate.
  // Two ways to ask for the commercial track: type it, or tap the button we ourselves offered.
  // The button path was missing — «العرض التجاري» is a title this code emits, and the pattern below
  // did not match it, so the tap fell through to discovery. Buttons route by the shared table.
  const tappedCommercial = since.some((t) => t.role === "customer" && templates.buttonIntent(t.text) === "commercial");
  // «تسعير» without the article is how it is usually typed («هل عندكم تسعير؟»); the anchored
  // «التسعير» missed it. Match the stem.
  const wantsCommercial = tappedCommercial ||
    /(كم\s*(السعر|التكلفة|يكلف)|السعر|تسعير|عرض\s*سعر|التكلفة|نبغى\s*نبدأ|كيف\s*نبدأ|متى\s*نبدأ|اشترك)/.test(asked);
  const known = [knowsType, knowsSystem, knowsService, knowsSize].filter(Boolean).length;
  // MUST-3: an objective already ASKED is not a live objective. On the founder's own contact the
  // entity-type question was asked at 14:22 and 14:29 and dodged both times; a third asking is the
  // «repeating a question already answered» he rejected. Track what we asked, and stop re-asking.
  const agentSaid = since.filter((t) => t.role === "agent").map((t) => t.text).join(" · ");
  const askedType = /(منشأة صحية|مزوّد نظام|مزود نظام|أي وصف يناسبكم|نوع الجهة)/.test(agentSaid);
  const askedSystem = /(نظام HIS|هل تستخدمون|النظام القائم|HIS أو ERP)/i.test(agentSaid);
  const nextObjective =
    wantsCommercial
      ? "طلب العميل الجانب التجاري — وهذه إشارة شراء، لا حالة دعم. ممنوع منعًا باتًا أن تنتهي هذه الرسالة عند «تم إشعار المختص» أو ما يشبهها؛ رسالة تُحيل ولا تسأل شيئًا هي نهاية مسدودة. الترتيب الإلزامي: (١) أعطِ السعر إن كان مذكورًا نصًا لنطاقهم، وإن كان نطاقهم خارج المذكور فقل بوضوح إن الرقم النهائي يُبنى على نطاق الربط وعدد الفروع — دون اختراع رقم. (٢) اربطه بما يتغيّر تشغيليًا عندهم. (٣) اختم دائمًا بسؤال التأهيل التجاري: «إذا وصلنا لاتفاق مناسب على السعر، هل فيه أي شيء ثاني ممكن يوقف البدء بالتكامل؟» — هذا السؤال يحوّل طلب السعر إلى التزام مشروط، وهو الهدف."
    : known >= 3
      ? "لديك أغلب الصورة. أوصِ بنموذج التكامل الأنسب بناءً على ما ذكره، وأكمل الناقص بسؤال واحد داخل التوصية لا كاستجواب منفصل."
    : !knowsType && !askedType ? "حدّد نوع الجهة: منشأة صحية تستخدم نظامًا، أم مزوّد نظام يخدم منشآت. اسأل هذا بأزرار."
    : !knowsType && askedType ? "سبق أن سألت عن نوع الجهة ولم يُجب. لا تكرّر السؤال — أعطِ قيمة ملموسة للحالتين معًا (منشأة أو مزوّد نظام) ثم اعرض خطوة عملية."
    : !knowsSystem && askedSystem ? "سبق أن سألت عن النظام ولم يُجب. لا تكرّر السؤال — انتقل إلى الخدمة التي تهمّه أو إلى الخطوة التجارية."
    : !knowsSystem ? "اعرف النظام القائم لديهم (HIS أو ERP أو إجراء يدوي)."
    : !knowsService ? "اعرف أي خدمة تهمهم: سجل التطعيمات، الإجازات المرضية، أو كلاهما. اسأل هذا بأزرار."
    : !knowsSize ? "اعرف حجم التشغيل: كم منشأة أو كم إصدارًا شهريًا تقريبًا."
    : "لديك ما يكفي — أوصِ بنموذج التكامل الأنسب واعرض الخطوة التجارية (عرض تعريفي أو جلسة تقنية).";
  // THE PRICE DIRECTIVE — computed in code, not hoped for from the prompt.
  //
  // Across five Codex-judged iterations the price scenario scored 0 every single time, including
  // the round where the exact sentence («باقة المؤسسات حتى ١٠ فروع سعرها ٩٥,٠٠٠ ريال سنويًا») was
  // written verbatim into the prompt. Rules and worked examples both failed; the model kept
  // answering a price question with an offer of paths. So the price stops being an instruction the
  // model may follow and becomes a fact injected into THIS turn, the same way nextObjective already
  // works. A number the customer is entitled to is not a judgement call.
  //
  // Only fires when the price is REAL — a figure printed in the product table for the locked
  // product. Everything else keeps the honest "scope determines it" path, so this can never invent.
  // Resolved from the transcript directly rather than via productlock, because
  // scripts/check-buttons.mjs evaluates this slice in isolation where module imports do not exist.
  // Same rule as productOf: the customer's own words win, newest first.
  const lockedProductEarly = [...(contact.transcript || [])].reverse()
    .filter((t) => t.role === "customer")
    .map((t) => PRODUCTS.find((p) => t.text.includes(p.name))?.name
      ?? (/\bNVR\b|السجل\s*الوطني|تطعيم/i.test(t.text) ? "خدمات التطعيمات" : undefined))
    .find(Boolean);
  const priced = lockedProductEarly ? PRODUCTS.find((p) => p.name === lockedProductEarly) : undefined;
  // No `!` assertions here: scripts/check-buttons.mjs slices this source and evaluates it as
  // plain JS, where a TS non-null assertion is a syntax error. Narrow with the guard instead.
  const priceDirective = wantsCommercial && priced && /[\d٠-٩]/.test(priced.pricing)
    ? `- إلزامي في هذه الرسالة: العميل سأل عن الجانب التجاري و«${priced.name}» لها سعر معتمد منشور. اذكره حرفيًا في أول سطرين: «${priced.pricing}». ثم اربطه بما يتغيّر تشغيليًا عندهم. ممنوع «حسب النطاق» وممنوع تأجيله لعرض لاحق وممنوع استبداله بعرض مسارات.`
    : wantsCommercial
      ? "- إلزامي في هذه الرسالة: العميل سأل عن الجانب التجاري ولا يوجد سعر منشور لهذه الخدمة. قل ذلك صراحة، وسمِّ ما يحدد السعر — عدد الفروع، بيئة الـHIS، ومتطلبات التنفيذ — واطلب الناقص منها وحده. ممنوع الاكتفاء بعرض مسارين."
      : "";
  const account = accounts.accountBlock(contact.phone);
  // What we still do not know, named and ranked. Without it the agent cannot tell «unknown» from
  // «not worth asking» and re-runs the whole §٨ ladder on every conversation — the founder's
  // complaint of 2026-08-18 («it asks clients»). See accounts.gapBlock.
  const gaps = accounts.gapBlock(contact.phone);
  // The usage-led motion ASSERTS the customer's own operation back to them. Holding a row is not
  // a licence to do that; measured usage is. A prospect we merely have a name for stays cold.
  const expansion = accounts.isExpansion(contact.phone);
  const lockedProduct = productlock.activeProduct(contact);
  return [
    // ---------------------------------------------------------------- 0. الحساب
    // The expansion motion only exists when we actually know the account. When the registry has
    // no record this block is empty and §١ب switches the agent back to the cold-inbound path —
    // an agent that TALKS like an account manager without the facts is the bot he complained about.
    account,
    gaps,
    // ---------------------------------------------------------------- 0ب. حقائق الفريق
    // BR-7d. What an operator TYPED outranks anything the model can read off a transcript, so it
    // is injected as context rather than left for the agent to re-derive and re-ask. Placed with
    // the account block because it is the same kind of fact: known, not inferred.
    tracker.humanFactsBlock(contact),
    // ---------------------------------------------------------------- 1. الهدف
    // ================================================================
    // The founder's AE spec, 2026-08-16. This section IS the spec — sections ١-٢١ were replaced
    // wholesale rather than patched, because the previous prompt kept accumulating competing
    // ladders. Hard guards that a prompt rewrite has silently deleted before (round-11) are
    // pinned by scripts/check-ae-prompt.mjs and must survive any future edit here.
    // ================================================================
    "# ١) الدور",
    "أنت مدير حساب أول (Account Executive) لتنمية الحسابات الصحية القائمة. تبيع خدمات صحية رقمية وتكاملات للمستشفيات والمجموعات الطبية ومزوّدي أنظمة الـHIS، عبر واتساب.",
    "أنت مسؤول عن المحادثة التجارية من أول تواصل حتى: يمضي العميل · أو يُتفق على خطوة تجارية/تقنية · أو تلزم موافقة بشرية فعلًا · أو يعتذر العميل.",
    "لست دعمًا فنيًا. لست روبوت تأهيل. لست موزّع طلبات. مهمتك أن تساعد العميل على فهم القيمة، وتحديد الملاءمة، وإزالة الاعتراضات، والتقدّم نحو الشراء.",
    "",
    "# ٢) الحركة البيعية",
    expansion
      ? "هذه الجهة تستخدم خدمتنا فعلًا، وغالبًا يدويًا عبر المنصة. الاستخدام المرتفع فرصة توسّع، وليس مشكلة."
      : "أغلب عملائنا يستخدمون خدمة أو أكثر يدويًا عبر المنصة. الاستخدام المرتفع فرصة توسّع، وليس مشكلة.",
    "الوضع الحالي: الممارس يخرج من الـHIS ← يفتح منصتنا ← يدخل المعلومات أو يكرّرها ← ينهي المعاملة ← يعود للـHIS.",
    "الوضع المطلوب: الممارس يبقى داخل الـHIS ← يكمل رحلة العمل ← الـHIS يتواصل مع خدمتنا عبر التكامل.",
    "أنت تبيع هذا التحسين التشغيلي. لا تبِع «واجهة برمجية». بِع: خطوات يدوية أقل · إدخالًا مزدوجًا أقل · تنقّلًا أقل بين الأنظمة · رحلة عمل أسرع · تشغيلًا أسهل عبر فروع متعددة · تجربة أفضل للممارس · قدرة أعلى على استيعاب أحجام المعاملات الكبيرة.",
    "",
    "# ٣) سياق الحساب ذاكرة",
    "ما يصلك عن الحساب معلومات مؤكدة: اسم العميل · المنتج النشط · الخدمات المستخدمة · حجم المعاملات · مستوى الاستخدام · عدد الفروع · اسم الـHIS · هل الفروع على بيئة واحدة · التكاملات القائمة · المحادثة السابقة · التسعير · الخصم المصرّح به · المرفقات · جهات الاتصال · صاحب القرار · الحالة التجارية.",
    "لا تسأل العميل أبدًا عن معلومة متاحة لديك. إن كنت تعرف أن لديهم ٧ فروع فلا تقل «كم فرع عندكم؟» بل «بحكم أن عندكم ٧ فروع على نفس البيئة…». يجب أن تبدو المحادثة متصلة.",
    "",
    "# ٤) قفل المنتج — حرج",
    lockedProduct
      ? `المنتج النشط: «${lockedProduct}». حتى يغيّر العميل المنتج صراحة: استخدم معرفة هذا المنتج وحده · تسعيره وحده · مرفقاته وحده · حالات استخدامه وحده · تكامله وحده. ممنوع منعًا باتًا استبدال منتج آخر لأن نموذج تكامله مشابه. قبل إرسال أي مستند تحقق أن المستند يخص «${lockedProduct}»، وإن لم يكن فلا ترسله.`
      : "لم يتحدد منتج نشط بعد. أول منتج يذكره العميل يصبح المنتج النشط وتلتزم به. وإن كان سياق المنتج غير واضح، وضّحه قبل إرسال أي مادة خاصة بمنتج.",
    "",
    "# ٥) حالة الصفقة — حدّدها داخليًا ولا تعرضها",
    "١ تفاعل ← ٢ اكتشاف ← ٣ قيمة ← ٤ حل ← ٥ تجاري ← ٦ تفاوض ← ٧ التزام ← ٨ تسليم بشري ← ٩ مغلق.",
    "لا تُجبر العميل على المرور بها بالترتيب. استنتج المرحلة من المحادثة. إذا كانت أول رسالة «كم السعر؟» فأجب عن السعر إن كان متاحًا ثم أكمل بذكاء — لا تفرض تعريفًا ثم اكتشافًا ثم قيمة.",
    "",
    "# ٦) قبل كل رد — نفّذه صامتًا",
    "١. ما الذي سأله العميل فعلًا؟ أجبه أولًا. ٢. ما الذي أعرفه مسبقًا؟ لا تسأل عنه. ٣. ما نية الشراء؟ (استكشاف · تفاصيل · اهتمام تقني · اهتمام سعري · اهتمام جاد · اعتراض · تفاوض · جاهز للمضي). ٤. ما العائق الحالي؟ (قيمة غير واضحة · ملاءمة تقنية · نطاق الفروع · السعر · صاحب القرار · التوقيت · الاعتماد).",
    "٥. ما أفضل إجراء الآن؟ اختر واحدًا فقط: أجب · اشرح · أظهِر القيمة · اسأل سؤال اكتشاف واحد · أوصِ · أعطِ السعر · عالج اعتراضًا · فاوض · اطلب التزامًا · رتّب موعدًا · صعّد. ٦. هل السؤال ضروري فعلًا؟ إن لم يكن، لا تسأل.",
    "",
    // ================================================================
    // Codex eval v1 scored this agent 2.8/10, prod_ready:false, 8 of 10 scenarios FAIL. These are
    // its fixes, placed HIGH because the failures were all "the model ignored a rule buried later".
    // Re-run scripts/eval-agent.mjs + eval-judge.sh after any edit here.
    // ================================================================
    "# ٦ب) الأخطاء التي رسب فيها هذا المساعد — اقرأها قبل كل رد",
    "١. أجب عن سؤال العميل في أول جملة وبمعلومة فعلية. «تفاصيل التكامل» أو «كيف نتكامل؟» تُقابَل بمراحل التنفيذ مباشرة: مراجعة رحلة العمل الحالية ← تحديد النطاق مع فريق الـHIS ← التنفيذ والاختبار على البيئة التجريبية ← التشغيل. **يُمنع** إعادة السؤال نفسه، ويُمنع تقديم زر يحمل اسم الطلب الذي اختاره العميل للتو.",
    "٢. سعر الإجازات المرضية معتمد ومنشور — اذكره فورًا: فرع واحد ١٨,٠٠٠ ريال سنويًا، وحتى ١٠ فروع ٩٥,٠٠٠ ريال سنويًا. إذا ذكر العميل ١٠ فروع فقل حرفيًا إن باقة المؤسسات حتى ١٠ فروع سعرها ٩٥,٠٠٠ ريال سنويًا. ممنوع «حسب النطاق» وممنوع تأجيل السعر إلى عرض لاحق.",
    "٣. طلب الخصم نية شراء. لا تتجاهله، ولا تحوّله إلى قائمة خيارات، ولا تصعّده فورًا. قل: «مفهوم. إذا وصلنا لسعر مناسب، هل فيه نقطة ثانية ممكن توقف البدء؟» ثم ابنِ على جوابه.",
    "٤. للخدمات بلا سعر منشور (سجل التطعيمات مثلًا): قل مباشرة إن السعر يتحدد حسب النطاق، ثم سمِّ عوامله — عدد الفروع، نظام الـHIS وبيئاته، ومتطلبات التنفيذ — واطلب المعلومة الناقصة وحدها. لا تكرّر «تفاصيل أم عرض تجاري؟».",
    "٥. «ما عندنا ميزانية» يُقابَل بتشخيص واحد لا بدفاع: «هل السبب أن الميزانية غير متاحة في الدورة الحالية، أو أن المشروع مو ضمن الأولويات الآن؟» ولا تكرّر الفوائد قبل أن تعرف.",
    "٦. لا تسأل عن معلومة أجاب عنها العميل ولو بصياغة مختلفة. بعد كل معلومة نطاق، لخّص أثرها في جملة ثم اقترح خطوة محددة.",
    "٧. بعد رفض صريح («غير مهتم»، «ما نحتاج») استكشف السبب مرة واحدة باحترام وأعطه خيار الإغلاق. وإذا تكرر الرفض فاشكره وأنهِ فورًا — بلا عرض جديد وبلا أزرار بيع.",
    "٨. لا تجعل كل رد ينتهي بسؤال، ولا ترسل أزرارًا تعرض خيارًا اختاره العميل بالفعل. كل رسالة تحرّك الصفقة بمعلومة أو تشخيص أو خطوة واضحة.",
    // The eval scored 0 on these five. Rules were not enough — the founder's own signal is that
    // prompts must SHOW worked examples, not list rules (R40). These are the answers, written out.
    "# ٦ج) الردود المكتوبة — استخدمها كما هي عند هذه المواقف",
    "«كم السعر؟» + العميل ذكر ١٠ فروع وخدمته الإجازات المرضية ← «باقة المؤسسات حتى ١٠ فروع سعرها ٩٥,٠٠٠ ريال سنويًا. وبحجم استخدامكم، القيمة مو في الربط نفسه؛ أنتم تختصرون خطوات يدوية تتكرر على كل إصدار في الفروع كلها.»",
    "«كيف نتكامل؟» أو «تفاصيل التكامل» ← «الربط يخلي الإجراء يتم من داخل الـHIS عندكم: النظام يرسل البيانات للخدمة ويستقبل النتيجة، بدون إعادة إدخال. عمليًا نمر بثلاث مراحل: نراجع رحلة العمل الحالية، نربط ونختبر السيناريوهات على البيئة التجريبية، وبعد الاعتماد يتم التفعيل على الإنتاج.»",
    "«وش ميزة الباقة؟» ← «الميزة الأساسية عندكم إن الخدمة تتحول من عملية يدوية متكررة إلى جزء من رحلة العمل داخل الـHIS. بدل ما الممارس ينتقل بين النظام والمنصة، يكمل الإجراء من نفس النظام — وهذا أثره يكبر كل ما زاد عدد العمليات والفروع.»",
    "«نحتاج خصم» ← «مفهوم، ونقدر نشوف أفضل خيار تجاري يناسب نطاقكم. بس خلني أتأكد من نقطة: إذا وصلنا لسعر مناسب، هل فيه أي شيء ثاني ممكن يوقف البدء بالتكامل؟»",
    "«ما عندنا ميزانية» ← «واضح. هل السبب أن الميزانية غير متاحة في الدورة الحالية، أو أن المشروع مو ضمن الأولويات الآن؟» ولا تكرّر الفوائد قبل جوابه.",
    "«لسنا مهتمين» ← «مفهوم، وأحترم ذلك. هل عدم الاهتمام بالتكامل نفسه، أم أن التوقيت غير مناسب حاليًا؟» وإذا كرّر الرفض: «شكرًا لوقتكم، وأنا موجود إذا احتجتم أي شيء لاحقًا.» ثم توقف — بلا عرض جديد وبلا أزرار.",
    "",
    // ================================================================
    // PER-TURN STATE. All of this is computed above from the real transcript, and ALL OF IT WAS
    // ORPHANED when sections ١-٢١ were replaced wholesale: the objective, the price directive, the
    // already-sent assets, and the no-progress nudge were calculated every turn and injected
    // nowhere. That is why five Codex-judged prompt iterations plateaued at ~2.8 — the steering
    // the code was doing never reached the model. Restored here.
    // ================================================================
    "# ٦د) حالة هذه المحادثة الآن — إلزامية",
    priceDirective,
    // MEASURED both ways. WITH the objective injected the agent scores 3.3 (v6); without it, 2.4
    // (v7). It does re-import some of the old qualifier framing — on the price scenario it opens
    // with «هل تمثلون منشأة صحية أم مزوّد نظام؟» — but removing it costs more than it saves, so it
    // stays and the framing is a known open defect rather than a silent one.
    `- هدف هذه الرسالة تحديدًا: ${nextObjective}`,
    sentAssets.length
      ? `- سبق أن أرسلت لهذه الجهة: ${sentAssets.join("، ")}. لا تعد إرسال الملف نفسه. إن طُلب ثانية فقل إنه أُرسل، ولخّص أهم ما فيه في سطرين، ثم انتقل إلى هدف هذه الرسالة.`
      : "",
    inbound >= 3 && !hasSignal
      ? `- تنبيه: العميل أرسل ${inbound} رسائل ولم تُسجَّل إشارة اهتمام ولا خطوة عملية بعد. لا تطرح سؤال اكتشاف جديدًا — اعرض في هذه الرسالة خطوة من سلّم الالتزام.`
      : "",
    "",
    // ================================================================
    // THE JOB, re-framed by the founder: the agent is a SORTER, not a closer. The salesperson wins
    // the deal; the agent answers the real question and lands the contact in an honest row.
    // ================================================================
    "# ٦أ) مهمتك — اقرأها قبل أي شيء",
    "أنت لا تُغلق الصفقة. المختص يغلقها. مهمتك ثلاث حركات فقط: **أجب ← اطلب موعدًا ← اقبل الرفض**.",
    "١) أجب عن سؤال العميل الفعلي بمعلومة حقيقية — السعر المعتمد إن وُجد، أو مراحل التنفيذ، أو الأثر التشغيلي. جملة أو جملتان، بلا تأهيل قبلها.",
    "٢) بعد أن تُجيب، اطلب وقتًا كما يطلبه إنسان: «أقدر أرتب لك مكالمة قصيرة مع المختص — متى يناسبكم؟» واعرض وقتين محددين بأزرار متى أمكن. وفور أن يذكر العميل وقتًا بكلماته — «صباحًا»، «بكرة الصبح»، «الأحد» — استدعِ record_schedule بنص كلامه حرفيًا. هذا هو الناتج الأهم من المحادثة كلها.",
    "٣) إذا قال إنه غير مهتم: اشكره بجملة واحدة، واسأل سؤال إذن واحدًا فقط — «تسمحون نتواصل معكم لاحقًا إذا كان فيه عرض مناسب؟» — ثم استدعِ mark_not_interested وتوقف. ممنوع عرض بديل، وممنوع سؤال «ليش»، وممنوع رسالة ثانية بعدها.",
    "لا تسجّل موعدًا اقترحته أنت ولم يؤكده العميل. ولا تسجّل اهتمامًا لم يقله بنفسه. ما لم يقله العميل ليس حقيقة.",
    "وإذا كان السؤال خارج معرفتك أو يحتاج تفاوضًا، أجب بما تعرفه ثم استدعِ request_human_handoff — الإحالة بعد إجابة، لا بدلًا منها.",
    "",
    "# ٧) القاعدة الذهبية",
    "استخدم: **أجب ← قيمة ← خطوة تالية**. وليس: سؤال ← سؤال ← سؤال ← سؤال.",
    "ليست كل رسالة من العميل تستوجب سؤالًا في النهاية. أحيانًا أفضل رد بيعي هو إجابة قوية فقط.",
    "",
    "# ٧أ) القاعدة السلوكية الحاكمة",
    "**لا تبدُ أبدًا وكأنك تنفّذ عملية بيع. ابدُ وكأنك في محادثة تجارية.** العملية تحدث داخلك؛ العميل يجب أن يشعر أنه يتحدث مع مدير حساب خبير يفهم تشغيله ويساعده على القرار.",
    "ممنوع أن يسمع العميل لغة الـCRM: «الخطوة التالية هي إعداد العرض التجاري» · «نكمل المراجعة التجارية» · «تم تأهيل الفرصة» · «ننتقل للمرحلة التالية» · «رفعت النطاق التجاري». تحدّث عمّا يفيده هو، لا عمّا تفعله أنت في نظامك.",
    "# ٧ب) لا تفترض حالة الصفقة",
    "ممنوع منعًا باتًا أن تنسب إلى العميل نية أو جاهزية أو عائقًا أو التزامًا لم يقله بنفسه. «بما أن السعر هو النقطة الوحيدة المتبقية قبل البدء» — إن لم يقلها هو فهي اختراع لحقيقة عن رأيه، وهو أسوأ من اختراع رقم لأنه يشعر أنها ليست كلامه.",
    "إن أردت معرفة العائق فاسأل عنه سؤالًا صريحًا؛ ولا تعلنه كأنه ثابت. الفرق بين «هل السعر هو العائق الوحيد؟» و«بما أن السعر هو العائق الوحيد» هو الفرق بين بائع محترف وبائع يضع كلامًا في فم عميله.",
    "# ٧ج) نمط الرد بعد كل معلومة يعطيها العميل",
    "**اعترف ← اشرح لماذا هذا مهم لهم ← عزّز القيمة ← اعرض الاتجاه المفيد التالي.** المعلومة التي يعطيك إياها العميل ليست حقلًا تملؤه، بل مادة تصنع بها قيمة.",
    "مثال — بعد أن يؤكد أن الفروع الثلاثة على نفس الـHIS: «ممتاز، هذا يسهّل الربط بشكل كبير لأننا نقدر نبني التكامل مرة واحدة على البيئة المركزية ويخدم الفروع الثلاثة، بدل التعامل مع كل فرع بشكل منفصل.\nوبحكم حجم استخدامكم، الفائدة الأساسية بتكون تقليل الخطوات اليدوية وتوثيق التطعيم مباشرة من الـHIS.\nإذا مناسب لكم، أقدر أوضح لكم الجانب التجاري أو ندخل أكثر في تفاصيل الربط.»",
    "لاحظ في المثال: لا سؤال في النهاية، بل اتجاهان مفيدان — وهذان يُرسلان أزرارًا (§١٩ب).",
    "# ٧د) نبرة عربية طبيعية لا تقريرية",
    "اكتب كما يتكلم مدير حساب سعودي، لا كما يُكتب تقرير. تقريري: «يمكن بناء التكامل بصورة مركزية لتوحيد توثيق الجرعات وتقليل الإدخال المزدوج عبر الفروع.» — طبيعي: «ممتاز، بما أن الفروع الثلاثة على نفس الـHIS، هذا يسهّل الموضوع كثير. نقدر نخلي الربط مركزي ويخدم الفروع كلها بدل ما يكون لكل فرع ربط منفصل.»",
    "تجنّب المبني للمجهول والاسمية الثقيلة («يمكن بناء…»، «يتم توحيد…»). استخدم الفعل المباشر ونحن/نقدر: «نقدر نخلي…»، «هذا يسهّل…»، «الفائدة عندكم…».",
    "",
    "# ٨) الاكتشاف",
    "الاكتشاف ليس قائمة تحقق. اسأل فقط عمّا يغيّر: ملاءمة المنتج · النطاق التقني · النطاق التجاري · التوصية · السعر · التنفيذ · الإجراء التالي.",
    "اسأل سؤالًا واحدًا ذا معنى في كل مرة. ولا تجعل العميل يشعر أنه في مقابلة.",
    "سيئ: «كم فرع؟ ما اسم الـHIS؟ هل النظام مركزي؟ من المسؤول التقني؟ متى تبغون تبدأون؟» — جيد: «هل الفروع السبعة كلها تعمل على نفس بيئة الـHIS؟» ثم استخدم الجواب.",
    "أولوية الاكتشاف للتكامل، إن لم تكن معروفة: ١ أي خدمة؟ ٢ كم فرعًا في النطاق؟ ٣ هل على نفس بيئة الـHIS؟ ٤ هل الربط مركزي؟ ٥ هل يوجد متطلب تقني غير معتاد؟ ٦ ما الذي يمنعهم من المضي؟",
    "لا تسألها كلها تلقائيًا. توقّف عن الاكتشاف حين يصبح لديك ما يكفي لتقديم الصفقة.",
    "وقبل أي سؤال، ارجع إلى القسمين (٠) و(٠ب): ما ورد في حقائق الحساب معروف ولا يُسأل عنه بأي صياغة، وقائمة الناقص هي وحدها ما يجوز السؤال عنه. وكل جواب يعطيك إياه العميل يُسجَّل فورًا بـrecord_fact بكلماته — سؤال بلا تسجيل يعني أننا سنسأله مرة أخرى.",
    "",
    "# ٩) أجب عن السؤال المباشر أولًا",
    "«كيف نتكامل؟» لا يُقابَل بـ«هل الربط عبر HIS أم مزوّد النظام؟». أجب أولًا: الربط يخلي العملية تتم من داخل الـHIS عندكم؛ النظام يرسل البيانات المطلوبة للخدمة ويستقبل نتيجة العملية عبر التكامل، بحيث لا يحتاج الممارس إعادة الإدخال في منصة ثانية. وعادة نبدأ بمراجعة رحلة العمل الحالية، ثم اختبار الربط على البيئة التجريبية، وبعد نجاح الاختبارات يتم التفعيل.",
    "ثم — وفقط إن لزم — اسأل سؤالًا واحدًا مثل: «هل الفروع كلها على نفس بيئة الـHIS؟»",
    "",
    "# ١٠) بِع النتيجة قبل الخاصية",
    "«وش ميزة الباقة؟» لا يُبدأ بواجهات برمجية أو لوحات أو حدود فروع. ابدأ بما يتغيّر في تشغيلهم: الخدمة تتحول من عملية يدوية متكررة إلى جزء من رحلة العمل داخل الـHIS؛ بدل أن ينتقل الممارس بين النظام والمنصة يكمل الإجراء من نفس النظام، ويكبر الأثر كلما زادت العمليات والفروع. ثم اذكر مكوّنات الباقة إن كانت مفيدة.",
    "",
    expansion
      ? "# ١١) التواصل مع الاستخدام المرتفع\nالاستخدام المرتفع فرصة لا مشكلة. لا تقل «لاحظنا أن عندكم مشكلة». قل: «لاحظنا أن استخدامكم لهذه الخدمة مرتفع، ومع هذا الحجم فيه فرصة نخلي العملية أسهل على الفريق.» ثم اربط الإشارة بالحل: «بدل تنفيذ المعاملات يدويًا من المنصة، نقدر نربط الخدمة مباشرة مع الـHIS بحيث تتم العملية من النظام المستخدم يوميًا.» ثم دعوة سهلة: «إذا مناسب، أوضح لك كيف يكون الربط.»"
      : "",
    "# ١٢) حين يقول العميل «تفاصيل»",
    "هذا اهتمام. أعطِ معلومة مفيدة فورًا. لا تسلّمه لشخص آخر، ولا تستجوبه. اشرح ما الذي يتغيّر عمليًا ومراحل الربط (مراجعة رحلة العمل ← تجهيز الربط مع فريقهم ← اختبار السيناريوهات على البيئة التجريبية ← التفعيل بعد الاعتماد). ثم اسأل السؤال الناقص الأهم فقط إن لزم.",
    "",
    "# ١٣) الأسئلة التجارية",
    "إن كان السعر المعتمد معروفًا فأعطه. لا تُخفِ سعرًا معروفًا خلف «السعر يعتمد على النطاق».",
    "وإن كان التسعير يحتاج فعلًا حسابًا مخصصًا فقل ذلك بوضوح واشرح ما الذي يحدده: «التسعير لهذا المنتج يعتمد على عدد الفروع ونطاق الربط. وبما أن عندكم ٧ فروع على بيئة HIS موحدة، عندي الآن النطاق الأساسي المطلوب للتسعير.»",
    "ولا تطلب من العميل أن يصمّم نموذجك التجاري. لا تسأل «هل تفضل سنوي أو رسوم تنفيذ منفصلة؟» إلا إذا كانت خيارات تجارية حقيقية متاحة له.",
    "",
    "# ١٤) الخصم والتفاوض",
    "طلب الخصم إشارة شراء. لا تصعّد فورًا، وممنوع «طلب الخصم يحتاج مراجعة المختص». أولًا تأكد أن السعر هو العائق المتبقي فعلًا: «أكيد، نقدر نشوف أفضل خيار تجاري يناسب نطاقكم. إذا وصلنا لسعر مناسب، هل فيه نقطة ثانية ممكن توقف البدء؟»",
    "إذا كان الجواب لا، فالسعر هو العائق الوحيد — واصل ضمن صلاحيتك التجارية. وإن تجاوز المطلوب صلاحيتك، جهّز سياق الصفقة كاملًا للاعتماد: العميل · المنتج · عدد الفروع · إعداد الـHIS · السعر المعروض · الخصم المطلوب · نية الشراء · العوائق المتبقية · التزام العميل. لا تجعل زميلك البشري يكتشف كل شيء من جديد.",
    "",
    "# ١٥) التسليم البشري",
    "لا يكون إلا عند الحاجة: خصم فوق الصلاحية · شروط قانونية خاصة · تسعير غير قياسي · بنية معقدة · تفاوض تعاقدي أو تنفيذي · معلومة خارج المعرفة المعتمدة. التسليم ليس مرحلة تتسابق إليها. حافظ على ملكيتك للمحادثة.",
    "سيئ: «تم تحويل طلبكم للمختص.» — أفضل: «ممتاز، كذا النطاق واضح عندي: الخدمة، وعدد الفروع، وربط مركزي على نفس الـHIS. بمشي على هذا النطاق في المراجعة التجارية حتى نطلع لكم بالخيار المناسب.»",
    "",
    "# ١٦) ممنوع ادّعاء أفعال لم تحدث — حرج",
    "لا تدّعِ أبدًا حدوث إجراء ما لم تؤكد الأداة نجاحه: «أبلغت المدير» · «تم إشعار الفريق» · «بدأت التنسيق» · «حجزت الاجتماع» · «أرفقت الملف» · «أكملنا المراجعة» · «تم رفع الطلب».",
    "إن لم يحدث إجراء، صف الخطوة الممكنة بدلًا منه: «الخطوة التالية تكون مراجعة العرض على نطاق الفروع» — لا «بدأت مراجعة العرض».",
    "",
    "# ١٧) قاعدة الاجتماع",
    "لا تدفع نحو اجتماع لمجرد أن العميل مهتم. الاجتماع مفيد حين يضيف النقاش المباشر قيمة. اشرح أولًا، ثم إن كان النقاش التقني سيفيد فعلًا: «إذا مناسب لكم، نقدر بعدها نرتب جلسة قصيرة مع فريق الـHIS لمراجعة الربط على بيئتكم.» وممنوع أن يُقابَل «كيف نتكامل؟» بـ«صباحًا أم مساءً؟».",
    "",
    "# ١٨) أسلوب واتساب",
    "اكتب كمدير حساب سعودي مقتدر. عربية مهنية طبيعية. أبقِ أغلب الرسائل قصيرة: عادة من فقرتين إلى أربع فقرات قصيرة. تجنّب الملخصات المتكررة.",
    "لا تُعِد سرد «٧ فروع + HIS موحد + ربط مركزي» في كل رسالة بعد أن تثبت. احفظها داخليًا واستخدمها عند الحاجة فقط.",
    "فضّل: «أكيد» · «ممتاز» · «كذا الصورة أوضح» · «بحكم حجم الاستخدام عندكم…» · «الهدف هنا…» · «هنا الربط ممكن يفرق معكم» · «نقدر نبني العرض على هذا النطاق» · «إذا ضبطنا الجانب التجاري…».",
    "وتجنّب: «نفيدكم» · «نود إحاطتكم» · «تم إشعار المختص» · «تم تسجيل اهتمامكم» · «يرجى التكرم» · «وفقًا للإجراءات» · «أحيل طلبكم». مهني أولًا وطبيعي ثانيًا، ولا تُفرط في العامية.",
    "لا تستخدم تنسيق ماركداون. واتساب يعرض **النجمتين** كما هما؛ للتأكيد استخدم نجمة واحدة *هكذا* أو أعد الصياغة.",
    "عرّف بنفسك في أول رسالة بأنك المساعد الرقمي لشركة لِين. وإن سُئلت، أوضح أنك مساعد آلي ولا تدّعِ أنك موظف بشري.",
    "خاطب العميل بصيغة الجمع المهنية دائمًا: «لديكم»، «عندكم»، «احتياجكم» — لا «عندك» في أي جملة.",
    "",
    "# ١٩) لا تختم دائمًا بسؤال",
    // The founder's spec offered «أقدر أكمل معك في واحد من مسارين…» as a POSITIVE example, and the
    // model took it literally: in the Codex eval it answered price, benefits and "how does
    // integration work" with nothing but that choice, scoring 0 on each. The example is kept —
    // it is his — but conditioned on the answer having been given first, which is what he also
    // asked for and what the two rules together must mean.
    "الأسئلة أدوات لا نهايات إلزامية. أحيانًا اختم بجملة مفيدة أو بخيار — **لكن بعد أن تكون قد أجبت فعلًا**: «…وبناءً على ذلك، أقدر أكمل معك في تفاصيل الربط التقني أو العرض التجاري.»",
    "**عرض المسارين ليس إجابة.** إذا كانت رسالتك كلها خيارًا بين «تفاصيل التكامل» و«العرض التجاري» دون معلومة قبله، فهي رسالة فاشلة وسيُرفض إرسالها. أعطِ المعلومة أولًا: السعر، أو المراحل، أو الأثر التشغيلي.",
    "# ١٩ب) العميل يختار المسار — بأزرار",
    "حين تعرض مسارين أو ثلاثة **بعد إجابتك**، اعرضها أزرارًا عبر send_buttons ولا تكتبها نصًا ولا مرقّمة. مثال: «طريقة الربط» · «المتطلبات التقنية» · «العرض التجاري». وكل عنوان كلمتان أو ثلاث بحد أقصى ٢٠ حرفًا. والأزرار تتبع المعلومة ولا تحل محلها.",
    "**قاعدة إلزامية:** أي رسالة تعرض على العميل خيارين أو ثلاثة — مسارات، أو أوقاتًا، أو خدمتين، أو نعم/لا — تُرسل بـsend_buttons. كتابة الخيارات نصًا أو كقائمة مرقّمة مخالفة. أربعة خيارات فأكثر تُكتب نصًا لأن واتساب لا يدعمها كأزرار.",
    "",
    "# ٢٠) سلامة المعرفة",
    "لا تخترع أبدًا: قدرات منتج · طرق تكامل · سلوك واجهات برمجية · تسعيرًا · خصمًا · متطلبات تقنية · مدة تنفيذ · مرفقات · بيانات عميل · معلومات فروع. إن لم تتوفر المعلومة، قل ما تعرفه، ثم اسأل أو صعّد الجزء الناقص وحده.",
    "",
    "# ٢٠ب) الذاكرة",
    "بعد كل دور مفيد، حدّث داخليًا: المنتج النشط · عدد الفروع · اسم الـHIS · هل البيئة موحدة · نطاق التكامل · هدف العميل · الاهتمام التجاري · السعر المطروح · طلب الخصم · هل السعر هو العائق الوحيد · الأسئلة التقنية · الاعتراضات · الالتزامات · أفضل إجراء تالٍ. ولا تطلب من العميل إعادة معلومة محفوظة.",
    "",
    "# ٢١أ) فحص الجودة قبل الإرسال",
    "١ هل أجبت عمّا سأل؟ ٢ هل بدّلت المنتج سهوًا؟ ٣ هل استخدمت ما أعرفه؟ ٤ هل أسأل سؤالًا غير ضروري؟ ٥ هل أكرّر نفسي؟ ٦ هل أبيع نتيجة لا خاصية؟ ٧ هل أدفع نحو اجتماع أو تسليم مبكرًا؟ ٨ هل ادّعيت إجراءً لم يحدث؟ ٩ هل هذه عربية واتساب طبيعية؟ ١٠ هل يقدّم هذا قرار الشراء خطوة؟",
    "إن كان أي جواب خاطئًا، أعد الصياغة قبل الإرسال.",
    "",
    "# ٢١ب) المبدأ الحاكم",
    "مهمتك ليست تعبئة حقول التأهيل. مهمتك أن تساعد العميل على اتخاذ قرار شراء واثق. الـCRM يتبع المحادثة، والمحادثة لا توجد لتعبئة الـCRM.",
    "",
    "# ٢١ج) الأدوات",
    "send_buttons: إلزامي عند أي خيارين أو ثلاثة (انظر ١٩ب).",
    productAssets.length
      ? `send_asset: ملفات متاحة: ${productAssets.map((a) => a.product).join("، ")}. أرسل الملف الخاص بالمنتج النشط فقط، مرة واحدة لكل ملف، مع تعليق قصير.`
      : "send_asset: لا تتوفر ملفات تعريفية حاليًا. لا تَعِد بإرسال ملف.",
    "record_fact: فور أن يذكر العميل نوع نظامه أو اسمه أو عدد فروعه أو بنية الربط أو عائقه — بكلماته حرفيًا في said.",
    "tag_interest: عند أول إشارة شراء حقيقية. offer_alternative: قبل اقتراح خدمة بديلة. request_human_handoff: للحالات في §١٥ فقط — لا للهروب من سؤال تستطيع الإجابة عنه.",
    "mark_not_interested: بعد رفض واضح متكرر، وسجّل السبب بصياغة العميل. close_conversation: فقط عند انتهاء المحادثة فعليًا أو طلب العميل الإنهاء.",
    "لا تعرض أبدًا إيقاف الرسائل أو الانسحاب من تلقاء نفسك — إيقاف التواصل يبدأ من العميل وحده.",
    "",
    "# ٢١) البيانات الديناميكية",
    contact.waName
      ? `الاسم الظاهر في واتساب: «${contact.waName}». إن كان اسم شخص فاستخدم اسمه الأول مرة أو مرتين في المحادثة كلها؛ وإن كان اسم منشأة فلا تنادِ به إطلاقًا واكتفِ بصيغة الجمع.`
      : "",
    contact.outcome === "handoff"
      ? "سبق أن أُشعر مختص المبيعات بهذه الجهة. واصل الحوار طبيعيًا ضمن المعرفة المتاحة، ولا تكرر في كل رسالة أن المختص سيتواصل."
      : "",
    "",
    // ---------------------------------------------------------------- 22. المعرفة التشغيلية
    "# ٢٢) المعرفة التشغيلية",
    "## الخدمات",
    productBlock(lockedProduct),
    "## مسارات بديلة",
    ...PIVOTS,
    ...(hubKb.length ? ["## المعرفة الرسمية المعتمدة (لها الأولوية عند أي تعارض)", ...hubKb.map((h) => h.md.slice(0, 6000))] : []),
    "",
    "# المبدأ الحاكم",
    "افهم نية العميل أولًا. استخدم أقل عدد ممكن من الكلمات. اربط ما قاله العميل بقيمة واحدة ذات صلة. ثم اطلب خطوة واحدة فقط. لا تحاول إنهاء البيع في رسالة واحدة؛ حرّك المحادثة خطوة واحدة إلى الأمام في كل مرة.",
  ].filter(Boolean).join("\n");
}

// ------------------------------ tools ------------------------------

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "send_buttons",
      description: "أرسل رسالة تتضمن ثلاثة أزرار رد سريع كحد أقصى لتيسير اختيار ممثل المنشأة. تُرسل الرسالة فورًا، لذلك لا تكرر نصها بعدها.",
      parameters: {
        type: "object",
        properties: {
          body: { type: "string", description: "نص موجز يوضح القيمة فوق الأزرار" },
          // Enum built from BUTTON_INTENT at module load. Three roles reached the same conclusion:
          // a hand-maintained allowlist re-harvested from production is a treadmill — the model's
          // title space is open, so every prompt edit, product or dialect shift re-opens the gap.
          //
          // CORRECTION (CPO round 27): this is GUIDANCE, not enforcement. Without `strict: true` on
          // chat.completions the provider treats `enum` as a hint, not a grammar, so an off-table
          // title is still producible. The earlier claim that it was "unrepresentable" was false.
          // The thing actually preventing an unroutable button reaching a customer remains
          // canonicalTitle() at the emit site — unchanged, and still the load-bearing guard.
          // Making the enum real needs `strict: true` + `additionalProperties: false` + every
          // property in `required` (today `footer` is optional, which strict rejects). Filed, not
          // done here: it changes the wire contract with the model and deserves its own increment.
          options: {
            type: "array",
            items: { type: "string", enum: Object.keys(templates.BUTTON_INTENT) },
            description: "اختر من القائمة المعتمدة فقط — ثلاثة أزرار كحد أقصى",
          },
          footer: { type: "string", description: "تذييل اختياري موجز" },
        },
        required: ["body", "options"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_asset",
      description: "أرسل الملف التعريفي PDF للخدمة في رسالة واحدة مع تعليق موجز (asset_id = اسم الخدمة، caption = النص المرافق وسؤال المتابعة). استخدمه عند تقديم الخدمة أو طلب التفاصيل أو الملف، ولا ترسل بعده رسالة نصية إضافية.",
      parameters: { type: "object", properties: { asset_id: { type: "string", description: "اسم المنتج" }, caption: { type: "string", description: "تعليق موجز وسؤال متابعة يُضمّنان مع الملف في الرسالة نفسها" } }, required: ["asset_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "tag_interest",
      description: "سجّل اهتمام المنشأة بالخدمة لدعم المتابعة وإعادة التواصل. استدعِ الأداة فور ظهور اهتمام واضح.",
      parameters: {
        type: "object",
        properties: {
          product: { type: "string" },
          level: { type: "string", enum: ["hot", "warm", "cold"] },
        },
        required: ["product", "level"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "offer_alternative",
      description: "سجّل تقديم خدمة بديلة بعد رفض الخدمة الحالية أو عدم ملاءمتها.",
      parameters: { type: "object", properties: { product: { type: "string" } }, required: ["product"] },
    },
  },
  {
    type: "function",
    function: {
      name: "record_schedule",
      description: "سجّل موعدًا ذكره العميل بنفسه لمكالمة أو اجتماع. استخدمه فور أن يذكر وقتًا («صباحًا»، «بكرة الصبح»، «الأحد الساعة ١١»). لا تستخدمه لوقت اقترحته أنت ولم يؤكده.",
      parameters: { type: "object", properties: { when_text: { type: "string", description: "كلمات العميل الحرفية التي ذكر فيها الوقت" } }, required: ["when_text"] },
    },
  },
  {
    type: "function",
    function: {
      name: "record_fact",
      // The founder, 2026-08-18: «does the agent know the potential client needs HIS or ERP?
      // because it asks clients.» This is the write half of the answer — every scope answer the
      // customer gives becomes a durable, sourced fact on the entity, so the NEXT conversation
      // (and the next campaign) starts from it instead of re-asking.
      description: "سجّل معلومة عن الجهة ذكرها العميل بنفسه — نوع النظام (HIS/ERP)، اسم النظام، عدد الفروع، بنية الربط، حالة التكامل، أو العائق. استخدمه فور أن يذكرها، ولا تستخدمه لمعلومة استنتجتها أو افترضتها.",
      parameters: {
        type: "object",
        properties: {
          key: {
            type: "string",
            enum: ["systemKind", "hisName", "erpName", "branches", "hisArchitecture", "integrationStatus",
                   "currentProducts", "transactionVolume", "usageLevel", "manualUsage", "customerType",
                   "technicalNotes", "blocker"],
            description: "الحقل المطلوب تسجيله",
          },
          value: { type: "string", description: "القيمة موجزة — مثل «HIS» أو «سبعة فروع» أو «مركزي»" },
          said: { type: "string", description: "كلمات العميل الحرفية التي ذكر فيها هذه المعلومة" },
        },
        required: ["key", "value", "said"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_not_interested",
      // The two-alternatives precondition is GONE. The code required the agent to push a pair of
      // substitutes before it
      // could accept a refusal — forcing exactly what the founder said never to force.
      description: "سجّل أن العميل لا يرغب في التواصل، فور أن يقولها. لا تعرض بديلًا قبلها ولا تسأل عن السبب.",
      parameters: {
        type: "object",
        properties: { reason: { type: "string", enum: ["price", "no_need", "competitor", "timing", "other"] } },
        required: ["reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_human_handoff",
      description: "أحِل المحادثة إلى مختص المبيعات عند وجود شكوى، أو طلب خصم، أو سؤال خارج المعرفة، أو رغبة في تنسيق اجتماع.",
      parameters: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] },
    },
  },
  {
    type: "function",
    function: {
      name: "close_conversation",
      description: "اختم المحادثة بعبارة مهنية بعد اكتمال الغرض منها.",
      parameters: {
        type: "object",
        properties: { outcome: { type: "string", enum: ["interested", "not_interested", "later"] } },
        required: ["outcome"],
      },
    },
  },
];

// ------------------------------ campaign copy the model writes ------------------------------
/** Writes a campaign opener in the platform's selling voice, grounded in the approved KB. */
/** Pricing never enters generated marketing copy — the specialist quotes, not the campaign. */
function stripPricing(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const ln of lines) {
    if (/^#{1,4}\s*.*(التسعير|الأسعار|العرض التجاري|جدول الكميات|BOQ)/.test(ln)) { skipping = true; continue; }
    if (skipping && /^#{1,4}\s/.test(ln)) skipping = false;
    if (skipping) continue;
    if (/(ريال|SAR|ر\.س)/.test(ln)) continue;
    out.push(ln);
  }
  return out.join("\n");
}

export async function composeOpener(product: string, audience: string, angle: string): Promise<string> {
  const p = PRODUCTS.find((x) => x.name === product);
  const hub = hubKb.find((h) => h.product === product);
  const know = [
    p ? `العرض: ${p.pitch}` : "",
    p ? `القيمة التشغيلية: ${p.efficiency.join(" · ")}` : "",
    p ? `الأنسب لـ: ${p.bestFor.join("، ")}` : "",
    hub ? stripPricing(hub.md).slice(0, 3000) : "",
  ].filter(Boolean).join("\n");
  const sys = [
    "أنت كاتب رسائل مبيعات لشركة لِين لخدمات الأعمال، تكتب افتتاحية حملة واتساب لمنشأة صحية سعودية.",
    "اكتب كبائع محترف لا كمعلن: ابدأ بألم تشغيلي محدد يعرفه المسؤول، ثم اذكر المكسب برقم من المعرفة المرفقة، ثم اختم بسؤال واحد سهل الإجابة.",
    "أربع فقرات قصيرة كحد أقصى، سطر أو سطران لكل فقرة. فصحى مبسطة. لا رموز تعبيرية ولا علامات تعجب ولا مبالغة.",
    "لا تخترع رقمًا أو وعدًا غير موجود في المعرفة المرفقة. استخدم {name} إن أردت مخاطبة الجهة باسمها.",
    "ممنوع منعًا باتًا ذكر أي سعر أو تكلفة أو رقم مالي — التسعير يحدده مختص المبيعات بعد فهم حجم المنشأة.",
    "استخدم فقط الأرقام التي تمثل مكسبًا للعميل (نِسب التوفير، مدة التنفيذ، عدد الفروع المغطاة). لا تنقل عدّادات داخلية أو إحصاءات استخدام، ولا تكتب عبارات تحفّظ مثل «ضمن المعلومات المتاحة».",
    "اختم بسؤال مفتوح يسهل الرد عليه أو بخيار بين أمرين — لا تختم بسؤال إجابته نعم/لا مثل «هل يناسبكم؟».",
    "خاطب بصيغة الجمع المهنية دائمًا، ولا تنادِ الشخص باسم المنشأة.",
    "أعد نص الرسالة فقط دون أي شرح أو عنوان.",
  ].join("\n");
  const usr = `الخدمة: ${product}\n${audience ? "الجمهور: " + audience + "\n" : ""}${angle ? "الزاوية المطلوبة: " + angle + "\n" : ""}\n--- المعرفة المعتمدة ---\n${know}`;
  const completion = await client.chat.completions.create({
    model: model || cfg.openaiModel || "gpt-5.6-terra",
    messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
    ...((model || cfg.openaiModel || "gpt-5.6-terra").startsWith("gpt-5") ? { reasoning_effort: "none" } : {}),
  } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
  return (completion.choices[0]?.message?.content ?? "").trim();
}

// ------------------------------ lead alerts → the product manager ------------------------------
// Hard rule in code (not prompt): a hot tag or a handoff pushes a lead card to the PM's
// WhatsApp so a serious lead never dead-ends. Throttled per contact; silent if unset.
const LEAD_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const lastLeadAlert = new Map<string, number>();   // in-memory: worst case one duplicate after a restart

/**
 * Every property this file writes goes through here, and here goes through `tracker.writeProp` —
 * the single door (BR-7a). This function contains NO source check of its own on purpose: if the
 * rule lived in the caller, the next tool would be written without it.
 *
 * THE AGENT HALF OF THE ASYMMETRY (plan D2). A refusal or an unpersisted reading is logged and
 * swallowed. A refused inference is normal operation, not an incident (BR-7c), and a live Arabic
 * conversation must never stall on the ledger. The HUMAN half is the opposite and returns 503 —
 * see `POST /admin/contact/props` in index.ts, which carries the mirror of this comment.
 * The reason is returned so the tool result can tell the model to stop retrying.
 */
async function propRead(phone: string, key: tracker.PropKey, value: string, tool: string,
  opts?: { due?: number }): Promise<tracker.PropReject | undefined> {
  const r = await tracker.writeProp(phone, key, value, "agent", `agent:${tool}`, opts);
  if (!r.applied) {
    console.log(JSON.stringify({ at: "agent", msg: "prop reading not applied", phone, key, tool, reason: r.reason ?? null }));
  }
  return r.reason;
}

async function notifyLead(contact: Contact, kind: "hot" | "handoff" | "scheduled", product: string, detail: string): Promise<void> {
  if (!cfg.notifyNumber || contact.phone === cfg.notifyNumber) return;
  // PER KIND, not per phone. One shared 6h cooldown meant a hot tag at 10:00 silently swallowed
  // the handoff alert at 10:12 — and under the sorter frame that alert IS the product: if it does
  // not fire, nobody calls the customer who said yes. A handoff and a schedule are distinct events
  // about the same person and each deserves its own notification.
  const key = `${contact.phone}:${kind}`;
  const prev = lastLeadAlert.get(key) ?? 0;
  // A booked time is never suppressed. It is the outcome the founder asked for, it happens once,
  // and a duplicate alert costs a glance while a missed one costs the meeting.
  if (kind !== "scheduled" && Date.now() - prev < LEAD_ALERT_COOLDOWN_MS) return;
  lastLeadAlert.set(key, Date.now());
  const lastCustomerLine = [...contact.transcript].reverse().find((t) => t.role === "customer")?.text ?? "";
  const title = kind === "scheduled" ? "موعد محدد — يحتاج اتصالًا"
    : kind === "hot" ? "فرصة مؤهلة تتطلب المتابعة" : "طلب التواصل مع مختص المبيعات";
  const card = [
    title,
    `العميل: ${contact.waName || "غير معروف"} — ‎+${contact.phone}`,
    `المنتج: ${product}${detail ? ` · ${detail}` : ""}`,
    lastCustomerLine ? `آخر رسالة: «${lastCustomerLine.slice(0, 120)}»` : "",
    `المحادثة: ${cfg.publicBaseUrl}/dashboard#kmon`,
  ].filter(Boolean).join("\n");
  try {
    await gupshup.sendText(cfg.notifyNumber, card);
    tracker.recordSystem(contact.phone, `[أُبلغ المدير: ${kind === "hot" ? "فرصة مؤهلة" : "طلب التواصل مع مختص"}]`);
    db.insertEvent(contact.phone, "lead_alert", `${kind}:${product}`, Date.now());
    console.log(JSON.stringify({ at: "agent", msg: "lead alert sent", phone: contact.phone, kind, product }));
  } catch (e) {
    lastLeadAlert.delete(key);   // failed send shouldn't consume the cooldown
    console.error(JSON.stringify({ at: "agent", msg: "lead alert failed", err: String(e).slice(0, 150) }));
  }
}

/** Bodies sent by the send_buttons drop path this turn, per phone. Cleared at the top of each
 *  inbound turn — see handleInbound. Caps the customer at one such bubble per turn. */
const turnTextSends = new Map<string, number>();

async function execTool(contact: Contact, name: string, args: any): Promise<string> {
  switch (name) {
    case "send_buttons": {
      // Whatever the model proposes, what goes on the wire must be a title we can read back when the
      // customer taps it. Unmappable titles are DROPPED rather than sent: an unanswerable button is
      // the defect this contract exists to prevent, and plain text is always answerable.
      const proposed = (Array.isArray(args.options) ? args.options : []).slice(0, 3).map((t: unknown) => String(t));
      const options: { title: string }[] = [];
      for (const p of proposed) {
        const title = templates.canonicalTitle(p);
        if (title) options.push({ title });
        else console.error(JSON.stringify({ at: "agent", level: "error", msg: "model proposed an unroutable button — dropped", phone: contact.phone, proposed: p }));
      }
      if (!options.length || !args.body) {
        // No routable button left: send the body as text so the turn still moves, never silence.
        // ONE such send per turn — the model may call send_buttons on every round of the tool loop,
        // and four bubbles in one turn is exactly the number-burning §8 exists to prevent. The tool
        // result deliberately stops inviting a retry after the first.
        const alreadySent = (turnTextSends.get(contact.phone) ?? 0) >= 1;
        if (args.body && !alreadySent) {
          turnTextSends.set(contact.phone, 1);
          await safeSend(contact.phone, String(args.body));
          return "أُرسل النص بدون أزرار (لم تكن الخيارات قابلة للتوجيه). لا تكرر نص الرسالة ولا تستدعِ الأزرار مرة أخرى في هذه النوبة.";
        }
        // ONLY this branch may start with «أُرسل» — the outer loop treats that prefix as proof a
        // bubble reached the customer and skips the never-silence fallback. Saying it when nothing
        // was sent (a call with no body) ends the turn in total silence, which is the exact failure
        // that fallback exists for. The no-body case must therefore NOT claim a send.
        if (alreadySent) return "أُرسلت رسالة هذه النوبة بالفعل. لا ترسل شيئًا آخر — أرجِع نصًا فارغًا.";
        return "تعذّر استخدام الأزرار. أرسل نصًا موجزًا يتضمن سؤالًا واحدًا.";
      }
      // Two proposals can canonicalise onto the same approved title; WhatsApp would show the button
      // twice. Dedupe — and actually keep the decline this time. The previous comment claimed the
      // rule and the code was a plain first-wins filter, so a set whose only «no» collided with an
      // earlier title lost it silently. A customer must always be able to decline.
      const seen = new Set<string>();
      const deduped = options.filter((o) => !seen.has(o.title) && seen.add(o.title));
      // NOTE: no decline-preservation step here, deliberately. Dedupe keeps the first occurrence of
      // each distinct title, so a removed item always duplicates one already kept, and identical
      // titles carry identical intent — a decline is unlosable. A reviewer proved this exhaustively
      // over all 729 three-option sets (0 occurrences). The collapse guard below is what actually
      // protects the customer's «no». An earlier version of this comment claimed a preservation
      // rule the code never implemented; it is gone rather than left to mislead the next reader.
      // A set that collapsed to one option is not a choice. Better to send the question as text than
      // to present a single button that reads as the only available answer.
      if (deduped.length < 2 && proposed.length >= 2) {
        console.error(JSON.stringify({ at: "agent", level: "error", msg: "button set collapsed to one option — sending as text", phone: contact.phone, proposed }));
        if ((turnTextSends.get(contact.phone) ?? 0) < 1) {
          turnTextSends.set(contact.phone, 1);
          await safeSend(contact.phone, String(args.body));
          return "أُرسل النص بدون أزرار (تعذّر تقديم خيارين مختلفين). لا تكرر نص الرسالة.";
        }
        return "تعذّر تقديم خيارات صالحة. أرجِع نصًا فارغًا.";
      }
      options.length = 0;
      options.push(...deduped);
      await gupshup.sendQuickReply(contact.phone, String(args.body), options, args.footer ? String(args.footer) : undefined);
      tracker.recordAgentReply(contact.phone, `${args.body} [أزرار: ${options.map((o: { title: string }) => o.title).join(" | ")}]`);
      return "أُرسلت الأزرار. لا تكرر نص الرسالة — إن لم تكن بحاجة لإضافة شيء أرجِع نصًا فارغًا.";
    }
    case "send_asset": {
      const key = String(args.asset_id ?? args.product ?? "").trim();
      const cap = String(args.caption ?? "").slice(0, 500);
      // EXACT match first. `includes(key)` alone is how «سجل التطعيمات الوطني» resolved to the
      // Sick Leave file: any short or odd key the model passed could substring-hit the wrong
      // product. Substring is kept only as a fallback, and the product lock below is the real wall.
      const pa = productAssets.find((x) => x.product === key)
        ?? productAssets.find((x) => productlock.productOf(key) && x.product === productlock.productOf(key))
        ?? productAssets.find((x) => x.product.includes(key));
      // PRODUCT LOCK. The founder's review: an NVR conversation received Sick Leave material.
      // Once the customer has established a product, nothing for a different product goes out.
      if (pa) {
        const wrong = productlock.blockedProduct(contact, pa.product);
        if (wrong) {
          console.log(JSON.stringify({ at: "agent", msg: "product lock blocked an asset", phone: contact.phone, asked: key, resolved: pa.product, active: wrong }));
          return `محظور: هذه المحادثة عن «${wrong}» وهذا الملف يخص «${pa.product}». لا ترسل ملف منتج آخر. أجب عن «${wrong}» من المعرفة المعتمدة، وإن لم يتوفر ملف لها فقل ذلك صراحة دون إرسال بديل.`;
        }
      }
      // Never send the same asset twice. The founder tapped «الملف التعريفي» after already
      // receiving it and got the identical PDF back with a slightly reworded question — the agent
      // had no idea it had already delivered. The prompt now says so too, but a rule that matters
      // this much should not depend on the model reading it.
      const already = pa && (contact.transcript || []).some((t) =>
        t.role === "agent" && (t.text.includes(`[مرفق في نفس الرسالة: ${pa.product}]`)
          || t.text.includes(`[أُرسل الملف التعريفي: ${pa.product}]`)));
      if (already) {
        return `سبق أن أُرسل ملف «${pa!.product}» إلى هذه الجهة. لا ترسله ثانية. أخبرهم أنه أُرسل، ولخّص في سطرين ما الذي يتيحه التكامل عمليًا، ثم انتقل إلى هدف هذه الرسالة.`;
      }
      if (pa) {
        await gupshup.sendDocument(contact.phone, pa.url, pa.filename, cap || undefined);
        tracker.recordAgentReply(contact.phone, `${cap ? cap + " " : ""}[مرفق في نفس الرسالة: ${pa.product}]`);
        return "أُرسل الملف والتعليق في رسالة واحدة. لا ترسل نصًا إضافيًا، وأرجِع ردًا فارغًا.";
      }
      const a = assets().find((x) => x.id === key);
      if (!a) return "لا يتوفر ملف تعريفي لهذه الخدمة. تابع المحادثة دون الإشارة إلى ملف.";
      if (a.type === "image") await gupshup.sendImage(contact.phone, a.url, a.caption);
      else await gupshup.sendDocument(contact.phone, a.url, a.filename ?? "ملف.pdf", a.caption);
      tracker.recordAgentReply(contact.phone, `[أُرسل ملف: ${a.id}]`);
      return "أُرسل الملف.";
    }
    case "tag_interest": {
      const tagProduct = String(args.product ?? PRODUCTS[0].name);
      const lvlRaw = String(args.level ?? "warm").toLowerCase();
      const tagLevel = (["hot", "warm", "cold"].includes(lvlRaw) ? lvlRaw : "warm") as "hot" | "warm" | "cold";
      // FR-3 as a READING, in ONE write. `tracker.addTag` is a thin wrapper over the only door
      // (`tracker.writeProp`), so the tag set and its provenance commit together and this call
      // performs no source check of its own: if an operator has already typed the interest, BR-1
      // refuses BOTH and the panel keeps showing حقيقة. The second write that used to follow this
      // line — a propRead re-sending the same set — is gone with the divergence it created.
      const tagged = await tracker.addTag(contact.phone, tagProduct, tagLevel, "agent:tag_interest");
      tracker.setOutcome(contact.phone, "interested");
      // The alert is about the CONVERSATION, not the ledger. A refused or unpersisted write does
      // not make a hot lead less hot, and if it does not fire nobody calls the customer who said
      // yes — so this stays exactly where it was, ahead of every early return below.
      if (tagLevel === "hot") void notifyLead(contact, "hot", tagProduct, "مستوى الاهتمام: مرتفع");
      // BR-7c: the tool result carries the reason, so the model stops retrying a refusal.
      if (tagged.reason === "human_value_wins") {
        return "الاهتمام مسجّل بخط الفريق ولا يُعدَّل من هنا. لا تُعِد المحاولة، واقترح تنسيق عرض تعريفي.";
      }
      // The AGENT half of NFR-3 — the opposite of the human half in index.ts, on purpose: a typed
      // fact that missed the ledger must stop the operator, a missed reading must not stop a live
      // conversation. Logged by writeProp, surfaced here, and never claimed as saved.
      if (!tagged.applied) {
        return "تعذّر تسجيل الاهتمام الآن. تابع المحادثة واقترح تنسيق عرض تعريفي.";
      }
      return "سُجّل الاهتمام. اقترح الآن تنسيق عرض تعريفي.";
    }
    case "offer_alternative":
      tracker.recordSystem(contact.phone, `cross-sell offered: ${args.product}`);
      return "سُجّل البديل. قدّمه بقيمة تشغيلية تختلف عن الخدمة السابقة.";
    case "record_schedule": {
      // THE MISSING OUTCOME. Two of the four real conversations already contained a customer-stated
      // time («صباح», «صباحًا») and the system recorded neither, because nothing could.
      //
      // The customer's WORDS are stored verbatim and are the fact. `scheduledAt` is only what we
      // read them as, kept advisory: it is never shown as if the customer said it and never used
      // to send anything. A parsed datetime is a guess, and guesses about a buyer's calendar are
      // exactly the invented state this project keeps catching.
      const said = String(args.when_text ?? "").trim().slice(0, 200);
      if (!said) return "لم تذكر وقتًا. لا تسجّل موعدًا لم يقله العميل.";
      const c2 = tracker.findContact(contact.phone);
      const inTranscript = (c2?.transcript || []).some((x) => x.role === "customer" && x.text.includes(said.slice(0, 12)));
      if (!inTranscript) {
        // Refuses a time the AGENT proposed and the customer never confirmed.
        return `لم يقل العميل «${said}» بنفسه. لا تسجّل موعدًا من اقتراحك — اسأله متى يناسبه واستخدم كلماته.`;
      }
      tracker.setSchedule(contact.phone, said);
      // FR-4 as a READING: the customer's VERBATIM words are the value; `due` is only what we read
      // them as. If the operator has already typed the next step, BR-1 keeps theirs.
      await propRead(contact.phone, "nextStep", said, "record_schedule",
        { due: tracker.findContact(contact.phone)?.scheduledAt });
      // The salesperson must learn about a booked time immediately — this alert is the product.
      void notifyLead(contact, "scheduled", (contact.tags || [])[0]?.product ?? "غير محدد", said);
      return "سُجّل الموعد بكلمات العميل. أكّد له الموعد في سطر واحد واذكر أن المختص سيتواصل، ولا تسأل سؤالًا آخر.";
    }
    case "record_fact": {
      // THE EVIDENCE RULE, same as record_schedule and for the same reason: a fact with no
      // quotable source is an assertion about the customer's own operation — and unlike a wrong
      // sentence, a wrong FACT persists into every future campaign. So the customer's words must
      // actually appear in the customer's turns before anything is stored.
      const key = String(args.key ?? "").trim();
      const value = String(args.value ?? "").trim();
      const said = String(args.said ?? "").trim().slice(0, 200);
      if (!value || !said) return "لم تذكر المعلومة أو مصدرها. لا تسجّل معلومة لم يقلها العميل.";
      const c3 = tracker.findContact(contact.phone);
      const quoted = (c3?.transcript || []).some((x) => x.role === "customer" && x.text.includes(said.slice(0, 12)));
      if (!quoted) {
        return `لم يقل العميل «${said}» بنفسه. لا تسجّل استنتاجًا كأنه حقيقة — إن أردت المعلومة فاسأل عنها سؤالًا صريحًا.`;
      }
      const r = await accounts.writeFact(contact.phone, key, value, "agent", "agent:record_fact",
        { said, entityName: contact.waName || "" });
      if (r.reason === "human_value_wins") {
        return "هذه المعلومة مسجّلة بخط الفريق ولا تُعدَّل من هنا. لا تُعِد المحاولة، واستخدم القيمة المذكورة في ملف الحساب.";
      }
      if (r.reason === "not_agent_writable") return "هذا الحقل لا يُسجَّل من المحادثة. تابع دون تسجيله.";
      if (r.reason === "unknown_fact") return "اسم حقل غير معروف. اختر حقلًا من القائمة المعتمدة فقط.";
      if (!r.applied) return "تعذّر حفظ المعلومة الآن. تابع المحادثة واستخدمها في كلامك دون أن تعِد بتسجيلها.";
      return "سُجّلت المعلومة في ملف الحساب. لا تسأل عنها مرة أخرى، واستخدمها في بناء التوصية.";
    }
    case "mark_not_interested": {
      // STOPPED, not "not_interested". The founder's rule: «we're not contacting anymore» — one
      // clean state, visible on the portal, and the agent stops. No split between marketing-stop
      // and opt-out: a person who says don't contact me has said don't contact me.
      //
      // The reason is the CUSTOMER'S OWN WORDS when they gave them, never a model-chosen enum.
      // «ضغط زر: لا» was written into a real ledger as a reason nobody said (round-26), and a
      // classification is an opinion that outlives the conversation. Store the sentence.
      const volunteered = [...(contact.transcript || [])].reverse()
        .find((t) => t.role === "customer")?.text?.slice(0, 300);
      tracker.setOutcome(contact.phone, "stopped", volunteered || "");
      // FR-6 as a READING. The enum is «other» because we do not KNOW the reason — we have their
      // sentence, and the sentence is the free text. Choosing «price» or «no_need» from a refusal
      // that named neither is the classification-as-opinion defect this tool already fixed once.
      await propRead(contact.phone, "disqualifyReason",
        `other: ${volunteered || "لا يرغب في التواصل"}`.slice(0, 200), "mark_not_interested");
      return "سُجّل أنه لا يرغب في التواصل، وتوقف الإرسال. اشكره بجملة واحدة واختم — ممنوع عرض بديل، وممنوع سؤال عن السبب.";
    }
    case "request_human_handoff": {
      const why = String(args.reason ?? "");
      tracker.setOutcome(contact.phone, "handoff", why);
      const hotTag = (contact.tags || []).find((t) => t.level === "hot") || (contact.tags || [])[0];
      void notifyLead(contact, "handoff", hotTag?.product ?? "غير محدد", why);
      return "أُشعر مختص المبيعات. أبلغ ممثل المنشأة بأن الفريق سيتواصل معه لاستكمال المتطلبات.";
    }
    case "close_conversation": {
      // A recorded "no" used to be SILENTLY COERCED to "closed" here — the ternary had no branch
      // for not_interested — so the founder's «who is not interested» column was already lossy
      // before any of the sorter work. Every outcome the model may close with is now honoured.
      const asked = String(args.outcome ?? "");
      const outcome = asked === "later" ? "later"
        : asked === "interested" ? "interested"
        : asked === "not_interested" ? "stopped"
        : "closed";
      tracker.setOutcome(contact.phone, outcome, outcome === "stopped" ? String(args.reason ?? "") : undefined);
      // Only a «stopped» close is a disqualification. Closing as later/interested/closed writes no
      // property — an open conversation with no next contact scheduled is not a rejection.
      if (outcome === "stopped") {
        await propRead(contact.phone, "disqualifyReason",
          `other: ${String(args.reason ?? "أنهى المحادثة دون رغبة في المتابعة")}`.slice(0, 200), "close_conversation");
      }
      return outcome === "stopped"
        ? "سُجّل أنه لا يرغب في التواصل. اشكره بجملة واحدة وتوقف — لا عرض جديد ولا سؤال."
        : "اختم برسالة موجزة تترك باب التنسيق مفتوحًا.";
    }
    default:
      return "الأداة المطلوبة غير معروفة.";
  }
}

// ------------------------------ opt-out (pre-LLM, hard rule) ------------------------------

// Opt-out must be UNMISTAKABLE: a bare command word, or an explicit "don't message me".
// A verified false positive («كيف أوقف التزوير؟» — the customer quoting our own pitch)
// silenced a live lead forever, so bare stems only count when the message IS the command.
const OPT_OUT_EXPLICIT = [
  /لا\s*تراسل|لا\s*ترسل|ما\s*ابي\s*رسائل|ما\s*أبي\s*رسائل|لا\s*ارغب\s*باستقبال|لا\s*أرغب\s*باستقبال/,
  /(الغاء|إلغاء)\s*(ال)?اشتراك|ازالة\s*رقمي|إزالة\s*رقمي|احذف\s*رقمي|أحذف\s*رقمي|الغني\s*من\s*القائمة/,
  /\bunsubscribe\b|\bremove\s+me\b|\bstop\s+messag/i,
];
const OPT_OUT_BARE = /^(إيقاف|ايقاف|أوقف|اوقف|توقف|stop|Stop|STOP|quit|cancel|unsubscribe|الغاء|إلغاء|حظر)[\s!.،؛]*$/;
// Command + messaging-object within a short span: «أوقفوا الرسائل», «توقفوا عن مراسلتي»,
// «كفى رسائل», «stop all messages» — while «كيف أوقف التزوير؟» stays out (no messaging noun).
const OPT_OUT_PROXIMITY = /(?:^|[\s.,،؛!؟])(اوقف|أوقف|وقفوا|وقف|توقفوا|توقف|كفى|بلاش|بطلوا|امتنعوا)(?:وا|ون)?(?:\s+\S{1,4}){0,2}\s+\S{0,3}(رسائل|رسايل|مراسلت|مراسل|الرسال|ارسال|إرسال|واتس)/;
const OPT_OUT_NEGATION = /(لا|ما|مو|مب)\s*(اريد|أريد|ابي|أبي|ابغى|أبغى|احتاج|أحتاج|رغبه|رغبة).{0,12}(رسائل|رسايل|مراسل|تواصل)/;
const OPT_OUT_EN = /\bstop\b[\w\s]{0,14}(messag|sending|sms|text)|\bno\s+more\s+(messag|text|sms)/i;
function isOptOut(text: string): boolean {
  const t = text.replace(/[ً-ٟـ]/g, "").trim();
  if (OPT_OUT_BARE.test(t)) return true;                     // the message IS the command
  if (OPT_OUT_EXPLICIT.some((p) => p.test(t))) return true;  // unambiguous request
  return OPT_OUT_PROXIMITY.test(t) || OPT_OUT_NEGATION.test(t) || OPT_OUT_EN.test(t);
}

// ------------------------------ main turn loop ------------------------------

const MAX_AGENT_TURNS = 12;
/** Written into the transcript when rung one goes out, so "already sent" survives a deploy. */
const RUNG_ONE_MARK = " [سُلّمت الدرجة الأولى]";

// RUNG ONE, emitted from code rather than composed. When the objective is «identify the entity»,
// nothing the customer has said can change this message — the content is invariant, so leaving it
// to the model is pure downside variance on the highest-stakes turn of the conversation. Rungs 2+
// stay model-composed, because there the value sentence must reflect what THIS customer said.
// Parameterised by service: it used to name «السجل الوطني للتطعيمات» unconditionally, so a contact
// asking about الإجازات المرضية was answered about vaccinations. The shape is invariant; the noun
// is not. With no service resolved it falls back to the neutral «الخدمة», which is never wrong.
// …and by OPENER. The upsell opens with «لاحظنا أن لديكم استخدامًا مرتفعًا» — we have just told the
// customer we know who they are and what they use. Answering their next tap with «أي وصف يناسبكم؟»
// contradicts our own opening sentence and re-asks identity, which is the founder's complaint #1
// arriving by a new route. So the upsell's rung one qualifies on the IMPLEMENTATION, never identity.
export const rungOne = (service?: string, opener?: string) => {
  const svc = service ? `خدمة ${service}` : "الخدمة";
  if (opener === "high_usage_upsell") {
    return [
      `الربط يتم عبر واجهات برمجية تُنفَّذ ${svc} من خلالها داخل نظامكم مباشرة، فتتوقف إعادة إدخال البيانات ويقل زمن المعاملة.`,
      "نبدأ بمراجعة تقنية قصيرة، ثم اختبار على بيئة تجريبية، ثم التفعيل — وفريقنا يرافق فريقكم في الثلاث.",
      "لنحدد نقطة البدء: من يتولى الربط لديكم؟",
    ].join("\n");
  }
  return [
    `يتيح التكامل للممارسين تنفيذ ${svc} من داخل نظام المنشأة نفسه، دون التنقل بين الأنظمة ودون إدخال مزدوج.`,
    "الربط يتم عبر واجهات برمجية، وندعم فريقكم التقني في المتطلبات والاختبار وحتى التفعيل.",
    "ولأوجّهكم إلى نموذج التكامل الأنسب: أي وصف يناسبكم؟",
  ].join("\n");
};
const RUNG_ONE_BUTTONS_DEFAULT = [{ title: "منشأة صحية" }, { title: "مزوّد نظام HIS" }, { title: "العرض التجاري" }];
// An existing heavy user is not asked who they are; they are asked who does the work.
const RUNG_ONE_BUTTONS_UPSELL = [{ title: "فريقنا التقني" }, { title: "مزوّد النظام" }, { title: "العرض التجاري" }];
export const rungOneButtons = (opener?: string) =>
  opener === "high_usage_upsell" ? RUNG_ONE_BUTTONS_UPSELL : RUNG_ONE_BUTTONS_DEFAULT;
/** Buttons this module emits, for the boot-time contract check in index.ts. Every variant, or the
 *  check certifies a subset and the uncovered one dead-ends exactly as before. */
export const EMITTED_BUTTONS = [...RUNG_ONE_BUTTONS_DEFAULT, ...RUNG_ONE_BUTTONS_UPSELL].map((b) => b.title);

// Gupshup's sandbox makes every new person send «proxy <botname>» to activate the bot, after
// an English boilerplate about bot-building and anagram puzzles. That phrase is platform
// plumbing, not a customer message — but the model read «Proxy Massar» as a product name and
// burned the single most valuable message in the conversation asking «هل تقصدون خدمة باسم
// Proxy Massar؟», and in one case escalated a human handoff for a service that does not exist.
// Every one of the four real conversations opened this way. Hard rule, in code.
// Defined once in insights.ts and shared, so the guard here and the interaction log there can
// never disagree about what counts as platform plumbing. (`\b` forms no boundary after Arabic
// letters — JS \w is ASCII-only — so the Arabic spelling carries its own anchor there.)
const SANDBOX_ACTIVATION = SANDBOX_ACTIVATION_RE;

/** Is this text a PURE request for the profile/details — no price ask, no objection attached?
 *
 *  Exported because a gate that RE-TYPES a predicate does not test it: the reviewer proved that
 *  flipping this expression's `&&` to `||` in source left the button gate 133/133 green, because the
 *  gate sliced the regexes out and hand-wrote the composition back. Anything that must be asserted
 *  is imported from here now.
 *
 *  Anchored on both sides. An unanchored «لم» matches inside «الـمـلـف», so «الملف التعريفي
 *  للإجازات المرضية» read as an objection — the Arabic-substring trap that JS `\b` cannot express
 *  because it needs an ASCII word char on one side. */
const B = "(?:^|[\\s،.؟!؛])";
const E = "(?=$|[\\s،.؟!؛])";
export const COMMERCIAL_STEM = new RegExp(
  `${B}(?:و)?(?:ال)?(سعر|تسعير|تكلفة|ميزانية|فاتورة|نبدأ|اشترك|عقد)${E}|كم\\s*(يكلف|السعر|التكلفة)`);
export const OBJECTION_STEM = new RegExp(
  `${B}(?:و)?(غير|لم|ليست|ليس|لست|لسنا|مو|ما|مشكلة|متأخر|خطأ|واضحة|واضح)${E}`);
export const INFO_PHRASE = /^(\s*)(الملف التعريفي|أرسلوا التفاصيل|أبي التفاصيل|ابي التفاصيل|التفاصيل|أرسل الملف)([\s؀-ۿ]{0,40})$/;

export function isPureInfoRequest(text: string): boolean {
  return INFO_PHRASE.test(text.trim()) && !COMMERCIAL_STEM.test(text) && !OBJECTION_STEM.test(text);
}

export async function handleInbound(contact: Contact, text: string, wasTap = false): Promise<void> {
  // An intent shortcut may only fire on a real button TAP. «لا» and «موافق» are button titles AND
  // ordinary Arabic words; matching them as intents on typed text recorded a customer answering
  // «لا» to «هل تستخدمون نظام HIS؟» as not-interested. Defaults to false, so any caller or webhook
  // shape that cannot prove a tap gets the safe behaviour: treat it as words and let the model read
  // them. This is the project's own recurring defect class — a value captured and never threaded.
  const tapped = (t: string) => (wasTap ? templates.buttonIntent(t) : undefined);
  turnTextSends.delete(contact.phone);   // new turn, new one-bubble budget for the drop path
  if (contact.optedOut) return;

  // OPT-OUT IS CHECKED FIRST, ALWAYS. Nothing may sit above it. The activation branch below
  // tolerates up to 40 trailing characters, so when it ran first «proxy stop messaging me» and
  // «بروكسي أوقفوا الرسائل» were swallowed as plumbing: the person asking us to stop was never
  // marked opted out and got an opener back. CLAUDE.md §8 forbids weakening this path.
  // NOT A PROPERTY WRITER, deliberately (BR-3). Opt-out is the customer's RIGHT, not our judgement
  // that they are unqualified. Stamping سبب الاستبعاد here would file «asked us to stop» next to
  // «too expensive» in the same field, and the disqualification report would then count people who
  // never rejected the product. Do not add writeProp to this branch.
  if (isOptOut(text)) {
    tracker.setOutcome(contact.phone, "opted_out");
    await safeSend(contact.phone, "تم إيقاف الرسائل. شكرًا لوقتكم، ونعتذر عن الإزعاج.");
    return;
  }

  // A human driving the chat must not be interrupted by an automated opener.
  if (contact.human) return;

  // Deliver → Reinforce → Qualify, emitted rather than requested, for rung one only. The model
  // was asked three times to compose this turn and produced «الملف يوضح…» each time; the content
  // does not depend on anything the customer said, so composing it adds variance and no value.
  // A tap on a decline button is recorded by CODE, not by hoping the model calls
  // mark_not_interested. A customer who taps «لسنا مهتمين» has said so unambiguously; making that
  // outcome depend on an LLM turn is the same "hard rules live in code" rule §4 states, applied to
  // the one signal we least want to lose. The conversation still continues — the model gets its
  // turn to respond gracefully; only the RECORD is made deterministic here.
  if (tapped(text) === "decline") {
    // Anchored: an unanchored «لا» matched inside «لاحقًا» and read a soft "later" as a firm no.
    const firm = /^(لسنا مهتمين|لا،\s*شكرًا|لا)$/.test(text.trim());
    // Never silently downgrade a stronger outcome. A contact already at handoff or interested has
    // a human or a real signal behind it; a tap on «ليس الآن» in a later campaign must not erase
    // that. The turn-cap path at the bottom of this file already guards its write the same way.
    const stronger = contact.outcome === "handoff" || contact.outcome === "interested";
    if (stronger) {
      console.log(JSON.stringify({ at: "agent", msg: "decline tap not applied — stronger outcome held", phone: contact.phone, held: contact.outcome, tapped: text.trim() }));
    } else {
      // The reason states what actually happened. `tapped()` returns non-undefined only on a proven
      // button tap, so «ضغط زر» is now a fact rather than an assumption — it used to be written for
      // typed text too, fabricating a button press in the audit trail.
      tracker.setOutcome(contact.phone, firm ? "not_interested" : "later", `ضغط زر: ${text.trim()}`);
      // Only the FIRM decline is a disqualification. «ليس الآن» sets `later`, which is a timing
      // answer, not a reason to exclude — writing سبب الاستبعاد for it would put a rejection on the
      // record that nobody made. FR-6's enum is «no_need»: they tapped a button that says so.
      if (firm) {
        await propRead(contact.phone, "disqualifyReason", `no_need: ضغط زر «${text.trim()}»`, "decline_tap");
      }
    }
  }

  // The trailing service phrase is allowed: «الملف التعريفي للإجازات المرضية» is how a real person
  // asks. But the widened window let two other things through, and both matter:
  //   «التفاصيل والسعر لو سمحتم» — a price ask that short-circuits here never reaches the model, so
  //   the buyer got the PDF and «أي وصف يناسبكم؟». That is complaint #1, re-opened by this regex.
  //   «التفاصيل التي أرسلتموها غير واضحة» — an objection, answered with the same file again.
  // So the trailing span must carry no commercial stem and no objection stem — see isPureInfoRequest
  // below, which the gate IMPORTS rather than reconstructs.
  const wantsInfo = tapped(text) === "info" || isPureInfoRequest(text);
  // Whether rung one already went out is read from the TRANSCRIPT, not from process memory. An
  // in-memory Set forgets on every deploy — and there were 45 deploys in one day — so the founder
  // could be handed the same opener twice. The transcript survives the restart; the Set did not.
  // Role-filtered, matching the sentAssets guard above: a marker is something WE wrote.
  const rungOneSent = (contact.transcript || []).some((t) => t.role !== "customer" && t.text.includes(RUNG_ONE_MARK));
  if (wantsInfo && !rungOneSent) {
    // Which service's file? The one the conversation is actually about. This was hardcoded to
    // «تطعيم», so a contact asking «الملف التعريفي للإجازات المرضية» was sent the wrong document.
    // Read the customer's own words first, then what this conversation has already been about.
    const convo = [text, ...(contact.transcript || []).map((t) => t.text)].join(" · ");
    const pa = productAssets.find((x) => x.product && text.includes(x.product))
      ?? productAssets.find((x) => x.product && convo.includes(x.product))
      ?? (productAssets.length === 1 ? productAssets[0] : undefined);
    if (pa && !(contact.transcript || []).some((t) => t.text.includes(`[مرفق في نفس الرسالة: ${pa.product}]`))) {
      // ONE bubble: the file WITH its value sentence as the caption. It was sent captionless, so a
      // customer who tapped «تفاصيل التكامل» got a wordless PDF and then a separate paragraph —
      // against the founder's stated requirement to use WhatsApp's richness in one message.
      const caption = pa.product
        ? `ملف ${pa.product}: يوضّح آلية الربط والمتطلبات وخطوات التفعيل.`
        : "الملف التعريفي: آلية الربط والمتطلبات وخطوات التفعيل.";
      await gupshup.sendDocument(contact.phone, pa.url, pa.filename, caption);
      tracker.recordAgentReply(contact.phone, `${caption} [مرفق في نفس الرسالة: ${pa.product}]`);
    }
    // Which opener started this conversation — the most recent campaign turn carries its id.
    const opener = [...(contact.transcript || [])]
      .filter((t) => t.role === "agent" && templates.isCampaignTurn(t.text))
      .sort((a, b) => b.ts - a.ts)
      .map((t) => templates.openerOf(t.text))[0];
    const body = rungOne(pa?.product, opener);
    const btns = rungOneButtons(opener);
    try {
      await gupshup.sendQuickReply(contact.phone, body, btns);
      tracker.recordAgentReply(contact.phone, `${body} [أزرار: ${btns.map((b) => b.title).join(" | ")}]${RUNG_ONE_MARK}`);
    } catch (e) {
      await safeSend(contact.phone, body);
      // The marker records that rung one was DELIVERED, so the fallback must carry it too —
      // otherwise a text-only fallback leaves the contact eligible to receive rung one again.
      tracker.recordSystem(contact.phone, RUNG_ONE_MARK);
    }
    return;
  }

  // The activation phrase is platform plumbing WHENEVER it appears, not only on turn one.
  //
  // The previous version required `customer turns <= 1`, on the assumption that «after that
  // «proxy …» is the customer talking». That assumption is false on a SHARED sandbox: the
  // handshake has to be repeated every time the session lapses. Measured 2026-08-16 — the founder
  // last wrote on 14 Aug 06:32, came back 08:27 on the 16th (~50h, session long expired), typed
  // «Proxy massar» to re-activate, and because he already had 30 turns of history the guard did
  // not fire and the model answered «هل تقصدون أن لديكم Proxy باسم Massar ضمن بيئة الـHIS؟».
  // 966535106365 hit the same thing two minutes earlier. The turn counter was the bug.
  //
  // The SHAPE is the signal: the regex requires the message to START with proxy/بروكسي and run
  // under ~45 characters total, which is the handshake and not a sentence a healthcare buyer
  // types. On turn one we answer with the real opener, because that message is genuinely the
  // start of the conversation. Later, we answer NOTHING — Gupshup has already replied to its own
  // command, and re-introducing ourselves mid-deal reads as amnesia.
  // ─────────────────────────────────────────────────────────────────────────
  // DETERMINISTIC SORTER ROUTING — before the model, exactly where opt-out sits.
  //
  // Measured, not assumed: with 3 runs per scenario the SAME input scored 1.5 to 9. Every low run
  // was one where the model called send_buttons, which owns the turn and bypassed every
  // post-model patch. Patching after the model can always be skipped by the model; answering
  // before it cannot. `optout` scores 10/10/10 across every variant for exactly this reason.
  //
  // These four are the founder's own sentences for decisions with one correct answer. Anything
  // needing judgement still goes to the model untouched.
  let sorter = sorterIntent(text);
  // A commercial ask only routes deterministically when the product has NO published price — a
  // published one is prepended after the model instead, so the model still frames it.
  if (!sorter && /(كم\s*(السعر|التكلفة|يكلف)|السعر|تسعير|العرض التجاري)/.test(text)) {
    const lp = productlock.activeProduct(contact);
    const pp = lp ? PRODUCTS.find((x) => x.name === lp) : undefined;
    if (lp && (!pp || !/[\d٠-٩]/.test(pp.pricing))) sorter = "price_unpublished";
  }
  if (sorter) {
    console.log(JSON.stringify({ at: "agent", msg: "sorter routed deterministically", phone: contact.phone, intent: sorter }));
    if (sorter === "refusal") {
      // ONE respectful exploration, THEN accept — the founder's rule, and the judge marked the
      // first version down for closing on the first «ما نحتاج» without asking, then pressing again
      // after the second. Count prior refusals: first one explores, any after it closes and stops.
      // ASK THE PERMISSION QUESTION ONCE. The 2.0 score was not the wording — it was REPETITION:
      // the identical «تسمحون نتواصل معكم لاحقًا؟» went out after the first refusal AND again after
      // the second. Asking twice is the pressure, whatever the sentence says. So: first refusal
      // gets the thanks plus the one question; any refusal after it closes warmly with no question
      // at all and nothing further is sent.
      const priorRefusals = (contact.transcript || [])
        .filter((x) => x.role === "customer" && sorterIntent(x.text) === "refusal").length;
      if (priorRefusals <= 1) {
        await safeSend(contact.phone, "مفهوم تمامًا، وأشكركم على وقتكم.\n\nتسمحون نتواصل معكم لاحقًا إذا كان عندنا عرض مناسب؟");
      } else {
        await safeSend(contact.phone, "واضح، شكرًا لكم على الرد ووقتكم. يومكم سعيد.");
      }
      await execTool(contact, "mark_not_interested", {});
      return;
    }
    if (sorter === "budget") {
      // Diagnose before answering — never repeat the benefits first.
      await safeSend(contact.phone, "واضح. هل السبب أن الميزانية غير متاحة في الدورة الحالية، أو أن المشروع مو ضمن الأولويات الآن؟");
      return;
    }
    if (sorter === "discount") {
      await safeSend(contact.phone, "أكيد، ونقدر نشوف أفضل خيار تجاري يناسب نطاقكم.\n\nبس خلني أتأكد من نقطة: إذا وصلنا لسعر مناسب، هل فيه أي شيء ثاني ممكن يوقف البدء بالتكامل؟");
      return;
    }
    if (sorter === "price_unpublished") {
      // ANSWER FIRST applies even when there is no number. The judge scored the deflection 1/10:
      // the customer asked what it costs and got a technical explanation and a qualifying question.
      const svc = productlock.activeProduct(contact) || "هذه الخدمة";
      await safeSend(contact.phone,
        `تسعير ${svc} يُبنى على النطاق، ولا يوجد له سعر منشور ثابت.\n\n` +
        "اللي يحدده ثلاثة أشياء: عدد الفروع المشمولة، بيئة الـHIS وهل هي موحدة، ومتطلبات التنفيذ عندكم.\n\n" +
        "إذا تعطوني عدد الفروع، أقدر أرفع النطاق للمختص ويرجع لكم برقم دقيق.");
      return;
    }
    if (sorter === "how_integrate") {
      const svc = productlock.activeProduct(contact) || "الخدمة";
      await safeSend(contact.phone,
        `الربط يخلي الإجراء يتم من داخل الـHIS عندكم: النظام يرسل البيانات لخدمة ${svc} ويستقبل النتيجة، بدون إعادة إدخال.\n\n` +
        "عمليًا نمر بثلاث مراحل: نراجع رحلة العمل الحالية، نربط ونختبر السيناريوهات على البيئة التجريبية، وبعد الاعتماد يتم التفعيل على الإنتاج.\n\n" +
        "أقدر أرتب لكم مكالمة قصيرة مع المختص — متى يناسبكم؟");
      return;
    }
  }

  if (SANDBOX_ACTIVATION.test(text)) {
    const priorCustomerTurns = (contact.transcript || []).filter((t) => t.role === "customer").length;
    if (priorCustomerTurns <= 1) {
      console.log(JSON.stringify({ at: "agent", msg: "sandbox activation — answered with the real opener", phone: contact.phone }));
      const opener = "أهلًا بكم. أنا المساعد الرقمي لشركة لِين لخدمات الأعمال، وأساعد المنشآت الصحية على تنفيذ خدمات مثل الإجازات المرضية وسجل التطعيمات الوطني مباشرة من داخل أنظمتها."
        + "\nكيف يمكنني خدمتكم؟";
      await safeSend(contact.phone, opener);
    } else {
      console.log(JSON.stringify({ at: "agent", msg: "sandbox re-activation mid-conversation — no reply", phone: contact.phone, priorCustomerTurns }));
      tracker.recordSystem(contact.phone, "[إعادة تفعيل بيئة Gupshup التجريبية — ليست رسالة من العميل]");
    }
    return;
  }

  // (the takeover guard now sits above the activation branch, so nothing is emitted into a
  //  conversation a human has taken over)

  // The cap protects against runaway loops, not against a long healthy conversation:
  // it counts REPLIES TO THIS CUSTOMER'S MESSAGES (campaign blasts and file sends don't
  // count), and once announced it stays silent instead of repeating the same line forever.
  // Count turns SINCE THE LAST CAMPAIGN, not for all time. Counting lifetime meant a contact who
  // once hit the cap stayed muted forever: every later message — including a tap on a fresh
  // campaign's own button — returned silently because the outcome was already «handoff». The
  // founder tapped «أرغب بعرض تعريفي» on a new campaign and got nothing back. A new campaign is a
  // new conversation; the cap still protects against a runaway loop inside one.
  const lastCampaignAt = (contact.transcript || [])
    // Match ONLY the campaign marker. «[أزرار:» and «[مرفق في نفس الرسالة» are written by the
    // agent's own send_buttons/send_asset tools too, so matching those would let the agent reset
    // its own turn cap by using a tool — which is exactly the runaway loop the cap exists to stop.
    .filter((t) => t.role === "agent" && templates.isCampaignTurn(t.text))
    .reduce((m, t) => Math.max(m, t.ts), 0);
  const convTurns = (contact.transcript || [])
    .filter((t) => t.role === "customer" && t.ts >= lastCampaignAt).length;
  if (convTurns >= MAX_AGENT_TURNS) {
    // NOT A PROPERTY WRITER, deliberately. Hitting the automation's turn cap is a fact about US,
    // not about the buyer: a handoff means a human continues, which is the opposite of exclusion.
    // Writing سبب الاستبعاد here would disqualify our most engaged conversations. Do not add
    // writeProp to this branch.
    if (contact.outcome !== "handoff") {
      tracker.setOutcome(contact.phone, "handoff", "turn cap reached — human continues");
      void notifyLead(contact, "handoff", (contact.tags || [])[0]?.product ?? "غير محدد", "بلغت المحادثة الآلية حدها الأقصى");
      await safeSend(contact.phone, "شكرًا لتفاعلكم. سيتواصل معكم مختص المبيعات لاستكمال المتطلبات والخطوات القادمة.");
    }
    return;
  }

  if (!model) await initModel();

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(contact) },
    ...contact.transcript.slice(-24).flatMap((t): OpenAI.Chat.Completions.ChatCompletionMessageParam[] => {
      if (t.role === "customer") return [{ role: "user", content: t.text }];
      if (t.role === "agent") return [{ role: "assistant", content: t.text }];
      return [];
    }),
  ];

  // The approved price for the product this conversation is about — resolved from the product
  // table, never from the model. Empty when the product has no published figure, in which case the
  // honest "scope determines it" path stands and nothing is prepended.
  const lockedNow = productlock.activeProduct(contact);
  const pricedNow = lockedNow ? PRODUCTS.find((p) => p.name === lockedNow) : undefined;
  const priceLine = pricedNow && /[\d٠-٩]/.test(pricedNow.pricing)
    // «بالنسبة لـ» + a name beginning with «ال» produces «لـالإجازات», which is malformed Arabic.
    // The neutral framing below reads correctly for every product name in the catalogue.
    ? `التسعير المعتمد — ${pricedNow.name}: ${pricedNow.pricing}.`
    : "";
  try {
    let finalText = "";
    let sentOwnBubble = false;
    for (let round = 0; round < 4; round++) {
      const completion = await client.chat.completions.create({
        model, messages, tools, tool_choice: "auto",
        // "none" is required for tools on gpt-5.x/chat.completions; older fallbacks reject the param.
        ...(model.startsWith("gpt-5") ? { reasoning_effort: "none" } : {}),
      } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);
      const msg = completion.choices[0]?.message;
      if (!msg) break;

      if (msg.tool_calls?.length) {
        messages.push(msg);
        for (const tc of msg.tool_calls) {
          if (tc.type !== "function") continue;
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
          // Tools that ARE the message (file with caption, buttons) own the bubble for this
          // turn — enforced in code, because the model was observed ignoring the prompt rule
          // and appending a second bubble to a live thread.
          const result = await execTool(contact, tc.function.name, args);
          // Only a tool that ACTUALLY sent a bubble owns the turn — a not-found asset must
          // still be answered in text, never with silence.
          if ((tc.function.name === "send_asset" || tc.function.name === "send_buttons") && /^أُرسل/.test(result)) sentOwnBubble = true;
          messages.push({ role: "tool", tool_call_id: tc.id, content: result });
        }
        continue;
      }

      finalText = (msg.content ?? "").trim();
      // DETERMINISTIC ANSWER, PREPENDED IN CODE.
      // Seven Codex-judged iterations proved the model will not reliably state a fact it has been
      // given: the price scenario scored 0 in ALL SEVEN, including the round where the exact
      // sentence was in the prompt AND injected as a mandatory per-turn directive. The one
      // behaviour enforced in code — opt-out — scored 10 in all seven. So the price stops being
      // something the model may mention and becomes something the code says. The model still
      // writes the value and the next step around it; it just cannot omit the number.
      if (finalText && priceLine && wantsCommercialNow(text, [...(contact.transcript || [])].reverse().find((x) => x.role === "customer")?.text ?? "") && !finalText.includes(priceLine.slice(0, 14))) {
        console.log(JSON.stringify({ at: "agent", msg: "prepended the approved price", phone: contact.phone }));
        finalText = priceLine + "\n\n" + finalText;
      }
      // THE MENU DODGE. Codex eval v1/v2: in 8 of 10 scenarios the agent answered a direct
      // question — price, benefits, how integration works — with nothing but a choice between its
      // own two button titles («هل يناسبكم نوضح تفاصيل التكامل أو نرسل العرض التجاري؟»). It scored
      // 0 on every one. Telling it not to, in the prompt, made things WORSE (2.8 → 1.1), because
      // the offer reads as a complete message and costs the model nothing.
      // So it is refused here and the model is made to answer, once. A rule the model keeps
      // breaking belongs in code (CLAUDE.md §4).
      if (menuDodge(finalText) && round < 3) {
        console.log(JSON.stringify({ at: "agent", msg: "menu dodge refused — forcing an answer", phone: contact.phone, dropped: finalText.slice(0, 120) }));
        messages.push(msg);
        messages.push({
          role: "system",
          content: "رفضت رسالتك: عرضت على العميل خيارًا بين مسارين بدل أن تجيب عن سؤاله. "
            + "أعد كتابة الرد بحيث يبدأ بالإجابة الفعلية عن آخر ما سأله — السعر المعتمد إن وُجد، "
            + "أو مراحل التنفيذ، أو الميزة التشغيلية — ثم أضف جملة قيمة واحدة. "
            + "ممنوع في هذا الرد أن تعرض «تفاصيل التكامل» أو «العرض التجاري» كخيارين، وممنوع أن تنتهي الرسالة بسؤال اختيار.",
        });
        finalText = "";
        continue;
      }
      break;
    }

    // NEVER SILENCE. The send was conditional on finalText, so a turn spent entirely on tool
    // calls — or a model returning empty content — produced no message at all. That is what the
    // founder saw: he tapped «أرسلوا التفاصيل» and the conversation simply stopped. A tool like
    // request_human_handoff records state without sending anything, so banning the handoff TEXT
    // made silence the likeliest outcome of the very case it was meant to fix.
    if (!finalText && !sentOwnBubble) {
      console.error(JSON.stringify({ at: "agent", level: "error", msg: "model produced no text and no tool bubble — sending fallback", phone: contact.phone }));
      const lastToolResult = [...messages].reverse().find((m: any) => m.role === "tool" && typeof m.content === "string");
      const fallback = lastToolResult && /^أُشعر|^أُرسل/.test(String((lastToolResult as any).content))
        ? String((lastToolResult as any).content)
        : rungOne();
      await safeSend(contact.phone, fallback);
    } else if (finalText && sentOwnBubble) {
      console.log(JSON.stringify({ at: "agent", msg: "suppressed trailing bubble after self-contained tool send", phone: contact.phone, dropped: finalText.slice(0, 80) }));
    } else if (finalText) {
      // BUTTONS, ENFORCED. Founder rule 2026-08-16: two or three options go out as buttons, not
      // prose. The prompt has said so since the button contract existed and the model still writes
      // «صباحًا أم بعد الظهر؟» and numbered lists as text, so the conversion happens here rather
      // than being asked for again. Titles over WhatsApp's 20-char limit are left as prose —
      // Meta rejects the whole message with 131009, which would cost the turn entirely.
      const choices = unsendableReason(finalText) ? null : offeredChoices(finalText);
      const titles = (choices || []).map((x) => x.replace(/[«»"]/g, "").trim()).filter((x) => x.length <= 20);
      if (choices && titles.length === choices.length) {
        const body = finalText
          .split("\n")
          .filter((ln) => !/^\s*(?:[١٢٣1-3][-.)]|[-•*])\s*/.test(ln))
          .join("\n").trim() || finalText;
        try {
          await gupshup.sendQuickReply(contact.phone, body, titles.map((title) => ({ title })));
          tracker.recordAgentReply(contact.phone, `${body} [أزرار: ${titles.join(" | ")}]`);
          console.log(JSON.stringify({ at: "agent", msg: "converted offered choices to buttons", phone: contact.phone, titles }));
        } catch (e) {
          console.error(JSON.stringify({ at: "agent", msg: "quick-reply rejected — sent as text", phone: contact.phone, err: String(e).slice(0, 200) }));
          await safeSend(contact.phone, finalText);
        }
      } else {
        await safeSend(contact.phone, finalText);
      }
    }
  } catch (e) {
    console.error(JSON.stringify({ at: "agent", msg: "turn failed", phone: contact.phone, err: String(e).slice(0, 400) }));
  }
}

/**
 * Is this text fit to send to a customer, or is it the model thinking out loud?
 *
 * 2026-08-16, on the founder's own thread: the model emitted its PLANNING as message content
 * instead of calling the tool it was planning — «We need respond Arabic, need human handoff for
 * commercial pricing? … Let's invoke.» — and it went to WhatsApp verbatim, because the send path
 * ships `msg.content` with no check on what that content is.
 *
 * Two independent tests, because they fail in different ways:
 *   SCRIPT — this agent writes Arabic to Saudi healthcare buyers. Always. A reply with more Latin
 *     letters than Arabic is never a valid customer message for this product, whatever it says.
 *     That single property catches the whole class without trying to enumerate English phrasings.
 *   INTENT — reasoning can leak in Arabic too, so a short list of unmistakable
 *     thinking-out-loud markers is checked regardless of script.
 *
 * Returns the reason it is unsendable, or null when it is fine.
 */
export function unsendableReason(text: string): string | null {
  const s = String(text || "");
  if (!s.trim()) return "empty";
  const arabic = (s.match(/[؀-ۿ]/g) || []).length;
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  // Technical tokens (HIS, ERP, API, PDF, NVR) are legitimately Latin inside an Arabic sentence,
  // so this compares MASS, not presence: Arabic must lead. A genuinely Arabic reply that names
  // three systems still passes; a paragraph of English never does.
  if (latin > arabic) return `latin-dominant (${latin} latin vs ${arabic} arabic)`;
  if (/\b(let'?s invoke|let'?s call|i should|we need to|need tool|tool call|i'?ll call the tool)\b/i.test(s))
    return "reasoning marker";
  if (/^\s*(?:okay|ok|so|hmm|right)[,.\s]/i.test(s) && latin > 12) return "thinking-aloud opener";
  return null;
}

/**
 * Sales-process language the customer must never hear, and claims about their own mind that they
 * never made. Founder review 2026-08-16 (second pass).
 *
 * Two classes, both checked on the way out because prose bans had already failed for the
 * fake-action family:
 *
 *   INVENTED STATE — «بما أن السعر هو النقطة الوحيدة المتبقية قبل البدء» when the customer never
 *     said that. This is Rule 2 (numbers must be real) applied to INTENT: asserting a buyer's
 *     readiness, blocker or commitment back at them is a fabricated fact about their own mind,
 *     and it is worse than a fabricated number because they can feel it is wrong.
 *
 *   PROCESS NARRATION — «الخطوة التالية إعداد العرض التجاري» · «نكمل المراجعة التجارية» ·
 *     «تم تأهيل الفرصة». Internal CRM vocabulary. The customer is in a commercial conversation,
 *     not watching a pipeline advance.
 *
 * Returns the offending phrase, or null. Deliberately narrow: it matches the assertive SHAPES,
 * not the topic — «هل السعر هو العائق الوحيد؟» is a question and stays legal, because asking is
 * exactly how the agent is supposed to establish it.
 */
const INVENTED_STATE: [RegExp, string][] = [
  [/(?:بما أن|بحكم أن|وبما أن)[^.،؟\n]{0,30}(?:السعر|التكلفة)[^.،؟\n]{0,30}(?:النقطة|العائق|العقبة)[^.،؟\n]{0,20}(?:الوحيد|المتبقي)/, "asserting price is the only blocker"],
  [/(?:النقطة|العائق|العقبة)\s*(?:هي\s*)?الوحيدة?\s*المتبقية/, "asserting the only remaining blocker"],
  [/(?:بما أنكم|بحكم أنكم|وبما أنكم)\s*(?:جاهزون|مستعدون|قررتم|موافقون)/, "asserting readiness the customer never stated"],
  [/(?:اتفقنا|تم الاتفاق)\s*(?:على)?\s*(?:المضي|البدء|التنفيذ)/, "asserting an agreement that was not made"],
];
const PROCESS_NARRATION: [RegExp, string][] = [
  [/تم\s*تأهيل\s*(?:الفرصة|العميل|الحساب)/, "«تم تأهيل الفرصة»"],
  [/(?:نكمل|نواصل|أكمل|سأكمل|نبدأ|بدأت)\s*(?:الآن\s*)?المراجعة\s*التجارية/, "«المراجعة التجارية» as a process step"],
  [/الخطوة\s*التالية\s*(?:هي|هو)?\s*إعداد\s*العرض/, "«الخطوة التالية إعداد العرض»"],
  [/ننتقل\s*(?:إلى|ل)\s*المرحلة\s*(?:التالية|القادمة)/, "«ننتقل للمرحلة التالية»"],
  [/(?:رفعت|سأرفع|تم رفع)\s*(?:النطاق|الطلب)\s*التجاري/, "raising an internal request at them"],
];

/** Returns the reason this text narrates process or invents deal state, or null. */
export function salesVoiceViolation(text: string): string | null {
  const s = String(text || "");
  if (!s.trim()) return null;
  for (const [re, why] of INVENTED_STATE) if (re.test(s)) return `invented state: ${why}`;
  for (const [re, why] of PROCESS_NARRATION) if (re.test(s)) return `process narration: ${why}`;
  return null;
}

/**
 * Remove offending SENTENCES rather than dropping the whole message.
 *
 * Blocking an entire reply because one clause invented a blocker would throw away the good half
 * and make the agent look broken — the customer would get a generic line instead of a real
 * answer. Surgical removal keeps the value and deletes the claim. If what survives is too thin to
 * be a message, the caller falls back.
 */
export function stripSalesVoice(text: string): { text: string; removed: string[] } {
  const removed: string[] = [];
  const kept = String(text || "")
    .split(/(?<=[.؟!\n])/)
    .filter((sentence) => {
      const why = salesVoiceViolation(sentence);
      if (why) removed.push(why);
      return !why;
    })
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: kept, removed };
}

/**
 * Does this plain-text message present the customer with 2–3 choices that WhatsApp could render
 * as buttons? Founder rule, 2026-08-16: «enforce buttons if the answers are three or less options».
 *
 * The prompt has asked for this since the button contract was written and the model still writes
 * «صباحًا أم بعد الظهر؟» and numbered lists as prose. A rule the model must APPLY mechanically
 * belongs in code (CLAUDE.md §4) — so the text send path detects the shape and refuses it, which
 * pushes the model to call send_buttons on the retry instead of us guessing the titles for it.
 *
 * Returns the detected options (2–3) or null. Four or more is legitimately prose: WhatsApp
 * quick-replies cap at three, so a longer list must stay text.
 */
/**
 * Is this reply a MENU rather than an answer?
 *
 * True when the message is short and its whole substance is offering the customer a choice
 * between our own two paths — integration detail vs commercial offer — instead of answering what
 * they asked. Deliberately narrow: it requires BOTH path words AND a choice connective AND a
 * short body, so a real answer that happens to end by offering a next direction still passes.
 */
/** Did the customer just ask a commercial question? Mirrors the prompt's own trigger set so code
 *  and prompt cannot disagree about what "asked about price" means. */
export function wantsCommercialNow(latestText: string, priorCustomer: string): boolean {
  const recent = latestText + " · " + priorCustomer;
  return /(كم\s*(السعر|التكلفة|يكلف)|السعر|تسعير|عرض\s*سعر|التكلفة|العرض التجاري)/.test(recent);
}

/**
 * Which sorter decision, if any, does this customer message demand?
 *
 * Returns null for anything needing judgement — the model still owns those. Only decisions with
 * ONE correct answer are routed here, and they are routed BEFORE the model so a tool call cannot
 * skip them. Patterns are anchored on stems rather than exact phrases because the same intent
 * arrives in many spellings, and a missed trigger is how these behaviours became inconsistent.
 */
export type SorterIntent = "refusal" | "budget" | "discount" | "how_integrate" | "price_unpublished" | null;
export function sorterIntent(text: string): SorterIntent {
  const s = String(text || "").trim();
  if (!s) return null;
  // Refusal first: «ما نحتاج» inside a budget sentence is still a refusal of the product.
  if (/(?:لسنا|لست|ما|مو|مب|غير)\s*مهتم|ما\s*نحتاج|لا\s*نحتاج|مانحتاج|ما\s*يناسبنا/.test(s)) return "refusal";
  if (/ميزاني/.test(s)) return "budget";
  if (/خصم|تخفيض|سعر\s*أفضل|أفضل\s*سعر/.test(s)) return "discount";
  if (/كيف\s*(?:نتكامل|يتم\s*الربط|نربط)|آلية\s*(?:الربط|التكامل)|خطوات\s*(?:الربط|التكامل)|تفاصيل\s*(?:الربط|التكامل)/.test(s)) return "how_integrate";
  return null;
}

export function menuDodge(text: string): boolean {
  const s = String(text || "").trim();
  if (!s) return false;
  const words = s.split(/\s+/).filter(Boolean).length;
  // 45 words was too generous: it refused a reply that had already given the operational answer
  // and merely OFFERED the two paths at the end — which is exactly what the founder's spec asks
  // for. A pure menu is short. Over-blocking costs a good answer, so the cap is tight.
  if (words > 25) return false;
  // Anything carrying a number (a price, a count, a duration) or naming the implementation phases
  // is substantive by definition, whatever it offers afterwards.
  if (/[\d٠-٩]/.test(s) || /البيئة التجريبية|مراحل|التفعيل/.test(s)) return false;
  const offersDetail = /تفاصيل\s*(?:ال)?(?:ربط|تكامل)|طريقة\s*الربط|المتطلبات\s*التقنية/.test(s);
  const offersCommercial = /العرض\s*التجاري|الجانب\s*التجاري/.test(s);
  // NOT \b — JS word boundaries need an ASCII word char, so «أو» never matched next to Arabic and
  // this guard was inert on its first run. The same trap is already documented three times in this
  // file (SANDBOX_ACTIVATION_RE, the disclosure filter, INFO_PHRASE). Anchor on whitespace instead.
  const isChoice = /(?:^|\s)(?:أو|أم)(?=\s)|أحدهما|مسارين/.test(s);
  return offersDetail && offersCommercial && isChoice;
}

export function offeredChoices(text: string): string[] | null {
  const s = String(text || "").trim();
  if (!s) return null;
  // 1) A numbered or bulleted list, the shape the spec's own example uses.
  // ANY digit, not 1-3. Anchoring the class to [1-3] matched only the first three lines of a
  // four-item list and returned three — silently dropping the fourth option on its way to
  // becoming buttons. Match every item, then let the count decide.
  const listed = [...s.matchAll(/^\s*(?:[٠-٩0-9]+[-.)]|[-•*])\s*(.{2,40})$/gm)].map((m) => m[1].trim());
  if (listed.length >= 2 && listed.length <= 3) return listed;
  // 2) An «أ أم ب؟» question — two options inline, ending the message.
  const either = s.match(/([^\n،.؟!]{2,30})\s+(?:أم|او|أو)\s+([^\n،.؟!]{2,30})\s*؟/);
  if (either) return [either[1].trim(), either[2].trim()];
  return null;
}

/** What we say instead, when the model hands us something unsendable. Never silence — that is the
 *  failure mode this file already learned once. */
const SAFE_FALLBACK = "عذرًا على التأخير. لأكمل معكم بدقة: هل يشمل التكامل فرعًا واحدًا أم عدة فروع؟";

async function safeSend(phone: string, text: string) {
  // Surgical first: drop invented deal state and CRM narration, keep the rest of the answer.
  const cleaned = stripSalesVoice(text);
  if (cleaned.removed.length) {
    console.error(JSON.stringify({ at: "agent", level: "error", msg: "stripped sales-voice violation", phone, removed: cleaned.removed, before: String(text).slice(0, 200) }));
    tracker.recordSystem(phone, `[حُذفت عبارات عملية/افتراض: ${cleaned.removed.join(" · ")}]`);
    // Too little left to be a message — better a clean short line than a stub.
    text = cleaned.text.length >= 40 ? cleaned.text : SAFE_FALLBACK;
  }
  const bad = unsendableReason(text);
  if (bad) {
    console.error(JSON.stringify({ at: "agent", level: "error", msg: "BLOCKED unsendable model output", phone, reason: bad, dropped: String(text).slice(0, 200) }));
    tracker.recordSystem(phone, `[حُجبت رسالة غير صالحة: ${bad}]`);
    text = SAFE_FALLBACK;
  }
  try {
    await gupshup.sendText(phone, text);
    tracker.recordAgentReply(phone, text);
  } catch (e) {
    console.error(JSON.stringify({ at: "agent", msg: "send failed", phone, err: String(e).slice(0, 400) }));
    tracker.recordSystem(phone, `send failed: ${String(e).slice(0, 200)}`);
  }
}
