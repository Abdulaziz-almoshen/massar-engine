#!/usr/bin/env node
// ---------------------------------------------------------------------------
// The enrichable client record — BR-1 must hold structurally, not just behaviourally.
//
// The ONE thing this gate exists to falsify is the SINGLE-DOOR property: no module other than
// tracker.ts writes `contacts.props`. Chosen over a pure rejection-matrix test because a
// behavioural test of writeProp passes at full green while agent.ts writes `c.props` directly —
// and this repo has that exact defect open elsewhere, documented in check-optout.mjs's own closing
// NOTE ("~13 other call sites reach Gupshup directly"). The other failure modes are VISIBLE: a
// nulled prop reads «ناقص», a broken matrix fails AC-2/AC-3. A bypass leaves a plausible value with
// the WRONG PROVENANCE — invisible on screen, and it makes the confirmation-rate metric circular.
//
// Two halves, the idiom of check-optout.mjs:
//   (a) BEHAVIOUR against dist/ — the ordered rejection ladder, provenance, and a negative control.
//   (b) STRUCTURE against src/ — the single door, the upsert trap, the named call sites, the two
//       deliberate NON-writers, and BR-4 (the props route can reach no sender).
//
// Why the behaviour half tests `decideProp` and not only `writeProp`: an APPLIED write is DB-first
// by design (NFR-3 — with no DATABASE_URL writeProp must refuse, or local dev pretends a save
// succeeded), so no accepted write is observable without Postgres, which this gate must not need.
// decideProp is the whole guard, pure and exported; writeProp owns only lookup + persistence. The
// structural half below pins writeProp to decideProp so this split cannot rot into a fiction.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;
const check = (name, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) { failures++; console.log(`FAIL ${name} — measured: ${JSON.stringify(actual)} · expected: ${JSON.stringify(expected)}`); }
  else console.log(`ok   ${name} — measured: ${JSON.stringify(actual)}`);
};

// --- (a) behaviour ----------------------------------------------------------
const tracker = await import(join(root, "dist/tracker.js"));
const { decideProp, writeProp, PROP_KEYS, formatInterest, humanFactsBlock } = tracker;

// [inert] — a gate that green-lights a deleted door is worse than no gate.
for (const [name, fn] of [["writeProp", writeProp], ["decideProp", decideProp],
                          ["formatInterest", formatInterest], ["humanFactsBlock", humanFactsBlock]]) {
  if (typeof fn !== "function") {
    console.error(`FAIL [inert] dist/tracker.js exports no ${name} — this gate is inert`);
    process.exit(1);
  }
}
check("exactly six properties, no seventh key", [...PROP_KEYS].sort(),
  ["decisionMaker", "disqualifyReason", "nextStep", "note", "orgProfile", "productInterest"]);

const NOW = 1_760_000_000_000;
const d = (over) => decideProp({ key: "nextStep", value: "x", source: "human", by: "gate", known: true, now: NOW, ...over });
const reason = (r) => r.reason ?? null;

// 1 · unknown key — NFR-2, never silently dropped, and reported even for an unknown phone.
check("an unknown key is refused", reason(d({ key: "leadScore" })), "unknown_property");
check("an unknown key is refused BEFORE the phone is judged",
  reason(d({ key: "leadScore", known: false })), "unknown_property");

// 2 · AC-3 — human-only / import-only keys. decisionMaker is human-only in this increment (OQ-1).
for (const key of ["note", "orgProfile", "decisionMaker"]) {
  const r = d({ key, source: "agent", value: "قيمة" });
  check(`agent may not write ${key}`, [reason(r), Boolean(r.prop), Boolean(r.applied)], ["not_agent_writable", false, false]);
}

// 3 · never manufactures a contact from a typo.
check("an unknown phone is refused", reason(d({ known: false })), "unknown_phone");
check("a refused agent key outranks the unknown phone",
  reason(d({ key: "note", source: "agent", known: false })), "not_agent_writable");

// 4 · NFR-1 bounds.
check("121 chars in a short text is too_long", reason(d({ value: "ا".repeat(121) })), "too_long");
check("120 chars in a short text is accepted (control)", reason(d({ value: "ا".repeat(120) })), null);
check("2001 chars in a note is too_long", reason(d({ key: "note", value: "ا".repeat(2001) })), "too_long");
check("2000 chars in a note is accepted (control)", reason(d({ key: "note", value: "ا".repeat(2000) })), null);
check("a due date 3 years out gets its OWN reason, not a length error", reason(d({ due: NOW + 3 * 365 * 24 * 3600e3 })), "bad_date");
check("a due date 2 years back gets its OWN reason, not a length error", reason(d({ due: NOW - 2 * 365 * 24 * 3600e3 })), "bad_date");
check("a due date next week is accepted (control)", reason(d({ due: NOW + 7 * 24 * 3600e3 })), null);
check("an unreadable due date gets its OWN reason, not a length error", reason(d({ due: Number.NaN })), "bad_date");

// 5 · BR-1, the hard invariant. A human fact is never replaced by a machine reading.
const HUMAN = { value: "د. سارة — مديرة العمليات", source: "human", by: "اللوحة", ts: NOW - 5000 };
const refused = decideProp({ key: "decisionMaker", value: "مدير تقنية المعلومات", source: "agent",
  by: "agent:insights", known: true, current: HUMAN, now: NOW });
// decisionMaker is not agent-writable at all this increment, so BR-1 is proven on a key the agent
// CAN write — otherwise the refusal would be the wrong refusal.
const contestedCase = decideProp({ key: "nextStep", value: "زيارة الأسبوع القادم", source: "agent",
  by: "agent:record_schedule", known: true, current: { ...HUMAN, value: "اتصال يوم الأحد" }, now: NOW });
check("a human decisionMaker is refused to the agent (human-only)", reason(refused), "not_agent_writable");
check("a human value survives a differing agent re-infer",
  [contestedCase.applied, reason(contestedCase), contestedCase.prop.value, contestedCase.prop.source,
   contestedCase.prop.by, contestedCase.prop.ts],
  [false, "human_value_wins", "اتصال يوم الأحد", "human", "اللوحة", NOW - 5000]);
check("the disagreement is stored ONCE as contested",
  contestedCase.prop.contested, { value: "زيارة الأسبوع القادم", by: "agent:record_schedule", ts: NOW });
const identical = decideProp({ key: "nextStep", value: "اتصال يوم الأحد", source: "agent",
  by: "agent:record_schedule", known: true, current: { ...HUMAN, value: "اتصال يوم الأحد" }, now: NOW });
check("an identical re-inference churns no contested",
  [identical.applied, reason(identical), identical.prop ?? null], [false, "human_value_wins", null]);
// The other direction is NOT symmetric: a human always outranks a stored agent reading.
const corrected = decideProp({ key: "nextStep", value: "اتصال الاثنين", source: "human", by: "اللوحة",
  known: true, current: { value: "اتصال الأحد", source: "agent", by: "agent:record_schedule", ts: NOW - 900 }, now: NOW });
check("a human CORRECTS an agent reading and keeps it as prior",
  [corrected.applied, corrected.prop.value, corrected.prop.source, corrected.prop.prior],
  [true, "اتصال الاثنين", "human", { value: "اتصال الأحد", by: "agent:record_schedule", ts: NOW - 900 }]);
// أكّد — the confirmation that makes the confirmation-rate metric computable at all.
const confirmed = decideProp({ key: "nextStep", value: "اتصال الأحد", source: "human", by: "اللوحة",
  known: true, current: { value: "اتصال الأحد", source: "agent", by: "agent:record_schedule", ts: NOW - 900 }, now: NOW });
check("أكّد stamps prior with the agent reading it confirms",
  [confirmed.applied, confirmed.prop.source, confirmed.prop.prior.value, confirmed.prop.prior.ts],
  [true, "human", "اتصال الأحد", NOW - 900]);
// An accepted write settles the disagreement; a stale «قراءة مختلفة» must not outlive it.
const settled = decideProp({ key: "nextStep", value: "اتصال الاثنين", source: "human", by: "اللوحة",
  known: true, current: { ...HUMAN, value: "اتصال الأحد", contested: { value: "زيارة", by: "agent:x", ts: NOW - 10 } }, now: NOW });
check("an accepted human write clears a stale contested", settled.prop.contested ?? null, null);

// 6 · empty.
check("an empty human value erases the key back to «ناقص»",
  [d({ value: "   " }).applied, d({ value: "   " }).remove, d({ value: "" }).prop ?? null], [true, true, null]);
check("an empty AGENT value is refused, never a silent clear",
  reason(d({ value: "  ", source: "agent" })), "empty_value");

// NEGATIVE CONTROL. A guard that only ever refuses proves nothing.
const fresh = decideProp({ key: "nextStep", value: "يرسل المتطلبات غدًا", source: "agent",
  by: "agent:record_schedule", known: true, current: undefined, now: NOW });
check("an agent write to a MISSING key IS applied (control)",
  [fresh.applied, reason(fresh), fresh.prop.value, fresh.prop.source, fresh.prop.ts, fresh.prop.prior ?? null],
  [true, null, "يرسل المتطلبات غدًا", "agent", NOW, null]);
const freshHuman = decideProp({ key: "note", value: "طلب عرضًا مكتوبًا", source: "human", by: "اللوحة", known: true, now: NOW });
check("a human write to a MISSING key IS applied (control)",
  [freshHuman.applied, freshHuman.prop.source, freshHuman.prop.by], [true, "human", "اللوحة"]);

// writeProp itself, through the real function: with no DATABASE_URL a write CANNOT succeed, and it
// must say so rather than mutate memory (NFR-3, risk R3 — local dev pretending a save succeeded).
const P = "966500000901";
tracker.getContact(P, "gate");
const np = await writeProp(P, "note", "قيمة لن تصل للسجل", "human", "gate");
check("with no database a human write returns not_persisted",
  [np.applied, np.persisted, np.reason], [false, false, "not_persisted"]);
check("…and memory was NOT mutated behind that failure",
  tracker.findContact(P).props.note ?? null, null);
const npAgent = await writeProp(P, "note", "x", "agent", "agent:t");
check("a refused agent write never reaches the ledger at all",
  [npAgent.applied, npAgent.reason], [false, "not_agent_writable"]);
check("writeProp never throws — the caller reads a reason", true, true);

// The grounded-truth block (BR-7d) shows حقيقة only, and never the internal note.
const facts = humanFactsBlock({ props: {
  decisionMaker: { value: "د. سارة", source: "human", by: "اللوحة", ts: NOW },
  nextStep: { value: "اتصال الأحد", source: "agent", by: "agent:x", ts: NOW },
  note: { value: "سرّي — لا يُقال للعميل", source: "human", by: "اللوحة", ts: NOW },
  disqualifyReason: { value: "no_need: غير مناسب", source: "human", by: "اللوحة", ts: NOW },
} });
check("grounded truth carries the human fact", facts.includes("د. سارة"), true);
check("grounded truth excludes a machine reading", facts.includes("اتصال الأحد"), false);
check("grounded truth never leaks the internal note", facts.includes("سرّي"), false);
// Our INTERNAL judgement of the account, not a fact about the customer. The model paraphrases what
// it is handed, and telling a clinic we filed them as unsuitable ends the relationship.
check("grounded truth never leaks our disqualification", facts.includes("غير مناسب"), false);
check("no human facts → an empty block, not a heading", humanFactsBlock({ props: {} }), "");
check("a contact with no props at all does not throw", humanFactsBlock({}), "");

// --- (b) structure ----------------------------------------------------------
// The half that matters. Everything above passes even if agent.ts writes `c.props` directly.
const read = (f) => readFileSync(join(root, f), "utf8");
const src = { tracker: read("src/tracker.ts"), db: read("src/db.ts"), index: read("src/index.ts"), agent: read("src/agent.ts") };
const OTHERS = ["src/index.ts", "src/agent.ts", "src/insights.ts", "src/dashboard.ts", "src/accounts.ts",
  "src/segments.ts", "src/outbound.ts", "src/gupshup.ts", "src/templates.ts", "src/audience.ts"];

// THE SINGLE DOOR. Nothing outside tracker.ts may assign a props object or reach the ledger writer.
for (const f of OTHERS) {
  let body;
  try { body = read(f); } catch { continue; }   // optional modules
  const assigns = body.match(/\.props\s*=[^=]/g) ?? [];
  const ledger = body.match(/upsertProps\s*\(/g) ?? [];
  check(`${f} assigns no .props directly`, assigns, []);
  check(`${f} does not call upsertProps`, ledger, []);
}
check("only db.ts and tracker.ts know upsertProps exists",
  ["src/db.ts", "src/tracker.ts"].filter((f) => read(f).includes("upsertProps")),
  ["src/db.ts", "src/tracker.ts"]);

// THE UPSERT TRAP (AC-5 / R2). props must not ride the shared upsert — not even COALESCE'd.
const upStart = src.db.indexOf("export function upsertContact(");
const upEnd = src.db.indexOf("\nexport function insertMessage", upStart);
if (upStart < 0 || upEnd < 0) { console.log("FAIL [inert] upsertContact anchors moved in src/db.ts"); failures++; }
else check("upsertContact's SQL contains no props", /props/.test(src.db.slice(upStart, upEnd)), false);
check("the props column exists in the migration", src.db.includes("ADD COLUMN IF NOT EXISTS props JSONB"), true);
// One ALTER on a missing table aborts every later statement (db.ts §90) — it must follow the CREATE.
check("the props ALTER follows the contacts CREATE",
  src.db.indexOf("CREATE TABLE IF NOT EXISTS contacts") < src.db.indexOf("ADD COLUMN IF NOT EXISTS props"), true);
// One transaction, or a crash leaves tags corrected and provenance missing (BR-2).
const upsPropsBody = src.db.slice(src.db.indexOf("export async function upsertProps("),
  src.db.indexOf("/** Mark a campaign as a sandbox"));
for (const frag of ["NotPersisted", "BEGIN", "COMMIT", "ROLLBACK", "DELETE FROM interest_tags"]) {
  check(`upsertProps contains ${frag}`, upsPropsBody.includes(frag), true);
}
check("upsertProps THROWS when the ledger is unreachable — it does not return early",
  /throw new NotPersisted/.test(upsPropsBody) && !/if \(!pool \|\| !connected\) return/.test(upsPropsBody), true);
// QA-1: `connected` is latched false by pool.on("error") and nothing flipped it back, so a routine
// Postgres failover refused every write until the PROCESS restarted — while the panel printed
// «أعد المحاولة», an instruction it could not honour. A human's typed fact must re-test the pool
// before being refused.
check("…and it RE-PROBES a latched-off pool before refusing a human's fact",
  /await reprobe\(\)/.test(upsPropsBody), true);
check("reprobe actually re-tests the connection rather than just reading the flag",
  /async function reprobe[\s\S]{0,400}SELECT 1[\s\S]{0,200}connected = true/.test(src.db), true);

// writeProp must delegate to the guard, or the behaviour half above tests dead code.
const wpBody = src.tracker.slice(src.tracker.indexOf("export async function writeProp("),
  src.tracker.indexOf("export function humanFactsBlock("));
check("writeProp decides nothing itself — it calls decideProp", wpBody.includes("decideProp({"), true);
check("writeProp writes the ledger BEFORE memory",
  wpBody.indexOf("db.upsertProps") < wpBody.indexOf("propsOf(c)"), true);
check("Contact.props is Readonly, so the door cannot be walked around",
  src.tracker.includes("props: Readonly<Partial<Record<PropKey, Readonly<Prop>>>>"), true);

// THE NAMED CALL SITES. A re-routing that got dropped must fail the build, not ship silently.
// Regions are bounded by a START and an END anchor, never by a character window: a window one line
// too generous reads the NEXT call site's writeProp and passes a site that has none.
const block = (body, from, to) => {
  const i = body.indexOf(from);
  if (i < 0) return null;
  const j = body.indexOf(to, i + from.length);
  return j < 0 ? null : body.slice(i, j);
};
// Comments are not code. `agent.ts` in a prose sentence must not satisfy a BR-4 assertion, and a
// comment saying "never sets opted_out" must not read as setting it.
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const SITES = [
  // tag_interest reaches the door through tracker.addTag — asserted to delegate to writeProp below,
  // so the chain is proven end to end rather than at one end.
  ["agent.ts tag_interest → productInterest", src.agent, 'case "tag_interest"', 'case "offer_alternative"', "addTag("],
  ["agent.ts record_schedule → nextStep", src.agent, 'case "record_schedule"', 'case "mark_not_interested"', "nextStep"],
  ["agent.ts mark_not_interested → disqualifyReason", src.agent, 'case "mark_not_interested"', 'case "request_human_handoff"', "disqualifyReason"],
  ["agent.ts close_conversation → disqualifyReason", src.agent, 'case "close_conversation"', "\n    default:", "disqualifyReason"],
  ["agent.ts decline tap → disqualifyReason", src.agent, 'if (tapped(text) === "decline")', "// The trailing service phrase is allowed", "disqualifyReason"],
  ["index.ts /admin/contact/outcome → disqualifyReason", src.index, 'app.post("/admin/contact/outcome"', "\n});", "disqualifyReason"],
  ["index.ts /admin/contact/tags → productInterest", src.index, 'app.post("/admin/contact/tags"', "\n});", "productInterest"],
];
for (const [name, body, from, to, key] of SITES) {
  const b = block(body, from, to);
  if (b === null) { console.log(`FAIL [inert] anchors moved: ${from} … ${to} — this gate is no longer reading the real code`); failures++; continue; }
  check(`${name} routes through the door`, /propRead\(|writeProp\(|tracker\.addTag\(/.test(b) && b.includes(key), true);
}
// Every agent property write goes through propRead, and propRead performs NO source check of its
// own — the rule lives in tracker.ts or the next tool will be written without it.
const prBody = block(src.agent, "async function propRead(", "\nasync function notifyLead(");
check("propRead calls tracker.writeProp with source 'agent'",
  Boolean(prBody) && prBody.includes("tracker.writeProp(phone, key, value, \"agent\""), true);
check("agent.ts reaches the ledger only via propRead",
  (src.agent.match(/tracker\.writeProp\(/g) ?? []).length, 1);

// ONE TAG WRITER. addTag used to push into c.tags and fire db.insertTag outside any transaction —
// a second door, standing outside BR-1, so an operator could delete a fabricated tag in ملف العميل
// and the next inference put it straight back into the customers table.
const atBody = block(src.tracker, "export async function addTag(", "\n/** Curation fixes what we recorded");
if (atBody === null) { console.log("FAIL [inert] addTag anchors moved in src/tracker.ts"); failures++; }
else {
  check("addTag routes the tag set through writeProp", /writeProp\(/.test(code(atBody)), true);
  check("…and owns no persistence of its own", /db\./.test(code(atBody)), false);
  check("…logging the timeline entry only when the write was APPLIED", /r\.applied/.test(code(atBody)), true);
}
check("interest_tags is written by db.ts alone",
  ["src/db.ts", "src/tracker.ts", "src/agent.ts", "src/index.ts"].filter((f) => /INSERT INTO interest_tags/.test(read(f))),
  ["src/db.ts"]);
// Comments are not code: db.ts explains where insertTag went, and that sentence must not read
// as the function still existing.
check("…inside upsertProps and nowhere else — db.insertTag is gone", /insertTag/.test(code(src.db)), false);

// THE DELIBERATE NON-WRITERS. Opt-out is the customer's right (BR-3); a turn cap is a fact about us.
const NON_WRITERS = [
  ["opt-out", "if (isOptOut(text)) {", "// A human driving the chat must not be interrupted"],
  ["turn-cap handoff", "if (convTurns >= MAX_AGENT_TURNS) {", "if (!model) await initModel();"],
];
for (const [name, from, to] of NON_WRITERS) {
  const b = block(src.agent, from, to);
  if (b === null) { console.log(`FAIL [inert] anchors moved: ${from} … ${to}`); failures++; continue; }
  check(`${name} writes NO property`, /propRead\(|writeProp\(/.test(code(b)), false);
}

// BR-4 — no enrichment path may send. The route body must not be able to reach a sender.
const propsRouteRaw = block(src.index, 'app.post("/admin/contact/props"', "\n});");
const propsRoute = propsRouteRaw && code(propsRouteRaw);
if (propsRoute === null) { console.log("FAIL [inert] the props route was not found in src/index.ts"); failures++; }
else {
  check("the props route touches no gupshup", /gupshup\./.test(propsRoute), false);
  check("the props route touches no agent", /\bagent\./.test(propsRoute), false);
  check("the props route reaches no sender",
    /gupshup|sendText|sendTemplate|sendDocument|sendImage|safeSend|checkOutbound/.test(propsRoute), false);
  check("the props route authenticates like its siblings", propsRoute.includes("adminOk(req)"), true);
  check("the props route strips the phone to digits", propsRoute.includes('replace(/\\D/g, "")'), true);
  check("the props route 503s an unpersisted human fact", propsRoute.includes("503"), true);
  check("the props route validates EVERY key before writing any (NFR-2)",
    propsRoute.indexOf("unknown_property") < propsRoute.indexOf("tracker.writeProp("), true);
  // BR-3 — disqualification is our judgement; opt-out is the customer's right and never ours.
  check("the props route never sets opted_out", /opted_out|"opted_out"/.test(propsRoute), false);
  check("a human disqualification moves the outcome (BR-3)", propsRoute.includes("tracker.setOutcome("), true);
}
// BR-4 at the module level: the only module that writes props must have no runtime edge to the wire
// at all. tracker.ts imports gupshup as `import type` only, which tsc erases — so the COMPILED
// module cannot reach a sender even transitively, whatever a future route does.
check("dist/tracker.js has no runtime reference to gupshup",
  /gupshup/.test(readFileSync(join(root, "dist/tracker.js"), "utf8")), false);

// The panel must be able to tell the operator that a save is impossible, rather than 503-ing later.
check("/admin/customer/:phone reports propsWritable",
  /propsWritable: db\.enabled\(\)/.test(src.index), true);
// …and does NOT key it on the transient latch: greying out every editor because of a blip locks the
// operator out of a ledger that may already be back. The write re-probes and reports honestly at the
// moment of saving instead of pre-emptively disabling the panel.
check("…and does not gate the editors on the transient isConnected latch",
  /propsWritable: db\.enabled\(\) && db\.isConnected\(\)/.test(src.index), false);

// --- (c) the panel, EXECUTED ------------------------------------------------
// dashboard.ts is ONE template literal, so tsc sees none of the client code and every gate on it so
// far has been a substring match. These three defects all passed a green build and a green grep:
//   M1 propDraft emitted «منتج · نية مرتفعة» while interestPairs read only «منتج:hot», so a typed
//      correction parsed to [], the row fell back to the AGENT's tags, and rendered them SOLID
//      under «سجّلها عبدالعزيز» — the machine's guess wearing a human signature.
//   M2 the same request shipped the UNCHANGED c.tags, so deleting a fabricated tag did nothing.
//   M3 «غير مناسب» printed «سُجّلت النتيجة» on a 200 whose disqualifyReason never reached the ledger.
// So the panel block is LIFTED OUT of the built bundle and RUN. What is asserted is what ships.
const H = (await import(join(root, "dist/dashboard.js"))).DASHBOARD_HTML;
const cut = (from, to) => {
  const i = H.indexOf(from), j = H.indexOf(to, i);
  if (i < 0 || j < 0) { console.log(`FAIL [inert] dashboard anchor moved: ${from}`); failures++; return null; }
  return H.slice(i, j);
};
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtN = (n) => String(n).replace(/[0-9]/g, (x) => "٠١٢٣٤٥٦٧٨٩"[+x]);
const fmtD = (t) => (t ? "١٢ أغسطس" : "—");

const panelSrc = cut("const OPERATOR = ", "\nfunction vCustomer(ph) {");
// The region starts at PROP_AUDIT, not at propPost: the carry-forward table and propCarry ARE the
// M2 fix, and a region that began one line later would run the fix's caller without the fix.
const postSrc = cut("const PROP_AUDIT = [", "\nwindow.propOpen =");
const outSrc = cut("window.setOutcome = async (btn) => {", "\nwindow.refreshInsights =");
const saveSrc = cut("window.propSave = async () => {", "\n// أكّد — one tap");
const confirmSrc = cut("window.propConfirm = async (btn) => {", "\n// Clearing the date must be possible");
const apptSrc = cut("function appt(c) {", "// --- end appointment");
const morningSrc = cut("function vMorningList() {", "\nfunction vCustomers() {");
// THE ONE READER, executed. appt() and fmtDay() are what M3 reconciles the appointment to, so the
// three surfaces below are rendered against the REAL functions, not against a stub of them.
const A = apptSrc ? new Function("return (" + "function () { " + apptSrc + " return { appt: appt, fmtDay: fmtDay }; }" + ")")()() : null;
if (A) {
  const DAYMS = 1_763_000_000_000;
  check("M9 the shipped fmtDay emits a DAY, never a clock — 09:00 is dayToMs's sort key, not a fact",
    A.fmtDay(DAYMS).indexOf(":"), -1);
  check("M9 …and it is not empty (control)", A.fmtDay(DAYMS).length > 3, true);
  const withHuman = { scheduledAt: DAYMS, props: { nextStep: { value: "زيارة", source: "human", by: "عبدالعزيز", ts: 1, due: DAYMS } } };
  check("M9 a day a human typed reads as CONFIRMED, signed",
    [A.appt(withHuman).confirmed, A.appt(withHuman).by, A.appt(withHuman).at], [true, "عبدالعزيز", DAYMS]);
  check("M9 …the same day with the agent's signature does NOT",
    A.appt({ scheduledAt: DAYMS, props: { nextStep: { value: "زيارة", source: "agent", by: "agent:x", ts: 1, due: DAYMS } } }).confirmed, false);
  // The safety catch. If the two representations ever drifted, claiming a human confirmed a moment
  // he did not is the one error this panel exists to prevent — so drift reads as UNCONFIRMED.
  check("M9 …and a human day that DISAGREES with the stored appointment claims nothing",
    A.appt({ scheduledAt: DAYMS, props: { nextStep: { value: "زيارة", source: "human", by: "عبدالعزيز", ts: 1, due: DAYMS + 86400e3 } } }).confirmed, false);
  check("M9 …no appointment at all is null, never a zero rendered as a date", A.appt({ props: {} }), null);
}
if (panelSrc && postSrc && outSrc && saveSrc) {
  // fmtT is deliberately a DIFFERENT string from fmtD here: M1's constraint is that a human's day
  // renders WITHOUT the 09:00 dayToMs stores, and with one stub for both that would be unobservable.
  const fmtTime = () => "٠٩:٠٠";
  const panel = (d) => new Function("ctx", `
    const { esc, fmtN, fmtD, fmtT, appt, fmtDay } = ctx;
    let profileData = ctx.profileData, propEdit = null, propFlash = "";
    ${panelSrc}
    return { vFactsPanel, interestPairs, propDraft, interestWire, interestUnread, propEditorHtml, isoDay, dayToMs, interestLatest };
  `)({ esc, fmtN, fmtD, fmtT: fmtTime, appt: A && A.appt, fmtDay: A && A.fmtDay, profileData: d });
  const api = panel(null);

  // M1a — SYMMETRY. propDraft's output must parse back to the pairs it was drawn from.
  // #4 — every expectation about the stored shape is now the SERVER encoder's ACTUAL output. A
  // hand-written literal is a third encoder: it passes while the two real ones drift apart.
  const WIRE = formatInterest([{ product: "أشعة الأسنان", level: "hot" }, { product: "تقويم الأسنان", level: "warm" }]);
  const draft = api.propDraft("productInterest", { value: WIRE });
  check("«صحّح» offers Arabic, never a machine string", /hot|warm|cold/.test(draft), false);
  check("propDraft round-trips through interestPairs", api.interestPairs(draft), api.interestPairs(WIRE));
  check("…and re-encodes to the identical stored value", api.interestWire(api.interestPairs(draft)), WIRE);
  check("a hand-typed correction parses to one pair",
    api.interestPairs("أشعة الأسنان: نية مرتفعة"), [{ product: "أشعة الأسنان", level: "hot" }]);
  check("an emptied field parses to nothing", api.interestPairs(""), []);
  check("free text the parser cannot read stays free text", api.interestPairs("ما عاد مهتم"), []);

  // M1b — solid styling requires a non-empty parse AND a human. Rendered, not grepped.
  const P = "966500000901";
  const doc = (props, tags) => ({ contact: { phone: P, tags: tags || [], props: props || {} }, insights: {}, propsWritable: true });
  const TAGS = [{ product: "أشعة الأسنان", level: "hot", ts: 1 }];
  const row = (d) => { const h = panel(d).vFactsPanel(d); return h.slice(h.indexOf("الاهتمام"), h.indexOf("الخطوة التالية")); };
  const free = row(doc({ productInterest: { value: "ما عاد مهتم", source: "human", by: "عبدالعزيز", ts: 1 } }, TAGS));
  check("a human SENTENCE renders no chips at all", /class="chip/.test(free), false);
  check("…and never shows the agent's product as the human's", free.includes("أشعة الأسنان"), false);
  check("…while still reading as a fact", [/fval-a/.test(free), free.includes("سجّلها عبدالعزيز")], [false, true]);
  const set = row(doc({ productInterest: { value: "تقويم الأسنان:warm", source: "human", by: "عبدالعزيز", ts: 1 } }, TAGS));
  check("a human SET renders solid chips, signed by him",
    [/class="rd"/.test(set), set.includes("تقويم الأسنان"), set.includes("أشعة الأسنان"), set.includes("سجّلها عبدالعزيز")],
    [false, true, false, true]);
  const read3 = row(doc({ productInterest: { value: "أشعة الأسنان:hot", source: "agent", by: "agent:tag_interest", ts: 1 } }, TAGS));
  check("an agent reading renders dashed «قراءة» chips, signed as a reading",
    [/class="rd"/.test(read3), read3.includes("قراءة المساعد")], [true, true]);
  const only = row(doc(null, TAGS));
  check("with no property the tags still render, as a reading (control)",
    [/class="rd"/.test(only), only.includes("أشعة الأسنان")], [true, true]);

  // M2 — AC-7: the tag set that ships is the one the operator typed.
  let sent = null;
  let dueVal = null;                      // null = no date input on screen; "" = present but empty
  // `setEdit` models the ONE thing that may change a stored value: an open editor. propPost nulls
  // propEdit on every successful save (the editor closes), so a rig that set it once would silently
  // test the closed-editor path from the second call onward.
  const rig = new Function("ctx", `
    const { interestPairs, interestUnread, interestWire, OPERATOR, profilePhone, TOKEN, fetch, alertBar, fmtN, PROP_MAX, refresh, render, setTimeout, document, dayToMs } = ctx;
    let propEdit = null, propFlash = "";
    const profileData = ctx.profileData;
    ${postSrc}
    return { post: propPost, setEdit: (e) => { propEdit = e; } };
  `)({
    interestPairs: api.interestPairs, interestUnread: api.interestUnread, interestWire: api.interestWire, OPERATOR: "عبدالعزيز",
    profilePhone: P, TOKEN: "gate", fmtN, PROP_MAX: { productInterest: 800 },
    profileData: doc({ productInterest: { value: "أشعة الأسنان:hot", source: "agent", by: "agent:tag_interest", ts: 1 } }, TAGS),
    fetch: async (_u, o) => { sent = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ ok: true }) }; },
    alertBar: () => {}, refresh: async () => {}, render: () => {}, setTimeout: () => {},
    // FR-4's date control. The gate models the browser: getElementById returns the element when the
    // editor is open and null when it is not — exactly the branch propPost must survive. dueVal is
    // empty by default, so every existing assertion also proves a dateless save stays dateless.
    document: { getElementById: (id) => (id === "propdue" && dueVal !== null ? { value: dueVal } : null) },
    dayToMs: api.dayToMs,
  });
  // Every call below opens the editor for the key it saves, which is what propSave does.
  const post = async (k, v, keep) => { rig.setEdit({ key: k, val: String(v), err: "" }); return rig.post(k, v, keep); };
  await post("productInterest", "تقويم الأسنان: مهتم", true);
  check("a correction ships the TYPED set, never the unchanged c.tags",
    [sent.tags, sent.props.productInterest],
    [[{ product: "تقويم الأسنان", level: "warm" }], formatInterest([{ product: "تقويم الأسنان", level: "warm" }])]);
  await post("productInterest", "   ", true);
  check("clearing the field ships [] — the deletion AC-7 exists for",
    [sent.tags, sent.props.productInterest.trim()], [[], ""]);

  // FR-4 — the optional date. It had NO control on the panel at all (QA-5): the operator could not
  // record WHEN, which is the third thing this product exists to answer, and the bad_date validation
  // in decideProp was unreachable dead code. These prove the control reaches the ledger and that an
  // absent date stays absent rather than defaulting to today — an invented fact.
  dueVal = "2026-09-03";
  await post("nextStep", "زيارة الفرع", true);
  check("a date the operator picked reaches the route as {value, due}",
    [typeof sent.props.nextStep === "object", sent.props.nextStep.value,
     api.isoDay(sent.props.nextStep.due)],
    [true, "زيارة الفرع", "2026-09-03"]);
  dueVal = "";
  await post("nextStep", "زيارة الفرع", true);
  check("…an emptied date sends NO date, never today", typeof sent.props.nextStep, "string");
  dueVal = null;
  await post("nextStep", "زيارة الفرع", true);
  check("…and a save with no date control on screen is unaffected", typeof sent.props.nextStep, "string");
  check("dayToMs and isoDay round-trip the operator's day", api.isoDay(api.dayToMs("2026-09-03")), "2026-09-03");
  check("dayToMs refuses anything that is not a day", api.dayToMs("bogus"), undefined);

  await post("productInterest", "ما عاد مهتم", true);
  check("free text ships [] rather than leaving stale chips in the table",
    [sent.tags, sent.props.productInterest], [[], "ما عاد مهتم"]);
  await post("note", "ملاحظة", true);
  check("no other key ever carries tags (control)", sent.tags ?? null, null);

  // M3 — NFR-3: a 200 whose fact missed the ledger must not read as success.
  const bars = [];
  const outcome = (payload) => new Function("ctx", `
    const { TOKEN, fetch, alertBar, refresh } = ctx;
    ${outSrc.replace("window.setOutcome =", "const setOutcome =")}
    return setOutcome;
  `)({ TOKEN: "gate", alertBar: (m, e) => bars.push([m, e]), refresh: async () => {},
       fetch: async () => ({ ok: true, status: 200, json: async () => payload }) });
  await outcome({ status: "ok", disqualify: "not_persisted" })({ dataset: { ph: P, out: "not_a_fit" } });
  check("an unpersisted disqualification is reported, not swallowed",
    bars.at(-1), ["سُجّلت النتيجة، لكن سبب الاستبعاد لم يُحفظ", true]);
  await outcome({ status: "ok", disqualify: "saved" })({ dataset: { ph: P, out: "not_a_fit" } });
  check("a saved one still reads as success (control)", bars.at(-1)[1], false);
  await outcome({ status: "ok", disqualify: null })({ dataset: { ph: P, out: "meeting_booked" } });
  check("an outcome carrying no disqualification is untouched (control)", bars.at(-1)[1], false);
  await outcome({ status: "ok", disqualify: "not_persisted" })({ dataset: { ph: P, out: "clear" } });
  check("a failed WITHDRAWAL says what actually happened",
    bars.at(-1), ["أُزيلت النتيجة، لكن سبب الاستبعاد ما زال مسجّلًا", true]);

  // M4 — THE PRE-ANSWERED FORM. A <select> with nothing marked `selected` shows, and submits, its
  // FIRST option. سبب الاستبعاد opened on «السعر», so one click on «استبعد…» + حفظ filed a price
  // rejection the customer never stated, signed by the operator, and moved his outcome. This is the
  // fabricated-fact-wearing-a-human-signature defect, in a form no grep of the source would show —
  // the bug was in an ATTRIBUTE THAT WAS ABSENT. So the browser's own rule is modelled here.
  const domSelect = (html) => {
    const opts = [...html.matchAll(/<option value="([^"]*)"([^>]*)>/g)].map((m) => [m[1], /\sselected/.test(m[2])]);
    const on = opts.filter((o) => o[1])[0];
    return on ? on[0] : (opts.length ? opts[0][0] : null);   // no `selected` → the browser picks [0]
  };
  const dqDoc = (stored) => doc(stored ? { disqualifyReason: { value: stored, source: "human", by: "عبدالعزيز", ts: 1 } } : null);
  const dqEditor = (stored) => panel(dqDoc(stored))
    .propEditorHtml("disqualifyReason", stored ? api.propDraft("disqualifyReason", { value: stored }) : "", "");
  // propSave assembles the value; propPost is stubbed, so "filed nothing" means the ledger was
  // never even asked — not that it refused.
  const save = async (stored, typed, chosen) => {
    const edit = { key: "disqualifyReason", val: typed, err: "", sel: false };
    let sent2 = null;
    const fn = new Function("ctx", `
      const { document, render, propPost, profileData } = ctx;
      const propEdit = ctx.propEdit;
      ${saveSrc.replace("window.propSave =", "const propSave =")}
      return propSave;
    `)({
      document: { getElementById: (id) => (id === "propinp" ? { value: typed } : { value: chosen }) },
      render: () => {}, profileData: dqDoc(stored), propEdit: edit,
      propPost: async (k, v) => { sent2 = [k, v]; return true; },
    });
    await fn();
    return { sent: sent2, err: edit.err };
  };
  const NOPICK = "اختر سببًا من القائمة.";
  check("M4 with nothing stored, the option the browser would submit is UNFILABLE", domSelect(dqEditor("")), "");
  check("M4 …and no reason in the list is preselected", /<option value="price"[^>]*selected/.test(dqEditor("")), false);
  check("M4 …the neutral option is offered as a choice to make, not as an answer",
    dqEditor("").includes("اختر السبب…"), true);
  check("M4 حفظ with no reason picked files NOTHING, and says why",
    [(await save("", "", "")).sent, (await save("", "", "")).err], [null, NOPICK]);
  check("M4 …free text alone never becomes a reason either",
    [(await save("", "غالي علينا", "")).sent, (await save("", "غالي علينا", "")).err], [null, NOPICK]);
  check("M4 an EXPLICIT human pick files exactly what he picked (control)",
    (await save("", "غالي علينا", "price")).sent, ["disqualifyReason", "price: غالي علينا"]);
  check("M4 …and a pick with no free text files the bare reason (control)",
    (await save("", "", "no_need")).sent, ["disqualifyReason", "no_need"]);

  // M5 — CLEARING ACTUALLY CLEARS. propDraft strips the enum for editing and propSave used to put
  // it straight back, so an emptied box still shipped «price»: decideProp's erase path existed and
  // was unreachable from the panel. «— أزل الاستبعاد —» is the explicit human choice that reaches it.
  check("M5 a stored reason preselects ITSELF, never the first option", domSelect(dqEditor("price: غالي علينا")), "price");
  check("M5 …and the same neutral option becomes the way OUT of it, named for what it does",
    [dqEditor("price: غالي علينا").includes("— أزل الاستبعاد —"), dqEditor("price: غالي علينا").includes("اختر السبب…")], [true, false]);
  check("M5 «أزل الاستبعاد» ships an EMPTY value — the erase", (await save("price: غالي علينا", "", "")).sent, ["disqualifyReason", ""]);
  check("M5 …even with the old free text still sitting in the box",
    (await save("price: غالي علينا", "غالي علينا", "")).sent, ["disqualifyReason", ""]);
  const erase = decideProp({ key: "disqualifyReason", value: "", source: "human", by: "عبدالعزيز", known: true, now: NOW });
  check("M5 …and the guard reads that as remove, never as a stored empty string",
    [erase.applied, erase.remove === true, erase.prop ?? null], [true, true, null]);
  check("M5 re-saving the same pick is still a normal write (control)",
    (await save("price: غالي علينا", "غالي علينا", "price")).sent, ["disqualifyReason", "price: غالي علينا"]);

  // M6 — A PARTIAL PARSE IS NOT A SUCCESS. «منتج أ: مهتم، منتج ب: مهتم جدا» stored one pair, dropped
  // the other, and printed «حُفظ في ملف العميل» over the loss. Data loss reported as success is the
  // same honesty defect as M3.
  let asked = false, sent3 = null;
  const edit3 = { key: "productInterest", val: "", err: "", sel: false };
  const post3 = new Function("ctx", `
    const { interestPairs, interestUnread, interestWire, OPERATOR, profilePhone, TOKEN, fetch, alertBar, fmtN, PROP_MAX, refresh, render, setTimeout, document, dayToMs } = ctx;
    let propEdit = ctx.propEdit, propFlash = "";
    const profileData = ctx.profileData;
    ${postSrc}
    return propPost;
  `)({
    interestPairs: api.interestPairs, interestUnread: api.interestUnread, interestWire: api.interestWire,
    OPERATOR: "عبدالعزيز", profilePhone: P, TOKEN: "gate", fmtN, PROP_MAX: { productInterest: 800 },
    profileData: doc(null, TAGS), propEdit: edit3,
    fetch: async (_u, o) => { asked = true; sent3 = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ ok: true }) }; },
    alertBar: () => {}, refresh: async () => {}, render: () => {}, setTimeout: () => {},
    // FR-4's date control. The gate models the browser: getElementById returns the element when the
    // editor is open and null when it is not — exactly the branch propPost must survive. dueVal is
    // empty by default, so every existing assertion also proves a dateless save stays dateless.
    document: { getElementById: (id) => (id === "propdue" && dueVal !== null ? { value: dueVal } : null) },
    dayToMs: api.dayToMs,
  });
  const attempt = async (typed) => { asked = false; sent3 = null; edit3.err = ""; const r = await post3("productInterest", typed, true); return { r, asked, sent: sent3, err: edit3.err }; };
  const partial = await attempt("منتج أ: مهتم، منتج ب: مهتم جدا");
  check("M6 a half-understood set is REFUSED, and the ledger is never even asked",
    [partial.r, partial.asked, partial.sent], [false, false, null]);
  check("M6 …the refusal NAMES the segment that was not understood",
    [partial.err.includes("منتج ب: مهتم جدا"), partial.err.includes("منتج أ")], [true, false]);
  const whole = await attempt("منتج أ: مهتم، منتج ب: نية مرتفعة");
  check("M6 a fully understood set still saves, both products (control)",
    [whole.r, whole.sent.tags], [true, [{ product: "منتج أ", level: "warm" }, { product: "منتج ب", level: "hot" }]]);
  const sentence = await attempt("ما عاد مهتم");
  check("M6 a set that parses to NOTHING is a human sentence, still stored verbatim (control)",
    [sentence.r, sentence.sent.tags, sentence.sent.props.productInterest], [true, [], "ما عاد مهتم"]);
  // Duplicates: two chips and two interest_tags rows for one product. addTag drops the older entry;
  // the human path does the same now.
  const dup = await attempt("تقويم الأسنان: مهتم، تقويم الأسنان: نية مرتفعة");
  check("M6 the same product typed twice is ONE tag, last wins — as addTag does",
    [dup.sent.tags, dup.sent.props.productInterest],
    [[{ product: "تقويم الأسنان", level: "hot" }], formatInterest([{ product: "تقويم الأسنان", level: "hot" }])]);

  // M7 — THE TWO ENCODERS, PINNED. dashboard.interestWire (client, inside the template literal,
  // invisible to tsc) and tracker.formatInterest (server) are byte-identical today and nothing held
  // them together. What the panel WRITES is what the ledger must READ BACK; a shape that lives on
  // one side only is this repo's standing defect class. Cross-module equality, not a literal.
  const PAIRSETS = [
    [],
    [{ product: "أشعة الأسنان", level: "hot" }],
    [{ product: "أشعة الأسنان", level: "hot" }, { product: "تقويم الأسنان", level: "warm" }],
    [{ product: "تبييض", level: "cold" }, { product: "زرعات", level: "warm" }, { product: "ابتسامة هوليوود", level: "hot" }],
    // The last two are adversarial on purpose: a product carrying the pair separator, and one
    // carrying the level separator. Neither ROUND-TRIPS — but both encoders must still agree
    // byte for byte on what was written, which is what this pin is for.
    [{ product: "منتج · يحمل الفاصل نفسه", level: "warm" }],
    [{ product: "product: with a colon", level: "hot" }],
  ];
  for (const set of PAIRSETS) {
    check("M7 interestWire === tracker.formatInterest · " + (set.length ? set.map((t) => t.product).join(" + ") : "empty set"),
      api.interestWire(set), formatInterest(set));
  }
  check("M7 …and the operator's own draft closes the loop through the SERVER encoder",
    api.interestWire(api.interestPairs(api.propDraft("productInterest", { value: formatInterest(PAIRSETS[2]) }))),
    formatInterest(PAIRSETS[2]));
  check("M7 …the panel READS what the server WRITES, back to the same pairs",
    api.interestPairs(formatInterest(PAIRSETS[3])), PAIRSETS[3]);

  // M8 — «أكّد» MUST NOT NARROW THE VALUE IT CONFIRMS. (CPO round-33 M2.)
  // The shipped propConfirm is executed against the shipped propPost with getElementById returning
  // null for EVERYTHING — which is what a confirm IS, because a confirm opens no editor. Before the
  // fix the request body was {"props":{"nextStep":"زيارة الفرع"}}: the day the operator was
  // confirming was deleted BY the act of confirming it, and the product's most valuable action was
  // its lossiest. Measured request bodies, not a source grep.
  const DUE = 1_763_000_000_000;
  let cBody = null;
  const confirmRig = (props) => new Function("ctx", `
    const { interestPairs, interestUnread, interestWire, OPERATOR, profilePhone, TOKEN, fetch, alertBar, fmtN, PROP_MAX, refresh, render, setTimeout, document, dayToMs } = ctx;
    let propEdit = ctx.propEdit || null, propFlash = "";
    const profileData = ctx.profileData;
    ${postSrc}
    ${confirmSrc.replace("window.propConfirm =", "const propConfirm =")}
    return propConfirm;
  `)({
    interestPairs: api.interestPairs, interestUnread: api.interestUnread, interestWire: api.interestWire,
    OPERATOR: "عبدالعزيز", profilePhone: P, TOKEN: "gate", fmtN, PROP_MAX: { nextStep: 120 },
    profileData: doc(props), propEdit: null,
    fetch: async (_u, o) => { cBody = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ ok: true }) }; },
    alertBar: () => {}, refresh: async () => {}, render: () => {}, setTimeout: () => {},
    // A CONFIRM OPENS NO EDITOR. Every control is off screen, so every getElementById returns null —
    // the exact browser state the old code read the date out of.
    document: { getElementById: () => null },
    dayToMs: api.dayToMs,
  });
  const AGENT_DATED = { nextStep: { value: "زيارة الفرع الرئيسي", source: "agent", by: "agent:record_schedule", ts: 1, due: DUE } };
  cBody = null;
  await confirmRig(AGENT_DATED)({ dataset: { k: "nextStep" } });
  check("M8 «أكّد» ships the DAY it is confirming, not a bare string that drops it",
    [typeof cBody.props.nextStep, cBody.props.nextStep.value, cBody.props.nextStep.due],
    ["object", "زيارة الفرع الرئيسي", DUE]);
  // THE GENERIC PROOF. A fix written as `key === "nextStep"` passes the assertion above and fails
  // this one: the seventh property added next quarter must be preserved with no edit to the panel.
  cBody = null;
  await confirmRig({ nextStep: { value: "زيارة", source: "agent", by: "agent:x", ts: 1, due: DUE, owner: "قسم الأسنان" } })({ dataset: { k: "nextStep" } });
  check("M8 …and a field this panel has never heard of survives the confirm too (the seventh property)",
    [cBody.props.nextStep.due, cBody.props.nextStep.owner], [DUE, "قسم الأسنان"]);
  check("M8 …while the LEDGER's own provenance is never echoed back as if the panel owned it",
    ["source", "by", "ts", "prior", "contested"].filter((f) => cBody.props.nextStep[f] !== undefined), []);
  cBody = null;
  await confirmRig({ nextStep: { value: "زيارة", source: "agent", by: "agent:x", ts: 1 } })({ dataset: { k: "nextStep" } });
  check("M8 …a DATELESS reading still confirms as a bare string — no date is invented (control)",
    typeof cBody.props.nextStep, "string");
  cBody = null;
  await confirmRig({ nextStep: { value: "زيارة", source: "human", by: "عبدالعزيز", ts: 1, due: DUE,
    contested: { value: "اتصال", by: "agent:x", ts: 2 } } })({ dataset: { k: "nextStep", use: "c" } });
  check("M8 «اعتمدها» adopts the contested TEXT and still keeps the day on the record",
    [cBody.props.nextStep.value, cBody.props.nextStep.due], ["اتصال", DUE]);


  // M13 — «أكّد» ON A READING WITH NO BACKING PROPERTY MUST NOT BE A DEAD BUTTON.
  // propState renders a reading from c.tags or c.scheduledSaid alone (a hydrated contact), and
  // propRow puts «أكّد» beside it — but propConfirm opened with a bare early return, so the button
  // was reachable and did NOTHING. A control that is drawn is a promise. It now confirms exactly the
  // value on screen: the same tag reduction the row drew itself from, or the customer's own sentence.
  let cAlert = null;
  const rigTags = (contact) => new Function("ctx", `
    const { interestPairs, interestUnread, interestWire, interestLatest, OPERATOR, profilePhone, TOKEN, fetch, alertBar, fmtN, PROP_MAX, refresh, render, setTimeout, document, dayToMs } = ctx;
    let propEdit = null, propFlash = "";
    const profileData = ctx.profileData;
    ${postSrc}
    ${confirmSrc.replace("window.propConfirm =", "const propConfirm =")}
    return propConfirm;
  `)({
    interestPairs: api.interestPairs, interestUnread: api.interestUnread, interestWire: api.interestWire,
    interestLatest: api.interestLatest,
    OPERATOR: "عبدالعزيز", profilePhone: P, TOKEN: "gate", fmtN, PROP_MAX: { nextStep: 120, productInterest: 800 },
    profileData: { contact }, propEdit: null,
    // The request body and the toast are captured SEPARATELY: alertBar also fires on SUCCESS, so
    // sharing one variable let the success toast overwrite the very body under test.
    fetch: async (_u, o) => { cBody = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ ok: true }) }; },
    alertBar: (m) => { cAlert = m; }, refresh: async () => {}, render: () => {}, setTimeout: () => {},
    document: { getElementById: () => null }, dayToMs: api.dayToMs,
  });
  cBody = null; cAlert = null;
  await rigTags({ phone: P, props: {}, tags: [{ product: "أشعة الأسنان", level: "hot", ts: 2 }] })({ dataset: { k: "productInterest" } });
  check("M13 «أكّد» on a tag-only reading confirms the tags on screen, it does not silently do nothing",
    [cBody && cBody.props ? cBody.props.productInterest : null, cBody && cBody.tags ? cBody.tags.length : null],
    [formatInterest([{ product: "أشعة الأسنان", level: "hot" }]), 1]);
  cBody = null; cAlert = null;
  await rigTags({ phone: P, props: {}, tags: [], scheduledSaid: "الأحد صباحًا" })({ dataset: { k: "nextStep" } });
  check("M13 …and on a scheduledSaid-only reading it confirms the customer's own sentence",
    cBody && cBody.props ? cBody.props.nextStep : null, "الأحد صباحًا");
  cBody = null; cAlert = null;
  await rigTags({ phone: P, props: {}, tags: [] })({ dataset: { k: "productInterest" } });
  check("M13 …and with genuinely nothing to confirm it SAYS so rather than failing mutely, and writes nothing",
    [cAlert, cBody], ["لا توجد قراءة لتأكيدها.", null]);

  // M9 — THE HUMAN'S DAY IS RENDERED, AND ONLY THE DAY. (CPO round-33 M1.)
  // Measured by rendering the shipped vFactsPanel: the row used to print the value and its
  // signature and NOTHING about the date, while the same fixture with source:'agent' printed the
  // machine's guess at the day — the guess visible, the confirmed fact invisible.
  const nsRow = (d) => { const h = panel(d).vFactsPanel(d); return h.slice(h.indexOf("الخطوة التالية"), h.indexOf("ملاحظة")); };
  const DAYTXT = A.fmtDay(DUE);
  const humanDoc = { contact: { phone: P, tags: [], scheduledAt: DUE,
    props: { nextStep: { value: "زيارة الفرع الرئيسي", source: "human", by: "عبدالعزيز", ts: 1, due: DUE } } },
    insights: {}, propsWritable: true };
  const humanRow = nsRow(humanDoc);
  check("M9 a human's dated next step RENDERS its day", humanRow.includes(DAYTXT), true);
  check("M9 …signed, so a row lifted out of context still says who recorded it",
    humanRow.includes("سجّله عبدالعزيز"), true);
  check("M9 …and NEVER the 09:00 nobody typed — a fabricated fact under a human signature",
    humanRow.includes("٠٩:٠٠"), false);
  check("M9 …nor «لم تُؤكَّد بعد» over an appointment a human confirmed",
    humanRow.includes("لم تُؤكَّد بعد"), false);
  const agentDoc = { contact: { phone: P, tags: [], scheduledAt: DUE,
    props: { nextStep: { value: "زيارة الفرع الرئيسي", source: "agent", by: "agent:record_schedule", ts: 1, due: DUE } } },
    insights: {}, propsWritable: true };
  const agentRow = nsRow(agentDoc);
  check("M9 the agent's reading keeps its existing treatment — the hour it parsed, and unconfirmed",
    [agentRow.includes("٠٩:٠٠"), agentRow.includes("لم تُؤكَّد بعد"), agentRow.includes("قراءتنا")], [true, true, true]);
  const noneRow = nsRow({ contact: { phone: P, tags: [], scheduledSaid: "الصباح", props: {} }, insights: {}, propsWritable: true });
  check("M9 a phrase we could not read a date from says so, and invents nothing (control)",
    [noneRow.includes("قراءتنا لم تُؤكَّد بعد."), noneRow.includes(DAYTXT)], [true, false]);

  // M10 — قائمة الصباح LEARNS THE OPERATOR'S DAY. (CPO round-33 M3a.) The screen whose own source
  // comment quotes the founder's three questions read c.scheduledAt alone, so the answer he typed
  // to the third question never reached the list he works from in the morning.
  const morning = (rows) => new Function("ctx", `
    const { esc, fmtN, fmtT, fmtDay, appt } = ctx;
    const cache = { contacts: ctx.rows }, showTest = true;
    ${morningSrc}
    return vMorningList();
  `)({ esc, fmtN, fmtT: fmtTime, fmtDay: A.fmtDay, appt: A.appt, rows: rows });
  const mHuman = morning([{ phone: P, waName: "مجمع النور", outcome: "scheduled", scheduledSaid: "الأحد الصباح",
    scheduledAt: DUE, props: { nextStep: { value: "زيارة", source: "human", by: "عبدالعزيز", ts: 1, due: DUE } } }]);
  check("M10 a day the operator confirmed reaches قائمة الصباح", [mHuman.includes(DAYTXT), mHuman.includes("مؤكَّد")], [true, true]);
  check("M10 …and the list stops calling it unconfirmed", mHuman.includes("لم تُؤكَّد بعد"), false);
  check("M10 …while the customer's own words still lead the row (control)", mHuman.includes("«الأحد الصباح»"), true);
  const mAgent = morning([{ phone: P, waName: "مجمع النور", outcome: "scheduled", scheduledSaid: "الأحد الصباح",
    scheduledAt: DUE, props: { nextStep: { value: "زيارة", source: "agent", by: "agent:x", ts: 1, due: DUE } } }]);
  check("M10 an unconfirmed reading is still labelled as ours (control)",
    [mAgent.includes("قراءتنا"), mAgent.includes("لم تُؤكَّد بعد"), mAgent.includes(DAYTXT)], [true, true, false]);
  const mInterested = morning([{ phone: P, waName: "مجمع النور", outcome: "interested", scheduledAt: DUE,
    props: { nextStep: { value: "زيارة", source: "human", by: "عبدالعزيز", ts: 1, due: DUE } } }]);
  check("M10 …and a confirmed day answers «متى؟» outside موعد محدد too",
    [mInterested.includes("موعد مؤكَّد"), mInterested.includes(DAYTXT)], [true, true]);
}
// --- (d) ONE APPOINTMENT, ONE PLACE ----------------------------------------
// M3's structural half. M9/M10 above prove two surfaces render the confirmed day; this proves no
// THIRD surface can go on reading the raw field behind their backs — which is how «مؤكَّد» reached
// one screen and not the two others in the first place. The status strip is inside vCustomer (216
// lines, not liftable), so it is pinned structurally with an inert-guard anchor.
{
  const i = H.indexOf("function appt(c) {"), j = H.indexOf("// --- end appointment");
  if (i < 0 || j < 0) { console.log("FAIL [inert] the appointment reader is gone from the bundle"); failures++; }
  else {
    const outside = code(H.slice(0, i) + H.slice(j));
    check("M11 c.scheduledAt is read in exactly ONE place in the shipped bundle — appt()",
      (outside.match(/c\.scheduledAt/g) ?? []).length, 0);
    check("M11 …and appt() is what the surfaces call instead",
      (code(H).match(/appt\(c\)/g) ?? []).length >= 3, true);
  }
  const strip = cut('if (c.outcome === "scheduled" && c.scheduledSaid) {', "} else if (c.outcomeEvidence) {");
  if (strip) {
    // This line appended «لم تُؤكَّد بعد» unconditionally, so a meeting a human had confirmed 200px
    // below read as unconfirmed forever.
    check("M11 the status strip reads the ONE appointment", /appt\(c\)/.test(strip), true);
    check("M11 …and «لم تُؤكَّد بعد» finally has a confirmed form beside it",
      [strip.includes("مؤكَّد: "), strip.includes("لم تُؤكَّد بعد")], [true, true]);
    check("M11 …and prints the DAY there too, never the 09:00", /fmtDay\(/.test(strip), true);
  }
}

// M12 — BR-1 GOVERNS THE APPOINTMENT ITSELF. Executed against dist/tracker.js, no Postgres needed:
// setSchedule mutates memory and persist() is a no-op with no DATABASE_URL. Without this, one new
// sentence from the customer would replace the day the operator confirmed with a fresh guess — the
// same class as M2, one layer down, and it would silently un-confirm the record.
{
  const SP = "966500000903";
  const HUMANDAY = NOW + 6 * 24 * 3600e3;
  const c1 = tracker.getContact(SP, "gate");
  // props is Readonly to TypeScript only; the gate reaches past it deliberately to build the state
  // an applied human write would leave, which is not observable without a database.
  c1.props.nextStep = { value: "زيارة الفرع", source: "human", by: "عبدالعزيز", ts: NOW, due: HUMANDAY };
  tracker.setSchedule(SP, "بكرة صباحًا");
  // «بكرة صباحًا» is a phrase readTime CAN read, so there is a real competing reading to defeat.
  check("M12 a customer's new phrase never overwrites the day a human typed",
    [tracker.findContact(SP).scheduledAt, tracker.findContact(SP).scheduledSaid], [HUMANDAY, "بكرة صباحًا"]);
  const SP2 = "966500000904";
  tracker.getContact(SP2, "gate");
  tracker.setSchedule(SP2, "بكرة صباحًا");
  const read2 = tracker.findContact(SP2).scheduledAt;
  check("M12 …with no human day, our reading of the phrase still lands (control)",
    [typeof read2, read2 > Date.now()], ["number", true]);
}
// The write-through itself needs Postgres to observe, so it is pinned structurally — with the
// clearing half named, because upsertContact COALESCEs scheduled_at and a clear that used persist()
// alone would come back on the next redeploy.
{
  const wp = src.tracker.slice(src.tracker.indexOf("export async function writeProp("),
    src.tracker.indexOf("export function humanFactsBlock("));
  check("M12 writeProp writes the appointment a human typed onto the contact the portal reads",
    /k === "nextStep" && source === "human"/.test(wp) && /c\.scheduledAt = Number\(due\)/.test(wp), true);
  check("M12 …and an erase clears it only when the standing appointment was HIS",
    /heldBefore !== undefined/.test(wp) && /db\.clearSchedule\(phone\)/.test(wp), true);
  check("M12 …with its own statement, because upsertContact COALESCEs scheduled_at",
    /export function clearSchedule/.test(src.db) && /SET scheduled_at = NULL/.test(src.db), true);
  const ss = src.tracker.slice(src.tracker.indexOf("export function setSchedule("),
    src.tracker.indexOf("/** Best-effort reading of an Arabic time phrase"));
  check("M12 …and setSchedule asks humanDue before it writes a reading over anything",
    /humanDue\(c\)/.test(code(ss)), true);
}

// The route must keep TELLING the panel: the honest message is only possible if the field arrives.
if (propsRoute !== null) {
  const outRoute = block(src.index, 'app.post("/admin/contact/outcome"', "\n});");
  check("the outcome route reports whether the disqualification persisted",
    Boolean(outRoute) && /disqualify/.test(outRoute) && /r\.applied \? "saved"/.test(outRoute), true);
}

console.log(`\n${failures ? failures + " FAILURES" : "props guard: all green"}`);
if (failures) process.exit(1);

// Rule 7: bound the claim. This gate covers the guard's decision ladder, the single-door property
// across src/ (tags included, since addTag now goes through it), the upsert trap, the seven named
// call sites, the two deliberate non-writers, and — executed against the built bundle — the
// الاهتمام round-trip, the tag set a correction ships, the disqualification message, the
// pre-answered <select> (M4), the erase path (M5), the partial-parse refusal (M6), and the
// cross-module equality of the two interest encoders (M7). It
// does NOT exercise Postgres — an APPLIED end-to-end write is proven separately against a real
// database, because a gate that needs a DB would be skipped in CI and that is worse than a gate
// that states its boundary.
console.log("NOTE: no Postgres here by design — applied writes are proven against a real database");
console.log("      in the cycle's proof run. This gate covers the ladder + the single door.");
