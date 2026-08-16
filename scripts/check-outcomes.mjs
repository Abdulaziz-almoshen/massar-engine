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
