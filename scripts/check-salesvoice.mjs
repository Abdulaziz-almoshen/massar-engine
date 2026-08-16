#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Founder review, second pass 2026-08-16: «still sounds too much like a workflow/qualification
// bot rather than a strong B2B salesperson.» Two families are enforced here rather than asked
// for, because prose bans had already failed for the fake-action family.
//
//   INVENTED STATE — «بما أن السعر هو النقطة الوحيدة المتبقية» when the customer never said it.
//     Rule 2 applied to INTENT: a fabricated fact about the buyer's own mind.
//   PROCESS NARRATION — internal CRM vocabulary spoken at the customer.
//
// The guard removes offending SENTENCES, so a good answer is not thrown away for one bad clause.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { salesVoiceViolation, stripSalesVoice } = await import(join(root, "dist/agent.js"));

let f = 0;
const c = (n, cond, got) => { if (!cond) f++; console.log(`${cond ? "ok  " : "FAIL"} ${n}${got !== undefined ? ` — ${JSON.stringify(got)}` : ""}`); };

// --- his verbatim complaint --------------------------------------------------
const INVENTED = "بما أن السعر هو النقطة الوحيدة المتبقية قبل البدء، سأجهز لكم العرض.";
c("the exact invented-blocker line is caught", salesVoiceViolation(INVENTED) !== null, salesVoiceViolation(INVENTED));

for (const t of [
  "النقطة الوحيدة المتبقية هي السعر.",
  "بما أنكم جاهزون للبدء، نكمل الإجراءات.",
  "تم تأهيل الفرصة وننتقل للمرحلة التالية.",
  "الخطوة التالية هي إعداد العرض التجاري.",
  "سأكمل المراجعة التجارية على هذا الأساس.",
  "ننتقل إلى المرحلة القادمة من العملية.",
]) c(`caught: «${t.slice(0, 40)}…»`, salesVoiceViolation(t) !== null);

// --- NEGATIVE CONTROLS: asking is how the agent is SUPPOSED to establish it ---
for (const t of [
  "إذا وصلنا لسعر مناسب، هل فيه نقطة ثانية ممكن توقف البدء؟",
  "هل السعر هو العائق الوحيد المتبقي عندكم؟",
  "ممتاز، بما أن الفروع الثلاثة على نفس الـHIS، هذا يسهّل الموضوع كثير.",
  "نقدر نخلي الربط مركزي ويخدم الفروع كلها بدل ما يكون لكل فرع ربط منفصل.",
  "التسعير لهذا المنتج يعتمد على عدد الفروع ونطاق الربط.",
  "الخطوة التالية تكون مراجعة العرض على نطاق الفروع.",
]) c(`allowed: «${t.slice(0, 40)}…»`, salesVoiceViolation(t) === null, salesVoiceViolation(t));

// --- surgical removal, not message destruction -------------------------------
const mixed = "ممتاز، بما أن الفروع الثلاثة على نفس الـHIS، هذا يسهّل الربط كثير ونقدر نبنيه مرة واحدة للفروع كلها. بما أن السعر هو النقطة الوحيدة المتبقية قبل البدء، سأجهز العرض.";
const out = stripSalesVoice(mixed);
c("the offending sentence is removed", !out.text.includes("النقطة الوحيدة المتبقية"));
c("…and the good sentence survives", out.text.includes("يسهّل الربط كثير"));
c("…and the removal is reported", out.removed.length === 1, out.removed);

const clean = stripSalesVoice("ممتاز، هذا يسهّل الربط بشكل كبير لأننا نقدر نبني التكامل مرة واحدة.");
c("a clean message is untouched", clean.removed.length === 0 && clean.text.length > 30);

// --- structure ---------------------------------------------------------------
const src = readFileSync(join(root, "src/agent.ts"), "utf8");
const i = src.indexOf("async function safeSend");
const body = src.slice(i, i + 1600);
c("safeSend strips before the wire",
  body.includes("stripSalesVoice") && body.indexOf("stripSalesVoice") < body.indexOf("gupshup.sendText"));

console.log(`\n${f ? f + " FAILURES" : "sales voice: all green"}`);
if (f) process.exit(1);
console.log("NOTE: matches the assertive SHAPES listed, not the topic. Novel phrasings of the same");
console.log("      idea are NOT caught in code — §٧أ/٧ب carry those, and prompts can be ignored.");
