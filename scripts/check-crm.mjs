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
const perfBody = (js.match(/function campPerfState[\s\S]*?\n\}/) || [""])[0];
for (const label of ["تجريبية", "فيها ردود", "بلا ردود بعد"]) {
  assert("campPerfState owns label " + label, perfBody.includes(label));
}

// ---- 4. the retired lifecycle claim is gone from the campaigns surface ----
// One occurrence is legitimate and expected: the service-readiness card («N من M مكتملة»), which is
// a count of completed KB docs, not a campaign state. Assert the count AND that the survivor is it.
const completedHits = [...js.matchAll(/مكتملة/g)].map((x) => js.slice(Math.max(0, x.index - 80), x.index + 12));
assert("retired campaign label «مكتملة» does not survive on a campaign surface",
  completedHits.length === 1 && /جاهزية الخدمة|rows\.length/.test(completedHits[0]),
  completedHits.length + " occurrence(s): " + JSON.stringify(completedHits));

// ---- 5. no invented denominator ----
// The zero-target rate must be unknown, not 0%. Both the old and new paths are asserted.
assert("no Math.max(1, targeted) denominator remains", !/Math\.max\(1,\s*st\.targeted\)/.test(js));
assert("crmRate returns null on a zero denominator", /function crmRate\([^)]*\)\s*\{\s*return b \?/.test(js));

// ---- 6. NO SEND. The hard one. ----
// Every fetch in the campaigns-crm block must go to /admin/campaign/test. Any other endpoint, and
// above all any Gupshup/message path, fails the build.
// Bounded by explicit start/end markers. An unbounded match ran to end-of-script and swallowed the
// bootstrap's /admin/state poll — a gate that measures the wrong region is worse than no gate.
const crmBlock = (js.match(/\/\* =+ campaigns-crm \(client\) =+ \*\/[\s\S]*?\/\* =+ end campaigns-crm \(client\) =+ \*\//) || [""])[0];
assert("campaigns-crm block is delimited", crmBlock.length > 0);
const fetches = [...crmBlock.matchAll(/fetch\(\s*("[^"]*"|'[^']*')/g)].map((x) => x[1].replace(/['"]/g, ""));
assert("campaigns-crm calls only the reclassify endpoint",
  fetches.every((u) => u === "/admin/campaign/test"),
  "found: " + JSON.stringify(fetches));
assert("campaigns-crm contains no outbound message path",
  !/gupshup|\/send|sendMessage|outbound/i.test(crmBlock));

// ---- report, including what this gate does NOT cover ----
console.log("[check:crm] " + passes.length + " passed, " + fails.length + " failed");
for (const f of fails) console.log("  FAIL " + f);
console.log("  coverage: parses the emitted client script and asserts seam wiring, label ownership,");
console.log("  denominator handling and the fetch allow-list. It does NOT execute the views — a");
console.log("  runtime fault inside a view is caught by crmBoot() + smoke.py, not by this gate.");
console.log("  fetch calls inspected in the campaigns-crm block: " + fetches.length);

process.exit(fails.length ? 1 : 0);
