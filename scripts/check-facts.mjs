#!/usr/bin/env node
// ---------------------------------------------------------------------------
// The account graph, asserted rather than assumed.
//
// The defect this cycle fixed was invisible for weeks precisely because nothing measured it:
// `ACCOUNTS_JSON` was never set on the deployed app, so `accountBlock()` returned "" for every
// real conversation and the agent interviewed every customer from scratch. The build was green,
// the tests passed, and the founder found it by reading a transcript.
//
// So the round trip is measured end to end here: a column in a spreadsheet becomes a typed fact,
// the fact reaches the system prompt as KNOWN, and the same key disappears from the list of things
// the agent is still allowed to ask about.
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";

const facts = await import("../dist/facts.js");
const accounts = await import("../dist/accounts.js");
const audience = await import("../dist/audience.js");

let failures = 0;
const c = (name, cond) => { if (!cond) failures++; console.log(`${cond ? "ok  " : "FAIL"} ${name}`); };
const NOW = 1_700_000_000_000;

// --- the guard: every branch of decideFact ----------------------------------
{
  const base = { value: "HIS", source: "agent", by: "agent:record_fact", said: "عندنا نظام HIS", now: NOW };

  c("unknown key is reported, never dropped",
    facts.decideFact({ ...base, key: "hisFlavour" }).reason === "unknown_fact");

  c("agent may not write a commercial term",
    facts.decideFact({ ...base, key: "pricing", value: "95,000" }).reason === "not_agent_writable");

  c("agent may write the system kind", facts.decideFact({ ...base, key: "systemKind" }).applied === true);

  c("an over-long value is refused",
    facts.decideFact({ ...base, key: "systemKind", value: "x".repeat(61) }).reason === "too_long");

  // THE HARD INVARIANT — a human fact is never replaced by a machine reading.
  const human = { value: "Oracle Health", source: "human", by: "عبدالعزيز", ts: NOW - 1000 };
  const clash = facts.decideFact({ ...base, key: "hisName", value: "Epic", current: human });
  c("human fact wins over an agent reading", clash.applied === false && clash.reason === "human_value_wins");
  c("…and the disagreement is KEPT once, passively",
    clash.fact?.value === "Oracle Health" && clash.fact?.contested?.value === "Epic");
  c("…the human value itself is untouched",
    clash.fact?.source === "human" && clash.fact?.by === "عبدالعزيز");

  // A model reading with no customer sentence behind it is not a fact.
  c("an agent fact with no quoted source is refused",
    facts.decideFact({ ...base, key: "branches", value: "٧", said: "" }).reason === "no_evidence");
  c("…and a human needs no quote",
    facts.decideFact({ key: "branches", value: "7", source: "human", by: "عبدالعزيز", now: NOW }).applied === true);

  // Empty: an erase from a human, nothing from the agent.
  c("empty from a human clears the key",
    facts.decideFact({ key: "branches", value: "", source: "human", by: "عبدالعزيز", now: NOW }).remove === true);
  c("empty from the agent is refused with its own reason",
    facts.decideFact({ ...base, key: "branches", value: "" }).reason === "empty_value");

  // Provenance carried forward.
  const second = facts.decideFact({ ...base, key: "systemKind", value: "ERP",
    current: { value: "HIS", source: "agent", by: "agent:record_fact", ts: NOW - 5 } });
  c("a correction keeps what it replaced", second.fact?.prior?.value === "HIS");
  c("an accepted agent fact stores the customer's words", second.fact?.said === "عندنا نظام HIS");

  // Order is load-bearing: an unknown key is unknown before the source is judged.
  c("unknown key outranks the writability check",
    facts.decideFact({ ...base, key: "nope", source: "human" }).reason === "unknown_fact");
}

// --- readFacts sanitises a hand-edited row ----------------------------------
{
  const r = facts.readFacts({ hisName: { value: "Epic", source: "human", by: "x", ts: 5 }, junk: { value: "y" }, branches: { value: 7 } });
  c("readFacts keeps a well-formed fact", r.hisName?.value === "Epic");
  c("readFacts drops an unknown key", r.junk === undefined);
  c("readFacts drops a non-string value", r.branches === undefined);
}

// --- the spreadsheet is producer #1 -----------------------------------------
{
  const mapped = facts.factsFromAttrs({
    "نظام الـHIS": "Oracle Health", "عدد الفروع": "7", "حالة التكامل": "لا يوجد",
    "المدينة": "الرياض", "بريد المسؤول": "a@b.com",
  }, NOW);
  c("an HIS column becomes a typed fact", mapped.hisName?.value === "Oracle Health");
  c("a branch column becomes a typed fact", mapped.branches?.value === "7");
  c("an integration column becomes a typed fact", mapped.integrationStatus?.value === "لا يوجد");
  c("an imported fact is HUMAN-sourced and labelled", mapped.hisName?.source === "human" && mapped.hisName?.by === "import");
  c("unmapped columns are left alone, not guessed at", Object.keys(mapped).length === 3);
  c("an English ERP column maps too", facts.factsFromAttrs({ "ERP System": "SAP" }, NOW).erpName?.value === "SAP");
}

// --- the ladder: what may still be asked ------------------------------------
{
  const all = facts.missingKeys({});
  c("with nothing known, the system kind is asked FIRST", all[0] === "systemKind");
  c("…and the whole ladder is open", all.length === 6);

  const withHis = facts.missingKeys({ hisName: { value: "Epic", source: "human", by: "import", ts: NOW } });
  c("knowing the HIS name answers «HIS or ERP» — never asked again", !withHis.includes("systemKind"));
  c("…and the HIS name itself is not re-asked", !withHis.includes("hisName"));
  c("…while the open items remain open", withHis.includes("branches") && withHis.includes("hisArchitecture"));

  const erpShop = facts.missingKeys({ erpName: { value: "SAP", source: "human", by: "import", ts: NOW } });
  c("an ERP shop is not asked for an HIS name", !erpShop.includes("hisName") && !erpShop.includes("systemKind"));

  const full = facts.missingKeys({
    systemKind: { value: "HIS", source: "human", by: "import", ts: NOW },
    hisName: { value: "Epic", source: "human", by: "import", ts: NOW },
    branches: { value: "7", source: "human", by: "import", ts: NOW },
    hisArchitecture: { value: "مركزي", source: "human", by: "import", ts: NOW },
    integrationStatus: { value: "لا يوجد", source: "human", by: "import", ts: NOW },
    blocker: { value: "الميزانية", source: "agent", by: "agent:record_fact", ts: NOW },
  });
  c("a fully known account has NOTHING left to ask", full.length === 0);
}

// --- THE ROUND TRIP: a column reaches the system prompt as known -------------
{
  const { systemPrompt } = await import("../dist/agent.js");
  const contact = (phone) => ({ phone, transcript: [], tags: [], statusTimes: {}, optedOut: false, human: false, test: true, agentTurns: 0 });

  const imported = facts.factsFromAttrs(
    { "نظام الـHIS": "Oracle Health", "عدد الفروع": "7", "الخدمات المستخدمة": "الإجازات المرضية", "حجم العمليات": "≈1,400 إجازة شهريًا" },
    NOW);
  const a = accounts.accountOf("مجموعة طبية", imported);
  accounts.snapshot([{ ...a, phone: "966500000111" }]);

  const p = systemPrompt(contact("966500000111"));
  c("round trip: the imported HIS name is in the prompt as a known fact", p.includes("نظام الـHIS: Oracle Health"));
  c("round trip: the branch count is there too", p.includes("عدد الفروع: 7"));
  c("round trip: the agent is told not to re-ask known facts", p.includes("لا تسأل العميل أبدًا عن معلومة متاحة"));
  // THE FOUNDER'S COMPLAINT, measured: the answered question must be gone from the ask-list.
  const gapSection = p.slice(p.indexOf("٠ب) الناقص"), p.indexOf("٠ب) الناقص") + 400);
  c("round trip: the HIS name is NOT listed as something to ask", !gapSection.includes("نظام الـHIS"));
  c("round trip: «HIS or ERP» is NOT asked when the HIS is known", !gapSection.includes("نوع النظام المستخدم"));
  c("round trip: what is genuinely unknown IS listed", gapSection.includes("بنية النظام"));
  c("round trip: the agent is told to write answers back", p.includes("record_fact"));

  // Measured usage licenses the expansion motion.
  c("measured usage turns on the expansion motion", p.includes("هذه الجهة تستخدم خدمتنا فعلًا"));

  // A name and a city are NOT a licence to assert the customer's own operation back to them.
  accounts.snapshot([{ ...accounts.accountOf("عيادة", facts.factsFromAttrs({ "نوع الجهة": "مجمع" }, NOW)), phone: "966500000222" }]);
  const thin = systemPrompt(contact("966500000222"));
  c("a thin record does NOT claim they use us", !thin.includes("هذه الجهة تستخدم خدمتنا فعلًا"));
  c("…and the high-usage strategy stays withheld", !thin.includes("التواصل مع الاستخدام المرتفع"));
  c("…but the fact we DO hold is still stated", thin.includes("نوع الجهة: مجمع"));
  c("…and everything else is still open to ask", thin.includes("نوع النظام المستخدم"));

  // An unknown phone: no account file at all, ladder fully open.
  accounts.snapshot([]);
  const cold = systemPrompt(contact("966500000999"));
  c("unknown phone: no account file", !cold.includes("ملف الحساب"));
  c("unknown phone: the ask-order is still given", cold.includes("٠ب) الناقص"));
}

// --- the tool contract ------------------------------------------------------
{
  const agentSrc = readFileSync("src/agent.ts", "utf8");
  c("record_fact exists as a tool", agentSrc.includes('name: "record_fact"'));
  c("record_fact requires the customer's own words", agentSrc.includes('required: ["key", "value", "said"]'));
  // The evidence rule, in code and not only in the prompt (CLAUDE.md §4).
  const handler = agentSrc.slice(agentSrc.indexOf('case "record_fact"'), agentSrc.indexOf('case "record_fact"') + 1800);
  c("the handler verifies the quote against the customer's turns",
    handler.includes('x.role === "customer"') && handler.includes("quoted"));
  c("an unquoted reading is refused, not stored", handler.includes("لا تسجّل استنتاجًا كأنه حقيقة"));
  c("a human fact tells the model to stop retrying", handler.includes("لا تُعِد المحاولة"));
  // The enum the model picks from may not contain a key it is forbidden to write.
  const enumBlock = agentSrc.slice(agentSrc.indexOf('name: "record_fact"'), agentSrc.indexOf('name: "record_fact"') + 1400);
  for (const forbidden of ["pricing", "approvedDiscountRange", "contractStatus", "customerName"]) {
    c(`the tool enum excludes the human-only key «${forbidden}»`, !enumBlock.includes(`"${forbidden}"`));
  }
  for (const k of facts.FACT_KEYS) {
    if (!facts.isAgentWritable(k)) continue;
    c(`the tool enum offers the writable key «${k}»`, enumBlock.includes(`"${k}"`));
  }
}

// --- the portal shows what the agent knows ----------------------------------
// A fact the agent may state to a customer that no human can see is the same defect as a value the
// system writes but cannot read back. The labels and the ask-order are duplicated into the client
// bundle by necessity (it is one static template literal), so they are asserted equal here.
{
  const dash = readFileSync("src/dashboard.ts", "utf8");
  c("the client record renders the account panel", dash.includes("function vAccountPanel(d)") && dash.includes("+ vAccountPanel(d) +"));
  const labels = dash.slice(dash.indexOf("var ACC_LABELS = {"), dash.indexOf("var ACC_LADDER"));
  for (const k of facts.FACT_KEYS) {
    c(`portal label matches the contract for «${k}»`, labels.includes(`${k}: "${facts.FACT_LABELS[k]}"`));
  }
  const ladder = dash.slice(dash.indexOf("var ACC_LADDER = ["), dash.indexOf("var ACC_EXTRA"));
  const order = facts.missingKeys({});
  c("portal ask-order matches facts.ts GAP_ORDER",
    order.every((k) => ladder.includes(`"${k}"`)) && (ladder.match(/"/g) || []).length / 2 === order.length);
  c("the portal states the provenance of each fact", dash.includes("function accSig(f)") && dash.includes("من كلام العميل"));
  c("a refused agent reading is shown passively", dash.includes("قراءة مختلفة من المساعد"));
}

// --- the env blob is really gone --------------------------------------------
{
  const acc = readFileSync("src/accounts.ts", "utf8");
  const conf = readFileSync("src/config.ts", "utf8");
  c("accounts.ts no longer reads an env registry", !acc.includes("accountsJson"));
  c("ACCOUNTS_JSON is gone from config", !conf.includes("ACCOUNTS_JSON"));
  c("accounts are loaded from the entities table", acc.includes("db.listEntities()"));
  c("/health reports honest fact coverage", readFileSync("src/index.ts", "utf8").includes("withFacts: accounts.withFacts()"));
  // …and the coverage number must be able to be WRONG. Counting rendered lines made it equal the
  // row count for any registry at all — the deployed app reported 15 of 15 accounts "known" while
  // knowing nothing about 15 of them.
  accounts.snapshot([
    { ...accounts.accountOf("جهة بلا حقائق", {}), phone: "966500000001" },
    { ...accounts.accountOf("جهة بحقائق", facts.factsFromAttrs({ "نظام الـHIS": "Epic" }, NOW)), phone: "966500000002" },
  ]);
  c("a name-only row does NOT count as a known account",
    accounts.count() === 2 && accounts.withFacts() === 1);
}

// --- the import's TAG column -------------------------------------------------
// Founder: «other departments want to use Massar to market their products.» A department does not
// tick 3,000 checkboxes — it imports a sheet whose column already names its line. What is asserted
// here is the parse, because everything downstream trusts it.
{
  const XLSX = await import("xlsx");
  const sheet = (rows) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "s");
    return audience.parseAudienceFile(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), "t.xlsx");
  };

  const p1 = sheet([["الاسم", "الجوال", "المدينة", "خط المنتجات"],
                    ["أ", "966500000001", "الرياض", "تأمين المركبات، تأمين طبي"]]);
  c("a «خط المنتجات» column is read as tags, not as a segment column",
    p1.columns.tags.includes("خط المنتجات") && !p1.columns.attrs.includes("خط المنتجات"));
  c("…and one cell may name several, split on the Arabic comma",
    JSON.stringify(p1.rows[0].tags) === JSON.stringify(["تأمين المركبات", "تأمين طبي"]));
  // Landing in both stores would give one spreadsheet column two filters with two counts.
  c("…and the tag column does NOT also become an attribute",
    p1.rows[0].attrs["خط المنتجات"] === undefined && p1.rows[0].attrs["المدينة"] === "الرياض");

  // «المنتجات» stays with facts.currentProducts: one header cannot honestly mean both what an
  // account owns and who we plan to approach.
  const p2 = sheet([["الاسم", "الجوال", "المنتجات"], ["ب", "966500000002", "الإجازات المرضية"]]);
  c("«المنتجات» is still a FACT column, not a tag column",
    !p2.columns.tags.includes("المنتجات") && p2.rows[0].tags.length === 0);
  c("…and it still lands as currentProducts",
    facts.factsFromAttrs(p2.rows[0].attrs, NOW).currentProducts?.value === "الإجازات المرضية");

  // An unrecognised column is left alone rather than guessed into the vocabulary every filter reads.
  const p3 = sheet([["الاسم", "الجوال", "ملاحظات المندوب"], ["ج", "966500000003", "زرناهم مرتين"]]);
  c("an unrecognised column stays a segment column and mints no tag",
    p3.columns.tags.length === 0 && p3.rows[0].tags.length === 0 &&
    p3.columns.attrs.includes("ملاحظات المندوب"));

  c("a value too long to be a label is dropped, not truncated into a near-duplicate",
    audience.tagsFromCell("x".repeat(61)).length === 0 && audience.tagsFromCell("x".repeat(60)).length === 1);
  c("blank and repeated values collapse", JSON.stringify(audience.tagsFromCell("أ، ، أ , ب")) === JSON.stringify(["أ", "ب"]));
}

console.log(`\n${failures ? failures + " FAILURES" : "account graph: all green"}`);
if (failures) process.exit(1);
console.log("NOTE: asserts the CONTRACT and the round trip, not model behaviour. It cannot prove the");
console.log("      model calls record_fact when a customer answers — only that it may, that an");
console.log("      unquoted reading cannot be stored, and that a stored fact stops being asked.");
