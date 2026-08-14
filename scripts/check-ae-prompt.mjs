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
