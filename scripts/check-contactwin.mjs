#!/usr/bin/env node
// ---------------------------------------------------------------------------
// A number attributed to an EVENT must be scoped to that event (founder, R48/R49).
// campWin fixed the campaign page; the customer page kept reporting a LIFETIME, so opening a
// contact from a campaign launched minutes ago credited it with every reply they ever sent.
//
// This gate exists because the FIRST version of the campaign-side fix shipped as a silent
// no-op: created_at is BIGINT and node-pg returns int8 as a digit STRING, Date.parse gave NaN,
// the window became 0 and every comparison was true. Fixtures below use the REAL shapes.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ins = await import(join(root, "dist/insights.js"));

let f = 0;
const c = (n, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) f++;
  console.log(`${pass ? "ok  " : "FAIL"} ${n} — measured: ${JSON.stringify(got)}`);
};

const HOUR = 3600e3;
const LAUNCH = 1786644640706;
const OLD = LAUNCH - 33 * HOUR;

// --- the window parser, against the shapes Postgres actually returns ---------
c("digit-string created_at parses (the no-op trap)", ins.campaignWindow(String(LAUNCH)).from, LAUNCH);
c("numeric epoch parses", ins.campaignWindow(LAUNCH).from, LAUNCH);
c("ISO parses", ins.campaignWindow(new Date(LAUNCH).toISOString()).from > 0, true);
// FAIL CLOSED: these must admit NOTHING, never everything.
for (const bad of [undefined, null, "", "not-a-date", "0", 0, "-1", -1, "  ", "1970-01", "0000-01"])
  c(`unreadable ${JSON.stringify(bad)} fails closed`, ins.campaignWindow(bad), { from: Infinity, to: Infinity });

// --- the read itself ---------------------------------------------------------
const contact = {
  phone: "1", tags: [], statusTimes: {}, optedOut: false, human: false, test: true, agentTurns: 0,
  transcript: [
    { role: "customer", text: "مهتم بالخدمة وكم السعر", ts: OLD },       // 33h before the launch
    { role: "agent", text: "أهلًا بكم", ts: OLD + 1000 },
    { role: "agent", text: "بخصوص سجل التطعيمات", ts: LAUNCH + 1000 },   // the campaign turn
  ],
};
const echo = () => false;

const lifetime = ins.interactionRead(contact, echo);
c("lifetime read still sees the old customer turn", lifetime.voice !== null, true);

const scoped = ins.interactionRead(contact, echo, ins.campaignWindow(String(LAUNCH)));
c("a campaign episode does NOT inherit the 33h-old reply", scoped.voice, null);

// NEGATIVE CONTROL — the window must still admit what genuinely belongs to it.
const older = ins.interactionRead(contact, echo, ins.campaignWindow(String(OLD - HOUR)));
c("an earlier campaign DOES see its own reply", older.voice !== null, true);

// An unreadable campaign must not silently fall back to lifetime.
const closed = ins.interactionRead(contact, echo, ins.campaignWindow("not-a-date"));
c("unreadable campaign admits nothing, not everything", closed.voice, null);

// --- structure: the endpoint must actually pass the window -------------------
const src = readFileSync(join(root, "src/index.ts"), "utf8");
const i = src.indexOf("interaction: insights.interactionRead");
const body = src.slice(i, i + 700);
c("the contact endpoint passes a window", body.includes("insights.campaignWindow"), true);
c("…derived from the ?campaign= query", src.includes("query as any)?.campaign"), true);

console.log(`\n${f ? f + " FAILURES" : "contact window: all green"}`);
if (f) process.exit(1);
console.log("NOTE: scopes the INTERACTION read. contextScore, insights and the timeline on the");
console.log("      same payload are still lifetime — they were not in scope for this fix.");
