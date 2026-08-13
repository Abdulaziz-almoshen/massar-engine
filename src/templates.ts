// ---------------------------------------------------------------------------
// Campaign templates — the founder's approved message shapes, as DATA.
//
// Two exist today and they are not variants of one message: the intro opens on an operational
// pain and asks for interest; the upsell opens on a fact we already know about the customer
// («لديكم استخدام مرتفع») and asks to connect what they are already doing. Different premise,
// different CTA, different audience. A third is a new entry here, not a code change.
//
// `{{1}}` is the service name, resolved from the campaign's selected service at launch — the
// same variable the founder's Meta-approved template uses, so these stay submittable as-is.
// ---------------------------------------------------------------------------

export type CampaignTemplate = {
  id: string;
  label: string;               // what the operator picks in the wizard
  hint: string;                // when to use it
  audience: string;            // who it is for — stated, so the wrong one is not picked by accident
  body: string;                // {{1}} = service name
  buttons: string[];           // quick replies; WhatsApp caps each title at 20 chars
  footer?: string;
};

export const TEMPLATES: CampaignTemplate[] = [
  {
    id: "intro_integration",
    label: "تعريفي — التكامل مع HIS",
    hint: "لجهة لم نتعامل معها بعد: يفتح على القيمة التشغيلية للتكامل ويطلب الاهتمام.",
    audience: "جهات جديدة لم تستخدم الخدمة بعد",
    body: [
      "ارتقِ بكفاءة منشأتكم من خلال التكامل المباشر بين نظام HIS وخدمة {{1}}.",
      "",
      "يُمكّن التكامل الممارسين من تنفيذ الخدمة مباشرة من داخل نظام المنشأة، مما يساهم في تسريع الإجراءات وتقليل العمل اليدوي.",
      "",
      "يسعدنا التنسيق معكم لعرض آلية التكامل ومناقشة الخطوات القادمة.",
    ].join("\n"),
    buttons: ["الملف التعريفي", "أرسلوا التفاصيل", "ليس الآن"],
  },
  {
    id: "high_usage_upsell",
    label: "استخدام مرتفع — اربطها بنظامكم",
    hint: "لجهة تستخدم الخدمة يدويًا عبر المنصة بكثافة: يفتح على استخدامهم الفعلي ويعرض ربطه.",
    audience: "جهات قائمة ذات استخدام مرتفع للخدمة",
    body: [
      "مرحبًا 👋",
      "",
      "لاحظنا أن لديكم استخدامًا مرتفعًا لخدمة {{1}}، ونعتقد أن هناك فرصة لتسهيل العمل على فريقكم بشكل أكبر.",
      "",
      "بدلًا من تنفيذ معاملات الخدمة يدويًا عبر المنصة، يمكنكم ربط {{1}} مباشرة مع نظام الـHIS لديكم، بحيث تتم العملية من داخل النظام الذي يستخدمه الممارس يوميًا، دون الحاجة للتنقل بين الأنظمة أو إعادة إدخال البيانات.",
      "",
      "يساعدكم التكامل على تقليل العمل اليدوي، تسريع تنفيذ المعاملات، وتقليل احتمالية الأخطاء — خصوصًا مع ارتفاع حجم الاستخدام.",
      "",
      "إذا أحببتم، نشارككم آلية التكامل والمتطلبات والخطوات اللازمة للبدء.",
    ].join("\n"),
    // «أرسلوا تفاصيل التكامل» is 21 characters and WhatsApp rejects the whole message over 20
    // (error 131009, measured). Shortened deliberately rather than truncated at the wire.
    buttons: ["تفاصيل التكامل", "أود مناقشة التكامل", "ليس الآن"],
  },
];

// ---------------------------------------------------------------------------
// Button → intent. The rule this table exists to enforce: EVERY reply button the system emits must
// be understood by the code that receives the tap. It was not. The launch emitted «العرض التجاري»
// and the commercial pattern did not match it, so tapping the button meant to ask for pricing
// routed the customer back to «أي وصف يناسبكم؟» — the founder's original complaint, reproduced by
// our own UI. A regex written separately from the buttons will drift again; one table, checked
// against the emitted set at boot, cannot.
// ---------------------------------------------------------------------------
export type ButtonIntent = "info" | "commercial" | "qualify" | "decline";

export const BUTTON_INTENT: Record<string, ButtonIntent> = {
  // asks for the material
  "الملف التعريفي": "info",
  "أرسلوا التفاصيل": "info",
  "تفاصيل التكامل": "info",
  // asks to talk business
  "العرض التجاري": "commercial",
  "أود مناقشة التكامل": "commercial",
  // answers who they are
  "منشأة صحية": "qualify",
  "مزوّد نظام HIS": "qualify",
  // says no, for now
  "ليس الآن": "decline",
};

/** Exact-match a tapped button to its intent. WhatsApp echoes the title verbatim, so a trim is the
 *  only normalisation needed — and matching loosely would swallow a customer's own typed sentence. */
export function buttonIntent(text: string): ButtonIntent | undefined {
  return BUTTON_INTENT[text.trim()];
}

/** Every button title the system can emit, from every source. */
export function emittedButtons(extra: string[] = []): string[] {
  return [...new Set([...TEMPLATES.flatMap((t) => t.buttons), ...extra])];
}

/** Fails loudly for a button we send but cannot answer, and for a title WhatsApp will reject.
 *  Called at boot: a dead-end button is a customer talking to a wall, which is worse than a crash. */
export function assertButtonsHandled(extra: string[] = []): void {
  const problems: string[] = [];
  for (const title of emittedButtons(extra)) {
    if (!BUTTON_INTENT[title]) problems.push(`«${title}» is emitted but has no intent`);
    if ([...title].length > 20) problems.push(`«${title}» is ${[...title].length} chars — WhatsApp rejects > 20 (131009)`);
  }
  if (problems.length) throw new Error(`button contract violated:\n  - ${problems.join("\n  - ")}`);
}

export function byId(id: string): CampaignTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Fill {{1}} with the service name. Also accepts the older {product} placeholder still present
 *  in saved drafts, so an existing campaign message does not silently render a literal token. */
export function render(body: string, service: string): string {
  return body.replaceAll("{{1}}", service).replaceAll("{product}", service);
}
