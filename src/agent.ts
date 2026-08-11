import OpenAI from "openai";
import { cfg } from "./config.js";
import * as gupshup from "./gupshup.js";
import * as tracker from "./tracker.js";
import * as db from "./db.js";
import type { Contact } from "./tracker.js";

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
    pitch: "إصدار وإدارة الإجازات المرضية إلكترونيًا بتوثيق رسمي معتمد وتكامل مباشر مع أنظمة HIS وERP — التفعيل خلال 5 أيام عمل.",
    efficiency: [
      "يقلّل زمن إصدار الإجازة بنسبة 70% — من طابور ورقي إلى دقائق",
      "يلغي الإدخال المزدوج: الإجازة تصدر من نظام المنشأة نفسه",
      "توثيق رسمي فوري يقفل باب التزوير والمراجعات",
      "لوحة متابعة لحظية لكل الإصدارات والفروع",
    ],
    bestFor: ["مجمعات طبية", "مراكز طبية", "مستشفيات", "مراكز أسنان"],
    pricing: "الباقة القياسية (فرع واحد): 18,000 ر.س سنويًا · باقة المؤسسات (حتى 10 فروع): 95,000 ر.س سنويًا",
    faq: [
      ["هل الخدمة معتمدة؟", "نعم، معتمدة رسميًا لدى الجهات التنظيمية ويمكن التحقق من الاعتماد."],
      ["كم يستغرق الربط؟", "5 أيام عمل للأنظمة المدعومة."],
      ["هل توجد تجربة؟", "نعم — بيئة تجريبية 14 يومًا."],
    ],
    objections: [
      ["السعر مرتفع", "قارنه بتكلفة الورق وساعات الموظفين والمراجعات — أغلب عملائنا يسترد التكلفة قبل نهاية الربع الأول."],
      ["عندنا نظام حالي", "ممتاز — نحن لا نستبدل نظامكم، نوصله بالاعتماد الرسمي والتوثيق الفوري دون إدخال مزدوج."],
    ],
  },
  {
    name: "فحص الموظفين",
    pitch: "فحوصات اللياقة الطبية للموظفين بقوالب معتمدة وتقارير جماعية وربط مباشر مع ملف الموظف.",
    efficiency: [
      "امتثال كامل لمتطلبات العمل بدون ملاحقة أوراق",
      "تقارير جماعية جاهزة للجهات بضغطة واحدة",
      "ربط نتيجة الفحص بملف الموظف تلقائيًا",
    ],
    bestFor: ["مستشفيات", "مجمعات طبية", "شركات ذات كثافة توظيف"],
    pricing: "اشتراك سنوي بتسعير لكل فحص — يحدده المختص حسب الحجم",
    faq: [["هل تشمل فحوصات ما قبل التوظيف؟", "نعم، مع الفحوصات الدورية أيضًا."]],
    objections: [["نعملها يدويًا حاليًا", "كل فحص يدوي = وقت موظف ومخاطرة امتثال — الأتمتة تحوّلها لدقائق موثقة."]],
  },
  {
    name: "التقارير الطبية",
    pitch: "تقارير طبية معتمدة إلكترونيًا بتوقيع رقمي وأرشفة مركزية ومشاركة آمنة — الإصدار خلال دقائق.",
    efficiency: [
      "من أيام انتظار إلى دقائق إصدار",
      "أرشيف مركزي يبحث فيه بدل الملفات المتناثرة",
      "مشاركة آمنة تحفظ خصوصية المريض",
    ],
    bestFor: ["مراكز طبية", "مختبرات", "عيادات"],
    pricing: "اشتراك سنوي حسب الحجم — يحدده المختص",
    faq: [["هل التوقيع معتمد؟", "نعم، توقيع إلكتروني معتمد نظامًا."]],
    objections: [["حجمنا صغير", "الباقات تبدأ صغيرة — والوقت الموفَّر لعيادة واحدة يظهر من أول أسبوع."]],
  },
  {
    name: "خدمات التطعيمات",
    pitch: "إدارة وتوثيق التطعيمات بسجل موحّد وتنبيهات جرعات وتقارير امتثال.",
    efficiency: ["توثيق لحظي لكل جرعة", "تنبيهات آلية للجرعات القادمة", "تقارير امتثال جاهزة"],
    bestFor: ["مراكز صحية", "صيدليات"],
    pricing: "اشتراك سنوي — يحدده المختص",
    faq: [],
    objections: [],
  },
  {
    name: "الشهادات الصحية",
    pitch: "إصدار الشهادات الصحية إلكترونيًا فورًا، بتحقق QR وسجل مركزي وبدون ورق.",
    efficiency: ["إصدار فوري بدل أيام", "تحقق بالـ QR يمنع التلاعب", "سجل مركزي لكل الشهادات"],
    bestFor: ["صيدليات", "مراكز طبية"],
    pricing: "اشتراك سنوي — يحدده المختص",
    faq: [],
    objections: [],
  },
  {
    name: "تكامل الأنظمة (HIS/ERP)",
    pitch: "ربط خدمات لِين بأنظمة المنشأة القائمة — واجهات جاهزة وتنفيذ خلال أسبوعين ودعم مخصص.",
    efficiency: ["إلغاء الإدخال المزدوج نهائيًا", "تنفيذ خلال أسبوعين بواجهات جاهزة", "فريق دعم فني مخصص"],
    bestFor: ["مستشفيات", "مجمعات كبيرة"],
    pricing: "مشروع تكامل + اشتراك سنوي — يحدده المختص",
    faq: [],
    objections: [],
  },
];

// Segment → next-best pivot when the current product gets a "no".
const PIVOTS = [
  "إذا رفض «الإجازات المرضية»: جرّب «فحص الموظفين» (كثافة توظيف) أو «التقارير الطبية» (عيادات/مختبرات).",
  "إذا رفض منشأة كبيرة/مستشفى: جرّب «تكامل الأنظمة» — ألم الإدخال المزدوج شبه مضمون.",
  "إذا كان صيدلية: «الشهادات الصحية» ثم «التطعيمات».",
  "لا تعرض أكثر من منتجين بديلين في المحادثة الواحدة — بعدها حوّل لمختص بلباقة.",
];

function productBlock(): string {
  return PRODUCTS.map((p) => [
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
export async function refreshKb(): Promise<number> {
  try {
    productAssets = (await db.listAssets()).filter((a) => !a.product.startsWith("__")).map((a) => ({
      product: a.product, url: `${cfg.publicBaseUrl}/assets/${a.public_id}.pdf`, filename: a.filename }));
    hubKb = (await db.listKb()).map((r) => ({ product: r.product, md: r.md }));
    console.log(JSON.stringify({ at: "agent", msg: "hub kb refreshed", products: hubKb.map((h) => h.product) }));
  } catch (e) { console.error(JSON.stringify({ at: "agent", msg: "hub kb refresh failed", err: String(e).slice(0, 200) })); }
  return hubKb.length;
}

function systemPrompt(contact: Contact): string {
  const availableAssets = assets();
  return [
    "# الهوية والأسلوب",
    "أنت «مساعد لِين الرقمي» — كبير مستشاري مبيعات في شركة لِين للصحة الرقمية بالسعودية. عرّف بنفسك كمساعد رقمي (لا تدّعِ أنك إنسان).",
    "أسلوبك: بائع محترف من الطراز الأول — واثق، دافئ، مقنع، يقود الحوار بخفة ولا يفقد زمام المبادرة. جُمل قصيرة مشحونة بالقيمة. فصحى مبسطة بنَفَس سعودي مهني.",
    "إيموجي: واحد كحد أقصى في الرسالة، وليس في كل رسالة. 👌 لا زخرفة.",
    "الطول: سطران إلى أربعة. سؤال واحد كحد أقصى. لا خُطب.",
    contact.waName ? `اسم العميل: ${contact.waName} — استخدم اسمه الأول باعتدال.` : "",
    contact.outcome === "handoff"
      ? "ملاحظة: سبق إشعار المختص بهذا العميل. تابع خدمته طبيعيًا (رتب العرض التعريفي، أجب أسئلته من المعرفة) ولا تكرر التحويل إلا لسبب جديد."
      : "",
    "",
    "# قاعدة ذهبية: لا طريق مسدود أبدًا",
    "كل رسالة تنتهي إمّا بسؤال ذكي أو بأزرار (send_buttons). لا ترسل رسالة تُغلق الحوار إلا عند close_conversation.",
    "إذا قال «لا» أو «غير مهتم» عن منتج: تقبّلها بأناقة في نصف سطر، ثم افتح فورًا زاوية جديدة — منتج أنسب لقطاعه أو سؤال عن ألم تشغيلي آخر (استدعِ offer_alternative). بعد بديلين مرفوضين: mark_not_interested واختم بباب مفتوح.",
    "إذا أبدى اهتمامًا: tag_interest فورًا، ثم ادفع للخطوة الملموسة: عرض تعريفي قصير مع المختص هذا الأسبوع.",
    "",
    "# البيع بالكفاءة (لغتك الأساسية)",
    "بِع النتيجة لا الميزة: وقت الإصدار ↓70%، لا إدخال مزدوج، امتثال جاهز، لوحة لحظية. اربط كل ميزة بألم تشغيلي يعيشه مدير المنشأة يوميًا.",
    "أسئلة تأهيل ذكية: عدد الفروع؟ النظام الحالي؟ حجم الإصدار الشهري؟ من يتولى الإجراءات اليوم؟",
    "",
    "# قواعد صارمة",
    "- لا خصومات ولا التزامات ولا مواعيد خارج المذكور. الأسعار: فقط المذكور نصًا في المعرفة؛ ما عداه «يحدده المختص حسب حجمكم».",
    "- لا أسماء عملاء آخرين، لا استشارات طبية، الشكاوى → request_human_handoff فورًا.",
    "- سؤال خارج المعرفة → قل إنك ستتأكد من المختص واستدعِ request_human_handoff.",
    "",
    "# أدوات واتساب — استخدمها بذكاء",
    "- send_buttons: عند عرض خيارات (اهتمام/تفاصيل/موعد) اجعل الرد بضغطة زر — أسهل للعميل وأعلى استجابة. ≤3 أزرار بعناوين قصيرة.",
    productAssets.length
      ? `- send_asset: ملف تعريفي PDF متاح لهذه المنتجات: ${productAssets.map((a) => a.product).join("، ")}. أرسله (باسم المنتج) مع افتتاحية الحديث عن المنتج، وعند أي طلب «تفاصيل أكثر / ملف / بروشور». لا ترسل نفس الملف مرتين في المحادثة.`
      : "- (لا ملفات تعريفية مرفوعة بعد — لا تعِد بإرسال ملف.)",
    "",
    "# المنتجات المعتمدة",
    productBlock(),
    "",
    "# مصفوفة البدائل",
    ...PIVOTS,
    ...(hubKb.length ? [
      "",
      "# معرفة معتمدة من Product Hub (ملفات رسمية مرفوعة — قدّمها على المعرفة الافتراضية عند التعارض)",
      ...hubKb.map((h) => h.md.slice(0, 6000)),
    ] : []),
  ].filter(Boolean).join("\n");
}

// ------------------------------ tools ------------------------------

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "send_buttons",
      description: "أرسل رسالة بأزرار رد سريع (≤3). استخدمها لتسهيل رد العميل. الرسالة تُرسل فورًا — لا تكرر نصها بعدها.",
      parameters: {
        type: "object",
        properties: {
          body: { type: "string", description: "نص الرسالة فوق الأزرار (قصير ومقنع)" },
          options: { type: "array", items: { type: "string" }, description: "عناوين الأزرار، ≤3، ≤20 حرفًا لكل زر" },
          footer: { type: "string", description: "سطر تذييل اختياري صغير" },
        },
        required: ["body", "options"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_asset",
      description: "أرسل الملف التعريفي PDF لمنتج (asset_id = اسم المنتج). استخدمه مع افتتاحية المنتج أو عند طلب تفاصيل/ملف/بروشور.",
      parameters: { type: "object", properties: { asset_id: { type: "string", description: "اسم المنتج" } }, required: ["asset_id"] },
    },
  },
  {
    type: "function",
    function: {
      name: "tag_interest",
      description: "سجّل اهتمام العميل بمنتج (يغذي التتبع وإعادة الاستهداف). استدعها فور ظهور اهتمام حقيقي.",
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
      description: "سجّل أنك تعرض الآن منتجًا بديلًا (بعد رفض أو عدم ملاءمة).",
      parameters: { type: "object", properties: { product: { type: "string" } }, required: ["product"] },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_not_interested",
      description: "سجّل رفضًا نهائيًا (بعد تجربة بديلين كحد أقصى).",
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
      description: "حوّل لمختص بشري (شكوى، خصم، سؤال خارج المعرفة، ترتيب اجتماع).",
      parameters: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] },
    },
  },
  {
    type: "function",
    function: {
      name: "close_conversation",
      description: "أنهِ المحادثة بأدب بعد اكتمالها.",
      parameters: {
        type: "object",
        properties: { outcome: { type: "string", enum: ["interested", "not_interested", "later"] } },
        required: ["outcome"],
      },
    },
  },
];

// ------------------------------ lead alerts → the product manager ------------------------------
// Hard rule in code (not prompt): a hot tag or a handoff pushes a lead card to the PM's
// WhatsApp so a serious lead never dead-ends. Throttled per contact; silent if unset.
const LEAD_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const lastLeadAlert = new Map<string, number>();   // in-memory: worst case one duplicate after a restart

async function notifyLead(contact: Contact, kind: "hot" | "handoff", product: string, detail: string): Promise<void> {
  if (!cfg.notifyNumber || contact.phone === cfg.notifyNumber) return;
  const prev = lastLeadAlert.get(contact.phone) ?? 0;
  if (Date.now() - prev < LEAD_ALERT_COOLDOWN_MS) return;
  lastLeadAlert.set(contact.phone, Date.now());
  const lastCustomerLine = [...contact.transcript].reverse().find((t) => t.role === "customer")?.text ?? "";
  const title = kind === "hot" ? "🔥 عميل جاد الآن" : "🤝 طلب تدخّل بشري";
  const card = [
    title,
    `العميل: ${contact.waName || "غير معروف"} — ‎+${contact.phone}`,
    `المنتج: ${product}${detail ? ` · ${detail}` : ""}`,
    lastCustomerLine ? `آخر رسالة: «${lastCustomerLine.slice(0, 120)}»` : "",
    `المحادثة: ${cfg.publicBaseUrl}/dashboard#kmon`,
  ].filter(Boolean).join("\n");
  try {
    await gupshup.sendText(cfg.notifyNumber, card);
    tracker.recordSystem(contact.phone, `[أُبلغ المدير: ${kind === "hot" ? "عميل جاد" : "طلب تدخّل"}]`);
    db.insertEvent(contact.phone, "lead_alert", `${kind}:${product}`, Date.now());
    console.log(JSON.stringify({ at: "agent", msg: "lead alert sent", phone: contact.phone, kind, product }));
  } catch (e) {
    lastLeadAlert.delete(contact.phone);   // failed send shouldn't consume the cooldown
    console.error(JSON.stringify({ at: "agent", msg: "lead alert failed", err: String(e).slice(0, 150) }));
  }
}

async function execTool(contact: Contact, name: string, args: any): Promise<string> {
  switch (name) {
    case "send_buttons": {
      const options = (Array.isArray(args.options) ? args.options : []).slice(0, 3).map((t: unknown) => ({ title: String(t).slice(0, 20) }));
      if (!options.length || !args.body) return "أزرار غير صالحة — أرسل نصًا عاديًا بسؤال.";
      await gupshup.sendQuickReply(contact.phone, String(args.body), options, args.footer ? String(args.footer) : undefined);
      tracker.recordAgentReply(contact.phone, `${args.body} [أزرار: ${options.map((o: { title: string }) => o.title).join(" | ")}]`);
      return "أُرسلت الأزرار. لا تكرر نص الرسالة — إن لم تكن بحاجة لإضافة شيء أرجِع نصًا فارغًا.";
    }
    case "send_asset": {
      const key = String(args.asset_id ?? args.product ?? "").trim();
      const pa = productAssets.find((x) => x.product === key || x.product.includes(key));
      if (pa) {
        await gupshup.sendDocument(contact.phone, pa.url, pa.filename);
        tracker.recordAgentReply(contact.phone, `[أُرسل الملف التعريفي: ${pa.product}]`);
        return "أُرسل الملف التعريفي — علّق عليه بسطر واحد وسؤال متابعة.";
      }
      const a = assets().find((x) => x.id === key);
      if (!a) return "لا يوجد ملف لهذا المنتج — تابع بدون ملف.";
      if (a.type === "image") await gupshup.sendImage(contact.phone, a.url, a.caption);
      else await gupshup.sendDocument(contact.phone, a.url, a.filename ?? "ملف.pdf", a.caption);
      tracker.recordAgentReply(contact.phone, `[أُرسل ملف: ${a.id}]`);
      return "أُرسل الملف.";
    }
    case "tag_interest": {
      const tagProduct = String(args.product ?? PRODUCTS[0].name);
      const tagLevel = (args.level ?? "warm") as "hot" | "warm" | "cold";
      tracker.addTag(contact.phone, tagProduct, tagLevel);
      tracker.setOutcome(contact.phone, "interested");
      if (tagLevel === "hot") void notifyLead(contact, "hot", tagProduct, "مستوى الجدية: جاد 🔥");
      return "سُجّل الاهتمام — ادفع الآن لموعد العرض التعريفي.";
    }
    case "offer_alternative":
      tracker.recordSystem(contact.phone, `cross-sell offered: ${args.product}`);
      return "سُجّل — قدّم البديل بزاوية كفاءة مختلفة عن المنتج المرفوض.";
    case "mark_not_interested":
      tracker.setOutcome(contact.phone, "not_interested", String(args.reason ?? "other"));
      return "سُجّل. اختم بلباقة وباب مفتوح.";
    case "request_human_handoff": {
      const why = String(args.reason ?? "");
      tracker.setOutcome(contact.phone, "handoff", why);
      const hotTag = (contact.tags || []).find((t) => t.level === "hot") || (contact.tags || [])[0];
      void notifyLead(contact, "handoff", hotTag?.product ?? "غير محدد", why);
      return "أُشعر المختص وسيتواصل قريبًا — أبلغ العميل بذلك بثقة.";
    }
    case "close_conversation":
      tracker.setOutcome(contact.phone, (args.outcome === "later" ? "later" : args.outcome === "interested" ? "interested" : "closed"));
      return "أنهِ برسالة ختامية قصيرة أنيقة.";
    default:
      return "أداة غير معروفة.";
  }
}

// ------------------------------ opt-out (pre-LLM, hard rule) ------------------------------

const OPT_OUT_PATTERNS = [
  /إيقاف|ايقاف|أوقف|اوقف|توقف|لا تراسلني|الغاء الاشتراك|إلغاء الاشتراك|حظر/,
  /\bstop\b|\bunsubscribe\b|\bquit\b|\bcancel\b/i,
];
function isOptOut(text: string): boolean {
  const t = text.replace(/[ً-ٟـ]/g, "").trim();
  return OPT_OUT_PATTERNS.some((p) => p.test(t));
}

// ------------------------------ main turn loop ------------------------------

const MAX_AGENT_TURNS = 12;

export async function handleInbound(contact: Contact, text: string): Promise<void> {
  if (contact.optedOut) return;

  if (isOptOut(text)) {
    tracker.setOutcome(contact.phone, "opted_out");
    await safeSend(contact.phone, "تم إيقاف الرسائل نهائيًا. شكرًا لوقتك، ونعتذر عن الإزعاج. 🌿");
    return;
  }

  if (contact.human) return; // explicit portal takeover only — agent silent while a human drives

  if (contact.agentTurns >= MAX_AGENT_TURNS) {
    tracker.setOutcome(contact.phone, "handoff", "turn cap reached");
    await safeSend(contact.phone, "شكرًا لتفاعلك — سيتولى أحد مختصينا إكمال الحديث معك مباشرة قريبًا بإذن الله.");
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

  try {
    let finalText = "";
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
          const result = await execTool(contact, tc.function.name, args);
          messages.push({ role: "tool", tool_call_id: tc.id, content: result });
        }
        continue;
      }

      finalText = (msg.content ?? "").trim();
      break;
    }

    if (finalText) await safeSend(contact.phone, finalText);
  } catch (e) {
    console.error(JSON.stringify({ at: "agent", msg: "turn failed", phone: contact.phone, err: String(e).slice(0, 400) }));
  }
}

async function safeSend(phone: string, text: string) {
  try {
    await gupshup.sendText(phone, text);
    tracker.recordAgentReply(phone, text);
  } catch (e) {
    console.error(JSON.stringify({ at: "agent", msg: "send failed", phone, err: String(e).slice(0, 400) }));
    tracker.recordSystem(phone, `send failed: ${String(e).slice(0, 200)}`);
  }
}
