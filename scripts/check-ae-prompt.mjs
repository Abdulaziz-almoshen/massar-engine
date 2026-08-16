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
check("known account: runs the expansion motion", known.includes("التوسّع المدفوع بالاستخدام"), true);
check("known account: told NOT to re-ask known facts", known.includes("لا تسأل عنها"), true);
check("known account: usage-insight strategy enabled", known.includes("رؤية الاستخدام"), true);

// --- unknown account ---------------------------------------------------------
const cold = systemPrompt(contact("966500000999"));
check("unknown account: no account block", cold.includes("ملف الحساب"), false);
check("unknown account: says so explicitly", cold.includes("غير مسجّلة كحساب قائم"), true);
check("unknown account: forbidden to claim usage knowledge", cold.includes("لا تدّعِ معرفة باستخدامهم"), true);
// The usage-insight and value-amplification strategies BOTH assert known usage. Neither may be
// offered when there is no account record to assert it from.
check("unknown account: usage-insight strategy withheld", cold.includes("رؤية الاستخدام"), false);
check("unknown account: value-amplification withheld", cold.includes("تضخيم القيمة بالحجم"), false);

// --- price honesty (both states) ---------------------------------------------
// The founder's own example price must be quotable — it is real, in the product table.
check("real price is available to quote", known.includes("95,000"), true);
// …and the no-invention rule must be present in both states.
for (const [label, p] of [["known", known], ["cold", cold]])
  check(`${label}: forbidden to invent a price or discount`, p.includes("ولا نسبة خصم من عندك"), true);

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
  commercial.includes("هل فيه أي شيء ثاني ممكن يوقف البدء بالتكامل؟"));
c2("commercial ask: treated as a buying signal, not support", commercial.includes("إشارة شراء، لا حالة دعم"));
c2("handoff message must carry scope + next step + question", commercial.includes("تبقى مالك المحادثة بعد الإحالة"));
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
  c3(`${label}: runs the spec's 10 opportunity states`, p.includes("موضع الفرصة"));
  c3(`${label}: internal decision engine is the spec's five steps`, p.includes("المجهول الواحد الأهم"));
  c3(`${label}: discovery gated on changing a sales decision`, p.includes("الاكتشاف — بشرط واحد"));
  c3(`${label}: message design is 1 idea + 1 next step`, p.includes("فكرة مفيدة واحدة + خطوة تالية واحدة"));
  c3(`${label}: success metric present`, p.includes("معيار النجاح لكل رد"));
  c3(`${label}: no bullet lists unless asked`, p.includes("لا تستخدم النقاط والقوائم إلا"));
}
c3("known: told to use account facts in speech", known.includes("لا تسأل عنه ولا تطلب تأكيده"));
if (f3) { console.log(`\n${f3} FAILURES (single motion)`); process.exit(1); }
console.log("single-motion guard: green");

// --- founder review 2026-08-16: stop the interview, stop fake actions --------
let f5 = 0;
const c5 = (n, cond) => { if (!cond) f5++; console.log(`${cond ? "ok  " : "FAIL"} ${n}`); };
for (const [label, p] of [["known", known], ["cold", cold]]) {
  c5(`${label}: answer → value → one question, question-stacking banned`,
    p.includes("أجب ← أضف قيمة ذات صلة") && p.includes("وممنوع نمط: سؤال ← سؤال ← سؤال"));
  c5(`${label}: a question must earn its place`, p.includes("قبل أن تسأل أي سؤال، تحقق"));
  c5(`${label}: integration answer must name the real phases`, p.includes("بيئة الاختبار"));
  c5(`${label}: must not re-recite known facts`, p.includes("لا تكرّر ما تعرفه في كل رسالة"));
  c5(`${label}: no meeting before value is earned`, p.includes("لا تعرض موعدًا أو مكالمة قبل"));
  c5(`${label}: customer must not design our commercial model`, p.includes("يصمّم نموذجك التجاري"));
  c5(`${label}: price qualifier comes AFTER understanding`, p.includes("لا قبل ذلك"));
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
c6("locked convo names its product", locked.includes("هذه المحادثة عن «خدمات التطعيمات»"));
// THE regression: Sick Leave's 18,000 / 95,000 must not be in context at all.
c6("Sick Leave pricing is absent from a locked NVR prompt", !locked.includes("95,000") && !locked.includes("18,000"));
c6("Sick Leave features are absent too", !locked.includes("يقلّل زمن إصدار الإجازة"));
c6("the locked product's own knowledge IS present", locked.includes("خدمات التطعيمات"));
// NEGATIVE CONTROL — with no lock, the full catalogue must still be available.
c6("unlocked prompt still carries the full catalogue (control)", cold.includes("95,000") && cold.includes("فحص الموظفين"));
// Question order.
for (const [label, p] of [["known", known], ["cold", cold]]) {
  c6(`${label}: branches asked before the HIS vendor name`, p.includes("اسم نظام الـHIS يأتي لاحقًا"));
  c6(`${label}: shared environment → central integration is explained`, p.includes("ربطًا مركزيًا واحدًا"));
}
if (f6) { console.log(`\n${f6} FAILURES (price scoping / question order)`); process.exit(1); }
console.log("price scoping + question order: green");
