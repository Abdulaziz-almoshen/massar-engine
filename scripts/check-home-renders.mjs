// GATE STEP: «الرئيسية» MUST RENDER.
//
// WHY THIS EXISTS. The home payload shipped twice with a function that no longer existed — once
// because a helper was dropped with the layout it lived in, once because a patch aborted half-way
// and wrote the CALL without the function. Both times `tsc` passed, `new Function(HOME_DS_JS)`
// parsed cleanly, and the live page rendered eighteen characters: a name is only missing at CALL
// time. So this executes the real payload against a fake ledger and asserts the screen comes back.
//
// The stubs are the page's own globals. If a new one is needed, the failure names it.
const { HOME_DS_JS } = await import(new URL("../dist/home-ds-crm.js", import.meta.url));
const day = 86400000, now = Date.now();
const g = {
  cache: { contacts: [
    { phone: "1", waName: "أ", transcript: [
      { ts: now - 2 * day, role: "agent", text: "x" },
      { ts: now - 2 * day, role: "customer", text: "y" },
      { ts: now - 40 * day, role: "agent", text: "z" }], statusTimes: { sent: now - 2 * day } },
    { phone: "2", test: true, transcript: [{ ts: now - day, role: "agent" }] } ] },
  fmtN: (n) => String(Number(n || 0)),
  esc: (s) => String(s == null ? "" : s),
  clip: (s, n) => String(s || "").slice(0, n),
  fmtD: () => "أمس",
  opPl: (n, a, b, c, d) => (n === 1 ? a : n === 2 ? b : n <= 10 ? n + " " + c : n + " " + d),
  mPl: (n, a, b, c, d) => (n === 1 ? a : n === 2 ? b : n <= 10 ? n + " " + c : n + " " + d),
  dsD: () => {}, dsFig: (k, v) => String(v),
  oppRows: [{ id: 1, product: "س", stage: "contact", sale_price: 10, years: 1, qty: 1, discount: 0,
              created_at: now - 5 * day, stage_at: now - 5 * day, account_name: "ج" }],
  acRows: [{ id: 1, approval: "approved", sector: "قطاع المستشفيات", ownerId: null, createdAt: now - 3 * day },
           { id: 2, approval: "approved", sector: "", ownerId: 3, createdAt: now - 60 * day }],
  pcCat: [{ product: "س", sector: "قطاع المستشفيات", packages: [] }],
  pcQuarters: { year: 2026, currentQuarter: 3, byProduct: [] },
  pcSectors: { periodEnd: now + 10 * day, sectors: [] },
  pcPerf: { 2026: { "س": { product: "س", achieved: 0, openValue: 0, openLines: 1, unpricedOpenLines: 0,
            annualTarget: 34000, quarters: [{ quarter: 3, target: 34000, achieved: 0 }] } } },
  opIsOpen: (l) => l.stage !== "won" && l.stage !== "lost",
  opIsWon: (l) => l.stage === "won",
  opValue: (l) => l.sale_price * l.years * l.qty,
  opDays: () => 5,
  opOpenStages: () => [{ key: "contact", label: "تواصل أولي" }, { key: "quote", label: "عرض السعر" }],
  parseISODate: () => null, toISODate: () => "2026-09-19",
  mDateRange: () => "<div></div>", render: () => {},
  window: { addEventListener: () => {} }, document: { addEventListener: () => {} },
};
const names = Object.keys(g);
const fn = new Function(...names, HOME_DS_JS + "\n;return { vHomeDs: vHomeDs, hdsActivity: hdsActivity };");
const api = fn(...names.map((n) => g[n]));
const act = api.hdsActivity(30);
console.log("activity buckets:", act.buckets.length, "| step:", act.step);
const hit = act.buckets.filter((b) => b.out || b.inb);
console.log("buckets with traffic:", JSON.stringify(hit));
let bad = 0;
const c = (name, pass, detail) => {
  console.log((pass ? "ok   " : "FAIL ") + name + (detail ? " — " + detail : ""));
  if (!pass) bad++;
};
c("the activity series buckets a day at a time over 30", act.step === "day" && act.buckets.length === 30,
  act.step + ", " + act.buckets.length + " buckets");
c("a test contact is not counted as traffic", hit.length === 1 && hit[0].out === 1 && hit[0].inb === 1,
  JSON.stringify(hit));
c("traffic older than the window is excluded", act.buckets.every((b) => b.out + b.inb <= 2));

const html = api.vHomeDs();
c("the screen renders", html.length > 4000, html.length + " chars");
for (const needle of ["hx-kpi", "hx-r2", "hx-r3", "النشاط", "خط البيع", "الحسابات حسب القطاع", "المستهدف", "آخر الأحداث"]) {
  c("it carries «" + needle + "»", html.includes(needle));
}
// The landmark scripts/smoke.py asserts on #home: if it moves, smoke goes red on the next deploy.
c("it carries the smoke landmark «الإيراد المحقق»", html.includes("الإيراد المحقق"));
console.log(bad ? "\nhome render: " + bad + " FAILED" : "\nhome render: all green");
process.exit(bad ? 1 : 0);
