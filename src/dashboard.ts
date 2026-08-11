// مَسار — the platform portal, built to the ORIGINAL prototype design (مسار.dc.html).
// Shell: navy sidebar + grouped nav + topbar. Marketing module screens:
//   متابعة الحملات — LIVE command center (funnel, contact tracker, transcripts)
//   إنشاء حملة    — the prototype's 4-step wizard, wired to today's backend (launch gated)
//   معرفة المنتج   — readiness view over the agent's real seed KB (editing = next phase)
//   شركاء المبيعات + non-marketing screens — the prototype's empty-state pattern.
// Single-file RTL SPA (hash router), 5s refresh from /admin/state (token → localStorage).

export const DASHBOARD_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>مَسار — نظام إدارة المبيعات</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; }
  body { font-family: 'IBM Plex Sans Arabic', sans-serif; background: #eef0f4; color: #1a2233; }
  ::selection { background: #3FB6B0; color: #fff; }
  .ms-scroll::-webkit-scrollbar { height: 10px; width: 10px; }
  .ms-scroll::-webkit-scrollbar-thumb { background: #cdd2da; border-radius: 999px; }
  .app { display: flex; height: 100vh; width: 100%; overflow: hidden; }

  /* ===== sidebar (prototype) ===== */
  aside { width: 264px; flex: none; background: linear-gradient(180deg, #2F5F94 0%, #1F4470 100%); color: #cdd6e6; display: flex; flex-direction: column; border-left: 1px solid #163257; }
  .brand { padding: 22px 22px 18px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 12px; }
  .brand .logo { width: 42px; height: 42px; flex: none; border-radius: 11px; background: linear-gradient(135deg, #3FB6B0, #2E8F89); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 22px; color: #1F4470; }
  .brand .t1 { font-size: 21px; font-weight: 700; color: #fff; line-height: 1; }
  .brand .t2 { font-size: 11.5px; color: #8ea3c0; margin-top: 4px; }
  nav { flex: 1; overflow-y: auto; padding: 14px 12px; }
  .grp { font-size: 11px; letter-spacing: .6px; color: #a9c2e0; padding: 15px 12px 8px; margin-top: 7px; font-weight: 700; border-top: 1px solid rgba(255,255,255,0.1); }
  .grp:first-child { border-top: none; margin-top: 0; }
  .nv { display: flex; align-items: center; gap: 12px; width: 100%; font-family: inherit; font-size: 13.5px; font-weight: 500; color: #cdd6e6; background: transparent; border: none; border-radius: 10px; padding: 11px 12px; cursor: pointer; text-align: right; margin-bottom: 3px; }
  .nv:hover { background: rgba(255,255,255,0.06); }
  .nv.on { font-weight: 700; color: #fff; background: rgba(201,162,39,0.14); }
  .nv .gx { width: 20px; height: 20px; flex: none; display: flex; align-items: center; justify-content: center; }
  .nv .lbl { flex: 1; }
  .nv .dot { width: 6px; height: 6px; border-radius: 999px; background: #3FB6B0; flex: none; display: none; }
  .nv.on .dot { display: block; }
  .g-sq { width: 13px; height: 13px; border-radius: 3px; background: #7f95b4; }
  .g-ci { width: 13px; height: 13px; border-radius: 999px; background: #7f95b4; }
  .g-di { width: 11px; height: 11px; background: #7f95b4; transform: rotate(45deg); border-radius: 2px; }
  .g-tr { width: 0; height: 0; border-right: 7px solid transparent; border-left: 7px solid transparent; border-bottom: 12px solid #7f95b4; }
  .g-ba { width: 13px; height: 13px; border-right: 3px solid #7f95b4; border-left: 3px solid #7f95b4; border-radius: 1px; }
  .g-ri { width: 13px; height: 13px; border-radius: 999px; border: 3px solid #7f95b4; }
  .g-tb { width: 13px; height: 13px; border-top: 3px solid #7f95b4; border-bottom: 3px solid #7f95b4; }
  .g-tree { width: 13px; height: 13px; border: 2px solid #7f95b4; border-radius: 3px; }
  .nv.on .gx > * { background-color: #3FB6B0; border-color: #3FB6B0; }
  .nv.on .g-tr { background: none; border-bottom-color: #3FB6B0; }
  .userbox { padding: 14px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 11px; }
  .userbox .av { width: 38px; height: 38px; flex: none; border-radius: 999px; background: #1c3a5e; display: flex; align-items: center; justify-content: center; color: #cdd6e6; font-weight: 700; font-size: 14px; }
  .userbox .n { font-size: 13px; font-weight: 700; color: #fff; }
  .userbox .r { font-size: 11px; color: #8ea3c0; }

  /* ===== main ===== */
  main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
  header { flex: none; height: 68px; background: #fff; border-bottom: 1px solid #e3e7ee; display: flex; align-items: center; gap: 18px; padding: 0 28px; }
  header .tt { flex: 1; min-width: 0; }
  header .t { font-size: 18px; font-weight: 700; color: #13294b; }
  header .s { font-size: 12px; color: #7b8597; margin-top: 2px; }
  .livechip { display: inline-flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 700; color: #2E7D77; background: #DCF1EF; border-radius: 999px; padding: 6px 13px; }
  .livechip .d { width: 7px; height: 7px; border-radius: 999px; background: #3FB6B0; }
  .body { flex: 1; overflow-y: auto; padding: 26px 28px 48px; }

  /* ===== shared components (prototype) ===== */
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 16px; margin-bottom: 22px; }
  .kpi { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 18px; }
  .kpi .k { font-size: 12.5px; color: #7b8597; margin-bottom: 12px; }
  .kpi .v { font-size: 28px; font-weight: 700; color: #13294b; line-height: 1; font-variant-numeric: tabular-nums; }
  .kpi .v small { font-size: 12px; font-weight: 500; color: #9aa4b4; }
  .card { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 20px; margin-bottom: 18px; }
  .card h3 { margin: 0 0 18px; font-size: 14.5px; font-weight: 700; color: #13294b; }
  .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
  .c-grey { background: #eef0f4; color: #6b7280; } .c-blue { background: #E3ECF8; color: #2F5F94; }
  .c-teal { background: #DCF1EF; color: #2E7D77; } .c-ok { background: #E6F4EC; color: #1f8a52; }
  .c-warn { background: #FBF2DD; color: #b5810f; } .c-bad { background: #FBE9E9; color: #c43d3d; }
  .fun { margin-bottom: 13px; }
  .fun .r1 { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
  .fun .l { font-size: 12px; font-weight: 600; color: #13294b; }
  .fun .m { font-size: 11.5px; color: #7b8597; font-variant-numeric: tabular-nums; }
  .fun .track { height: 9px; background: #eef0f4; border-radius: 999px; overflow: hidden; }
  .fun .fill { height: 100%; border-radius: 999px; min-width: 3%; }
  .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 90px 20px; text-align: center; }
  .empty .ic { width: 64px; height: 64px; border-radius: 16px; background: #fff; border: 1px solid #e3e7ee; display: flex; align-items: center; justify-content: center; margin-bottom: 18px; }
  .empty .ic span { width: 26px; height: 26px; border: 2px dashed #c2cad6; border-radius: 7px; }
  .empty .t { font-size: 17px; font-weight: 700; color: #13294b; }
  .empty .s { font-size: 13px; color: #7b8597; margin-top: 6px; max-width: 380px; line-height: 1.7; }

  /* campaign table */
  .tblwrap { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; overflow: hidden; margin-bottom: 18px; }
  .thead, .trow { display: grid; grid-template-columns: 1.7fr 2fr 1.6fr 1.6fr 0.8fr; gap: 12px; padding: 13px 18px; align-items: center; }
  .thead { background: #f8fafc; border-bottom: 1px solid #eef1f5; font-size: 11px; font-weight: 700; color: #7b8597; }
  .trow { border-bottom: 1px solid #f3f5f8; cursor: pointer; }
  .trow:hover { background: #fafbfd; }
  .trow:last-child { border-bottom: none; }
  .cust { display: flex; align-items: center; gap: 11px; min-width: 0; }
  .cust .av { width: 36px; height: 36px; flex: none; border-radius: 9px; background: #13294b; display: flex; align-items: center; justify-content: center; color: #3FB6B0; font-weight: 700; font-size: 15px; }
  .cust .nm { font-size: 13.5px; font-weight: 700; color: #13294b; }
  .cust .ph { font-size: 10.5px; color: #9aa4b4; direction: ltr; text-align: right; }
  .lastm { font-size: 11.5px; color: #7b8597; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tm { font-size: 11px; color: #9aa4b4; font-variant-numeric: tabular-nums; }
  .thread { display: none; background: #E5DDD4; padding: 16px 20px; border-bottom: 1px solid #f3f5f8; }
  .open + .thread { display: block; }
  .bub { max-width: 76%; border-radius: 11px; padding: 9px 13px; font-size: 12.5px; line-height: 1.9; margin-bottom: 9px; box-shadow: 0 1px 1px rgba(0,0,0,.06); white-space: pre-line; color: #13294b; }
  .b-a { background: #DCF8C6; border-top-left-radius: 3px; margin-inline-start: auto; }
  .b-c { background: #fff; border-top-right-radius: 3px; margin-inline-end: auto; }
  .b-s { background: rgba(255,255,255,.65); font-size: 11px; color: #5b6678; max-width: 100%; text-align: center; }
  .bt { font-size: 9.5px; color: #7d8b6a; text-align: left; margin-top: 4px; direction: ltr; }

  /* wizard (aimkt) */
  .step { background: #fff; border: 1px solid #e9edf3; border-radius: 16px; padding: 22px; margin-bottom: 16px; }
  .step .hd { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  .step .num { width: 30px; height: 30px; flex: none; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; background: #2E8F89; color: #fff; }
  .step .num.done { background: #DCF1EF; color: #2E7D77; }
  .step .ht { font-size: 15px; font-weight: 700; color: #13294b; }
  .step .hs { font-size: 12px; color: #9aa4b4; margin-top: 4px; }
  .prods { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
  .prod { text-align: right; font-family: inherit; background: #fff; border: 1.5px solid #e9edf3; border-radius: 14px; padding: 16px; cursor: pointer; }
  .prod.on { background: #F4FBFA; border-color: #3FB6B0; }
  .prod .pn { font-size: 13.5px; font-weight: 700; color: #13294b; margin-bottom: 12px; }
  .prod .sc { font-size: 20px; font-weight: 700; }
  .prod .scl { font-size: 10.5px; color: #9aa4b4; }
  .prod .bar { height: 6px; background: #eef0f4; border-radius: 999px; overflow: hidden; margin: 10px 0; }
  .prod .bar i { display: block; height: 100%; border-radius: 999px; }
  .wa-prev { background: #E5DDD4; border-radius: 14px; padding: 18px; max-width: 480px; }
  .wa-prev .b { background: #DCF8C6; border-radius: 12px; border-top-left-radius: 3px; padding: 12px 14px; font-size: 12.5px; color: #13294b; line-height: 2; white-space: pre-line; box-shadow: 0 1px 1px rgba(0,0,0,.08); }
  .wa-prev .t { font-size: 9.5px; color: #7d8b6a; text-align: left; margin-top: 6px; }
  .btn { font-family: inherit; font-size: 13px; font-weight: 700; border: none; border-radius: 10px; padding: 11px 18px; cursor: pointer; }
  .btn-teal { color: #1F4470; background: #3FB6B0; }
  .btn-dis { color: #9aa4b4; background: #eef0f4; cursor: not-allowed; }
  .note { display: flex; align-items: center; gap: 9px; background: #FDF8EC; border: 1px solid #F2E3C4; border-radius: 11px; padding: 12px 16px; font-size: 12px; color: #b5810f; font-weight: 600; margin-top: 14px; }

  /* kb */
  .kbrow { display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-bottom: 1px solid #f2f4f8; }
  .kbrow:last-child { border-bottom: none; }
  .kbrow .dt { width: 9px; height: 9px; flex: none; border-radius: 999px; }
  .kbrow .ti { flex: 1; min-width: 0; }
  .kbrow .t1 { font-size: 13.5px; font-weight: 700; color: #13294b; }
  .kbrow .t2 { font-size: 11.5px; color: #9aa4b4; margin-top: 4px; }
  .kbrow .ct { font-size: 11.5px; color: #b6bfcc; }
  .gate { max-width: 420px; margin: 80px auto; background: #fff; border: 1px solid #e3e7ee; border-radius: 16px; padding: 28px; text-align: center; }
  .gate input { font-family: inherit; width: 100%; font-size: 13px; border: 1px solid #d8dee8; border-radius: 10px; padding: 11px 13px; margin: 14px 0; direction: ltr; }
  @media (max-width: 900px) { aside { display: none; } .thead, .trow { grid-template-columns: 1.6fr 1.8fr 1fr; } .thead div:nth-child(4), .trow > div:nth-child(4), .thead div:nth-child(5), .trow > div:nth-child(5) { display: none; } }
</style>
</head>
<body>
<div class="app">
  <aside>
    <div class="brand">
      <div class="logo">م</div>
      <div><div class="t1">مَسار</div><div class="t2">نظام إدارة المبيعات</div></div>
    </div>
    <nav class="ms-scroll" id="nav"></nav>
    <div class="userbox"><div class="av">ع</div><div><div class="n">عبدالعزيز المحسن</div><div class="r">المدير التنفيذي</div></div></div>
  </aside>
  <main>
    <header>
      <div class="tt"><div class="t" id="pt">مَسار</div><div class="s" id="ps"></div></div>
      <span class="livechip" id="live" style="display:none"><span class="d"></span> مباشر · <span id="upd">—</span></span>
    </header>
    <div class="body ms-scroll" id="body"></div>
  </main>
</div>
<script>
const qs = new URLSearchParams(location.search);
if (qs.get("token")) { localStorage.setItem("massar_admin_token", qs.get("token")); history.replaceState({}, "", "/dashboard" + location.hash); }
let TOKEN = localStorage.getItem("massar_admin_token") || "";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const openSet = new Set(); let cache = null; let selProd = 0;

const NAV = [
  { grp: "نظرة عامة" }, { id: "home", l: "الرئيسية", g: "g-sq" },
  { grp: "دورة البيع" }, { id: "customers", l: "العملاء", g: "g-ci" }, { id: "opps", l: "فرص البيع", g: "g-tr" }, { id: "pipeline", l: "لوحة المتابعة", g: "g-ba" },
  { grp: "التسويق" }, { id: "aimkt", l: "إنشاء حملة", g: "g-di" }, { id: "kmon", l: "متابعة الحملات", g: "g-ba" }, { id: "kb", l: "معرفة المنتج", g: "g-ri" }, { id: "partners", l: "شركاء المبيعات", g: "g-ci" },
  { grp: "التخطيط والأداء" }, { id: "products", l: "المنتجات", g: "g-di" }, { id: "targets", l: "المستهدفات", g: "g-ri" }, { id: "reports", l: "التقارير", g: "g-tb" },
  { grp: "المنشأة" }, { id: "org", l: "الهيكل التنظيمي", g: "g-tree" },
];
const TITLES = {
  home: ["الرئيسية", "نظرة عامة على نشاط مسار الحي"],
  kmon: ["الحملات الذكية", "مركز متابعة أداء حملات المساعد الذكي"],
  aimkt: ["إنشاء حملة", "أنشئ حملة موجّهة للمنشآت الصحية في خطوات قليلة"],
  kb: ["معرفة المنتج للمساعد الذكي", "ما يعرفه مساعد المبيعات ويبيع به في واتساب"],
  partners: ["لوحة متابعة شركاء المبيعات", "ضمن المرحلة القادمة"],
  customers: ["قائمة العملاء", "ضمن المرحلة القادمة"], opps: ["فرص البيع", "ضمن المرحلة القادمة"],
  pipeline: ["لوحة متابعة الفرص", "ضمن المرحلة القادمة"], products: ["المنتجات", "ضمن المرحلة القادمة"],
  targets: ["المستهدفات", "ضمن المرحلة القادمة"], reports: ["التقارير", "ضمن المرحلة القادمة"], org: ["الهيكل التنظيمي", "ضمن المرحلة القادمة"],
};
// The agent's real catalog (mirrors src/agent.ts seed KB; the KB module feeds this later).
const PRODUCTS = [
  { n: "الإجازات المرضية", sc: 92, gaps: [] },
  { n: "فحص الموظفين", sc: 74, gaps: ["أسئلة شائعة", "مواد معتمدة"] },
  { n: "التقارير الطبية", sc: 71, gaps: ["مقارنة المنافسين"] },
  { n: "خدمات التطعيمات", sc: 55, gaps: ["أسئلة شائعة", "ردود الاعتراضات"] },
  { n: "الشهادات الصحية", sc: 55, gaps: ["أسئلة شائعة", "ردود الاعتراضات"] },
  { n: "تكامل الأنظمة (HIS/ERP)", sc: 63, gaps: ["التسعير التفصيلي"] },
];
const KB_SECTIONS = [
  ["نظرة عامة على المنتج", "الوصف وآلية العمل ومدة التنفيذ", "ok", "مكتمل"],
  ["القيمة المقدَّمة", "جُمل الإقناع: زمن الإصدار ↓70%، لا إدخال مزدوج، توثيق فوري", "ok", "مكتمل"],
  ["العملاء المستهدفون", "المجمعات والمراكز والمستشفيات ومراكز الأسنان", "ok", "مكتمل"],
  ["التسعير والباقات", "القياسية 18,000 ر.س · المؤسسات 95,000 ر.س سنويًا", "ok", "مكتمل"],
  ["الأسئلة الشائعة", "الاعتماد، مدة الربط (5 أيام)، التجربة (14 يومًا)", "ok", "3 عناصر"],
  ["معالجة الاعتراضات", "«السعر مرتفع» · «عندنا نظام حالي»", "warn", "2 من 8"],
  ["مقارنة المنافسين", "غير مُدخلة بعد", "bad", "لم يبدأ"],
  ["ضوابط المساعد", "لا خصومات، لا مواعيد غير معتمدة، تحويل الشكاوى لمختص", "ok", "مكتمل"],
  ["مواد ومرفقات", "سجل الملفات فارغ — أضف الكتيبات لتفعيل الإرسال", "warn", "0 ملفات"],
];

function nav() {
  const cur = (location.hash || "#kmon").slice(1);
  document.getElementById("nav").innerHTML = NAV.map((x) => x.grp
    ? '<div class="grp">' + x.grp + "</div>"
    : '<button class="nv' + (x.id === cur ? " on" : "") + '" onclick="location.hash=\\'' + x.id + '\\'">' +
      '<span class="gx"><span class="' + x.g + '"></span></span><span class="lbl">' + x.l + '</span><span class="dot"></span></button>'
  ).join("");
  const t = TITLES[cur] || TITLES.kmon;
  document.getElementById("pt").textContent = t[0];
  document.getElementById("ps").textContent = t[1];
  document.getElementById("live").style.display = (cur === "kmon" || cur === "home") ? "" : "none";
}

function chipRow(c) {
  const st = c.statusTimes || {}; const seen = st.read || st.replied; let h = "";
  if (st.sent || (c.transcript || []).some((t) => t.role === "agent")) h += '<span class="chip c-grey">أُرسلت</span>';
  if (st.delivered) h += '<span class="chip c-blue">وصلت</span>';
  if (seen) h += '<span class="chip c-teal">شوهدت ✓</span>';
  const oc = { interested: ["c-ok", "مهتم ⭐"], not_interested: ["c-bad", "غير مهتم"], later: ["c-warn", "لاحقًا"], handoff: ["c-blue", "محوّلة لمختص"], opted_out: ["c-bad", "أوقف الرسائل"], closed: ["c-grey", "مغلقة"] }[c.outcome];
  if (oc) h += '<span class="chip ' + oc[0] + '">' + oc[1] + "</span>";
  (c.tags || []).forEach((t) => h += '<span class="chip ' + (t.level === "hot" ? "c-ok" : "c-warn") + '">اهتمام: ' + esc(t.product) + "</span>");
  return h || '<span class="chip c-grey">جديد</span>';
}
const fmtT = (ts) => new Date(ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
const fills = ["#2F5F94", "#2F5F94", "#3FB6B0", "#3FB6B0", "#2E8F89", "#1f8a52"];

function funnelData(d) {
  const cs = d.contacts || []; const n = cs.length;
  const cnt = (f) => cs.filter(f).length;
  return [
    ["العملاء المستهدفون", n], ["تم إرسال الرسائل", cnt((c) => (c.statusTimes || {}).sent || (c.transcript || []).some((t) => t.role === "agent"))],
    ["تم التسليم", cnt((c) => (c.statusTimes || {}).delivered)], ["تمت المشاهدة", cnt((c) => (c.statusTimes || {}).read || (c.statusTimes || {}).replied)],
    ["تم الرد", cnt((c) => (c.statusTimes || {}).replied)], ["العملاء المهتمون", cnt((c) => c.outcome === "interested")],
  ];
}

function vKmon(d) {
  const cs = (d.contacts || []).slice().sort((a, b) => (b.lastEventAt || 0) - (a.lastEventAt || 0));
  const fd = funnelData(d); const base = Math.max(1, fd[0][1]);
  let h = '<div class="card" style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;">' +
    '<div><div style="font-size:11px;font-weight:700;color:#2E7D77;margin-bottom:6px;">لوحة تحكم الحملة</div>' +
    '<div style="font-size:18px;font-weight:700;color:#13294b;">حملة الساندبوكس — المساعد البائع</div>' +
    '<div style="font-size:12px;color:#7b8597;margin-top:6px;">المنتج: الإجازات المرضية · القناة: واتساب · المصدر: <span dir="ltr">+91 78348 11114</span></div></div>' +
    '<span class="chip c-ok" style="padding:7px 14px;">جارية</span></div>';
  h += '<div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:2px;">' +
    '<div class="card" style="flex:1 1 380px;min-width:0;"><h3>مسار الحملة</h3>' +
    fd.map((f, i) => '<div class="fun"><div class="r1"><span class="l">' + f[0] + '</span><span class="m">' + f[1] + " · " + Math.round(f[1] / base * 100) + '%</span></div><div class="track"><div class="fill" style="width:' + Math.max(3, Math.round(f[1] / base * 100)) + '%;background:' + fills[i] + ';"></div></div></div>').join("") +
    "</div>" +
    '<div class="card" style="flex:1 1 260px;min-width:0;"><h3>أداء المساعد</h3>' +
    [["ردود المساعد", (d.counters || {}).agent_reply || 0], ["رسائل واردة", (d.counters || {}).inbound || 0], ["اهتمامات مسجلة", (d.counters || {}).tag || 0], ["تحويلات لمختص", (d.counters || {})["outcome:handoff"] || 0]]
      .map((x) => '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #f4f6f9;"><span style="font-size:11.5px;color:#7b8597;">' + x[0] + '</span><span style="font-size:12.5px;font-weight:700;color:#13294b;">' + x[1] + "</span></div>").join("") +
    "</div></div>";
  h += '<div class="tblwrap"><div class="thead"><div>العميل</div><div>الحالة</div><div>آخر رسالة</div><div>الوقت</div><div></div></div>';
  if (!cs.length) h += '<div style="padding:44px 20px;text-align:center;color:#7b8597;font-size:13px;line-height:2;">لا محادثات بعد — أرسل رسالة واتساب إلى <b dir="ltr" style="color:#13294b">+91 78348 11114</b> وستظهر هنا مباشرة.</div>';
  cs.forEach((c) => {
    const last = (c.transcript || [])[(c.transcript || []).length - 1];
    const open = openSet.has(c.phone);
    h += '<div class="trow' + (open ? " open" : "") + '" onclick="tog(\\'' + esc(c.phone) + '\\')">' +
      '<div class="cust"><div class="av">' + esc((c.waName || "؟").trim().charAt(0)) + '</div><div><div class="nm">' + esc(c.waName || "غير معروف") + '</div><div class="ph">+' + esc(c.phone) + '</div></div></div>' +
      '<div style="display:flex;gap:5px;flex-wrap:wrap;">' + chipRow(c) + "</div>" +
      '<div class="lastm">' + esc(last ? last.text : "—") + "</div>" +
      '<div class="tm">' + (last ? fmtT(last.ts) : "") + "</div>" +
      '<div style="text-align:left;font-size:12px;color:#2F5F94;font-weight:700;">' + (open ? "إخفاء" : "عرض المحادثة") + "</div></div>";
    h += '<div class="thread">' + (c.transcript || []).map((t) =>
      '<div class="bub ' + (t.role === "agent" ? "b-a" : t.role === "customer" ? "b-c" : "b-s") + '">' + esc(t.text) + '<div class="bt">' + fmtT(t.ts) + "</div></div>").join("") + "</div>";
  });
  h += "</div>";
  return h;
}

function vHome(d) {
  const cs = d.contacts || [];
  const interested = cs.filter((c) => c.outcome === "interested").length;
  return '<div class="kpis">' +
    '<div class="kpi"><div class="k">جهات التواصل</div><div class="v">' + cs.length + "</div></div>" +
    '<div class="kpi"><div class="k">رسائل واردة</div><div class="v">' + ((d.counters || {}).inbound || 0) + "</div></div>" +
    '<div class="kpi"><div class="k">ردود المساعد</div><div class="v">' + ((d.counters || {}).agent_reply || 0) + "</div></div>" +
    '<div class="kpi"><div class="k">مهتمون</div><div class="v" style="color:#1f8a52">' + interested + "</div></div></div>" +
    '<div class="card"><h3>حالة المنصة</h3><div style="font-size:13px;color:#5b6678;line-height:2.1;">' +
    'المساعد البائع يعمل الآن على واتساب (ساندبوكس) ويبيع كامل سلة المنتجات الصحية.<br>' +
    'وحدة <b>التسويق</b> نشطة: <a href="#kmon" style="color:#2E7D77;font-weight:700;">متابعة الحملات</a> حيّة، و<a href="#aimkt" style="color:#2E7D77;font-weight:700;">إنشاء حملة</a> و<a href="#kb" style="color:#2E7D77;font-weight:700;">معرفة المنتج</a> بواجهاتها الأصلية.<br>' +
    'بقية الوحدات (العملاء، الفرص، لوحة المتابعة…) ضمن المراحل القادمة حسب خارطة الطريق.</div></div>';
}

function vAimkt() {
  const p = PRODUCTS[selProd];
  const tone = (sc) => sc >= 80 ? ["#1f8a52", "جاهز للبيع", "c-ok"] : sc >= 60 ? ["#b5810f", "جاهز بتحفّظ", "c-warn"] : ["#c43d3d", "غير جاهز", "c-bad"];
  let h = '<div class="step"><div class="hd"><span class="num done">1</span><div><div class="ht">أي منتج يبيعه المساعد؟</div><div class="hs">يعتمد المساعد على معرفة المنتج المسجّلة — لن تعيد إدخال شيء.</div></div></div><div class="prods">' +
    PRODUCTS.map((x, i) => { const t = tone(x.sc); return '<button class="prod' + (i === selProd ? " on" : "") + '" onclick="pick(' + i + ')"><div class="pn">' + x.n + '</div><span class="sc" style="color:' + t[0] + '">' + x.sc + '%</span> <span class="scl">درجة معرفة المساعد</span><div class="bar"><i style="width:' + x.sc + '%;background:' + t[0] + ';"></i></div><span class="chip ' + t[2] + '">' + t[1] + "</span></button>"; }).join("") + "</div>" +
    (p.gaps.length ? '<div class="note">معرفة ناقصة قد يتعثر معها المساعد: ' + p.gaps.join(" · ") + ' — أكملها من «معرفة المنتج».</div>' : "") + "</div>";
  h += '<div class="step"><div class="hd"><span class="num">2</span><div><div class="ht">من يتواصل معهم؟</div><div class="hs">قاعدة جهات الاتصال قيد البناء (استيراد العملاء + حقول الموافقة — المرحلة القادمة). حاليًا: المنضمون للساندبوكس فقط.</div></div></div>' +
    '<div style="display:inline-flex;align-items:baseline;gap:7px;background:#F4FBFA;border:1px solid #B9E4E0;border-radius:11px;padding:9px 16px;"><span style="font-size:20px;font-weight:700;color:#2E7D77;" id="audN">—</span><span style="font-size:11.5px;color:#2E7D77;font-weight:600;">منشأة متاحة (ساندبوكس)</span></div></div>';
  h += '<div class="step"><div class="hd"><span class="num">3</span><div><div class="ht">رسالة الافتتاح</div><div class="hs">كتبها المساعد من معرفة «' + p.n + '» — القوالب الرسمية تُعتمد مع رقم الأعمال الإنتاجي.</div></div></div>' +
    '<div class="wa-prev"><div class="b">مساء الخير أ. فهد،\\nمعك مساعد لِين الرقمي. نعمل مع المنشآت الصحية على رفع كفاءة الإجراءات عبر «' + p.n + '».\\nهل يناسبكم عرض تعريفي قصير هذا الأسبوع؟</div><div class="t">10:14 ص ✓✓</div></div></div>';
  h += '<div class="step" style="text-align:center;"><button class="btn btn-dis" title="يتطلب محرك الحملات (المرحلة القادمة)">ابدأ تواصل المساعد</button>' +
    '<div style="font-size:11.5px;color:#9aa4b4;margin-top:12px;">الإطلاق الجماعي يتفعّل مع محرك الحملات (outbox + pacer) والقوالب المعتمدة — وفق خارطة الطريق.</div></div>';
  return h;
}

function vKb() {
  const dot = { ok: "#2e9e6b", warn: "#d6a01f", bad: "#d85151" };
  const chip = { ok: ["c-ok", "مكتمل"], warn: ["c-warn", "ناقص"], bad: ["c-bad", "لم يبدأ"] };
  return '<div class="card" style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">' +
    '<div style="font-size:34px;font-weight:700;color:#2E7D77;">92%</div>' +
    '<div><div style="font-size:11px;color:#9aa4b4;margin-bottom:5px;">جاهزية المساعد — الإجازات المرضية</div><span class="chip c-ok" style="padding:5px 12px;">جاهز للعمل</span></div>' +
    '<div style="flex:1;min-width:200px;font-size:12px;color:#7b8597;line-height:1.9;">هذه المعرفة الحقيقية التي يبيع بها المساعد الآن على واتساب. التحرير والاعتماد من هذه الشاشة ضمن المرحلة القادمة.</div></div>' +
    '<div style="background:#fff;border:1px solid #e9edf3;border-radius:14px;overflow:hidden;">' +
    KB_SECTIONS.map((s) => '<div class="kbrow"><span class="dt" style="background:' + dot[s[2]] + ';"></span><div class="ti"><div class="t1">' + s[0] + '</div><div class="t2">' + s[1] + '</div></div><span class="chip ' + chip[s[2]][0] + '">' + chip[s[2]][1] + '</span><span class="ct">' + s[3] + "</span></div>").join("") + "</div>";
}

function vPlaceholder(cur) {
  const t = TITLES[cur] || ["", ""];
  return '<div class="empty"><div class="ic"><span></span></div><div class="t">' + t[0] + '</div><div class="s">هذه الوحدة ضمن المرحلة القادمة من «مسار» وفق خارطة الطريق — وحدة التسويق هي النشطة حاليًا.</div></div>';
}

window.tog = (p) => { openSet.has(p) ? openSet.delete(p) : openSet.add(p); render(false); };
window.pick = (i) => { selProd = i; render(false); };

function gate(msg) {
  document.getElementById("body").innerHTML = '<div class="gate"><div style="font-size:16px;font-weight:700;">دخول مَسار</div>' +
    '<input id="tok" placeholder="admin token" dir="ltr"><button class="btn btn-teal" onclick="saveTok()">دخول</button>' +
    (msg ? '<div style="color:#c43d3d;font-size:12px;margin-top:10px;">' + esc(msg) + "</div>" : "") + "</div>";
}
window.saveTok = () => { TOKEN = document.getElementById("tok").value.trim(); localStorage.setItem("massar_admin_token", TOKEN); refresh(); };

function render(fetchNew) {
  nav();
  const cur = (location.hash || "#kmon").slice(1);
  const b = document.getElementById("body");
  if (cur === "kmon" || cur === "home") {
    if (!TOKEN) return gate();
    if (!cache) return; // first fetch pending
    b.innerHTML = cur === "kmon" ? vKmon(cache) : vHome(cache);
  } else if (cur === "aimkt") {
    b.innerHTML = vAimkt();
    const n = document.getElementById("audN"); if (n && cache) n.textContent = (cache.contacts || []).length;
  } else if (cur === "kb") {
    b.innerHTML = vKb();
  } else {
    b.innerHTML = vPlaceholder(cur);
  }
}

async function refresh(force) {
  const cur = (location.hash || "#kmon").slice(1);
  if (TOKEN) {
    try {
      const r = await fetch("/admin/state", { headers: { "x-admin-token": TOKEN } });
      if (r.status === 401) { if (cur === "kmon" || cur === "home") return gate("رمز غير صحيح"); }
      else { cache = await r.json(); document.getElementById("upd").textContent = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
    } catch (e) { /* keep last view */ }
  }
  render(true);
}
window.addEventListener("hashchange", () => render(false));
if (!location.hash) location.hash = "kmon";
refresh();
setInterval(refresh, 5000);
</script>
</body>
</html>`;
