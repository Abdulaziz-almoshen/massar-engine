#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Campaign numbers must describe THAT campaign. Nothing else in the gate chain asserts one, which
// is why a fix that was a complete no-op in production shipped with every check green:
// `created_at` is BIGINT and node-pg returns int8 as a STRING of digits, so `Date.parse` gave NaN,
// the window silently became 0, and `atOrAfter(undefined, 0)` was true — every contact counted as
// delivered and `failed` was structurally pinned at zero. The founder saw «ردّوا ٢» on a campaign
// nobody had opened, and two real send failures were hidden behind it.
//
// These fixtures use the REAL shapes: created_at as a digit string, statusTimes as lifetime values.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { DASHBOARD_HTML } = await import(join(root, "dist/dashboard.js"));
const script = [...DASHBOARD_HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])[0];
const from = script.indexOf("function contactByPhone");
const to = script.indexOf("function clip(s, n)");
if (from < 0 || to < 0) {
  console.error("FAIL [slice] campStats anchors moved in src/dashboard.ts — this gate is inert");
  process.exit(1);
}

const HOUR = 3600e3;
const LAUNCH = 1786644640706;              // the real created_at of campaign 22, as a digit string
const OLD = LAUNCH - 33 * HOUR;            // when both contacts actually replied — 33h earlier

const contacts = [
  { phone: "1", statusTimes: { sent: OLD, delivered: OLD, read: OLD, replied: OLD, failed: LAUNCH + 3000 },
    tags: [{ product: "x", level: "hot", ts: OLD }], outcome: "interested",
    transcript: [{ role: "customer", text: "مهتم", ts: OLD }, { role: "agent", text: "أهلًا", ts: LAUNCH + 1 }] },
  { phone: "2", statusTimes: { sent: OLD, delivered: OLD, read: OLD, replied: OLD, failed: LAUNCH + 3000 },
    tags: [], outcome: undefined,
    transcript: [{ role: "customer", text: "كم السعر", ts: OLD }, { role: "agent", text: "أهلًا", ts: LAUNCH + 1 }] },
];

const ctx = { console, Date, Number, Math, String, Boolean, Array, Object, JSON, Infinity, isNaN };
vm.createContext(ctx);
vm.runInContext(`var cache = ${JSON.stringify({ contacts })};\n` + script.slice(from, to), ctx);
const stats = (camp) => vm.runInContext(`campStats(${JSON.stringify(camp)})`, ctx);

let failures = 0;
const check = (name, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name} — measured: ${JSON.stringify(actual)}`);
};

const targets = [{ phone: "1" }, { phone: "2" }];

// THE regression. created_at as a digit STRING is the shape Postgres actually returns.
const fresh = stats({ targets, created_at: String(LAUNCH) });
check("digit-string created_at is parsed (not NaN → window 0)", fresh.replied, 0);
check("a campaign inherits no older reply", fresh.seen, 0);
check("nor an older interest tag", fresh.interested, 0);
check("nor an older delivery", fresh.delivered, 0);
check("and real failures after the launch ARE reported", fresh.failed, 2);

// Numeric epoch and ISO must behave identically to the string.
check("numeric epoch matches the string", stats({ targets, created_at: LAUNCH }).replied, 0);
check("ISO matches the string", stats({ targets, created_at: new Date(LAUNCH).toISOString() }).replied, 0);

// A campaign launched BEFORE those replies must still count them.
const older = stats({ targets, created_at: String(OLD - HOUR) });
check("an older campaign still counts its own replies", older.replied, 2);
check("…and its own interest", older.interested, 1);

// FAIL CLOSED: an unreadable launch time must show nothing, never everything.
// safety-gate advisory: "0" and "-1" reached Date.parse and resolved to the year 2000, opening the
// window on every past event through the very fallback meant to close it.
for (const bad of [undefined, null, "", "not-a-date", "0", 0, "-1", -1, "  ", {}]) {
  const r = stats({ targets, created_at: bad });
  check(`unreadable created_at (${JSON.stringify(bad)}) shows zero, not everything`,
    [r.replied, r.seen, r.delivered, r.interested], [0, 0, 0, 0]);
}

// A missing timestamp is no event — the bug that pinned `failed` at zero.
const noStatus = [{ phone: "3", statusTimes: {}, tags: [], transcript: [] }];
vm.runInContext(`cache = ${JSON.stringify({ contacts: noStatus })};`, ctx);
const empty = stats({ targets: [{ phone: "3" }], created_at: String(LAUNCH) });
check("a contact with no status counts as nothing", [empty.delivered, empty.seen, empty.replied], [0, 0, 0]);


// --- the refusal reading -----------------------------------------------------
// No gate covered this regex, and it broke twice in opposite directions in one day: first it called
// «مو مهتم بالسعر بقدر الجودة» — a BUYING signal — an explicit refusal; then anchoring it to
// end-of-clause made «لسنا مهتمين» invisible, because Arabic inflects and the anchor sat after the
// stem instead of after the suffix. Both directions are pinned here.
const ins = await import(join(root, "dist/insights.js"));
const asContact = (text) => ({ phone: "r", tags: [], statusTimes: {},
  transcript: [{ role: "customer", text, ts: Date.now() }] });
const isRefusal = (text) => ins.interactionRead(asContact(text), () => false).state === "refused";

for (const t of ["لسنا مهتمين", "ماني مهتم شكرا", "لست مهتم بهذا", "ماني مهتم لا تتصل علي",
                 "مو مهتم", "غير مهتمة", "لا تراسلني"])
  check(`«${t}» IS a refusal`, isRefusal(t), true);

for (const t of ["ما نبغى نتأخر", "لا نحتاج وقت طويل", "مو مهتم بالسعر بقدر الجودة",
                 "مهتمين جدًا بالتكامل", "كم السعر", "الملف التعريفي"])
  check(`«${t}» is NOT a refusal`, isRefusal(t), false);

// The platform's own boilerplate must never be quoted back as the customer's words.
const proxy = ins.interactionRead(asContact("proxy Massar"), () => false);
check("sandbox activation is not surfaced as the customer's voice", proxy.voice, null);

console.log(`\n${failures ? failures + " FAILURES" : "campaign scoping + refusal reading: all green"}`);
if (failures) process.exit(1);
console.log("NOTE: fixtures use the REAL created_at shape (int8 as a digit string). A gate that");
console.log("asserts campaign numbers with an ISO string it invented is how the no-op shipped clean.");
