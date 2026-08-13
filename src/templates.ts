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
export type ButtonIntent = "info" | "commercial" | "qualify" | "decline" | "schedule";

// `Object.create(null)`-backed: a plain literal makes inherited keys truthy, so `BUTTON_INTENT`
// would have reported an intent for "toString" and `assertButtonsHandled(["toString"])` would pass.
export const BUTTON_INTENT: Record<string, ButtonIntent> = Object.assign(Object.create(null), {
  // asks for the material
  "الملف التعريفي": "info",
  "أرسلوا التفاصيل": "info",
  "تفاصيل التكامل": "info",
  // asks to talk business. «أريد العرض التجاري» is the exact title the system prompt tells the model
  // to offer — it was absent, so the prompt's own pricing button routed nowhere.
  "العرض التجاري": "commercial",
  "أريد العرض التجاري": "commercial",
  "أود مناقشة التكامل": "commercial",
  "احجز اجتماعًا": "commercial",
  // answers who they are, or who does the integration work
  "منشأة صحية": "qualify",
  "مزوّد نظام HIS": "qualify",
  "فريقنا التقني": "qualify",
  "مزوّد النظام": "qualify",
  // says no, for now
  "ليس الآن": "decline",
  "لاحقًا": "decline",
  "لا، شكرًا": "decline",
  "لسنا مهتمين": "decline",
  // the scheduling close — the prompt orders send_buttons here and forbids writing the options as
  // text, so these MUST route or the highest-value turn in the ladder ships with no buttons at all
  "صباحًا": "schedule",
  "مساءً": "schedule",
  "بعد الظهر": "schedule",
  "مكالمة قصيرة": "schedule",
  "الأحد": "schedule", "الاثنين": "schedule", "الثلاثاء": "schedule",
  "الأربعاء": "schedule", "الخميس": "schedule",
  // §372's third prescribed case is a plain yes/no. Without these the model composes them and the
  // emit path drops both, leaving the turn with no buttons at all.
  "نعم": "qualify",
  "لا": "decline",
  "موافق": "commercial",
  // the opening classifier the prompt prescribes for منصة صحة conversations
  "تكامل صحة": "qualify",
  "إجراء بالمنصة": "qualify",
  "استفسار آخر": "qualify",
  "لدينا نظام حالي": "qualify",
  "أرسلوا الملف التعريفي": "info",
  "أرسلوا معلومات": "info",
});

/** Exact-match a tapped button to its intent. WhatsApp echoes the title verbatim, so a trim is the
 *  only normalisation needed — and matching loosely would swallow a customer's own typed sentence. */
export function buttonIntent(text: string): ButtonIntent | undefined {
  return BUTTON_INTENT[text.trim()];
}

// ---------------------------------------------------------------------------
// EMIT-TIME canonicalisation — the hole the first version of this contract missed entirely.
//
// `assertButtonsHandled()` covers titles written in code. But `send_buttons` lets the MODEL compose
// button titles at runtime, and the system prompt itself prescribes «أريد العرض التجاري» — which is
// not «العرض التجاري» and matched nothing, so tapping the pricing button the prompt asks for fell
// straight back to «أي وصف يناسبكم؟». The largest source of emitted buttons was outside the contract.
//
// Fixed at the SOURCE rather than by loosening `buttonIntent`: whatever the model proposes, what
// goes on the wire is a title this system can read back. Inbound matching stays exact, so a
// customer's own sentence still cannot be mistaken for a tap.
// ---------------------------------------------------------------------------
// A NEGATED proposal must never be rewritten into its affirmative. «لا أريد العرض التجاري» mapped to
// «أريد العرض التجاري» — the customer would have read a button that said the opposite of what the
// model meant, and tapping it would have routed them to a commercial track they had just refused.
//
// The first attempt was a denylist of negation particles. That is unfixable in Arabic, and the
// review proved it: refusal is frequently a VERB («نرفض», «ألغوا», «أجّلوا», «توقفوا عن»), which no
// particle list contains, and «ولا» hides «لا» behind a prefixed conjunction the same way «الملف»
// hides «لم». 10 of 11 refusals still inverted.
//
// So the rule is inverted. Anything surrounding an approved title must be on a SHORT ALLOWLIST of
// meaningless courtesy particles; everything else refuses the button. Verb-form refusals become
// impossible by construction rather than by enumeration, and a proposal carrying real meaning we
// would silently discard («صباحًا الأحد» → «صباحًا», dropping the day) is refused too.
const BENIGN_AFFIX = new Set([
  "", "،", ".", "!", "؟",
  "نعم", "نعم،", "أجل", "أجل،", "من فضلكم", "لو سمحتم", "رجاءً", "رجاء", "شكرًا", "شكرا",
  "أرسلوا", "أرسل", "أريد", "نريد", "نبغى", "اختر", "اختاروا",
]);

export function canonicalTitle(proposed: string): string | undefined {
  const t = proposed.trim();
  if (BUTTON_INTENT[t]) return t;
  const keys = Object.keys(BUTTON_INTENT);
  // A title that is ALSO a benign courtesy particle («نعم») must not compete as a candidate when it
  // is merely the prefix of a longer proposal — «نعم أرسلوا التفاصيل» means the details, not "yes".
  // It stays tappable on its own: an exact match returned on the fast path above.
  const contained = keys.filter((k) => t.includes(k) && !BENIGN_AFFIX.has(k));
  if (!contained.length) return undefined;
  // Keep only MAXIMAL hits — «أريد العرض التجاري» contains «العرض التجاري», which is nesting, not
  // ambiguity. Two genuinely distinct titles («ليس الآن، أريد العرض التجاري لاحقًا») cannot be
  // resolved by length or by any rule that is not guessing intent, so the button is refused.
  const maximal = contained.filter((k) => !contained.some((o) => o !== k && o.includes(k)));
  if (maximal.length !== 1) return undefined;
  const hit = maximal[0];
  const before = t.slice(0, t.indexOf(hit)).trim();
  const after = t.slice(t.indexOf(hit) + hit.length).trim();
  // Allowlist, not denylist — see the note above. Unknown surrounding text means unknown meaning,
  // and we do not put words in the customer's mouth on a guess.
  if (!BENIGN_AFFIX.has(before) || !BENIGN_AFFIX.has(after)) return undefined;
  return hit;
}

/** Used when a launch names no template. Lives here so the boot check can see it — a literal at the
 *  call site is an emission site the contract is blind to, which is the defect this file exists for. */
export const LAUNCH_FALLBACK_BUTTONS = ["الملف التعريفي", "أرسلوا التفاصيل", "ليس الآن"];

/** Every button title the system can emit, from every source. */
export function emittedButtons(extra: string[] = []): string[] {
  return [...new Set([...TEMPLATES.flatMap((t) => t.buttons), ...LAUNCH_FALLBACK_BUTTONS, ...extra])];
}

/** Fails loudly for a button we send but cannot answer, and for a title WhatsApp will reject.
 *  Called at boot: a dead-end button is a customer talking to a wall, which is worse than a crash. */
export function assertButtonsHandled(extra: string[] = []): void {
  const problems: string[] = [];
  for (const title of emittedButtons(extra)) {
    if (!BUTTON_INTENT[title]) problems.push(`«${title}» is emitted but has no intent`);
    // Count the SAME units the adapter truncates on (UTF-16, `gupshup.ts` slice(0,20)), or a title
    // can pass this check and still be silently cut on the wire into a string with no intent.
    if (title.length > 20 || [...title].length > 20)
      problems.push(`«${title}» is ${title.length} UTF-16 units / ${[...title].length} chars — WhatsApp rejects > 20 (131009)`);
  }
  if (problems.length) throw new Error(`button contract violated:\n  - ${problems.join("\n  - ")}`);
}

// ---------------------------------------------------------------------------
// The campaign marker, written into the transcript when an opener goes out. It carries the
// TEMPLATE ID because the agent's next turn depends on which opener started the conversation:
// the upsell asserts «لاحظنا أن لديكم استخدامًا مرتفعًا» — we have just told them we know who they
// are — so answering their next tap with «أي وصف يناسبكم؟» contradicts the opener and reproduces
// the founder's complaint #1 by a new route. One regex, exported, so the marker cannot be written
// in one shape and read in another.
// ---------------------------------------------------------------------------
export const CAMPAIGN_MARK_RE = /\[حملة(?::([A-Za-z0-9_]+))?\]/;

export function campaignMark(templateId?: string): string {
  return ` [حملة${templateId ? `:${templateId}` : ""}]`;
}

export function isCampaignTurn(text: string): boolean {
  return CAMPAIGN_MARK_RE.test(text);
}

/** The template id of the most recent campaign turn, if it carried one. */
export function openerOf(text: string): string | undefined {
  return (CAMPAIGN_MARK_RE.exec(text) || [])[1];
}

export function byId(id: string): CampaignTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Fill {{1}} with the service name. Also accepts the older {product} placeholder still present
 *  in saved drafts, so an existing campaign message does not silently render a literal token. */
export function render(body: string, service: string): string {
  return body.replaceAll("{{1}}", service).replaceAll("{product}", service);
}
