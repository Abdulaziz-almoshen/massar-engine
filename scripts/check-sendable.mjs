#!/usr/bin/env node
// ---------------------------------------------------------------------------
// The model's reasoning must never reach a customer.
//
// 2026-08-16, founder's own thread: gpt-5.6-terra emitted its planning as message CONTENT
// instead of calling the tool — «We need respond Arabic, need human handoff for commercial
// pricing? … Let's invoke.» — and the send path shipped msg.content verbatim to WhatsApp.
//
// The property asserted here is the one that actually holds for this product: the agent writes
// Arabic. A Latin-dominant reply is never valid, whatever it says.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { unsendableReason } = await import(join(root, "dist/agent.js"));

let f = 0;
const c = (n, cond, got) => { if (!cond) f++; console.log(`${cond ? "ok  " : "FAIL"} ${n}${got !== undefined ? ` — ${JSON.stringify(got)}` : ""}`); };

// THE leak, verbatim from his screenshot.
const LEAK = "We need respond Arabic, need human handoff for commercial pricing? User has shared 3 branches same HIS. Need mention central integration one serves all, and request handoff. Must not claim started unless tool. Let's invoke.";
c("the exact leaked message is blocked", unsendableReason(LEAK) !== null, unsendableReason(LEAK));

for (const t of [
  "Let's invoke the handoff tool now",
  "I should ask about branches first",
  "Okay, so the user wants pricing and we need to check the catalogue before replying",
  "The customer has 3 branches on the same HIS environment, so we need to mention central integration",
]) c(`blocked: «${t.slice(0, 42)}…»`, unsendableReason(t) !== null);

// NEGATIVE CONTROLS. A guard that blocks real Arabic replies is an outage, not a guard.
// These are real sentences this agent must still be able to send.
for (const t of [
  "يشمل الاحتياج 3 فروع، وهذا يحدد نطاق العرض التجاري بشكل أدق. هل الفروع الثلاثة تعمل على نفس بيئة الـHIS؟",
  "الربط يتم مع الـHIS أو ERP عبر واجهات برمجية (API)، ونرسل لكم الملف بصيغة PDF.",
  "بالنسبة لسجل التطعيمات الوطني NVR، التوثيق يتم من داخل الـHIS عندكم.",
  "تم إيقاف الرسائل. شكرًا لوقتكم، ونعتذر عن الإزعاج.",
  "أهلًا بكم. أنا المساعد الرقمي لشركة لِين لخدمات الأعمال.",
]) c(`allowed: «${t.slice(0, 40)}…»`, unsendableReason(t) === null, unsendableReason(t));

c("empty text is blocked", unsendableReason("") !== null);

// STRUCTURE: the guard must sit on the single send door, not at one call site.
const src = readFileSync(join(root, "src/agent.ts"), "utf8");
const i = src.indexOf("async function safeSend");
c("safeSend consults the guard before the wire",
  src.slice(i, i + 1600).includes("unsendableReason") &&
  src.slice(i, i + 1600).indexOf("unsendableReason") < src.slice(i, i + 1600).indexOf("gupshup.sendText"));

console.log(`\n${f ? f + " FAILURES" : "sendable guard: all green"}`);
if (f) process.exit(1);
console.log("NOTE: covers agent TEXT via safeSend. Asset captions and template bodies do not");
console.log("      pass through it — they are authored, not model-generated.");
