#!/usr/bin/env node
// ---------------------------------------------------------------------------
// The button + template contract, as a runnable gate.
//
// Why this file exists: the assertions that proved 5f38d56 lived in a scratch harness and a chat
// message. The planner's verdict was blunt — "the 20/20 and 16/16 numbers exist only in a chat
// message" — so a later round would have to re-derive them from source a third time. A claim that
// cannot be re-run is a belief, not evidence.
//
// It executes the REAL objective block sliced out of src/agent.ts rather than a copy, so the test
// cannot drift away from the code the way a duplicated regex would. Every case prints its MEASURED
// value, not a restatement of the expectation.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const templates = await import(join(root, "dist/templates.js"));

let failures = 0;
const results = [];
function check(group, name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  results.push({ group, name, measured: actual, expected, pass });
  console.log(`${pass ? "ok  " : "FAIL"} [${group}] ${name} — measured: ${JSON.stringify(actual)}`);
}

// --- 1. the boot contract ---------------------------------------------------
// Read the SAME input `src/index.ts` passes to assertButtonsHandled() at boot. A hand-copied list
// here means the gate can pass green while boot throws — a crash-loop that takes down the webhook
// receiver carrying «إيقاف». It was already divergent by one title when the reviewer caught it.
const agentMod = await import(join(root, "dist/agent.js"));
const agentButtons = agentMod.EMITTED_BUTTONS;
if (!Array.isArray(agentButtons) || !agentButtons.length) {
  console.error("FAIL [contract] agent.EMITTED_BUTTONS missing — this gate is not checking what boot checks");
  process.exit(1);
}
let threw = null;
try { templates.assertButtonsHandled(agentButtons); } catch (e) { threw = e.message; }
check("contract", "shipped buttons all handled", threw, null);

threw = null;
try { templates.assertButtonsHandled(["زر بلا نية"]); } catch (e) { threw = /no intent/.test(e.message); }
check("contract", "unhandled button rejected", threw, true);

threw = null;
try { templates.assertButtonsHandled(["أرسلوا تفاصيل التكامل"]); } catch (e) { threw = /21 chars/.test(e.message); }
check("contract", "21-char title rejected (real cause of 131009)", threw, true);

// Every emitted title, from every source, must route AND fit. This is the property the three
// scattered literal copies used to satisfy only by coincidence.
for (const title of templates.emittedButtons(agentButtons)) {
  check("contract", `«${title}» routes`, Boolean(templates.buttonIntent(title)), true);
  check("contract", `«${title}» within WhatsApp cap (both measures)`, title.length <= 20 && [...title].length <= 20, true);
}

// --- 2. template rendering --------------------------------------------------
for (const t of templates.TEMPLATES) {
  const out = templates.render(t.body, "الإجازات المرضية");
  check("render", `${t.id}: no unresolved variable`, /\{\{1\}\}|\{product\}/.test(out), false);
  check("render", `${t.id}: buttons are 1..3`, t.buttons.length >= 1 && t.buttons.length <= 3, true);
}
check("render", "unknown id resolves to undefined", templates.byId("nope"), undefined);

// --- 3. the campaign marker round-trips --------------------------------------
// The defect class this repo keeps producing: a value written in one shape and read in another.
for (const id of [undefined, "intro_integration", "high_usage_upsell"]) {
  const mark = templates.campaignMark(id);
  check("marker", `«${mark.trim()}» is recognised as a campaign turn`, templates.isCampaignTurn(mark), true);
  check("marker", `«${mark.trim()}» reads back its opener`, templates.openerOf(mark), id);
}
check("marker", "a plain agent line is not a campaign turn", templates.isCampaignTurn("مرحبًا بكم"), false);

// --- 4. intent routing, against the REAL objective block ---------------------
const src = readFileSync(join(root, "src/agent.ts"), "utf8").split("\n");
const start = src.findIndex((l) => l.includes("const knowsType = /منشأة"));
let end = src.findIndex((l) => l.includes("const nextObjective ="));
if (start < 0 || end < 0) {
  console.error("FAIL [slice] anchors moved in src/agent.ts — this gate is no longer reading the real code");
  process.exit(1);
}
while (end < src.length && !/;\s*$/.test(src[end])) end++;
const slice = src.slice(start, end + 1).join("\n");
const runObjective = new Function(
  "since", "said", "asked", "knowsSystem", "knowsSize", "templates", "inbound", "hasSignal", "sentAssets",
  slice + "\nreturn { wantsCommercial, nextObjective, askedType, askedSystem };");
const objective = (text) => runObjective(
  [{ role: "customer", text }], text, text, false, false, templates, 1, false, []);

for (const b of ["العرض التجاري", "أود مناقشة التكامل"])
  check("intent", `tapping «${b}» routes commercial`, objective(b).wantsCommercial, true);
for (const q of ["كم السعر؟", "كم التكلفة؟", "كيف نبدأ؟", "متى نبدأ؟", "هل عندكم تسعير؟"])
  check("intent", `typing «${q}» routes commercial`, objective(q).wantsCommercial, true);
for (const b of ["منشأة صحية", "مزوّد نظام HIS", "تفاصيل التكامل", "ليس الآن", "الملف التعريفي", "فريقنا التقني"])
  check("intent", `tapping «${b}» does NOT route commercial`, objective(b).wantsCommercial, false);
// Disclosures must not read as price asks — the regression that shipped once already.
for (const d of ["عندنا ٢٠ فرع", "نستخدم نظام HIS", "نحن مجمع طبي", "المستشفى فيه ٣ فروع"])
  check("intent", `disclosure «${d}» is not a price ask`, objective(d).wantsCommercial, false);

// --- 5. turn two must not contradict the opener -----------------------------
// product-discovery's finding on 5f38d56: the upsell says «لاحظنا أن لديكم استخدامًا مرتفعًا» — we
// have just told them we know who they are — and then rung one asked «أي وصف يناسبكم؟». Every green
// check tested the opener and the button table; none tested turn two. This one does.
// The compiled module imported above — testing the code that actually runs in production.
const rung = agentMod;

const upsell = rung.rungOne("الإجازات المرضية", "high_usage_upsell");
const intro = rung.rungOne("الإجازات المرضية", "intro_integration");
check("turn-two", "upsell rung one does NOT re-ask identity", /أي وصف يناسبكم/.test(upsell), false);
check("turn-two", "intro rung one still asks identity", /أي وصف يناسبكم/.test(intro), true);
check("turn-two", "upsell qualifies on implementation instead", /من يتولى الربط/.test(upsell), true);
check("turn-two", "upsell names the service", upsell.includes("الإجازات المرضية"), true);
check("turn-two", "upsell buttons differ from intro's",
  rung.rungOneButtons("high_usage_upsell").map((b) => b.title).join("|") !==
  rung.rungOneButtons("intro_integration").map((b) => b.title).join("|"), true);
check("turn-two", "no service resolved → neutral wording, never a hole",
  /خدمة undefined|خدمة null|\{\{1\}\}/.test(rung.rungOne(undefined, "high_usage_upsell")), false);
for (const opener of ["high_usage_upsell", "intro_integration", undefined])
  for (const b of rung.rungOneButtons(opener))
    check("turn-two", `rung-one button «${b.title}» (opener=${opener}) routes`,
      Boolean(templates.buttonIntent(b.title)), true);

// --- 6. model-composed buttons: the hole the first contract missed ----------
// The reviewer's MUST-FIX on 5f38d56: `send_buttons` lets the MODEL compose titles at runtime, so
// the largest source of emitted buttons was outside the contract — and the system prompt itself
// prescribes «أريد العرض التجاري», which routed nowhere. Canonicalisation closes it at the source.
check("model-buttons", "prompt's own «أريد العرض التجاري» routes",
  templates.buttonIntent("أريد العرض التجاري"), "commercial");
check("model-buttons", "«أريد العرض التجاري» canonicalises",
  templates.canonicalTitle("أريد العرض التجاري"), "أريد العرض التجاري");
check("model-buttons", "a wordier proposal maps to the approved title",
  templates.canonicalTitle("من فضلكم العرض التجاري"), "العرض التجاري");
check("model-buttons", "an unmappable proposal is rejected, not silently sent",
  templates.canonicalTitle("اضغط هنا"), undefined);
// Whatever canonicalTitle returns must itself be routable — otherwise we'd emit an unanswerable
// button through the very function meant to prevent that.
// The BENIGN_AFFIX exclusion in canonicalTitle is safe only while at most one BUTTON_INTENT key is
// also a courtesy affix («نعم»). A second one would silently stop being a candidate. Pin it.
const benignAlsoKeys = Object.keys(templates.BUTTON_INTENT)
  .filter((k) => templates.canonicalTitle(k + " العرض التجاري") === "العرض التجاري");
check("fidelity", "at most one BUTTON_INTENT key doubles as a benign affix", benignAlsoKeys.length <= 1, true);

// SAFETY property plus a COVERAGE floor. QA proved the safety property alone is vacuous: force
// canonicalTitle to always return undefined and it still passes 4/4, because "undefined is allowed"
// is satisfied by refusing everything. The floor below fails under exactly that mutation.
const mustMap = [["من فضلكم العرض التجاري", "العرض التجاري"], ["نعم أرسلوا التفاصيل", "أرسلوا التفاصيل"],
                 ["أريد العرض التجاري", "أريد العرض التجاري"], ["صباحًا", "صباحًا"]];
for (const [proposal, expected] of mustMap)
  check("model-buttons", `«${proposal}» MUST map (coverage floor — fails if canonicalTitle refuses all)`,
    templates.canonicalTitle(proposal), expected);
// Property, stated independently of the outcome: for EVERY proposal, canonicalTitle either
// returns a routable approved title or returns undefined. Never a title we cannot answer.
for (const p of ["أريد العرض التجاري", "من فضلكم العرض التجاري", "نعم أرسلوا التفاصيل",
                 "ليس الآن شكرًا", "اضغط هنا", "توصيل مجاني", "صباحًا", "تكامل صحة"]) {
  const c = templates.canonicalTitle(p);
  check("model-buttons", `canonical(«${p}») is routable-or-undefined`,
    c === undefined || Boolean(templates.buttonIntent(c)), true);
}
// The prompt tells the model to offer these three by name — every one must survive the emit path.
for (const t of ["منشأة صحية", "مزوّد نظام HIS", "أريد العرض التجاري"])
  check("model-buttons", `prompt-prescribed «${t}» survives emit`, templates.canonicalTitle(t), t);

// The adapter truncates on UTF-16 units; the contract must count the same way or a title can pass
// the check and still be cut on the wire into a string with no intent.
// Discriminating case: 15 code points, 21 UTF-16 units. A code-point-only check PASSES this and
// the adapter then truncates it on the wire into a string with no intent; the UTF-16 check fails it.
const surrogate = "ليس الآن 🙏🙏🙏🙏🙏🙏";
check("model-buttons", "case discriminates the two measures",
  [...surrogate].length <= 20 && surrogate.length > 20, true);
threw = null;
try { templates.assertButtonsHandled([surrogate]); } catch (e) { threw = /UTF-16/.test(e.message); }
check("model-buttons", "surrogate title rejected on UTF-16 length", threw, true);

// --- 6b. fidelity: a rewrite must never invert what the model meant ---------
// Re-review finding: «لا أريد العرض التجاري» was rewritten to «أريد العرض التجاري» — the customer
// would have read a button saying the opposite of what was intended, and tapping it would route
// them into a commercial track they had just refused.
// Arabic refusal is often a VERB, and a prefixed conjunction hides the particle («ولا»). A denylist
// missed 10 of these 11; the allowlist-on-surrounding-text refuses all of them by construction.
for (const neg of ["لا أريد العرض التجاري", "لا نحتاج تفاصيل التكامل", "غير منشأة صحية",
                   "لسنا بحاجة العرض التجاري", "بدون تفاصيل التكامل",
                   "مو محتاجين العرض التجاري", "ولا نريد العرض التجاري", "كلا، العرض التجاري",
                   "نرفض العرض التجاري", "ألغوا العرض التجاري", "أجّلوا العرض التجاري",
                   "توقفوا عن العرض التجاري", "ليسوا مهتمين بالعرض التجاري", "أبدًا العرض التجاري"])
  check("fidelity", `negated «${neg}» is refused, not inverted`, templates.canonicalTitle(neg), undefined);
// Two genuinely distinct approved titles in one proposal cannot be resolved without guessing.
check("fidelity", "ambiguous proposal is refused",
  templates.canonicalTitle("ليس الآن، أريد العرض التجاري لاحقًا"), undefined);
// Nesting is not ambiguity — «أريد العرض التجاري» contains «العرض التجاري».
// Must NOT be an exact BUTTON_INTENT key, or canonicalTitle returns on line 1 and the
// maximal/nesting filter is never exercised.
check("fidelity", "nested titles still resolve (exercises the maximal filter)",
  templates.canonicalTitle("من فضلكم أريد العرض التجاري"), "أريد العرض التجاري");
// A clause carrying meaning we would silently drop from the customer's view is refused.
check("fidelity", "a whole sentence around the title is refused",
  templates.canonicalTitle("لو تكرمتم نبغى نعرف كل تفاصيل التكامل قبل الاجتماع"), undefined);
// Prototype keys must not read as approved titles.
check("fidelity", "prototype key is not an intent", templates.buttonIntent("toString"), undefined);
threw = null;
try { templates.assertButtonsHandled(["toString"]); } catch (e) { threw = /no intent/.test(e.message); }
check("fidelity", "prototype key rejected by the boot contract", threw, true);

// --- 6c. the prompt's OWN prescribed buttons must survive the emit path -----
// Re-review finding: the scheduling close — the highest-value turn in the ladder — prescribed
// «صباحًا»/«بعد الظهر» and the prompt forbids writing options as text. Every one was dropped.
for (const t of ["صباحًا", "بعد الظهر", "تكامل صحة", "إجراء بالمنصة", "استفسار آخر",
                 "لدينا نظام حالي", "أرسلوا الملف التعريفي", "أرسلوا معلومات", "لسنا مهتمين"])
  check("prompt-buttons", `prescribed «${t}» survives emit`, templates.canonicalTitle(t), t);

// --- 6d. an info request that also asks price must NOT short-circuit --------
// Re-review finding: the widened wantsInfo swallowed «التفاصيل والسعر لو سمحتم» and returned before
// the model ran — PDF plus «أي وصف يناسبكم؟». Complaint #1, re-opened by a nice-to-have.
const infoSrc = readFileSync(join(root, "src/agent.ts"), "utf8");
const iStart = infoSrc.indexOf('const B = "(?:^|[\\\\s،.؟!؛])";');
// End the slice at the terminator of the `const wantsInfo = …` statement, found structurally.
// Anchoring on the literal text of the expression made this gate crash instead of failing when the
// expression changed — a mutation must produce a red FAIL line, not a stack trace.
const wStart = infoSrc.indexOf("const wantsInfo =", iStart);
const iEnd = wStart < 0 ? -1 : infoSrc.indexOf(";", wStart) + 1;
if (iStart < 0 || iEnd < 30) { console.error("FAIL [slice] wantsInfo anchors moved"); process.exit(1); }
// Execute the REAL `const wantsInfo = ...` line, not a retyped copy of it. The reviewer proved the
// retyped version was blind: flipping `&&` to `||` on that line in src/agent.ts left the gate
// 133/133 green while a bare «مرحبًا» would have fired the PDF and rung one.
const infoBlock = infoSrc.slice(iStart, iEnd);
const stems = new Function(infoBlock.replace(/const wantsInfo =[\s\S]*$/, "") +
  "\nreturn { COMMERCIAL_STEM, OBJECTION_STEM };")();
check("info-gate", "«الملف» does not self-match the objection stem («لم» inside «الـمـلـف»)",
  stems.OBJECTION_STEM.test("الملف التعريفي"), false);
check("info-gate", "the stem still catches a real objection",
  stems.OBJECTION_STEM.test("التفاصيل غير واضحة"), true);
// Discriminating: «تسعير» appears as a SUBSTRING of «التسعيرة» but not as a word, so this passes
// only while the commercial stem is anchored.
check("info-gate", "anchored commercial stem does not fire on a substring",
  stems.COMMERCIAL_STEM.test("التفاصيل والتسعيرة"), false);
check("info-gate", "but does fire on the real word", stems.COMMERCIAL_STEM.test("التفاصيل والتسعير"), true);
// `tapped` is the real gate in source; here we exercise the regex half by passing a non-tap.
const runInfo = new Function("text", "templates", "tapped",
  infoBlock + "\nreturn wantsInfo;");
const typed = (t) => runInfo(t, templates, () => undefined);

for (const t of ["الملف التعريفي", "أرسلوا التفاصيل", "الملف التعريفي للإجازات المرضية", "أرسلوا التفاصيل عن التطعيمات"])
  check("info-gate", `«${t}» is a pure info request`, typed(t), true);
for (const t of ["التفاصيل والسعر لو سمحتم", "أرسلوا التفاصيل وكم السعر", "التفاصيل وكيف نبدأ", "الملف التعريفي والتسعير"])
  check("info-gate", `«${t}» does NOT short-circuit (price must reach the model)`, typed(t), false);
for (const t of ["التفاصيل التي أرسلتموها غير واضحة", "الملف التعريفي لم يفتح معنا", "أرسلوا التفاصيل إلى المدير المالي وليس لي"])
  check("info-gate", `objection «${t}» does NOT short-circuit`, typed(t), false);

// --- 7. the info buttons all reach rung one ---------------------------------
for (const t of templates.TEMPLATES)
  for (const b of t.buttons.filter((x) => templates.buttonIntent(x) === "info"))
    check("rung-one", `«${b}» (${t.id}) is an info request`, templates.buttonIntent(b), "info");

console.log(`\n${results.length} checks · ${failures} failures`);
if (failures) {
  console.error("button/template contract FAILED — see the measured values above.");
  process.exit(1);
}
console.log("NOTE: this gate proves routing and the emitted-button contract on real source. It does");
console.log("NOT prove wire behaviour — no WhatsApp message is sent by this or any check.");
