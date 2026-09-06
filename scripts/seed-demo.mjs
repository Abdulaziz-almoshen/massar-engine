// Demo data for the screens built this cycle: the sector board, the products screen, the four named
// reports and the four-quarter view. Adds to what seed-local.mjs creates (contacts, conversations,
// opportunities, tasks, notes) rather than replacing it.
//
// SAFETY. This script never makes an HTTP request, so unlike seed-local.mjs it cannot reach a send
// route even by accident — it writes through the engine's own db module. It still refuses a
// non-local database, because a seeder that can reach production is a seeder that will.
//
// It writes through the REAL writers (createOppLines, recordEngagement, setTarget, upsertPackage),
// not raw INSERTs, so the actions and ledger rows the reports read are created the way the product
// creates them. Demo data written by a fake writer proves nothing about the screens.
//
// NOTE: `source` stores an ENGLISH key (call / visit / referral / inbound / whatsapp / other) and
// the Arabic «مكالمة · زيارة · إحالة» is a display label mapped from it. Passing the label writes
// a row that fails opportunities_source_check.
//
// Usage: DATABASE_URL=postgres://…/massar_demo node scripts/seed-demo.mjs

const URL_ = process.env.DATABASE_URL || "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(URL_)) {
  console.error(`refusing to seed a non-local database: ${URL_.replace(/:[^:@]*@/, ":***@")}`);
  process.exit(1);
}
const db = await import("../dist/db.js");
await db.init();

const DAY = 86400000, now = Date.now();
const ago = (d) => now - d * DAY;
let made = 0;

// Deals that the four reports must find. Each is created AT the stage its outcome belongs to, then
// the outcome is recorded through recordEngagement — which is what writes the action and the
// stage-ledger row the reports actually read.
const BLOCKED = [
  { account: "مستشفى الأمل التخصصي", product: "الإجازات المرضية", stage: "negotiate", key: "awaiting_procurement", price: 95000, qty: 1, years: 1, days: 23 },
  { account: "مجمع الرياض الطبي",     product: "الإجازات المرضية", stage: "negotiate", key: "awaiting_procurement", price: 18000, qty: 3, years: 1, days: 11 },
  { account: "شركة صحة الخليج",       product: "فحص الموظفين",     stage: "negotiate", key: "contract_edit",        price: 140000, qty: 1, years: 2, days: 17 },
  { account: "مختبرات النخبة",        product: "التقارير الطبية",   stage: "tech",      key: "awaiting_tech",        price: 60000, qty: 1, years: 1, days: 8 },
  { account: "صيدليات الدواء الحديث", product: "الشهادات الصحية",   stage: "present",   key: "needs_tech_clarity",   price: 45000, qty: 2, years: 1, days: 4 },
];

const LOST = [
  { account: "مستشفى الشفاء العام", product: "تكامل الأنظمة (HIS/ERP)", stage: "tech", key: "integration_failed", price: 220000, qty: 1, years: 1, days: 31 },
  { account: "مجمع عيادات المستقبل", product: "الإجازات المرضية",       stage: "lost", key: "lost_integration",   price: 95000, qty: 1, years: 2, days: 12 },
];

/** Push this deal's action and ledger rows back N days, so a report has something to measure. */
async function ageRows(oppId, days) {
  const pool = db.__poolForDemo ? db.__poolForDemo() : null;
  const pg = (await import("pg")).default;
  const p = new pg.Pool({ connectionString: URL_ });
  try {
    await p.query("UPDATE actions SET created_at = $2 WHERE opp_id = $1", [oppId, ago(days)]);
    await p.query(
      "UPDATE track_stage_events SET effective_at = to_timestamp($2 / 1000.0) WHERE opp_id = $1",
      [oppId, ago(days)]);
    // Also the engagement: the loss report prefers the LATEST of (ledger, engagement), so ageing
    // only the ledger left every loss reading «منذ ٠ يومًا» on data seeded to be weeks old.
    await p.query(
      "UPDATE engagements SET occurred_at = to_timestamp($2 / 1000.0) WHERE opp_id = $1",
      [oppId, ago(days)]);
  } finally { await p.end(); }
}

async function seedDeal(d, i) {
  const [opp] = await db.createOppLines(
    { account_name: d.account, phone: null, source: "call", source_ref: null, created_by: "بيانات تجريبية" },
    [{ product: d.product, stage: d.stage, sale_price: d.price, qty: d.qty, years: d.years, discount: 0,
       owner: ["سارة", "خالد", "نورة"][i % 3] }]);
  if (!opp) { console.error(`  could not create «${d.account}» — is «${d.product}» in tags?`); return; }
  // Recorded AT a legitimate time — recordEngagement refuses a backdate beyond two days, on
  // purpose, so an unbounded occurred_at cannot rewrite a quiet week into a compliant one. Demo
  // data still needs deals that have been stuck for weeks, so the engagement is recorded honestly
  // and the resulting rows are aged afterwards. That ageing is a DEMO concern and belongs here,
  // never in a writer the product uses.
  const r = await db.recordEngagement({
    idemKey: `demo-${d.key}-${opp.id}`, contactPhone: "966500000000", oppId: opp.id,
    rep: ["سارة", "خالد", "نورة"][i % 3], kind: "call", outcomeKey: d.key,
    occurredAt: Date.now() - 60_000, note: null,
  });
  if (!r.ok) { console.error(`  ${d.account}: ${r.error}${r.field ? " (" + r.field + ")" : ""}`); return; }
  await ageRows(opp.id, d.days);
  made++;
  console.log(`  ${d.account.padEnd(26)} ${d.key.padEnd(22)} منذ ${d.days} يومًا  (${r.actionsCreated} إجراء)`);
}

console.log("\nصفقات متوقفة (تغذّي التقارير الثلاثة الأولى):");
for (const [i, d] of BLOCKED.entries()) await seedDeal(d, i);

console.log("\nخسائر التكامل (تغذّي التقرير الرابع):");
for (const [i, d] of LOST.entries()) await seedDeal(d, i + 7);

// Four quarters of targets, so «الإنجاز الربعي» has four bars with different shapes rather than
// one filled quarter and three empty ones.
const YEAR = new Date().getFullYear();
console.log(`\nمستهدفات ${YEAR} الأربعة:`);
for (const [q, amount] of [[1, 1200000], [2, 1500000], [3, 1800000], [4, 2000000]]) {
  const ok = await db.setTarget("الإجازات المرضية", YEAR, q, amount, "بيانات تجريبية");
  console.log(`  الربع ${q}: ${amount.toLocaleString("ar-SA")} ${ok ? "" : "(فشل)"}`);
}
await db.setTarget("فحص الموظفين", YEAR, 3, 400000, "بيانات تجريبية");
await db.setTarget("التقارير الطبية", YEAR, 3, 250000, "بيانات تجريبية");

// A won deal in the current quarter, so «المحقق» is not zero on every screen.
const [win] = await db.createOppLines(
  { account_name: "مستشفى النور", phone: null, source: "referral", source_ref: null, created_by: "بيانات تجريبية" },
  [{ product: "الإجازات المرضية", stage: "negotiate", sale_price: 95000, qty: 4, years: 1, discount: 5, owner: "سارة" }]);
if (win) {
  const r = await db.recordEngagement({
    idemKey: `demo-won-${win.id}`, contactPhone: "966500000000", oppId: win.id, rep: "سارة",
    // «agreed» at negotiate is what ADVANCES a deal into won; «signed» belongs to the won stage
    // itself, so recording it on a negotiate-stage deal is rejected as outcome_not_valid_for_stage.
    kind: "visit", outcomeKey: "agreed", occurredAt: Date.now() - 60_000, note: null });
  if (r.ok) await ageRows(win.id, 6);
  console.log(`\nصفقة مربوحة: مستشفى النور · ${r.ok ? "٣٦١٬٠٠٠ ر.س" : r.error}`);
}

console.log(`\n${made} صفقة تجريبية. لا رسالة واتساب أُرسلت — هذا السكربت لا يطلب HTTP إطلاقًا.`);
process.exit(0);
