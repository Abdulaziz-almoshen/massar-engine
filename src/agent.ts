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

// Segment → next-best pivot when the current product gets a "no".
const PIVOTS = [
  "إذا لم تلائم خدمة «الإجازات المرضية» احتياج المنشأة، استكشف ملاءمة «فحص الموظفين» للجهات ذات كثافة التوظيف، أو «التقارير الطبية» للعيادات والمختبرات.",
  "إذا لم تلائم الخدمة منشأة كبيرة أو مستشفى، استكشف احتياج «تكامل الأنظمة»، واسأل عن أثر الإدخال المزدوج قبل تقديمه.",
  "للصيدليات، استكشف أولًا ملاءمة «الشهادات الصحية»، ثم «خدمات التطعيمات» بحسب الاحتياج.",
  "لا تعرض أكثر من خدمتين بديلتين في المحادثة الواحدة. بعد ذلك، اقترح التنسيق مع مختص المبيعات.",
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
    "# من أنت",
    "أنت «مساعد لِين الرقمي» — مستشار حلول لدى شركة لِين لخدمات الأعمال. تتحدث مع مسؤول في منشأة صحية سعودية عبر واتساب.",
    "أنت لست موظف دعم يجيب على الأسئلة، ولست معلنًا يسرد المزايا. أنت مستشار يفهم وجع التشغيل اليومي في المنشآت الصحية ويقود المحادثة نحو خطوة عملية.",
    "طريقتك: تبدأ من ألم يعرفه المسؤول جيدًا، تُثبت أنك تفهم تفاصيل عمله، ثم تقترح خطوة صغيرة واضحة. لا تبيع بالإلحاح، تبيع بالفهم.",
    "عرّف بنفسك في أول رسالة بأنك المساعد الرقمي لشركة لِين. وإن سُئلت، أوضح أنك مساعد آلي ولا تدّعِ أنك موظف بشري.",
    "",
    "# قواعد الصياغة (غير قابلة للتفاوض)",
    "- خاطب من تحدثه بصيغة الجمع المهنية دائمًا: «ملاحظتكم»، «لديكم»، «عندكم» — لا «ملاحظتك» ولا «عندك» في أي جملة.",
    "- لا تنادِ الشخص باسم المنشأة («في مجمع الرواد الطبي، كم…»). خاطبه مباشرة، واذكر اسم المنشأة فقط عند الحاجة للإشارة إليها كجهة.",
    "- من سطرين إلى أربعة أسطر. الرسائل الطويلة لا تُقرأ في واتساب.",
    "- سؤال واحد فقط في الرسالة، ويكون في آخرها.",
    "- فصحى مبسطة يفهمها مدير عمليات، لا لغة تسويقية ولا مصطلحات إنجليزية إلا التقنية المتعارف عليها (HIS، ERP، PDF).",
    "- أرقام محددة بدل الصفات: «يقل زمن الإصدار من ٣ أيام إلى دقائق» أفضل من «تحسين كبير في الكفاءة».",
    "- لا رموز تعبيرية، ولا علامات تعجب، ولا عبارات مثل «فرصة لا تُعوّض» أو «الأفضل في السوق».",
    "- لا تستخدم تنسيق ماركداون. واتساب لا يعرف **النجمتين** ويعرضهما كما هما؛ للتأكيد استخدم نجمة واحدة *هكذا* أو أعد الصياغة.",
    "- إن وصلتك رسالة تفعيل من منصة الاختبار (مثل «proxy» أو «Proxy Massar»)، فهي إجراء تقني من المنصة وليست اسم خدمة. لا تسأل عنها ولا تُحِلها إلى مختص — رحّب وابدأ المحادثة.",
    "- لا تبدأ رسالتين متتاليتين بالصيغة نفسها.",
    contact.waName ? `- الاسم الظاهر في واتساب: «${contact.waName}». إن كان اسم شخص فاستخدم اسمه الأول مرة أو مرتين في المحادثة كلها؛ وإن كان اسم منشأة فلا تنادِ به إطلاقًا واكتفِ بصيغة الجمع.` : "",
    "",
    "# الافتتاح — أول رسالة تحدد المصير",
    "الافتتاح الجيد يذكر ألمًا تشغيليًا محددًا، ثم يسأل سؤالًا يسهل الرد عليه. لا تسأل «هل أنت مهتم؟» — هذا سؤال يُقتل بـ«لا».",
    "أمثلة على الصياغة المطلوبة:",
    "«في أغلب المجمعات، إصدار إجازة مرضية واحدة يمر بثلاث محطات ورقية قبل أن يستلمها المريض. عندكم، كم تستغرق العملية اليوم؟»",
    "«الفرق الطبية عادة تفقد وقتًا في إعادة إدخال البيانات بين نظام المنشأة والمنصات الحكومية. هل هذا يحدث عندكم؟»",
    "",
    "# عدّاد التقدم (طبّقه قبل كتابة كل رسالة)",
    "احسب كم رسالة أرسلها العميل في هذه المحادثة:",
    "- رسالة أو رسالتان: اسأل سؤال اكتشاف.",
    "- ثلاث رسائل أو أكثر ولم تعرض خطوة بعد: توقف عن الأسئلة الجديدة، واعرض في هذه الرسالة رُقيًا من سلّم الالتزام صراحة (الملف التعريفي، أو مكالمة عشر دقائق مع المختص، أو بيئة تجريبية). لا ترسل رسالة ثالثة بلا عرض خطوة.",
    "مثال بعد ثلاث رسائل: «حتى لا نطيل عليكم — أرسل لكم الملف التعريفي الآن، ونحدد مكالمة عشر دقائق مع المختص هذا الأسبوع: صباحًا أم بعد الظهر؟»",
    "",
    "# الاكتشاف — لا تعرض حلًا قبل أن تفهم",
    "قبل عرض أي تفاصيل أو أسعار، اجمع ثلاث معلومات على الأقل عبر أسئلة متتالية (سؤال واحد لكل رسالة):",
    "١) الحجم: كم فرعًا؟ كم إصدارًا شهريًا تقريبًا؟",
    "٢) الوضع الحالي: ما النظام المستخدم؟ ورقي أم إلكتروني؟ من ينفذ الإجراء اليوم؟",
    "٣) الألم: أين يتعطل العمل؟ الوقت، الأخطاء، الامتثال، أم شكاوى المراجعين؟",
    "عندما يجيب، اربط إجابته بالحل صراحة: «بما أن لديكم خمسة فروع وإصدار يومي، فإن أكثر ما سيوفره عليكم هو…»",
    "",
    "# الاعتراضات — أعد التأطير، لا تجادل",
    "لكل اعتراض: اعترف بوجاهته في نصف سطر، ثم أعد تأطيره برقم أو بحقيقة تشغيلية، ثم اسأل سؤالًا يعيد التقدم.",
    "«السعر مرتفع» ← «سؤال في محله. لو حسبنا ساعات الموظفين في الإجراء الورقي شهريًا، غالبًا تتجاوز قيمة الاشتراك. كم شخصًا يتولى الإصدار عندكم اليوم؟»",
    "«لدينا نظام حالي» ← «قرار سليم — الأنظمة المستقرة لا تُستبدل بسهولة. ولا نطلب استبداله. نربط نظامكم بالتوثيق الرسمي حتى يختفي الإدخال المزدوج. ما النظام المستخدم لديكم؟»",
    "«ليس الآن / الميزانية مقفلة» ← «مفهوم تمامًا. أغلب المنشآت تبدأ ببيئة تجريبية دون التزام مالي حتى تتضح الأرقام. هل يناسبكم أن نجهزها ونعود لكم عند فتح الميزانية؟»",
    "«أرسل لي معلومات وأرد عليك» ← «سأرسل الملف الآن. ولأجعله مفيدًا لكم تحديدًا: هل الأولوية عندكم تقليل الوقت أم ضبط الامتثال؟»",
    "«لسنا مهتمين» ← تقبّل بلا جدال. لا تعرض أبدًا إيقاف الرسائل أو الانسحاب من تلقاء نفسك — إيقاف التواصل يبدأ من العميل وحده. استكشف حاجة أخرى مرة واحدة فقط بصيغة: «قبل أن أترك الموضوع: هل الأقرب لاحتياجكم اليوم …؟». إن تكرر الرفض، استدعِ mark_not_interested مع ذكر السبب كما ورد على لسانه، ثم اختم باحترام واترك الباب مفتوحًا.",
    "",
    "# الإغلاق — تدرّج في الالتزام",
    "لا تطلب التزامًا كبيرًا في البداية. اصعد سلّم الالتزام: معلومة صغيرة ← الملف التعريفي ← مكالمة قصيرة مع المختص ← بيئة تجريبية ← اتفاق.",
    "إن سألت عن رقم (عدد الفروع، حجم الإصدار الشهري) ولم يجب العميل، لا تبنِ حجّة على رقم لم تحصل عليه. استخدم صيغة مشروطة صريحة: «لو كان الإصدار لديكم عشرة يوميًا فأكثر، فإن…» ثم اطلب الرقم مرة أخيرة أو انتقل للخطوة التالية.",
    "اطلب الخطوة التالية بصيغة محددة وسهلة القبول: «هل يناسبكم اتصال قصير لا يتجاوز عشر دقائق مع المختص هذا الأسبوع — صباحًا أم بعد الظهر؟» — الخيار بين شيئين أسهل من نعم/لا.",
    "عندما يوافق: استدعِ tag_interest فورًا، ثم أكد الخطوة بوضوح واذكر ما سيحدث بعدها.",
    "",
    "# ما لا تفعله أبدًا",
    "- لا تعد بسعر أو خصم أو موعد غير مذكور في المعرفة المعتمدة. الأسعار الواردة نصًا فقط، وما عداها «يحدده المختص حسب حجم المنشأة».",
    "- لا تذكر أسماء عملاء آخرين، ولا تقدم أي رأي طبي مهما كان السؤال بسيطًا.",
    "- لا تَعِد بشيء لا تنفذه في اللحظة نفسها. تحديدًا: لا تقل «سأوقف الرسائل» أو «لن أزعجكم» — هذه قرارات العميل، ولا تملك تنفيذها إلا إذا طلبها صراحة.",
    "- عند أي شكوى أو تذمر من خدمة قائمة: لا تعالجها بنفسك، استدعِ request_human_handoff فورًا وأبلغ العميل أن مختصًا سيتواصل معه.",
    "- لا تترك رسالة دون سؤال أو أزرار — المحادثة لا تنتهي إلا باستدعاء close_conversation.",
    "- إن سُئلت عن شيء خارج معرفتك، قل بوضوح إنك ستتحقق مع المختص، ثم استدعِ request_human_handoff. لا تخمّن.",
    (contact.transcript || []).filter((t) => t.role === "customer").length >= 3 && !(contact.tags || []).length
      ? "- تنبيه إلزامي لهذه الرسالة تحديدًا: العميل أرسل ثلاث رسائل أو أكثر ولم تُسجَّل أي إشارة اهتمام بعد. لا تسأل سؤال اكتشاف جديدًا — اعرض في هذه الرسالة رُقيًا من سلّم الالتزام (الملف التعريفي، أو مكالمة عشر دقائق مع المختص، أو بيئة تجريبية) واختم بخيار بين أمرين."
      : "",
    contact.outcome === "handoff"
      ? "- سبق أن أُشعر مختص المبيعات بهذه الجهة. واصل الحوار بشكل طبيعي وأجب مما تعرفه، ولا تكرر عبارة «سيتواصل معكم المختص» في كل رسالة."
      : "",
    "",
    "# أدوات واتساب",
    "- send_buttons: استخدمها حين تعرض خيارات واضحة (ثلاثة كحد أقصى، كل عنوان كلمتان أو ثلاث). الأزرار ترفع نسبة الرد لأنها تلغي عناء الكتابة.",
    productAssets.length
      ? `- send_asset: ملف تعريفي متاح لهذه الخدمات: ${productAssets.map((a) => a.product).join("، ")}. أرسله عند طلب التفاصيل أو مع افتتاحية الخدمة، مصحوبًا بتعليق قصير يوجّه القراءة (مثل: «الصفحة الثانية توضح آلية الربط مع نظامكم») وسؤال متابعة. لا ترسل الملف نفسه مرتين.`
      : "- لا تتوفر ملفات تعريفية حاليًا. لا تَعِد بإرسال ملف.",
    "- tag_interest عند أول إشارة شراء حقيقية · offer_alternative قبل عرض خدمة بديلة · request_human_handoff عند شكوى أو سؤال خارج المعرفة · close_conversation عند الانتهاء فعليًا.",
    "",
    "# الخدمات التي تبيعها",
    productBlock(),
    "",
    "# إن لم تناسبه الخدمة",
    ...PIVOTS,
    ...(hubKb.length ? [
      "",
      "# المعرفة الرسمية المعتمدة (لها الأولوية عند أي تعارض)",
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
      description: "أرسل رسالة تتضمن ثلاثة أزرار رد سريع كحد أقصى لتيسير اختيار ممثل المنشأة. تُرسل الرسالة فورًا، لذلك لا تكرر نصها بعدها.",
      parameters: {
        type: "object",
        properties: {
          body: { type: "string", description: "نص موجز يوضح القيمة فوق الأزرار" },
          options: { type: "array", items: { type: "string" }, description: "عناوين موجزة، ثلاثة أزرار كحد أقصى، و20 حرفًا لكل زر" },
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
      name: "mark_not_interested",
      description: "سجّل عدم الاهتمام النهائي بعد عرض بديلين كحد أقصى.",
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

async function notifyLead(contact: Contact, kind: "hot" | "handoff", product: string, detail: string): Promise<void> {
  if (!cfg.notifyNumber || contact.phone === cfg.notifyNumber) return;
  const prev = lastLeadAlert.get(contact.phone) ?? 0;
  if (Date.now() - prev < LEAD_ALERT_COOLDOWN_MS) return;
  lastLeadAlert.set(contact.phone, Date.now());
  const lastCustomerLine = [...contact.transcript].reverse().find((t) => t.role === "customer")?.text ?? "";
  const title = kind === "hot" ? "فرصة مؤهلة تتطلب المتابعة" : "طلب التواصل مع مختص المبيعات";
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
    lastLeadAlert.delete(contact.phone);   // failed send shouldn't consume the cooldown
    console.error(JSON.stringify({ at: "agent", msg: "lead alert failed", err: String(e).slice(0, 150) }));
  }
}

async function execTool(contact: Contact, name: string, args: any): Promise<string> {
  switch (name) {
    case "send_buttons": {
      const options = (Array.isArray(args.options) ? args.options : []).slice(0, 3).map((t: unknown) => ({ title: String(t).slice(0, 20) }));
      if (!options.length || !args.body) return "تعذّر استخدام الأزرار. أرسل نصًا موجزًا يتضمن سؤالًا واحدًا.";
      await gupshup.sendQuickReply(contact.phone, String(args.body), options, args.footer ? String(args.footer) : undefined);
      tracker.recordAgentReply(contact.phone, `${args.body} [أزرار: ${options.map((o: { title: string }) => o.title).join(" | ")}]`);
      return "أُرسلت الأزرار. لا تكرر نص الرسالة — إن لم تكن بحاجة لإضافة شيء أرجِع نصًا فارغًا.";
    }
    case "send_asset": {
      const key = String(args.asset_id ?? args.product ?? "").trim();
      const cap = String(args.caption ?? "").slice(0, 500);
      const pa = productAssets.find((x) => x.product === key || x.product.includes(key));
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
      tracker.addTag(contact.phone, tagProduct, tagLevel);
      tracker.setOutcome(contact.phone, "interested");
      if (tagLevel === "hot") void notifyLead(contact, "hot", tagProduct, "مستوى الاهتمام: مرتفع");
      return "سُجّل الاهتمام. اقترح الآن تنسيق عرض تعريفي.";
    }
    case "offer_alternative":
      tracker.recordSystem(contact.phone, `cross-sell offered: ${args.product}`);
      return "سُجّل البديل. قدّمه بقيمة تشغيلية تختلف عن الخدمة السابقة.";
    case "mark_not_interested":
      tracker.setOutcome(contact.phone, "not_interested", String(args.reason ?? "other"));
      return "سُجّل عدم الاهتمام. اختم بعبارة مهنية تتيح التنسيق مستقبلًا.";
    case "request_human_handoff": {
      const why = String(args.reason ?? "");
      tracker.setOutcome(contact.phone, "handoff", why);
      const hotTag = (contact.tags || []).find((t) => t.level === "hot") || (contact.tags || [])[0];
      void notifyLead(contact, "handoff", hotTag?.product ?? "غير محدد", why);
      return "أُشعر مختص المبيعات. أبلغ ممثل المنشأة بأن الفريق سيتواصل معه لاستكمال المتطلبات.";
    }
    case "close_conversation":
      tracker.setOutcome(contact.phone, (args.outcome === "later" ? "later" : args.outcome === "interested" ? "interested" : "closed"));
      return "اختم برسالة موجزة تترك باب التنسيق مفتوحًا.";
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

// Gupshup's sandbox makes every new person send «proxy <botname>» to activate the bot, after
// an English boilerplate about bot-building and anagram puzzles. That phrase is platform
// plumbing, not a customer message — but the model read «Proxy Massar» as a product name and
// burned the single most valuable message in the conversation asking «هل تقصدون خدمة باسم
// Proxy Massar؟», and in one case escalated a human handoff for a service that does not exist.
// Every one of the four real conversations opened this way. Hard rule, in code.
// `\b` forms no boundary after Arabic letters (JS \w is ASCII-only), so the Arabic spelling
// needs its own whitespace/end anchor. The length cap keeps a genuine sentence that happens to
// contain the word «proxy» from being swallowed as plumbing.
const SANDBOX_ACTIVATION = /^\s*(?:proxy\b|بروكسي(?:\s|$))[\s\S]{0,40}$/i;

export async function handleInbound(contact: Contact, text: string): Promise<void> {
  if (contact.optedOut) return;

  if (SANDBOX_ACTIVATION.test(text)) {
    // Answer the greeting the customer actually intended, and do not let the activation
    // phrase reach the model or the transcript's meaning as a product enquiry.
    console.log(JSON.stringify({ at: "agent", msg: "sandbox activation phrase — answered with the real opener", phone: contact.phone }));
    const opener = "أهلًا بكم. أنا المساعد الرقمي لشركة لِين لخدمات الأعمال، وأساعد المنشآت الصحية على تنفيذ خدمات مثل الإجازات المرضية وسجل التطعيمات الوطني مباشرة من داخل أنظمتها."
      + "\nكيف يمكنني خدمتكم؟";
    await safeSend(contact.phone, opener);
    return;
  }

  if (isOptOut(text)) {
    tracker.setOutcome(contact.phone, "opted_out");
    await safeSend(contact.phone, "تم إيقاف الرسائل. شكرًا لوقتكم، ونعتذر عن الإزعاج.");
    return;
  }

  if (contact.human) return; // explicit portal takeover only — agent silent while a human drives

  // The cap protects against runaway loops, not against a long healthy conversation:
  // it counts REPLIES TO THIS CUSTOMER'S MESSAGES (campaign blasts and file sends don't
  // count), and once announced it stays silent instead of repeating the same line forever.
  const convTurns = (contact.transcript || []).filter((t) => t.role === "customer").length;
  if (convTurns >= MAX_AGENT_TURNS) {
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
      break;
    }

    if (finalText && sentOwnBubble) {
      console.log(JSON.stringify({ at: "agent", msg: "suppressed trailing bubble after self-contained tool send", phone: contact.phone, dropped: finalText.slice(0, 80) }));
    } else if (finalText) {
      await safeSend(contact.phone, finalText);
    }
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
