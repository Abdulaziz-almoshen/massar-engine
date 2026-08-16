#!/usr/bin/env node
// ---------------------------------------------------------------------------
// The AE prompt is the product, so it is asserted rather than eyeballed.
//
// Two states must hold, and the SECOND is the one that protects the customer: when we have no
// account record, the agent must NOT talk like an account manager. An agent that says "بحكم حجم
// استخدامكم الحالي" to a facility whose usage we do not know is inventing a fact about the
// customer's own operation — the sharpest form of user-model Rule 2, and the exact thing that
// makes it read as a bot pretending to know them.
// ---------------------------------------------------------------------------
process.env.ACCOUNTS_JSON = JSON.stringify([{
  phone: "966500000111",
  customerName: "مجموعة طبية",
  customerType: "مجموعة طبية",
  currentProducts: ["الإجازات المرضية"],
  transactionVolume: "≈1,400 إجازة شهريًا",
  usageLevel: "مرتفع",
  branches: 10,
  hisName: "نظام المجموعة",
  hisArchitecture: "مركزي",
  integrationStatus: "لا يوجد",
  manualUsage: "الإصدار يتم من المنصة يدويًا",
}]);

const { systemPrompt } = await import("../dist/agent.js");

let failures = 0;
const check = (name, actual, expected) => {
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name} — measured: ${JSON.stringify(actual)}`);
};

const contact = (phone) => ({
  phone, transcript: [], tags: [], statusTimes: {},
  optedOut: false, human: false, test: true, agentTurns: 0,
});

// --- known account -----------------------------------------------------------
const known = systemPrompt(contact("966500000111"));
check("known account: facts are injected", known.includes("ملف الحساب"), true);
check("known account: branch count present", known.includes("عدد الفروع: 10"), true);
check("known account: measured volume present", known.includes("≈1,400 إجازة شهريًا"), true);
check("known account: HIS name present", known.includes("نظام المجموعة"), true);
check("known account: runs the expansion motion", known.includes("الحركة البيعية"), true);
check("known account: told NOT to re-ask known facts", known.includes("لا تسأل العميل أبدًا عن معلومة متاحة"), true);
check("known account: usage-insight strategy enabled", known.includes("التواصل مع الاستخدام المرتفع"), true);

// --- unknown account ---------------------------------------------------------
const cold = systemPrompt(contact("966500000999"));
check("unknown account: no account block", cold.includes("ملف الحساب"), false);
check("unknown account: says so explicitly", cold.includes("لم يتحدد منتج نشط بعد"), true);
check("unknown account: forbidden to claim usage knowledge", cold.includes("أغلب عملائنا يستخدمون خدمة أو أكثر"), true);
// The usage-insight and value-amplification strategies BOTH assert known usage. Neither may be
// offered when there is no account record to assert it from.
check("unknown account: usage-insight strategy withheld", cold.includes("التواصل مع الاستخدام المرتفع"), false);
check("unknown account: value-amplification withheld", cold.includes("التواصل مع الاستخدام المرتفع"), false);

// --- price honesty (both states) ---------------------------------------------
// The founder's own example price must be quotable — it is real, in the product table.
check("real price is available to quote", known.includes("95,000"), true);
// …and the no-invention rule must be present in both states.
for (const [label, p] of [["known", known], ["cold", cold]])
  check(`${label}: forbidden to invent a price or discount`, p.includes("لا تخترع أبدًا") && p.includes("تسعيرًا · خصمًا"), true);

// --- hard guards survived the rewrite ----------------------------------------
// A prompt rewrite is a DELETION event (user-model, round-11): four §8-adjacent guarantees once
// vanished in a rewrite and two failed live in the same round. Pin them.
for (const [label, p] of [["known", known], ["cold", cold]]) {
  check(`${label}: opt-out is never offered by the agent`, p.includes("إيقاف التواصل يبدأ من العميل وحده"), true);
  check(`${label}: AI self-disclosure retained`, p.includes("مساعد آلي"), true);
  check(`${label}: no markdown on WhatsApp`, p.includes("لا تستخدم تنسيق ماركداون"), true);
  check(`${label}: plural professional address retained`, p.includes("بصيغة الجمع المهنية"), true);
  check(`${label}: complaint path to a human retained`, p.includes("request_human_handoff"), true);
}

console.log(`\n${failures ? failures + " FAILURES" : "AE prompt: all green"}`);
if (failures) process.exit(1);
console.log("NOTE: asserts prompt CONTENT, not model behaviour. It cannot prove the model obeys");
console.log("      the strategies — only that the instructions and guards are present.");

// --- the live failure of 2026-08-14 02:09 ------------------------------------
// On his own number, «العرض التجاري» was answered with «تم إشعار المختص بطلب العرض التجاري
// لـ٩٩ فرعًا…» — no price, no next step, no question. That breaks Strategy 9, Strategy 13,
// Rule 6 and Rule 10 at once. Pinned so the dead-end cannot come back.
const commercial = systemPrompt({
  ...contact("966500000999"),
  transcript: [{ role: "customer", text: "العرض التجاري", ts: Date.now() }],
});
let f2 = 0;
const c2 = (name, cond) => { if (!cond) f2++; console.log(`${cond ? "ok  " : "FAIL"} ${name}`); };
c2("commercial ask: bare escalation is banned", commercial.includes("تم إشعار المختص") && commercial.includes("ممنوع"));
c2("commercial ask: must end with the conditional-commitment question",
  commercial.includes("هل فيه نقطة ثانية ممكن توقف البدء؟"));
c2("commercial ask: treated as a buying signal, not support", commercial.includes("طلب الخصم إشارة شراء"));
c2("handoff message must carry scope + next step + question", commercial.includes("حافظ على ملكيتك للمحادثة"));
if (f2) { console.log(`\n${f2} FAILURES (commercial path)`); process.exit(1); }
console.log("commercial dead-end guard: green");

// --- one motion, not two -----------------------------------------------------
// The whole point of the §١-٩ rewrite. The old inbound-qualifier ladder (اشرح ← أهّل ← اكتشف
// and the COLD/INTERESTED/QUALIFIED stage names) competed with the spec's own motion in the
// same prompt, and the live conversation drifted into feature-listing before dead-ending.
// If either comes back, there are two motions again.
let f3 = 0;
const c3 = (name, cond) => { if (!cond) f3++; console.log(`${cond ? "ok  " : "FAIL"} ${name}`); };
for (const [label, p] of [["known", known], ["cold", cold]]) {
  c3(`${label}: old explain→qualify→discover ladder removed`, !p.includes("رحلة البيع — اشرح"));
  c3(`${label}: old COLD/INTERESTED stage names removed`, !p.includes("COLD ← INTERESTED"));
  c3(`${label}: runs the spec's 10 opportunity states`, p.includes("حالة الصفقة"));
  c3(`${label}: internal decision engine is the spec's five steps`, p.includes("ما أفضل إجراء الآن؟"));
  c3(`${label}: discovery gated on changing a sales decision`, p.includes("الاكتشاف ليس قائمة تحقق"));
  c3(`${label}: message design is 1 idea + 1 next step`, p.includes("أجب ← قيمة ← خطوة تالية"));
  c3(`${label}: success metric present`, p.includes("فحص الجودة قبل الإرسال"));
  c3(`${label}: no bullet lists unless asked`, p.includes("أبقِ أغلب الرسائل قصيرة"));
}
c3("known: told to use account facts in speech", known.includes("لا تسأل العميل أبدًا عن معلومة متاحة"));
if (f3) { console.log(`\n${f3} FAILURES (single motion)`); process.exit(1); }
console.log("single-motion guard: green");

// --- founder review 2026-08-16: stop the interview, stop fake actions --------
let f5 = 0;
const c5 = (n, cond) => { if (!cond) f5++; console.log(`${cond ? "ok  " : "FAIL"} ${n}`); };
for (const [label, p] of [["known", known], ["cold", cold]]) {
  c5(`${label}: answer → value → one question, question-stacking banned`,
    p.includes("أجب ← قيمة ← خطوة تالية") && p.includes("وليس: سؤال ← سؤال ← سؤال ← سؤال"));
  c5(`${label}: a question must earn its place`, p.includes("هل السؤال ضروري فعلًا؟"));
  c5(`${label}: integration answer must name the real phases`, p.includes("البيئة التجريبية"));
  c5(`${label}: must not re-recite known facts`, p.includes("لا تُعِد سرد"));
  c5(`${label}: no meeting before value is earned`, p.includes("لا تدفع نحو اجتماع"));
  c5(`${label}: customer must not design our commercial model`, p.includes("يصمّم نموذجك التجاري"));
  c5(`${label}: price qualifier comes AFTER understanding`, p.includes("هل فيه نقطة ثانية ممكن توقف البدء؟"));
  c5(`${label}: fake actions banned`, p.includes("ممنوع ادّعاء أفعال لم تحدث"));
  c5(`${label}: product lock section present`, p.includes("قفل المنتج"));
}
if (f5) { console.log(`\n${f5} FAILURES (founder review)`); process.exit(1); }
console.log("founder-review rules: green");

// --- price cannot cross products; scope questions come first -----------------
// The prompt-level lock stopped the wrong FILE but left every other product's PRICING in context.
// A model cannot quote a price it was never given, so the knowledge block is narrowed too.
process.env.ACCOUNTS_JSON = "[]";
const nvrConvo = {
  phone: "966500000777", tags: [], statusTimes: {},
  optedOut: false, human: false, test: true, agentTurns: 0,
  transcript: [
    { role: "agent", text: "بخصوص سجل التطعيمات الوطني", ts: 1 },
    { role: "customer", text: "تفاصيل التكامل", ts: 2 },
  ],
};
const locked = systemPrompt(nvrConvo);
let f6 = 0;
const c6 = (n, cond) => { if (!cond) f6++; console.log(`${cond ? "ok  " : "FAIL"} ${n}`); };
c6("locked convo names its product", locked.includes("المنتج النشط: «خدمات التطعيمات»"));
// THE regression: Sick Leave's 18,000 / 95,000 must not be in context at all.
c6("Sick Leave pricing is absent from a locked NVR prompt", !locked.includes("95,000") && !locked.includes("18,000"));
c6("Sick Leave features are absent too", !locked.includes("يقلّل زمن إصدار الإجازة"));
c6("the locked product's own knowledge IS present", locked.includes("خدمات التطعيمات"));
// NEGATIVE CONTROL — with no lock, the full catalogue must still be available.
c6("unlocked prompt still carries the full catalogue (control)", cold.includes("95,000") && cold.includes("فحص الموظفين"));
// Question order.
for (const [label, p] of [["known", known], ["cold", cold]]) {
  c6(`${label}: branches asked before the HIS vendor name`, p.includes("هل على نفس بيئة الـHIS؟"));
  c6(`${label}: shared environment → central integration is explained`, p.includes("هل الربط مركزي؟"));
}
if (f6) { console.log(`\n${f6} FAILURES (price scoping / question order)`); process.exit(1); }
console.log("price scoping + question order: green");

// --- measured on his thread 09:12→09:13 --------------------------------------
let f7 = 0;
const c7 = (n, cond) => { if (!cond) f7++; console.log(`${cond ? "ok  " : "FAIL"} ${n}`); };
for (const [label, p] of [["known", known], ["cold", cold]]) {
  c7(`${label}: scope questions are asked together, not across turns`,
    p.includes("اسأل سؤالًا واحدًا ذا معنى في كل مرة"));
}
if (f7) { console.log(`\n${f7} FAILURES (turn economy)`); process.exit(1); }
console.log("turn economy: green");

// --- founder review, second pass 2026-08-16 ----------------------------------
let f8 = 0;
const c8 = (n, cond) => { if (!cond) f8++; console.log(`${cond ? "ok  " : "FAIL"} ${n}`); };
for (const [label, p] of [["known", known], ["cold", cold]]) {
  c8(`${label}: governing behavioural rule present`, p.includes("لا تبدُ أبدًا وكأنك تنفّذ عملية بيع"));
  c8(`${label}: CRM vocabulary banned by name`, p.includes("تم تأهيل الفرصة") && p.includes("ممنوع أن يسمع العميل لغة الـCRM"));
  c8(`${label}: inventing deal state banned`, p.includes("لا تفترض حالة الصفقة"));
  c8(`${label}: ask-vs-assert distinction taught`, p.includes("يضع كلامًا في فم عميله"));
  c8(`${label}: acknowledge→why→value→direction pattern`, p.includes("اعترف ← اشرح لماذا هذا مهم لهم ← عزّز القيمة"));
  c8(`${label}: the worked example is present`, p.includes("هذا يسهّل الربط بشكل كبير"));
  c8(`${label}: natural-not-report voice taught`, p.includes("اكتب كما يتكلم مدير حساب سعودي، لا كما يُكتب تقرير"));
  c8(`${label}: passive/nominal style called out`, p.includes("تجنّب المبني للمجهول"));
}
if (f8) { console.log(`\n${f8} FAILURES (voice)`); process.exit(1); }
console.log("voice rules: green");
