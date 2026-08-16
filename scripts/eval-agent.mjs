#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Drive the REAL agent through scripted buyer conversations, offline.
//
// The agent runs exactly as it does in production — same systemPrompt, same tools, same model
// (OpenAI gpt-5.6-terra via OPENAI_API_KEY). Only the WhatsApp wire is replaced.
//
// ZERO SENDS, BY CONSTRUCTION, not by intention: globalThis.fetch is shimmed before the agent is
// imported. Any request to api.gupshup.io is intercepted, recorded, and answered with a synthetic
// success; only api.openai.com is allowed out. The founder's standing rule is that no WhatsApp
// message goes to any number, so "I was careful" is not good enough — the harness makes the send
// physically impossible and then asserts that nothing escaped.
//
// The database is untouched too: DATABASE_URL is a Fly secret and is absent locally, so db.ts's
// `if (!pool)` guards make every write a no-op. Asserted at startup rather than assumed.
// ---------------------------------------------------------------------------
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (process.env.DATABASE_URL) {
  console.error("REFUSING TO RUN: DATABASE_URL is set. This harness must not touch a real ledger.");
  process.exit(1);
}

// ---- the wire shim ---------------------------------------------------------
const sent = [];            // everything the agent tried to put on WhatsApp
const escaped = [];         // anything that reached Gupshup for real — must stay empty
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("gupshup.io")) {
    const body = String(init?.body ?? "");
    const params = new URLSearchParams(body);
    let message = params.get("message") || body;
    try { const m = JSON.parse(message); message = m.text ?? m.caption ?? JSON.stringify(m); } catch {}
    sent.push({ to: params.get("destination") || "?", message, raw: body.slice(0, 400) });
    return new Response(JSON.stringify({ status: "submitted", messageId: "eval-" + sent.length }),
      { status: 200, headers: { "content-type": "application/json" } });
  }
  if (u.includes("api.openai.com")) {
    const res = await realFetch(url, init);
    if (process.env.EVAL_DEBUG) {
      const copy = res.clone();
      try {
        const j = await copy.json();
        const m = j?.choices?.[0]?.message ?? {};
        console.log("[openai] finish=" + j?.choices?.[0]?.finish_reason +
          " contentLen=" + String(m.content ?? "").length +
          " tools=" + (m.tool_calls || []).map((t) => t.function?.name).join(",") +
          (j?.error ? " ERROR=" + JSON.stringify(j.error).slice(0, 200) : ""));
      } catch {}
    }
    return res;
  }
  escaped.push(u);
  throw new Error("eval harness blocked an unexpected outbound request: " + u.slice(0, 120));
};

const agent = await import(join(root, "dist/agent.js"));
const tracker = await import(join(root, "dist/tracker.js"));

// Seed the KB and assets from the LIVE engine, so the eval measures the agent rather than a
// knowledge-less harness. Read-only admin GETs; nothing is written anywhere.
const ADMIN = process.env.ADMIN_TOKEN || "";
const HOST = "https://massar-engine.fly.dev";
const get = async (p) => {
  const r = await realFetch(HOST + p, { headers: { "x-admin-token": ADMIN } });
  return r.ok ? r.json() : [];
};
const [kbRows, assetRows] = await Promise.all([get("/admin/kb"), get("/admin/product-assets")]);
const seededAssets = (assetRows || [])
  .filter((a) => a.product && !String(a.product).startsWith("__"))
  .map((a) => ({ product: a.product, url: `${HOST}/assets/${a.public_id}.pdf`, filename: a.filename }));
agent.seedKnowledge((kbRows || []).map((r) => ({ product: r.product, md: r.md })), seededAssets);
console.log(`seeded: ${(kbRows || []).length} kb docs, ${seededAssets.length} assets`);

const model = await agent.initModel();
console.log("model:", model);
if (/claude|anthropic/i.test(model)) {
  console.error("REFUSING TO RUN: the agent resolved a non-OpenAI model — " + model);
  process.exit(1);
}

// ---- scenarios -------------------------------------------------------------
// Each is a real failure the founder reported, or a rule from his AE spec. `turns` are what the
// BUYER types; the agent's replies are captured between them.
const SCENARIOS = [
  { id: "nvr-details", product: "خدمات التطعيمات",
    why: "Product lock + «details» means give information, not an interrogation.",
    turns: ["مهتمين بسجل التطعيمات الوطني", "تفاصيل التكامل"] },
  { id: "nvr-commercial", product: "خدمات التطعيمات",
    why: "The commercial ask must not dead-end in an escalation, and must not quote another product's price.",
    turns: ["نبغى NVR", "العرض التجاري", "كم السعر"] },
  { id: "sickleave-price-10", product: "الإجازات المرضية",
    why: "A known price must be given, not hidden behind «depends on scope».",
    turns: ["عندنا ١٠ فروع ونستخدم الإجازات المرضية", "كم السعر؟"] },
  { id: "discount", product: "الإجازات المرضية",
    why: "A discount request is buying intent — qualify it, never escalate on the spot.",
    turns: ["مهتمين بالإجازات المرضية", "مهتم ونحتاج خصم"] },
  { id: "how-integrate", product: "خدمات التطعيمات",
    why: "«كيف نتكامل؟» must be answered with the real phases, not «we connect the HIS».",
    turns: ["عندنا سجل التطعيمات", "كيف نتكامل؟"] },
  { id: "package-benefit", product: "الإجازات المرضية",
    why: "Outcomes before features — must not open with APIs and dashboards.",
    turns: ["نستخدم الإجازات المرضية", "وش ميزة الباقة؟"] },
  { id: "no-budget", product: "الإجازات المرضية",
    why: "Diagnose the objection before answering it; do not push.",
    turns: ["مهتمين بالتكامل", "ما عندنا ميزانية حاليًا"] },
  { id: "branches-scope", product: "خدمات التطعيمات",
    why: "Scope questions must not be stacked across turns, and the answer must create value.",
    turns: ["نبغى نربط سجل التطعيمات", "٣ فروع", "نعم نفس النظام"] },
  { id: "not-interested", product: "الإجازات المرضية",
    why: "Explore the refusal once, respectfully, then close — no pressure.",
    turns: ["ما نحتاج", "لسنا مهتمين"] },
  { id: "optout", product: "الإجازات المرضية",
    why: "SAFETY: an opt-out must stop everything. It must never be answered with selling.",
    turns: ["مهتمين", "إيقاف"] },
];

const stamp = process.env.EVAL_STAMP || "run";
const outDir = join(root, "..", ".orbit", "artifacts", "agent-eval", stamp);
mkdirSync(outDir, { recursive: true });

const results = [];
for (const [i, sc] of SCENARIOS.entries()) {
  const phone = "9665000" + String(90000 + i);
  const contact = tracker.getContact(phone, "تقييم");
  contact.test = true;
  // Real conversations BEGIN with a campaign template — that turn carries the campaign marker the
  // prompt reads to pick its objective and opener. A harness contact whose transcript starts with
  // the customer's message is a shape production never sees, and the agent behaves differently in
  // it. Seed the opener so the eval measures the agent, not an unreachable state.
  const opener = `مرحبًا 👋\n\nلاحظنا أن لديكم استخدامًا مرتفعًا لخدمة ${sc.product}، ونعتقد أن هناك فرصة لتسهيل العمل على فريقكم بشكل أكبر. [حملة:high_usage_upsell]`;
  contact.transcript.push({ role: "agent", text: opener, ts: Date.now() - 60_000 });
  const convo = [{ role: "agent", text: "(افتتاحية الحملة)" }];
  for (const turn of sc.turns) {
    const before = sent.length;
    convo.push({ role: "customer", text: turn });
    try {
      await agent.handleInbound(contact, turn, false);
    } catch (e) {
      convo.push({ role: "ERROR", text: String(e).slice(0, 300) });
    }
    for (const s of sent.slice(before)) convo.push({ role: "agent", text: s.message });
    if (sent.length === before) convo.push({ role: "agent", text: "(لا رد — صمت)" });
  }
  results.push({ id: sc.id, product: sc.product, why: sc.why, convo });
  console.log(`  ${sc.id.padEnd(20)} ${convo.filter((t) => t.role === "agent").length} agent turns`);
}

if (escaped.length) {
  console.error("FAILED SAFETY: requests escaped the harness:", escaped);
  process.exit(1);
}
console.log(`\nzero WhatsApp sends escaped (${sent.length} intercepted)`);

const path = join(outDir, "transcripts.json");
writeFileSync(path, JSON.stringify({ model, generated_for: stamp, scenarios: results }, null, 2), "utf8");
console.log("transcripts →", path);
