// Seed a LOCAL massar-engine with plausible dummy data.
//
// Why this exists: there is no DATABASE_URL outside Fly, and Fly does not let secret values be
// read back, so a local instance boots memory-only with an empty ledger and every screen renders
// the day-one empty state. That state is worth seeing once, but it is not browsable.
//
// It seeds through the REAL admin HTTP API, not by reaching into module internals, so every row
// goes through the same validators the portal uses — an invalid line fails here exactly as it
// would in production.
//
// SAFETY. This script never calls a send route. The four that reach WhatsApp
// (/admin/send-test, /admin/send-template, /admin/campaign/launch, /admin/campaign/test) are
// listed in FORBIDDEN below and asserted against every request before it is made, so a careless
// edit fails loudly instead of messaging a real clinic. Point it only at localhost.
//
// Usage:  node scripts/seed-local.mjs [baseUrl] [adminToken]
//         node scripts/seed-local.mjs http://127.0.0.1:8080 local

const BASE = process.argv[2] || "http://127.0.0.1:8080";
const TOKEN = process.argv[3] || "local";

// Belt and braces: a seeder that can reach production is a seeder that will, eventually.
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) {
  console.error(`refusing to seed a non-local target: ${BASE}`);
  process.exit(1);
}

const FORBIDDEN = ["/admin/send-test", "/admin/send-template", "/admin/campaign/launch", "/admin/campaign/test"];

let ok = 0, failed = 0;

async function post(path, body, { auth = "admin" } = {}) {
  if (FORBIDDEN.some((f) => path.startsWith(f))) {
    throw new Error(`BLOCKED: ${path} can send a real message. The seeder never calls it.`);
  }
  const url = BASE + path + (auth === "webhook" ? `?token=${TOKEN}` : "");
  const headers = { "Content-Type": "application/json" };
  if (auth === "admin") headers["x-admin-token"] = TOKEN;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 120) }; }
  if (!res.ok || json.ok === false || json.error) {
    failed++;
    console.log(`  ✗ ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 140)}`);
  } else {
    ok++;
  }
  return json;
}

// Riyadh, Jeddah, Dammam, Khobar, Madinah — the shape of a real Saudi clinic book.
const ACCOUNTS = [
  ["مجمع النور الطبي",            "966500000801", "متوسط", "الرياض"],
  ["عيادات صحة الأسرة",           "966500000802", "صغير",  "الرياض"],
  ["مستشفى الأمل التخصصي",        "966500000803", "كبير",  "جدة"],
  ["مركز البسمة لطب الأسنان",     "966500000804", "صغير",  "جدة"],
  ["مجموعة الرعاية المتقدمة",     "966500000805", "كبير",  "الدمام"],
  ["عيادات الواحة",               "966500000806", "متوسط", "الخبر"],
  ["مركز الحياة للجلدية",         "966500000807", "صغير",  "الرياض"],
  ["مستوصف السلام",               "966500000808", "متوسط", "المدينة المنورة"],
  ["مجمع ابن سينا الطبي",         "966500000809", "كبير",  "الرياض"],
  ["عيادات النخبة",               "966500000810", "صغير",  "جدة"],
];

const FACTS = [
  ["966500000801", { systemKind: "نظام معلومات صحي", hisName: "Cerner", branches: "٣", integrationStatus: "قيد الدراسة" }],
  ["966500000803", { systemKind: "نظام معلومات صحي", hisName: "Epic", branches: "١", customerType: "مستشفى خاص", transactionVolume: "عالٍ" }],
  ["966500000805", { hisName: "InterSystems", erpName: "SAP", branches: "٧", integrationStatus: "مُنفَّذ جزئيًا", blocker: "انتظار موافقة تقنية المعلومات" }],
  ["966500000806", { systemKind: "نظام عيادات", hisName: "ClinicSoft", branches: "٢", usageLevel: "متوسط" }],
  ["966500000809", { hisName: "Cerner", branches: "٥", customerType: "مجمع طبي", contractStatus: "تفاوض" }],
];

const OPPS = [
  ["مجمع النور الطبي",        "966500000801", "تكامل الأنظمة",     "present",  "whatsapp", 120000, 2, 3],
  ["مستشفى الأمل التخصصي",    "966500000803", "تكامل الأنظمة",     "negotiate","referral", 480000, 3, 1],
  ["مجموعة الرعاية المتقدمة", "966500000805", "الإجازات المرضية",  "tech",     "visit",    260000, 1, 7],
  ["عيادات الواحة",           "966500000806", "الإجازات المرضية",  "contact",  "whatsapp",  45000, 1, 2],
  ["مجمع ابن سينا الطبي",     "966500000809", "تكامل الأنظمة",     "won",      "call",     310000, 2, 5],
  ["عيادات صحة الأسرة",       "966500000802", "الإجازات المرضية",  "contact",  "inbound",   28000, 1, 1],
  ["مركز البسمة لطب الأسنان", "966500000804", "الإجازات المرضية",  "lost",     "whatsapp",  22000, 1, 1],
  ["مستوصف السلام",           "966500000808", "تكامل الأنظمة",     "present",  "visit",     95000, 1, 2],
];

// Inbound WhatsApp turns, in the Gupshup v2 envelope the webhook actually parses.
// The agent cannot reply: OPENAI_API_KEY and GUPSHUP_API_KEY are both blank in a seeded run.
const INBOUND = [
  ["966500000801", "السلام عليكم، وصلتني رسالتكم عن التكامل. عندنا Cerner في ثلاثة فروع."],
  ["966500000801", "كم تقريبًا التكلفة السنوية؟"],
  ["966500000803", "نعم مهتمين. متى ممكن نحدد اجتماع مع الفريق التقني؟"],
  ["966500000805", "الموضوع عند تقنية المعلومات الآن، أعطونا أسبوعين."],
  ["966500000806", "ما فهمت الخدمة بالضبط، ممكن توضيح؟"],
  ["966500000802", "شكرًا، بس حاليًا ما عندنا ميزانية لهذي السنة."],
  ["966500000804", "إيقاف"],
  ["966500000809", "تم توقيع العقد أمس، شكرًا لكم."],
  ["966500000807", "أرسلوا لي كراسة المنتج على الإيميل لو سمحتم."],
];

const NOTES = [
  ["966500000801", "طلب مقارنة سعرية مع مزوّد آخر. أرسلت له جدول الفروقات."],
  ["966500000805", "الاجتماع التقني تأجل مرتين. المسؤول التقني هو صاحب القرار الحقيقي."],
  ["966500000803", "أبدى استعدادًا للتوقيع خلال الربع الحالي إذا اكتمل التكامل مع Epic."],
];

const TASKS = [
  ["966500000801", "إرسال العرض المحدّث بعد مراجعة السعر", 2],
  ["966500000805", "متابعة موافقة تقنية المعلومات", 5],
  ["966500000806", "مكالمة توضيحية عن الخدمة", 1],
  ["966500000803", "تنسيق الاجتماع التقني", 3],
];

const wa = (phone, text, i) => ({
  app: "Massar",
  type: "message",
  payload: {
    id: `wamid.SEED${i}`,
    source: phone,
    type: "text",
    sender: { phone, name: "" },
    payload: { text },
  },
});

async function main() {
  console.log(`seeding ${BASE}\n`);

  // Products are tags, and an opportunity line is rejected unless its product is a KNOWN tag.
  // That is the catalogue guard doing its job, so the seeder registers them first rather than
  // routing around it.
  console.log("products");
  for (const name of ["تكامل الأنظمة", "الإجازات المرضية"]) {
    await post("/admin/tags", { name });
  }

  console.log("accounts");
  await post("/admin/entities", {
    text: ACCOUNTS.map((a) => a.join("، ")).join("\n"),
  });

  console.log("conversations");
  for (let i = 0; i < INBOUND.length; i++) {
    const [phone, text] = INBOUND[i];
    await post("/webhooks/gupshup", wa(phone, text, i), { auth: "webhook" });
  }
  // The webhook acks before processing, so give the queue a beat to drain before the
  // facts and notes below attach to contacts it is still creating.
  await new Promise((r) => setTimeout(r, 600));

  console.log("facts");
  for (const [phone, facts] of FACTS) {
    await post("/admin/entity/facts", { phone, by: "بذرة محلية", facts });
  }

  // Shape matters here: the account and its provenance sit at the TOP level, and `lines` carries
  // one row per product. Nesting account_name inside a line is rejected as invalid_field.
  console.log("opportunities");
  for (const [account_name, phone, product, stage, source, sale_price, years, qty] of OPPS) {
    await post("/admin/opps", {
      by: "بذرة محلية",
      account_name, phone, source,
      lines: [{ product, stage, sale_price, years, qty }],
    });
  }

  console.log("notes");
  for (const [phone, content] of NOTES) {
    await post("/admin/notes", { by: "بذرة محلية", ref_kind: "contact", ref_id: phone, content });
  }

  console.log("tasks");
  const day = 86400000;
  for (const [phone, title, inDays] of TASKS) {
    await post("/admin/tasks", {
      by: "بذرة محلية", ref_kind: "contact", ref_id: phone,
      title, due_at: Date.now() + inDays * day,
    });
  }

  // Targets make «المستهدفات والأداء» show something. Deliberately NOT hit on every product, so
  // the screen also demonstrates its "no target set" state rather than only its happy path.
  console.log("targets");
  const perf = await (await fetch(BASE + "/admin/sales/performance", { headers: { "x-admin-token": TOKEN } })).json();
  for (const [product, amount] of [["تكامل الأنظمة", 4000000], ["الإجازات المرضية", 1500000], ["التقارير الطبية", 800000]]) {
    await post("/admin/sales/targets", { product, year: perf.year, quarter: perf.quarter, amount });
  }

  console.log(`\n${ok} ok, ${failed} failed`);
  const h = await (await fetch(BASE + "/health")).json();
  console.log(`ledger: ${h.db.counts?.contacts ?? "?"} contacts, ${h.db.counts?.messages ?? "?"} messages | accounts known: ${h.accounts.known}, with facts: ${h.accounts.withFacts}`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
