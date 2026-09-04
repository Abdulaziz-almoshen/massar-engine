#!/usr/bin/env node
// ---------------------------------------------------------------------------
// «Enforce buttons if the answers are three or less options» — founder, 2026-08-16.
// The prompt has asked for this since the button contract was written, and the model kept
// writing «صباحًا أم بعد الظهر؟» and numbered lists as prose. Detection is asserted here;
// the conversion sits on the text send path.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { offeredChoices } = await import(join(root, "dist/agent.js"));

let f = 0;
const c = (n, cond, got) => { if (!cond) f++; console.log(`${cond ? "ok  " : "FAIL"} ${n}${got !== undefined ? ` — ${JSON.stringify(got)}` : ""}`); };

// The spec's own example.
const paths = "أقدر أكمل معك الآن في:\n1. طريقة الربط\n2. المتطلبات التقنية\n3. العرض التجاري";
c("a 3-way numbered list becomes buttons", (offeredChoices(paths) || []).length === 3, offeredChoices(paths));

const arabicNums = "نكمل في:\n١. الربط التقني\n٢. العرض التجاري";
c("Arabic-Indic numbering is detected", (offeredChoices(arabicNums) || []).length === 2, offeredChoices(arabicNums));

const either = "تفضّلون صباحًا أم بعد الظهر؟";
c("an «أم» either/or is detected", (offeredChoices(either) || []).length === 2, offeredChoices(either));

const bullets = "الخيارات:\n- تفاصيل الربط\n- العرض التجاري";
c("bulleted options are detected", (offeredChoices(bullets) || []).length === 2, offeredChoices(bullets));

// NEGATIVE CONTROLS. Over-converting is worse than under-converting: a normal sentence turned
// into buttons is a broken message, and 4+ options cannot be buttons at all on WhatsApp.
const four = "نكمل في:\n1. الربط\n2. المتطلبات\n3. العرض\n4. الجدول الزمني";
c("4 options stay prose (WhatsApp caps at 3)", offeredChoices(four) === null, offeredChoices(four));

for (const t of [
  "الربط يتم مع الـHIS بحيث تظل رحلة الممارس داخل نظامكم، ويتم تبادل البيانات مع الخدمة بالخلفية.",
  "يشمل الاحتياج 3 فروع، وهذا يحدد نطاق العرض التجاري بشكل أدق.",
  "تم إيقاف الرسائل. شكرًا لوقتكم، ونعتذر عن الإزعاج.",
  "",
]) c(`prose stays prose: «${t.slice(0, 38)}…»`, offeredChoices(t) === null, offeredChoices(t));

// STRUCTURE: the conversion must sit on the send path, before the text wire.
const src = readFileSync(join(root, "src/agent.ts"), "utf8");
const i = src.indexOf("} else if (finalText) {");
// Window widened 1600 -> 2400 on 2026-09-04. The block grew when the fallback stopped being
// unconditional; the asserted string sits at offset ~1772 now. Widened rather than trimmed, and
// paid for with the two stronger assertions below — a regression lock should get harder to pass
// when the code it guards gets safer, not quietly shorter.
const body = src.slice(i, i + 2400);
c("the send path converts offered choices", body.includes("offeredChoices"));
c("…via sendQuickReply", body.includes("gupshup.sendQuickReply"));
c("…and falls back to text when Meta rejects the shape", body.includes("quick-reply rejected"));
// The fallback must be GATED on a provider rejection. An unconditional re-send delivered the same
// message twice whenever a send timed out after Gupshup had already accepted it.
c("…only when the provider actually rejected it", body.includes("gupshup.isProviderRejection"));
c("…and never re-sends on an unknown outcome", body.includes("NOT resent"));

// The OTHER quick-reply fallback: rung one. Same three-way rule, and a different failure if it
// is wrong. Marking RUNG_ONE_MARK after a LOCAL preflight throw (missing API key, no source
// number) permanently suppresses a message that never reached the wire; not marking after a
// timeout lets a message that DID land be sent a second time. agent.ts has no seam for a unit
// test, so the structure is asserted here, the way the repo already guards the send path.
const rungIdx = src.indexOf("const btns = rungOneButtons(opener);");
const rung = rungIdx === -1 ? "" : src.slice(rungIdx, rungIdx + 1800);
c("rung one has a fallback path at all", rung.includes("gupshup.sendQuickReply"));
c("…falls back to text only on a provider rejection", rung.includes("gupshup.isProviderRejection"));
c("…marks as delivered when the outcome is merely unknown", rung.includes("gupshup.isUnknownOutcome"));
c("…and leaves a local failure eligible for retry", rung.includes("left eligible for retry"));
c("…and skips titles over WhatsApp's 20-char limit", body.includes("x.length <= 20"));

console.log(`\n${f ? f + " FAILURES" : "button enforcement: all green"}`);
if (f) process.exit(1);
console.log("NOTE: detects numbered/bulleted lists and «أم» pairs. A choice phrased as free prose");
console.log("      («ممكن نبدأ بالربط، أو بالعرض») is NOT detected and still goes out as text.");
