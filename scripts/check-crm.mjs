// check-crm.mjs — the campaigns-crm gate.
//
// WHY IT EXISTS. dashboard.ts's client script is a string inside a template literal, so `tsc` and
// `node --check` both pass on code that cannot run. ADR-0001 was written after exactly that shipped
// a blank page. This gate parses the EMITTED client script and asserts the properties the cycle
// claims, so none of them rests on a reviewer's word.
//
// It reports its own coverage rather than asserting a universal (user-model Rule 7): a check that
// cannot state what would make it fail is not evidence.

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const { DASHBOARD_HTML } = await import("../dist/dashboard.js");

const fails = [];
const passes = [];
function assert(name, cond, detail) {
  if (cond) passes.push(name);
  else fails.push(name + (detail ? " — " + detail : ""));
}

// ---- 1. the script block must exist and must actually parse ----
const m = DASHBOARD_HTML.match(/<script>([\s\S]*)<\/script>/);
assert("script block present", !!m);
const js = m ? m[1] : "";
if (js) {
  const tmp = "/tmp/massar-crm-client-check.js";
  writeFileSync(tmp, js);
  let parsed = true, err = "";
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); }
  catch (e) { parsed = false; err = String(e.stderr || e).split("\n").slice(0, 3).join(" "); }
  assert("emitted client script parses", parsed, err);
}

const { CAMPAIGNS_CRM_JS } = await import("../dist/campaigns-crm.js");
const crmBlock = CAMPAIGNS_CRM_JS;
assert("campaigns-crm module is non-empty", crmBlock.length > 0);
assert("the emitted script contains the module verbatim", js.includes(CAMPAIGNS_CRM_JS),
  "interpolation altered or truncated the module");

// ---- 2. the seam is wired: views, guard, styles ----
assert("vKmonCrm defined", /function vKmonCrm\s*\(/.test(js));
assert("vKmonDetailCrm defined", /function vKmonDetailCrm\s*\(/.test(js));
assert("guarded entry defined", /function crmCampaignsHtml\s*\(/.test(js));
assert("render dispatches through the guard", /crmCampaignsHtml\(campId\)/.test(js));
assert("fallback views still present", /function vKmon\s*\(/.test(js) && /function vKmonDetail\s*\(/.test(js));
assert("bulk bar styles injected", DASHBOARD_HTML.includes(".bulkbar"));

// ---- 3. state labels come from ONE function ----
// The row chip and the board column must never disagree, so campPerfState is the only place the
// three labels may be written. A label appearing outside it is the drift this asserts against.
assert("campPerfState defined", /function campPerfState\s*\(/.test(js));
// The labels moved OUT of campPerfState's body into a single CRM_PERF table, which is stronger:
// the kanban seeds its columns from the same table, so a rename cannot desync board and chip.
const perfTable = (js.match(/var CRM_PERF = \[[\s\S]*?\n\];/) || [""])[0];
assert("CRM_PERF table defined", perfTable.length > 0);
for (const label of ["تجريبية", "بلا جمهور", "لم تُرسل بعد", "فيها ردود", "بلا ردود بعد"]) {
  assert("CRM_PERF owns label " + label, perfTable.includes(label));
}
assert("campPerfState selects from the table rather than writing labels",
  !/label:\s*"/.test((js.match(/function campPerfState[\s\S]*?\n\}/) || [""])[0]));

// ---- 4. the retired lifecycle claim is gone from the CAMPAIGN surface ----
// Scoped, not counted. The first version asserted «مكتملة» appeared exactly ONCE in the whole
// script and that the survivor was the service-readiness card — which assumed I could enumerate
// every future legitimate use of a common Arabic word. It went red the moment another module
// shipped «الحقول الأساسية مكتملة» on the contact record, a correct use. What actually matters is
// that no CAMPAIGN state label says it, so that is what is measured: the campaigns-crm module and
// the campaign row/chip path in dashboard.ts.
const campaignSurfaces = crmBlock + "\n" + (js.match(/function vKmon\b[\s\S]*?\n\}/) || [""])[0]
  + "\n" + (js.match(/function vKmonDetail\b[\s\S]*?\n\}/) || [""])[0];
const retiredOnCampaign = [...campaignSurfaces.matchAll(/مكتملة/g)];
assert("the retired lifecycle label «مكتملة» appears on no campaign surface",
  retiredOnCampaign.length === 0,
  retiredOnCampaign.length + " occurrence(s) inside campaigns-crm / vKmon / vKmonDetail");
// and campPerfState remains the only emitter of the three campaign state labels
assert("campaign state labels have exactly one source",
  (crmBlock.match(/"فيها ردود"/g) || []).length === 1 &&
  (crmBlock.match(/"بلا ردود بعد"/g) || []).length === 1,
  "a state label is written outside the CRM_PERF table");

// ---- 5. no invented denominator ----
// The zero-target rate must be unknown, not 0%. Both the old and new paths are asserted.
assert("no Math.max(1, targeted) denominator remains", !/Math\.max\(1,\s*st\.targeted\)/.test(js));
assert("crmRate returns null on a zero denominator", /function crmRate\([^)]*\)\s*\{\s*return b \?/.test(js));

// ---- 6. NO SEND. The hard one. ----
// Every fetch in the campaigns-crm block must go to /admin/campaign/test. Any other endpoint, and
// above all any Gupshup/message path, fails the build.
// The region is the MODULE ITSELF, not a comment-delimited slice of the emitted string. A review
// mutation-tested the previous version and got two passes it should have failed: a rogue fetch
// placed one line BELOW the end marker (exactly where the next handler naturally lands), and a
// sendBeacon INSIDE the block. Importing the source removes the boundary entirely, and asserting
// the emitted script still contains it verbatim proves the interpolation landed whole.
const fetches = [...crmBlock.matchAll(/fetch\(\s*("[^"]*"|'[^']*')/g)].map((x) => x[1].replace(/['"]/g, ""));
assert("campaigns-crm calls only the reclassify endpoint",
  fetches.every((u) => u === "/admin/campaign/test"),
  "found: " + JSON.stringify(fetches));
// A non-literal fetch argument defeats the allow-list above (fetch("/gup"+"shup/send")), so any
// dynamic fetch is refused outright rather than inspected.
const dynamicFetch = [...crmBlock.matchAll(/fetch\(\s*(?!["'])/g)].length;
assert("campaigns-crm has no dynamically-constructed fetch URL", dynamicFetch === 0,
  dynamicFetch + " non-literal fetch call(s)");
// fetch is not the only way to reach the network. Each of these would have carried a payload out
// while the allow-list above stayed green.
const EXFIL = /sendBeacon|XMLHttpRequest|EventSource|WebSocket|\bimport\s*\(|navigator\.send|<form|formAction/i;
assert("campaigns-crm uses no network primitive other than fetch", !EXFIL.test(crmBlock),
  "matched: " + (crmBlock.match(EXFIL) || [""])[0]);
assert("campaigns-crm contains no outbound message path",
  !/gupshup|\/send|sendMessage|outbound|campaign\/launch/i.test(crmBlock));

// ---- report, including what this gate does NOT cover ----
console.log("[check:crm] " + passes.length + " passed, " + fails.length + " failed");
for (const f of fails) console.log("  FAIL " + f);
console.log("  coverage: parses the emitted client script and asserts seam wiring, label ownership,");
console.log("  denominator handling and the fetch allow-list. It does NOT execute the views — a");
console.log("  runtime fault inside a view is caught by crmBoot() + smoke.py, not by this gate.");
console.log("  fetch calls inspected in the campaigns-crm block: " + fetches.length);

process.exit(fails.length ? 1 : 0);
