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
  c(`unreadable ${JSON.stringify(bad)} fails closed`, ins.campaignWindow(bad), { from: null, to: null });

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

// --- provenance: the contact profile must name its campaign source ----------
// Founder: «I see all campaign details and not sure which one is related to the last one».
// Measured cause: the payload returned {id,name} only — no date, no order — and the client
// rendered identical blue chips linking AWAY to #kmon. Discovery's verdict was provenance, not
// analytics: name the source, make the chips scope in place, keep lifetime as the default.
const src2 = readFileSync(join(root, "src/index.ts"), "utf8");
const dash = readFileSync(join(root, "src/dashboard.ts"), "utf8");
let g = 0;
const c2 = (n, cond) => { if (!cond) g++; console.log(`${cond ? "ok  " : "FAIL"} ${n}`); };

c2("payload carries the launch time", src2.includes("created_at: cp.created_at"));
c2("payload is sorted newest-first", src2.includes("launchedAt(b) - launchedAt(a)"));
c2("unreadable launch sorts last, not NaN", src2.includes("Number.isFinite(w) ? w : 0"));
c2("profile states the campaign source", dash.includes("بدأت هذه المحادثة من"));
c2("scoped view says so", dash.includes("مقصور على حملة"));
c2("scoped view offers a way back to lifetime", dash.includes("عرض كل التاريخ"));
c2("unreadable launch refuses attribution in words", dash.includes("فلا تُنسب أرقام لهذه الحملة"));
c2("campaign links scope IN PLACE, not away to #kmon",
  dash.includes("#customer/' + esc(c.phone) + \"/\" + first.id"));
c2("hashchange assigns the scope (the dead variable)",
  dash.includes('profileCampaign = (location.hash || "").split("/")[2]'));
c2("first refresh reads the scope too, for deep links",
  (dash.match(/profileCampaign = \(location\.hash/g) || []).length >= 2);
c2("lifetime remains the default", !dash.includes("profileCampaign = cps[0].id"));

if (g) { console.log(`\n${g} FAILURES (provenance)`); process.exit(1); }
console.log("campaign provenance: green");

// --- the window must CLOSE (designer + BA both caught this) ------------------
// `to: Infinity` meant an older campaign's window stayed open forever and credited every later
// reply — the founder's own complaint surviving inside the fix meant to end it.
let h = 0;
const c3 = (n, cond) => { if (!cond) h++; console.log(`${cond ? "ok  " : "FAIL"} ${n}`); };
const w = ins.campaignWindow(String(LAUNCH));
c3("the window closes, it is not Infinity", Number.isFinite(w.to));
c3("it closes at WhatsApp's 24h service window", w.to === LAUNCH + 24 * 3600e3);
c3("the constant is exported so both screens can agree", ins.CAMPAIGN_WINDOW_MS === 24 * 3600e3);

// A reply 33h after launch belongs to NO campaign window — not to the one that launched first.
const late = {
  phone: "2", tags: [], statusTimes: {}, optedOut: false, human: false, test: true, agentTurns: 0,
  transcript: [{ role: "customer", text: "مهتم", ts: LAUNCH + 33 * HOUR }],
};
c3("a reply 33h later is NOT credited to the launch", ins.interactionRead(late, () => false, w).voice === null);
// …and one inside the window still is. Without this the guard proves nothing.
const inside = {
  phone: "3", tags: [], statusTimes: {}, optedOut: false, human: false, test: true, agentTurns: 0,
  transcript: [{ role: "customer", text: "مهتم بالخدمة", ts: LAUNCH + 2 * HOUR }],
};
c3("a reply 2h later IS credited (control)", ins.interactionRead(inside, () => false, w).voice !== null);

if (h) { console.log(`\n${h} FAILURES (window closure)`); process.exit(1); }
console.log("window closure: green");
