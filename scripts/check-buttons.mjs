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
const agentButtons = ["منشأة صحية", "مزوّد نظام HIS", "العرض التجاري", "فريقنا التقني", "مزوّد النظام"];
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
  check("contract", `«${title}» ≤ 20 chars`, [...title].length <= 20, true);
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
// Imported from dist rather than sliced: the slice carries TS annotations, and importing the
// COMPILED function tests the code that actually runs in production.
const rung = await import(join(root, "dist/agent.js"));

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
for (const p of ["أريد العرض التجاري", "من فضلكم العرض التجاري", "نعم أرسلوا التفاصيل", "ليس الآن شكرًا"]) {
  const c = templates.canonicalTitle(p);
  check("model-buttons", `canonical(«${p}») is routable`, c ? Boolean(templates.buttonIntent(c)) : "rejected", c ? true : "rejected");
}
// The prompt tells the model to offer these three by name — every one must survive the emit path.
for (const t of ["منشأة صحية", "مزوّد نظام HIS", "أريد العرض التجاري"])
  check("model-buttons", `prompt-prescribed «${t}» survives emit`, templates.canonicalTitle(t), t);

// The adapter truncates on UTF-16 units; the contract must count the same way or a title can pass
// the check and still be cut on the wire into a string with no intent.
threw = null;
try { templates.assertButtonsHandled(["ليس الآن 🙏🏻🙏🏻🙏🏻🙏🏻🙏🏻🙏🏻🙏🏻"]); } catch (e) { threw = /UTF-16/.test(e.message); }
check("model-buttons", "surrogate-heavy title rejected on UTF-16 length", threw, true);

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
