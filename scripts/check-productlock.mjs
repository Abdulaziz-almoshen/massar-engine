#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Product lock. Founder review 2026-08-16: «customer asked about NVR, but the agent sent Sick
// Leave material. This should never happen.» Root cause was send_asset resolving the file with
// `x.product.includes(key)` — a loose substring match with no reference to the conversation.
//
// Asserted here, not trusted to the prompt: the lock derives from the CUSTOMER's turns, blocks a
// cross-product send, and — the half that matters — still ALLOWS the correct one.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pl = await import(join(root, "dist/productlock.js"));

let f = 0;
const c = (name, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) f++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name} — measured: ${JSON.stringify(got)}`);
};
const convo = (...turns) => ({
  phone: "1", tags: [], statusTimes: {}, optedOut: false, human: false, test: true, agentTurns: 0,
  transcript: turns.map(([role, text], i) => ({ role, text, ts: 1000 + i })),
});

const NVR = "خدمات التطعيمات";
const SICK = "الإجازات المرضية";

// --- the founder's exact case ------------------------------------------------
const nvrTalk = convo(
  ["agent", "مرحبًا، بخصوص سجل التطعيمات الوطني"],
  ["customer", "تفاصيل التكامل"],
);
c("NVR conversation resolves to the vaccination service", pl.activeProduct(nvrTalk), NVR);
c("sending Sick Leave into an NVR conversation is BLOCKED", pl.blockedProduct(nvrTalk, SICK), NVR);
c("sending the NVR file into an NVR conversation is ALLOWED", pl.blockedProduct(nvrTalk, NVR), null);

// «NVR» in the founder's own shorthand, typed by the customer.
const nvrShort = convo(["customer", "نبغى NVR"]);
c("«NVR» shorthand resolves", pl.activeProduct(nvrShort), NVR);
c("…and blocks Sick Leave", pl.blockedProduct(nvrShort, SICK), NVR);

// --- the customer owns the lock ---------------------------------------------
const switched = convo(
  ["agent", "بخصوص سجل التطعيمات الوطني"],
  ["customer", "لا، نبغى الإجازات المرضية"],
);
c("an explicit customer switch MOVES the lock", pl.activeProduct(switched), SICK);
c("…and the new product is allowed", pl.blockedProduct(switched, SICK), null);
c("…while the old one is now blocked", pl.blockedProduct(switched, NVR), SICK);

// --- must not over-block -----------------------------------------------------
// NEGATIVE CONTROLS. A lock that blocks everything is not a lock, it is an outage.
const noProduct = convo(["customer", "مرحبا"], ["customer", "كم السعر"]);
c("no product established → nothing is blocked", pl.blockedProduct(noProduct, SICK), null);
c("…for any product", pl.blockedProduct(noProduct, NVR), null);
c("an unclassifiable candidate is not blocked", pl.blockedProduct(nvrTalk, "ملف عام"), null);
c("customer turns outrank our own", pl.activeProduct(convo(
  ["customer", "نبغى الإجازات المرضية"], ["agent", "وأيضًا خدمات التطعيمات متاحة"])), SICK);

// --- structure: the send path must consult the lock --------------------------
const src = readFileSync(join(root, "src/agent.ts"), "utf8");
const i = src.indexOf('case "send_asset"');
const body = src.slice(i, i + 2200);
c("send_asset consults the product lock", body.includes("productlock.blockedProduct"), true);
c("send_asset prefers an EXACT product match", body.includes("productAssets.find((x) => x.product === key)"), true);

console.log(`\n${f ? f + " FAILURES" : "product lock: all green"}`);
if (f) process.exit(1);
console.log("NOTE: covers asset sends. Price and feature scoping are prompt-level (§٧ب) and are");
console.log("      NOT enforced in code — a wrong PRICE for the wrong product is still possible.");

// --- integration is cross-cutting, not a product switch ----------------------
// «تفاصيل التكامل» is one of OUR button titles. Classifying that tap as the integration product
// moved the lock off NVR — the founder's own complaint reappearing at a new address.
let g = 0;
const c2 = (n, cond) => { if (!cond) g++; console.log(`${cond ? "ok  " : "FAIL"} ${n}`); };
c2("«تفاصيل التكامل» does not move the lock", pl.productOf("تفاصيل التكامل") === null);
c2("«أود مناقشة التكامل» does not move the lock", pl.productOf("أود مناقشة التكامل") === null);
c2("«كيف نتكامل؟» does not move the lock", pl.productOf("كيف نتكامل؟") === null);
c2("the full integration name still resolves",
  pl.productOf("نبغى تكامل الأنظمة (HIS/ERP)") === "تكامل الأنظمة (HIS/ERP)");
c2("an NVR convo survives an integration tap",
  pl.activeProduct(convo(["agent", "بخصوص سجل التطعيمات الوطني"], ["customer", "تفاصيل التكامل"])) === "خدمات التطعيمات");
if (g) { console.log(`\n${g} FAILURES (integration cross-cut)`); process.exit(1); }
console.log("integration cross-cut: green");
