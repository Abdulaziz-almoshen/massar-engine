#!/usr/bin/env node
// ---------------------------------------------------------------------------
// The SORTER contract. Founder: "we want to know who are interested, who are not interested, and
// if interested, when are we going to schedule them." Two of his four real conversations already
// contained a customer-stated time («صباح», «صباحًا») that the system recorded nowhere.
//
// These assert the RECORD, not the prose. A conversation that ends without an honest row is the
// failure, however well it read.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tracker = await import(join(root, "dist/tracker.js"));

let f = 0;
const c = (n, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) f++;
  console.log(`${pass ? "ok  " : "FAIL"} ${n} — measured: ${JSON.stringify(got)}`);
};

// --- a stated time is recorded verbatim -------------------------------------
const P = "966500000801";
const k = tracker.getContact(P, "eval");
k.transcript.push({ role: "customer", text: "صباحًا يناسبنا", ts: Date.now() });
tracker.setSchedule(P, "صباحًا يناسبنا");
const got = tracker.findContact(P);
c("the customer's words are stored verbatim", got.scheduledSaid, "صباحًا يناسبنا");
c("outcome becomes scheduled", got.outcome, "scheduled");
c("the outcome carries its evidence", got.outcomeEvidence, "صباحًا يناسبنا");
c("a readable phrase yields an advisory time", typeof got.scheduledAt, "number");
c("…and that time is in the future", got.scheduledAt > Date.now(), true);

// An unreadable phrase must NOT invent a slot — a wrong meeting time is worse than none,
// because a human acts on it.
const Q = "966500000802";
const q = tracker.getContact(Q, "eval");
q.transcript.push({ role: "customer", text: "نشوف بعدين", ts: Date.now() });
tracker.setSchedule(Q, "نشوف بعدين");
c("an unreadable phrase stores the words", tracker.findContact(Q).scheduledSaid, "نشوف بعدين");
c("…and refuses to guess a datetime", tracker.findContact(Q).scheduledAt, undefined);

// --- the stopped state ------------------------------------------------------
const R = "966500000803";
tracker.getContact(R, "eval");
tracker.setOutcome(R, "stopped", "ما نحتاج حاليًا");
c("stopped is a real outcome", tracker.findContact(R).outcome, "stopped");
c("…carrying the customer's own reason", tracker.findContact(R).outcomeReason, "ما نحتاج حاليًا");

// --- structure: the bugs that made the record lossy -------------------------
const src = readFileSync(join(root, "src/agent.ts"), "utf8");
c("close_conversation no longer coerces a no into 'closed'",
  src.includes('asked === "not_interested" ? "stopped"'), true);
// Assert the DESCRIPTION the model reads, not the file — a comment explaining the removal would
// otherwise fail the check that the removal happened.
const niDesc = src.slice(src.indexOf('name: "mark_not_interested"'), src.indexOf('name: "mark_not_interested"') + 400);
c("mark_not_interested no longer demands two alternatives first",
  !niDesc.includes("بعد عرض بديلين"), true);
c("…and tells the model to record it immediately", niDesc.includes("فور أن يقولها"), true);
c("the reason is the customer's words, not a model enum",
  src.includes("volunteered ||"), true);
c("lead alerts are keyed per KIND, not per phone",
  src.includes("`${contact.phone}:${kind}`"), true);
c("a booked time is never suppressed by a cooldown",
  src.includes('kind !== "scheduled" &&'), true);
c("record_schedule refuses a time the agent proposed",
  src.includes("لم يقل العميل"), true);

console.log(`\n${f ? f + " FAILURES" : "outcome record: all green"}`);
if (f) process.exit(1);
console.log("NOTE: asserts the LEDGER. Whether the agent asks for a time well is a separate");
console.log("      question, measured by the Codex eval, not by this gate.");

// --- the cached fabrication must not reach the screen ------------------------
// Founder caught «أكد أن السعر هو العائق الوحيد المتبقي» in a live reply. The send path was
// guarded, but the same sentence was still on his PORTAL, written into a cached reading before
// the guard existed. Rule 6: stopping the leak is not wiping the spill.
const ins2 = await import(join(root, "dist/insights.js"));
let g = 0;
const c2 = (n, cond) => { if (!cond) g++; console.log(`${cond ? "ok  " : "FAIL"} ${n}`); };
const FAB = "أكد أن السعر هو العائق الوحيد المتبقي قبل البدء، بعد تحديد نطاق التكامل والفروع.";
const FACT = "سأل عن السعر بعد أن حدد نطاق التكامل والفروع، وطلب عرضًا تجاريًا.";
c2("the fabrication is scrubbed", ins2.scrubInventedIntent(FAB) === "");
c2("a factual reading survives untouched", ins2.scrubInventedIntent(FACT) === FACT);
const mixed = ins2.scrubInventedIntent("المنشأة تناقش تكامل سجل التطعيمات. " + FAB);
c2("mixed text keeps the real half", mixed.includes("تناقش تكامل سجل التطعيمات"));
c2("…and drops the invented half", !mixed.includes("العائق الوحيد"));
// ARRAYS. The live fabrication was in signals[] and the first scrub only covered strings, so it
// kept rendering while string-fixture tests passed. This uses the REAL sentence from the ledger.
const LIVE = "أفاد بأن «السعر هو العائق الوحيد المتبقي قبل البدء» ثم اختار «سنوي».";
const KEPT = "أفاد بأن لديهم ٧ فروع وأنها تعمل على نفس بيئة HIS.";
const arr = ins2.normalizeCached({ product_interest: [], signals: [KEPT, LIVE] });
c2("a fabricated SIGNAL is dropped", !JSON.stringify(arr.signals).includes("العائق الوحيد"));
c2("…and the factual signal beside it survives", arr.signals.includes(KEPT));
c2("objections arrays are scrubbed too",
  !JSON.stringify(ins2.normalizeCached({ product_interest: [], objections: [LIVE] }).objections).includes("العائق"));

// Every rendered free-text field goes through the same scrub, in one place.
for (const f of ["summary", "why", "stage_reason", "next_action"])
  c2(`normalizeCached scrubs ${f}`, ins2.normalizeCached({ product_interest: [], [f]: FAB })[f] === "");

// --- the morning list --------------------------------------------------------
const dash2 = readFileSync(join(root, "src/dashboard.ts"), "utf8");
c2("a morning list exists", dash2.includes("function vMorningList"));
c2("…grouped by the founder's own three questions",
  dash2.includes("موعد محدد") && dash2.includes("مهتم بلا موعد") && dash2.includes("لا يرغب في التواصل"));
c2("…showing the customer's own words for the time", dash2.includes("c.scheduledSaid"));
c2("…with our parse labelled as ours", dash2.includes("قراءتنا"));
c2("…and an empty group says so rather than hiding", dash2.includes("لا أحد في هذه المجموعة بعد"));
c2("…and unsorted contacts are counted, not ignored", dash2.includes("لم تُفرز بعد"));
if (g) { console.log(`\n${g} FAILURES (scrub / morning list)`); process.exit(1); }
console.log("scrub + morning list: green");
