#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Opt-out must survive every outbound route.
//
// Independent QA (Codex, 2026-08-14) found /admin/send-test and /admin/send-template calling
// gupshup.* directly with no optedOut check, so a contact who had written «إيقاف» could still be
// messaged from an admin route. The campaign launch path had the right checks and kept them to
// itself — the recurring "widened for one consumer, re-tested only for that consumer" shape.
//
// This gate has two halves, because a behavioural test alone buys one round:
//   (a) BEHAVIOUR — checkOutbound refuses what it must, and still allows what it must.
//   (b) STRUCTURE — the admin routes are asserted to consult the guard BEFORE reaching the wire,
//       so deleting the call re-opens the hole and fails the build instead of shipping.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;
const check = (name, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name} — measured: ${JSON.stringify(actual)}`);
};

// --- (a) behaviour ----------------------------------------------------------
const tracker = await import(join(root, "dist/tracker.js"));
const { checkOutbound } = await import(join(root, "dist/outbound.js"));

if (typeof checkOutbound !== "function") {
  console.error("FAIL [inert] dist/outbound.js exports no checkOutbound — this gate is inert");
  process.exit(1);
}

const code = (r) => (r ? r.code : null);

const OPTED = "966500000001";
tracker.getContact(OPTED, "gate");
tracker.setOutcome(OPTED, "opted_out");
check("opted-out blocks a session send", code(checkOutbound(OPTED, "session")), "opted_out");
// Opt-out has NO template exception. A Meta-approved template is still a message to someone
// who asked us to stop, and templates are exactly the thing that can re-open a closed window.
check("opted-out blocks a TEMPLATE send", code(checkOutbound(OPTED, "template")), "opted_out");

check("a number that never wrote to us blocks a session send",
  code(checkOutbound("966500000002", "session")), "no_inbound_ever");
check("empty phone is refused", code(checkOutbound("", "session")), "invalid_phone");
check("non-digits are refused", code(checkOutbound("abc", "session")), "invalid_phone");

// A stale conversation cannot take a free-form message.
const STALE = "966500000004";
const stale = tracker.getContact(STALE, "gate");
stale.transcript = [{ role: "customer", text: "مرحبا", ts: Date.now() - 33 * 3600e3 }];
check("a 33h-old conversation blocks a session send", code(checkOutbound(STALE, "session")), "outside_window");

// NEGATIVE CONTROL. A guard that only ever refuses proves nothing — the null-set clean.
const LIVE = "966500000003";
const live = tracker.getContact(LIVE, "gate");
live.transcript = [{ role: "customer", text: "مرحبا", ts: Date.now() }];
check("a live in-window contact is ALLOWED (control)", code(checkOutbound(LIVE, "session")), null);
check("a template to a stale but opted-in contact is ALLOWED (control)",
  code(checkOutbound(STALE, "template")), null);

// --- (b) structure ----------------------------------------------------------
// The behavioural half above passes even if no route calls the guard. This half is what makes
// the property structural: each admin send route must consult checkOutbound before gupshup.*.
const src = readFileSync(join(root, "src/index.ts"), "utf8");

for (const route of ["/admin/send-test", "/admin/send-template"]) {
  const start = src.indexOf(`app.post("${route}"`);
  if (start < 0) {
    console.log(`FAIL [inert] route ${route} not found in src/index.ts — this gate is inert`);
    failures++;
    continue;
  }
  const body = src.slice(start, src.indexOf("\n});", start));
  const guardAt = body.indexOf("checkOutbound");
  const wireAt = body.search(/gupshup\.send/);
  check(`${route} consults the guard`, guardAt >= 0, true);
  check(`${route} consults it BEFORE the wire`, guardAt >= 0 && wireAt >= 0 && guardAt < wireAt, true);
}

console.log(`\n${failures ? failures + " FAILURES" : "opt-out guard: all green"}`);
if (failures) process.exit(1);

// Rule 7: bound the claim to what was measured. This gate covers the TWO admin routes and the
// guard's own logic. It does NOT assert the single-door property — agent.ts 616/686/705/711/712/
// 919/930/1047 and index.ts 227/239/243 still reach Gupshup directly, and AC4 is still FAIL in
// the independent review. Do not quote this green as "all outbound is guarded".
console.log("NOTE: covers the 2 admin routes + guard logic. ~13 other call sites reach Gupshup");
console.log("      directly and are NOT covered here — independent QA AC4 remains FAIL.");

// --- sandbox plumbing must never be answered (2026-08-16) --------------------
// The activation guard was gated on «customer turns <= 1», on the assumption that a later
// «proxy …» is the customer talking. False on a SHARED sandbox: the handshake repeats every time
// the session lapses. Measured — the founder returned after ~50h, re-typed «Proxy massar» with 30
// turns of history, the guard did not fire, and the model asked whether he had «Proxy باسم Massar
// ضمن بيئة الـHIS». Pinned by SHAPE, with no turn counter.
const ins2 = await import("../dist/insights.js");
const RE = ins2.SANDBOX_ACTIVATION_RE;
let f4 = 0;
const c4 = (name, cond) => { if (!cond) f4++; console.log(`${cond ? "ok  " : "FAIL"} ${name}`); };

for (const t of ["Proxy massar", "proxy Massar", "PROXY massar", "بروكسي مسار", " Proxy massar "])
  c4(`«${t.trim()}» is recognised as plumbing`, RE.test(t));

// Must NOT swallow real customer speech.
for (const t of ["هل يوجد proxy في الشبكة عندكم؟", "نستخدم proxy server داخلي للربط مع HIS",
                 "كم السعر", "العرض التجاري"])
  c4(`«${t.slice(0, 34)}…» is NOT plumbing`, !RE.test(t));

// The turn counter must be gone from the guard — that was the defect itself.
const src2 = readFileSync(join(root, "src/agent.ts"), "utf8");
const gi = src2.indexOf("if (SANDBOX_ACTIVATION.test(text))");
c4("activation guard is not gated on a turn counter", gi >= 0);
c4("guard replies with the opener only on the first turn", src2.slice(gi, gi + 900).includes("priorCustomerTurns <= 1"));
c4("guard stays silent on re-activation", src2.slice(gi, gi + 900).includes("sandbox re-activation mid-conversation"));

if (f4) { console.log(`\n${f4} FAILURES (sandbox plumbing)`); process.exit(1); }
console.log("sandbox plumbing guard: green");
