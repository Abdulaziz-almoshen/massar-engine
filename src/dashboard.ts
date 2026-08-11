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
  .thead, .trow { display: grid; grid-template-columns: 1.6fr 1.6fr 1.5fr 1.4fr 0.7fr 0.8fr; gap: 12px; padding: 13px 18px; align-items: center; }
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
  .statgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: 12px; margin-bottom: 16px; }
  .statc { background: #fff; border: 1px solid #e3e7ee; border-radius: 12px; padding: 13px 15px; }
  .statc .l { font-size: 11px; color: #7b8597; margin-bottom: 7px; }
  .statc .v { font-size: 22px; font-weight: 700; color: #13294b; line-height: 1; font-variant-numeric: tabular-nums; }
  .statc .p { font-size: 10.5px; color: #2E7D77; font-weight: 700; margin-top: 5px; }
  .statc .mb { height: 4px; background: #eef0f4; border-radius: 999px; overflow: hidden; margin-top: 8px; }
  .statc .mb i { display: block; height: 100%; border-radius: 999px; }
  .backdrop { position: fixed; inset: 0; background: rgba(15,37,64,.35); z-index: 69; }
  .convo { position: fixed; inset-block: 0; inset-inline-start: 0; width: min(420px, 94vw); background: #fff; z-index: 70; display: flex; flex-direction: column; box-shadow: 8px 0 24px rgba(16,38,68,.18); }
  .convo .hd { flex: none; display: flex; align-items: center; gap: 11px; padding: 13px 16px; border-bottom: 1px solid #e3e7ee; }
  .convo .hd .av { width: 38px; height: 38px; flex: none; border-radius: 10px; background: #13294b; color: #3FB6B0; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; }
  .convo .msgs { flex: 1; overflow-y: auto; background: #E5DDD4; padding: 16px; }
  .convo .ft { flex: none; padding: 12px 16px; border-top: 1px solid #e3e7ee; }
  @media (prefers-reduced-motion: no-preference) { .convo { animation: slideIn .18s ease; } @keyframes slideIn { from { transform: translateX(-30px); opacity: .6; } to { transform: none; opacity: 1; } } }
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
  @media (max-width: 900px) { aside { display: none; } .thead, .trow { grid-template-columns: 1.5fr 1.4fr 1.1fr .5fr; } .thead div:nth-child(4), .trow > div:nth-child(4), .thead div:nth-child(5), .trow > div:nth-child(5) { display: none; } .trow > div:last-child { font-size: 14px !important; } .hidemob { display: none !important; } }
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
let cache = null; let selProd = 0;
let entities = []; const entSel = new Set(); let entQ = ""; const entFilters = {}; let entImportSummary = ""; let custQ = "";
const LIST_CAP = 60;   // never render huge audiences — filter/search narrows, «تحديد المطابقين» selects all matches
let kbDocs = []; let prodAssets = []; let launching = false; let campaigns = []; let campFilter = "all"; let campName = "";
let showTest = false;         // sandbox separation: test traffic hidden from real views by default
let profileData = null;       // العميل ٣٦٠ payload for the open #customer/<phone> route
let profilePhone = "";        // phone the loaded profile belongs to
let insCache = {};            // phone → cached فهم المساعد (list rows read this, no LLM)
let retargetCohort = null;    // {label, campaign, targets:[{phone,name}]} — set from a campaign's filtered cohort
let lastDetailCohort = null;  // captured at render time by vKmonDetail (current filter + search)
let campMsg = "مرحبًا {name}، معك مساعد لِين الرقمي. نساعد المنشآت الصحية على تقليل زمن إصدار الإجازات المرضية بنسبة 70% بتوثيق رسمي وتكامل مع أنظمتكم. هل يناسبكم عرض تعريفي قصير هذا الأسبوع؟";

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
  customers: ["قائمة المستهدفين", "استيراد وإدارة جهات الاستهداف للحملات"], opps: ["فرص البيع", "ضمن المرحلة القادمة"],
  pipeline: ["لوحة متابعة الفرص", "ضمن المرحلة القادمة"], products: ["المنتجات", "ضمن المرحلة القادمة"],
  targets: ["المستهدفات", "ضمن المرحلة القادمة"], reports: ["التقارير", "ضمن المرحلة القادمة"], org: ["الهيكل التنظيمي", "ضمن المرحلة القادمة"],
};
// The agent's real catalog (mirrors src/agent.ts seed KB; the KB module feeds this later).
const PRODUCTS_FULL = [
  { n: "الإجازات المرضية", pitch: "إصدار وإدارة الإجازات المرضية إلكترونيًا بتوثيق رسمي معتمد وتكامل HIS/ERP — التفعيل خلال 5 أيام عمل.", eff: ["زمن الإصدار ↓70%", "لا إدخال مزدوج", "توثيق فوري"], best: ["مجمعات طبية", "مراكز", "مستشفيات", "أسنان"], pricing: "القياسية 18,000 ر.س · المؤسسات 95,000 ر.س سنويًا" },
  { n: "فحص الموظفين", pitch: "فحوصات اللياقة الطبية بقوالب معتمدة وتقارير جماعية وربط بملف الموظف.", eff: ["امتثال بلا أوراق", "تقارير بضغطة"], best: ["مستشفيات", "مجمعات", "كثافة توظيف"], pricing: "سنوي لكل فحص — يحدده المختص" },
  { n: "التقارير الطبية", pitch: "تقارير معتمدة إلكترونيًا بتوقيع رقمي وأرشفة مركزية.", eff: ["دقائق بدل أيام", "أرشيف مركزي"], best: ["مراكز", "مختبرات", "عيادات"], pricing: "سنوي حسب الحجم — يحدده المختص" },
  { n: "خدمات التطعيمات", pitch: "إدارة وتوثيق التطعيمات بسجل موحّد وتنبيهات جرعات.", eff: ["توثيق لحظي", "تنبيهات آلية"], best: ["مراكز صحية", "صيدليات"], pricing: "سنوي — يحدده المختص" },
  { n: "الشهادات الصحية", pitch: "إصدار فوري للشهادات الصحية بتحقق QR وسجل مركزي.", eff: ["إصدار فوري", "تحقق QR"], best: ["صيدليات", "مراكز"], pricing: "سنوي — يحدده المختص" },
  { n: "تكامل الأنظمة (HIS/ERP)", pitch: "ربط خدمات لِين بأنظمة المنشأة — تنفيذ خلال أسبوعين.", eff: ["لا إدخال مزدوج", "أسبوعان تنفيذ"], best: ["مستشفيات", "مجمعات كبيرة"], pricing: "مشروع + اشتراك — يحدده المختص" },
];
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
  const cur = (location.hash || "#kmon").slice(1).split("/")[0];
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
  const oc = { later: ["c-warn", "لاحقًا"], handoff: ["c-blue", "محوّلة لمختص"], opted_out: ["c-bad", "أوقف الرسائل"], closed: ["c-grey", "مغلقة"] }[c.outcome];
  if (oc) h += '<span class="chip ' + oc[0] + '">' + oc[1] + "</span>";
  if (c.human) h += '<span class="chip c-warn">المساعد متوقف — بيد البشر</span>';
  if ((c.statusTimes || {}).failed && !(c.statusTimes || {}).delivered) h += '<span class="chip c-bad">فشل الإرسال</span>';
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

function contactByPhone(phone) { return ((cache && cache.contacts) || []).find((c) => c.phone === phone); }
function seenOf(c) { const st = (c && c.statusTimes) || {}; return Boolean(st.read || st.replied); }
function interestedOf(c) { return Boolean(c && (c.outcome === "interested" || (c.tags || []).some((t) => t.level === "hot" || t.level === "warm"))); }
function campStats(camp) {
  const cs = camp.targets.map((t) => contactByPhone(t.phone)).filter(Boolean);
  return {
    targeted: camp.targets.length,
    sent: cs.filter((c) => (c.statusTimes || {}).sent || (c.transcript || []).some((t) => t.role === "agent")).length,
    delivered: cs.filter((c) => (c.statusTimes || {}).delivered).length,
    seen: cs.filter(seenOf).length,
    replied: cs.filter((c) => (c.statusTimes || {}).replied).length,
    interested: cs.filter(interestedOf).length,
    failed: cs.filter((c) => (c.statusTimes || {}).failed && !(c.statusTimes || {}).delivered).length,
  };
}
function interestChips(c) {
  if (!c) return '<span style="color:#c2cad6;">—</span>';
  const latest = new Map();
  (c.tags || []).forEach((t) => latest.set(t.product, t));
  if (latest.size) {
    const lv = { hot: ["c-ok", "نية مرتفعة"], warm: ["c-warn", "مهتم"], cold: ["c-grey", "فاتر"] };
    return [...latest.values()].map((t) => {
      const m = lv[t.level] || lv.warm;
      return '<span class="chip ' + m[0] + '">' + esc(t.product) + " · " + m[1] + "</span>";
    }).join(" ");
  }
  if (c.outcome === "interested") return '<span class="chip c-ok">مهتم</span>';
  if (c.outcome === "not_interested") return '<span class="chip c-bad">غير مهتم' + (c.outcomeReason ? " · " + esc(c.outcomeReason) : "") + "</span>";
  return '<span style="color:#c2cad6;">—</span>';
}
function fmtD(ts) { return new Date(Number(ts)).toLocaleDateString("ar-SA", { day: "numeric", month: "long" }); }
function contactRowsHtml(rows) {
  let h = "";
  rows.forEach((r) => {
    const c = r.contact || { phone: r.phone, waName: r.name, statusTimes: {}, tags: [], transcript: [] };
    const nm = c.waName || r.name || "غير معروف";
    const last = (c.transcript || [])[(c.transcript || []).length - 1];
    const ci = insCache[c.phone];
    h += '<div class="trow" onclick="location.hash=\\'customer/' + esc(c.phone) + '\\'">' +
      '<div class="cust"><div class="av">' + esc(String(nm).trim().charAt(0)) + '</div><div><div class="nm">' + esc(nm) + '</div><div class="ph">+' + esc(c.phone) + '</div></div></div>' +
      '<div style="display:flex;gap:5px;flex-wrap:wrap;">' + chipRow(c) + "</div>" +
      '<div style="display:flex;gap:5px;flex-wrap:wrap;">' + interestChips(c) + "</div>" +
      '<div class="lastm">' + (ci && ci.next_action ? '<span style="color:#2E7D77;font-weight:600;">← ' + esc(ci.next_action) + "</span>" : esc(last ? last.text : "—")) + "</div>" +
      '<div class="tm">' + (last ? fmtT(last.ts) : "") + "</div>" +
      '<div style="text-align:left;font-size:12px;color:#2F5F94;font-weight:700;" onclick="event.stopPropagation();openConvo(\\'' + esc(c.phone) + '\\')">المحادثة ←</div></div>';
  });
  return h;
}
window.setHuman = async (phone, val) => {
  try {
    const r = await fetch("/admin/contact/human", { method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ phone, human: val }) });
    if (!r.ok) { alertBar("تعذّر تبديل حالة المساعد (" + r.status + ")", true); return; }
    alertBar(val ? "توقف المساعد — المحادثة بيدك الآن" : "استأنف المساعد المحادثة ✓", false);
  } catch (e) { alertBar("تعذّر الاتصال بالخادم — أعد المحاولة", true); return; }
  await refresh();
};
window.setTestFlag = async (phone, val) => {
  try {
    const r = await fetch("/admin/contact/test", { method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ phone, test: val }) });
    if (!r.ok) { alertBar("تعذّر تحديث الوسم (" + r.status + ")", true); return; }
    alertBar(val ? "وُسمت المحادثة كتجريبية — خارج الأرقام الحقيقية" : "أُعيدت المحادثة للبيانات الحقيقية", false);
  } catch (e) { alertBar("تعذّر الاتصال بالخادم", true); return; }
  await refresh();
};
let convoPhone = null;
let convoSig = "";
window.openConvo = (p) => { convoPhone = p; renderConvo(); };
window.closeConvo = () => { convoPhone = null; renderConvo(); };
function renderConvo() {
  let el = document.getElementById("convoRoot");
  if (!el) { el = document.createElement("div"); el.id = "convoRoot"; document.body.appendChild(el); }
  if (!convoPhone || !cache) { el.innerHTML = ""; convoSig = ""; return; }
  const c = (cache.contacts || []).find((x) => x.phone === convoPhone);
  if (!c) { el.innerHTML = ""; convoPhone = null; convoSig = ""; return; }
  const sig = c.phone + "|" + (c.transcript || []).length + "|" + c.human + "|" + c.test + "|" + (c.outcome || "") +
    "|" + Object.keys(c.statusTimes || {}).join(",") + "|" + (c.tags || []).map((t) => t.product + ":" + t.level).join(",");
  if (sig === convoSig && el.innerHTML) return;   // nothing changed — don't rebuild (keeps scroll)
  const prevMsgs = document.getElementById("convoMsgs");
  const wasAtBottom = !prevMsgs || (prevMsgs.scrollHeight - prevMsgs.scrollTop - prevMsgs.clientHeight < 60);
  const prevScroll = prevMsgs ? prevMsgs.scrollTop : 0;
  convoSig = sig;
  const nm = c.waName || "غير معروف";
  el.innerHTML = '<div class="backdrop" onclick="closeConvo()"></div>' +
    '<aside class="convo" role="dialog" aria-label="المحادثة">' +
    '<div class="hd"><div class="av">' + esc(nm.trim().charAt(0)) + '</div>' +
    '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:#13294b;">' + esc(nm) + '</div>' +
    '<div style="font-size:11px;color:#9aa4b4;direction:ltr;text-align:right;">+' + esc(c.phone) + "</div></div>" +
    '<button onclick="closeConvo()" style="font-family:inherit;flex:none;font-size:18px;font-weight:700;color:#9aa4b4;background:#f4f6f9;border:none;border-radius:9px;width:32px;height:32px;cursor:pointer;">×</button></div>' +
    '<div style="padding:9px 16px;border-bottom:1px solid #f0f2f6;display:flex;gap:5px;flex-wrap:wrap;">' + chipRow(c) + " " + interestChips(c) + "</div>" +
    '<div class="msgs" id="convoMsgs">' + (c.transcript || []).map((t) =>
      '<div class="bub ' + (t.role === "agent" ? "b-a" : t.role === "customer" ? "b-c" : "b-s") + '">' + esc(t.text) + '<div class="bt">' + fmtT(t.ts) + "</div></div>").join("") + "</div>" +
    '<div class="ft" style="display:flex;gap:8px;"><button class="btn" style="flex:1;font-size:12.5px;' +
    (c.human ? 'color:#fff;background:#2E8F89;' : 'color:#c43d3d;background:#fff;border:1px solid #f0d3d3;') +
    '" onclick="setHuman(\\'' + esc(c.phone) + '\\',' + (c.human ? "false" : "true") + ')">' +
    (c.human ? "استئناف المساعد ▶" : "إيقاف المساعد — أنا أتولى المحادثة") + "</button>" +
    '<button class="btn" title="فصل بيانات الساندبوكس عن الحقيقية" style="flex:none;font-size:11.5px;' +
    (c.test ? 'color:#8a6d10;background:rgba(201,162,39,.14);border:1px solid rgba(201,162,39,.45);' : 'color:#7b8597;background:#fff;border:1px solid #e0e5ec;') +
    '" onclick="setTestFlag(\\'' + esc(c.phone) + '\\',' + (c.test ? "false" : "true") + ')">' +
    (c.test ? "تجريبي ✓" : "وسم كتجريبي") + "</button></div></aside>";
  const m = document.getElementById("convoMsgs");
  if (m) m.scrollTop = wasAtBottom ? m.scrollHeight : prevScroll;
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && convoPhone) closeConvo(); });
window.setCampFilter = (f) => { campFilter = f; render(false); };
window.toggleShowTest = () => { showTest = !showTest; render(false); };
function campIsTest(cp) {
  return cp.targets.length > 0 && cp.targets.every((t) => { const c = contactByPhone(t.phone); return c && c.test; });
}
function testToggleChip(nTest) {
  if (!nTest) return "";
  return '<button class="btn" style="padding:5px 12px;font-size:11px;border-radius:999px;' +
    (showTest ? 'color:#8a6d10;background:rgba(201,162,39,.14);border:1px solid rgba(201,162,39,.45);' : 'color:#9aa4b4;background:#fff;border:1px dashed #d5dae2;') +
    '" onclick="toggleShowTest()">' + (showTest ? "إخفاء التجريبية" : "إظهار التجريبية (" + nTest + ")") + "</button>";
}

function vKmon(d) {
  const inCamp = new Set(); campaigns.forEach((c) => c.targets.forEach((t) => inCamp.add(t.phone)));
  let h = '<div class="sec">الحملات <span class="meta">' + campaigns.length + ' حملة · اضغط حملة لفتح لوحتها</span></div>';
  if (!campaigns.length) {
    h += '<div class="empty" style="padding:44px 20px;"><div class="ic"><span></span></div><div class="t">لا حملات بعد</div><div class="s">أطلق أول حملة من <a href="#aimkt" style="color:#2E7D77;font-weight:700;">إنشاء حملة</a> — كل إطلاق يظهر هنا بلوحته وأرقامه.</div></div>';
  } else {
    h += '<div class="tblwrap"><div style="overflow-x:auto;" class="ms-scroll"><div style="min-width:760px;">' +
      '<div style="display:grid;grid-template-columns:1.9fr 1.2fr .9fr .8fr repeat(5,.62fr);gap:10px;padding:12px 18px;background:#f8fafc;border-bottom:1px solid #eef1f5;font-size:11px;font-weight:700;color:#7b8597;">' +
      '<div>اسم الحملة</div><div>المنتج</div><div>البدء</div><div>الحالة</div><div style="text-align:center;">مستهدفون</div><div style="text-align:center;">وصلت</div><div style="text-align:center;">شوهدت</div><div style="text-align:center;">ردّوا</div><div style="text-align:center;">مهتمون</div></div>';
    campaigns.forEach((c) => {
      const st = campStats(c);
      h += '<div onclick="location.hash=\\'kmon/' + c.id + '\\'" style="display:grid;grid-template-columns:1.9fr 1.2fr .9fr .8fr repeat(5,.62fr);gap:10px;align-items:center;padding:13px 18px;border-bottom:1px solid #f3f5f8;cursor:pointer;" onmouseover="this.style.background=\\'#fafbfd\\'" onmouseout="this.style.background=\\'\\'">' +
        '<div style="font-size:12.5px;font-weight:700;color:#13294b;">' + esc(c.name) + "</div>" +
        '<div style="font-size:11.5px;color:#5b6678;">' + esc(c.product || "—") + "</div>" +
        '<div style="font-size:11.5px;color:#7b8597;">' + fmtD(c.created_at) + "</div>" +
        '<div>' + (campIsTest(c) ? '<span class="chip" style="color:#8a6d10;background:rgba(201,162,39,.14);">تجريبية</span>' : '<span class="chip c-ok">جارية</span>') + "</div>" +
        '<div style="text-align:center;font-size:12.5px;font-weight:700;color:#13294b;">' + st.targeted + "</div>" +
        '<div style="text-align:center;font-size:12.5px;font-weight:700;color:#2F5F94;">' + st.delivered + "</div>" +
        '<div style="text-align:center;font-size:12.5px;font-weight:700;color:#2E7D77;">' + st.seen + "</div>" +
        '<div style="text-align:center;font-size:12.5px;font-weight:700;color:#13294b;">' + st.replied + "</div>" +
        '<div style="text-align:center;font-size:12.5px;font-weight:700;color:#1f8a52;">' + st.interested + "</div></div>";
    });
    h += "</div></div></div>";
  }
  const organicAll = ((d && d.contacts) || []).filter((c) => !inCamp.has(c.phone))
    .sort((a, b) => (b.lastEventAt || 0) - (a.lastEventAt || 0));
  const organic = showTest ? organicAll : organicAll.filter((c) => !c.test);
  const nTestOrganic = organicAll.filter((c) => c.test).length;
  if (organicAll.length) {
    h += '<div class="sec" style="margin-top:22px;">محادثات خارج الحملات <span class="meta">' + organic.length + ' — انضموا للساندبوكس مباشرة</span> ' + testToggleChip(nTestOrganic) + "</div>" +
      '<div class="tblwrap"><div class="thead"><div>العميل</div><div>الحالة</div><div>الاهتمام والجدية</div><div>آخر رسالة</div><div>الوقت</div><div></div></div>' +
      (organic.length ? contactRowsHtml(organic.map((c) => ({ phone: c.phone, contact: c }))) : '<div style="padding:22px;text-align:center;color:#9aa4b4;font-size:12px;">كل المحادثات هنا تجريبية — أظهرها بالزر أعلاه</div>') + "</div>";
  }
  return h;
}

let rQ = "";
window.rSearch = (el) => { rQ = el.value; clearTimeout(window.__rq); window.__rq = setTimeout(() => render(false), 250); };
function vKmonDetail(id, d) {
  const camp = campaigns.find((x) => String(x.id) === String(id));
  if (!camp) return '<div class="empty"><div class="ic"><span></span></div><div class="t">حملة غير موجودة</div><div class="s"><a href="#kmon" style="color:#2E7D77;font-weight:700;">→ كل الحملات</a></div></div>';
  const st = campStats(camp);
  const rows = camp.targets.map((t) => ({ phone: t.phone, name: t.name, contact: contactByPhone(t.phone) }));
  const base = Math.max(1, st.targeted);
  const pct = (v) => Math.round(v / base * 100);
  let h = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;">' +
    '<a href="#kmon" style="font-size:12.5px;font-weight:700;color:#13294b;text-decoration:none;">→ كل الحملات</a>' +
    '<div style="flex:1;min-width:0;"><span style="font-size:16px;font-weight:700;color:#13294b;">' + esc(camp.name) + '</span>' +
    '<span style="font-size:11.5px;color:#7b8597;margin-inline-start:10px;">' + (camp.product ? esc(camp.product) + " · " : "") + "واتساب · " + fmtD(camp.created_at) + "</span></div>" +
    '<span class="chip c-ok">جارية</span></div>';
  const cards = [
    ["المستهدفون", st.targeted, "#2F5F94"], ["أُرسلت", st.sent, "#2F5F94"], ["وصلت", st.delivered, "#3FB6B0"],
    ["شوهدت", st.seen, "#3FB6B0"], ["ردّوا", st.replied, "#2E8F89"], ["مهتمون", st.interested, "#1f8a52"],
  ];
  h += '<div class="statgrid">' + cards.map((c, i) =>
    '<div class="statc"><div class="l">' + c[0] + '</div><div class="v">' + c[1] + "</div>" +
    '<div class="p">' + (i === 0 ? "&nbsp;" : pct(c[1]) + "% من المستهدفين") + "</div>" +
    '<div class="mb"><i style="width:' + (i === 0 ? 100 : pct(c[1])) + "%;background:" + c[2] + ';"></i></div></div>').join("") + "</div>";
  const filters = [
    ["all", "الكل", rows.length, (r) => true],
    ["seen", "شوهدت ✓", st.seen, (r) => seenOf(r.contact)],
    ["replied", "ردّوا", st.replied, (r) => r.contact && (r.contact.statusTimes || {}).replied],
    ["interested", "مهتمون", st.interested, (r) => interestedOf(r.contact)],
    ["failed", "فشل الإرسال", st.failed, (r) => r.contact && (r.contact.statusTimes || {}).failed && !(r.contact.statusTimes || {}).delivered],
  ];
  const active = filters.find((f) => f[0] === campFilter) || filters[0];
  const q = rQ.trim();
  const shown = rows.filter(active[3]).filter((r) => !q || (r.contact && (r.contact.waName || "").includes(q)) || (r.name || "").includes(q) || r.phone.includes(q));
  // Snapshot the visible cohort so «إعادة استهداف» carries exactly what the founder is looking at.
  lastDetailCohort = {
    label: active[1].replace(/[✓⭐]/g, "").trim(), campaign: camp.name,
    targets: shown.map((r) => ({ phone: r.phone, name: (r.contact && r.contact.waName) || r.name || "" })),
  };
  h += '<div class="tblwrap"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #eef1f5;background:#fff;">' +
    '<span style="font-size:13px;font-weight:700;color:#13294b;flex:none;">المستهدفون</span>' +
    '<span style="font-size:11px;color:#9aa4b4;flex:none;">' + shown.length + " من " + rows.length + "</span>" +
    '<span style="flex:1;"></span>' +
    (shown.length ? '<button class="btn" style="padding:7px 14px;font-size:11.5px;border-radius:999px;color:#8a6d10;background:rgba(201,162,39,.14);border:1px solid rgba(201,162,39,.45);font-weight:700;" onclick="startRetarget()">⟲ إعادة استهداف هذه الفئة (' + shown.length + ")</button>" : "") +
    filters.map((f) => '<button class="btn" style="padding:6px 12px;font-size:11.5px;border-radius:999px;' +
      (campFilter === f[0] ? 'color:#2E7D77;background:#DCF1EF;border:1px solid #3FB6B0;' : 'color:#5b6678;background:#fff;border:1px solid #e9edf3;') +
      '" onclick="setCampFilter(\\'' + f[0] + '\\')">' + f[1] + " (" + f[2] + ")</button>").join("") +
    '<input id="rq" value="' + esc(rQ) + '" oninput="rSearch(this)" placeholder="بحث…" style="font-family:inherit;font-size:11.5px;border:1px solid #e9edf3;border-radius:999px;padding:7px 13px;background:#f8fafc;width:130px;">' +
    "</div>" +
    '<div class="thead"><div>العميل</div><div>الحالة</div><div>الاهتمام والجدية</div><div>آخر رسالة</div><div>الوقت</div><div></div></div>' +
    (shown.length ? contactRowsHtml(shown) : '<div style="padding:30px;text-align:center;color:#9aa4b4;font-size:12.5px;">لا نتائج</div>') + "</div>";
  return h;
}

function vHome(d) {
  const csAll = d.contacts || [];
  const cs = showTest ? csAll : csAll.filter((c) => !c.test);
  const nTest = csAll.filter((c) => c.test).length;
  const realCampaigns = campaigns.filter((cp) => !campIsTest(cp));
  const interestedList = cs.filter((c) => interestedOf(c) || c.outcome === "handoff");
  const delivered = cs.filter((c) => (c.statusTimes || {}).delivered || (c.statusTimes || {}).read).length;
  const replied = cs.filter((c) => (c.statusTimes || {}).replied).length;
  const hotOf = (c) => (c.tags || []).find((t) => t.level === "hot");
  let h = '<div class="kpis">' +
    '<div class="kpi"><div class="k">الحملات الحقيقية</div><div class="v">' + realCampaigns.length + (campaigns.length > realCampaigns.length ? ' <span style="font-size:11px;color:#9aa4b4;font-weight:600;">+' + (campaigns.length - realCampaigns.length) + " تجريبية</span>" : "") + "</div></div>" +
    '<div class="kpi"><div class="k">المستهدفون</div><div class="v">' + entities.length.toLocaleString("ar-SA") + "</div></div>" +
    '<div class="kpi"><div class="k">وصلت إليهم الرسائل</div><div class="v" style="color:#2E8F89">' + delivered + "</div></div>" +
    '<div class="kpi"><div class="k">ردّوا</div><div class="v" style="color:#2F5F94">' + replied + "</div></div>" +
    '<div class="kpi"><div class="k">مهتمون وجادّون</div><div class="v" style="color:#1f8a52">' + interestedList.length + "</div></div></div>";
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;">' +
    '<a href="#aimkt" style="text-decoration:none;" class="btn btn-teal">+ إنشاء حملة</a>' +
    '<a href="#customers" class="btn" style="text-decoration:none;color:#1F4470;background:#E3ECF8;">⬆ استيراد مستهدفين</a>' +
    '<a href="#kb" style="text-decoration:none;color:#1F4470;background:#E3ECF8;border-radius:11px;padding:12px 18px;font-size:13px;font-weight:700;">معرفة المنتج</a></div>';
  h += vHomeCharts(cs);
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;align-items:start;">';
  h += '<div class="card" style="margin:0;"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><h3 style="margin:0;">أفضل الفرص الآن</h3><span style="display:inline-flex;gap:6px;align-items:center;"><span class="chip ' + (interestedList.length ? "c-ok" : "c-grey") + '">' + interestedList.length + "</span>" + testToggleChip(nTest) + "</span></div>" +
    (interestedList.length
      ? '<div style="margin-top:10px;">' + interestedList.slice(0, 6).map((c) => {
          const tg = hotOf(c) || (c.tags || [])[0];
          const last = [...(c.transcript || [])].reverse().find((t) => t.role === "customer");
          const ci = insCache[c.phone];
          return '<div onclick="location.hash=\\'customer/' + esc(c.phone) + '\\'" style="display:flex;align-items:center;gap:11px;padding:10px 4px;border-bottom:1px solid #f3f5f8;cursor:pointer;">' +
            '<div class="avatar" style="width:34px;height:34px;flex:none;border-radius:9px;background:#13294b;color:#3FB6B0;display:flex;align-items:center;justify-content:center;font-weight:700;">' + esc((c.waName || "؟").trim().charAt(0)) + "</div>" +
            '<div style="flex:1;min-width:0;"><div style="font-size:12.5px;font-weight:700;color:#13294b;">' + esc(c.waName || "غير معروف") + " " +
            (tg ? '<span class="chip ' + (tg.level === "hot" ? "c-bad" : "c-warn") + '" style="font-weight:700;">' + esc(tg.product) + (tg.level === "hot" ? " · نية مرتفعة" : " · مهتم") + "</span>" : (c.outcome === "handoff" ? '<span class="chip c-warn">طلب تواصلًا</span>' : "")) + (c.test ? ' <span class="chip" style="color:#8a6d10;background:rgba(201,162,39,.14);">تجريبي</span>' : "") + "</div>" +
            (ci && ci.next_action ? '<div style="font-size:11px;color:#2E7D77;font-weight:600;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">← ' + esc(ci.next_action) + '</div>'
              : (last ? '<div style="font-size:11px;color:#8a94a4;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">«' + esc(last.text.slice(0, 70)) + '»</div>' : "")) + "</div>" +
            '<span style="font-size:11.5px;font-weight:700;color:#2F5F94;flex:none;">الملف ←</span></div>';
        }).join("") + "</div>"
      : '<div style="font-size:12px;color:#9aa4b4;margin-top:12px;line-height:1.9;">حين يرصد المساعد عميلًا جادًا سيظهر هنا فورًا — ويصلك تنبيه واتساب مباشرة.</div>') +
    (d.notifyNumber ? '<div style="display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #f0f2f6;font-size:11px;color:#7b8597;">🔔 تنبيهات «عميل جاد» و«طلب تدخّل» تصل واتساب مدير المنتج: <b style="color:#13294b;direction:ltr;">+' + esc(d.notifyNumber) + "</b></div>" : "") + "</div>";
  h += '<div class="card" style="margin:0;"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><h3 style="margin:0;">أحدث الحملات</h3><a href="#kmon" style="font-size:11.5px;font-weight:700;color:#2E7D77;text-decoration:none;">الكل ←</a></div>' +
    (campaigns.length
      ? '<div style="margin-top:10px;">' + campaigns.slice(0, 5).map((cp) => {
          const st = campStats(cp);
          return '<a href="#kmon/' + cp.id + '" style="text-decoration:none;display:flex;align-items:center;gap:11px;padding:10px 4px;border-bottom:1px solid #f3f5f8;">' +
            '<div style="flex:1;min-width:0;"><div style="font-size:12.5px;font-weight:700;color:#13294b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(cp.name) + (campIsTest(cp) ? ' <span class="chip" style="color:#8a6d10;background:rgba(201,162,39,.14);">تجريبية</span>' : "") + "</div>" +
            '<div style="font-size:10.5px;color:#9aa4b4;margin-top:3px;">' + (cp.product ? esc(cp.product) + " · " : "") + fmtD(cp.created_at) + "</div></div>" +
            '<span class="chip c-blue">' + st.targeted + ' مستهدف</span><span class="chip c-teal">شوهدت ' + st.seen + '</span><span class="chip ' + (st.replied ? "c-ok" : "c-grey") + '">ردّوا ' + st.replied + "</span></a>";
        }).join("") + "</div>"
      : '<div style="font-size:12px;color:#9aa4b4;margin-top:12px;">لا حملات بعد — أطلق الأولى من «إنشاء حملة».</div>') + "</div>";
  h += "</div>";
  return h;
}

// Segment groups derive from whatever columns the imported file carried:
// one group per attribute key (by coverage, max 6), values ordered by count (max 12).
function segGroups() {
  const keyCount = new Map();
  entities.forEach((e) => Object.keys(e.attrs || {}).forEach((k) => keyCount.set(k, (keyCount.get(k) || 0) + 1)));
  return [...keyCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([key]) => {
    const valCount = new Map();
    entities.forEach((e) => { const v = (e.attrs || {})[key]; if (v) valCount.set(v, (valCount.get(v) || 0) + 1); });
    return { key, values: [...valCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12) };
  });
}
function entMatches() {
  const q = entQ.trim();
  return entities.filter((e) =>
    Object.keys(entFilters).every((k) => !entFilters[k] || ((e.attrs || {})[k] || "") === entFilters[k]) &&
    (!q || e.name.includes(q) || e.phone.includes(q)));
}
function attrChips(e, max) {
  const a = e.attrs || {}; const keys = Object.keys(a).slice(0, max);
  return keys.map((k) => {
    const v = a[k];
    const cls = v === "كبيرة" || v === "كبير" ? "c-blue" : v === "متوسطة" || v === "متوسط" ? "c-teal" : "c-grey";
    return '<span class="chip ' + cls + '" title="' + esc(k) + '">' + esc(v) + "</span>";
  }).join("");
}
function chipBtn(label, on, fn) {
  return '<button class="btn" style="padding:8px 14px;font-size:12px;border-radius:999px;' +
    (on ? 'color:#2E7D77;background:#DCF1EF;border:1px solid #3FB6B0;' : 'color:#5b6678;background:#fff;border:1px solid #e9edf3;') +
    '" onclick="' + fn + '">' + esc(label) + "</button>";
}
// Indexes only in onclick (Arabic keys/values stay out of attribute strings);
// both sides re-derive the same ordering from segGroups().
window.entSetAttr = (ki, vi) => {
  const g = segGroups()[ki]; if (!g) return;
  entFilters[g.key] = vi < 0 ? "" : (g.values[vi] ? g.values[vi][0] : "");
  render(false);
};
window.entSearch = (el) => { entQ = el.value; clearTimeout(window.__eq); window.__eq = setTimeout(() => render(false), 250); };
window.entTog = (id) => { entSel.has(id) ? entSel.delete(id) : entSel.add(id); render(false); };
window.entAllMatching = () => { const m = entMatches(); const all = m.every(e => entSel.has(e.id)); m.forEach(e => all ? entSel.delete(e.id) : entSel.add(e.id)); render(false); };
window.entClear = () => { entSel.clear(); render(false); };
window.campMsgSet = (el) => { campMsg = el.value; };
window.campNameSet = (el) => { campName = el.value; };
window.pick = (i) => { selProd = i; render(false); };
window.startRetarget = () => {
  if (!lastDetailCohort || !lastDetailCohort.targets.length) return;
  retargetCohort = lastDetailCohort;
  if (!campName.trim()) campName = "إعادة استهداف — " + retargetCohort.label + " — " + retargetCohort.campaign;
  location.hash = "aimkt";
};
window.clearRetarget = () => { retargetCohort = null; campName = ""; render(false); };
function launchTargets() {
  return retargetCohort ? retargetCohort.targets : entities.filter(e => entSel.has(e.id)).map(e => ({ phone: e.phone, name: e.name }));
}
window.openLaunch = () => { if (!launchTargets().length || !campMsg.trim() || launching) return; document.getElementById("lmodal").style.display = "flex"; };
window.closeLaunch = () => { const m = document.getElementById("lmodal"); if (m) m.style.display = "none"; };
window.confirmLaunch = async () => {
  if (launching) return; launching = true;
  const btn = document.getElementById("lgo"); if (btn) { btn.textContent = "جارٍ الإرسال…"; }
  const targets = launchTargets();
  try {
    const r = await fetch("/admin/campaign/launch", { method: "POST",
      headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ targets, message: campMsg, name: campName, product: wizProducts()[selProd].name }) });
    const d = await r.json();
    launching = false; closeLaunch();
    if (!r.ok) { alertBar("فشل الإطلاق: " + esc(d.error || r.status), true); render(false); return; }
    alertBar("أُرسلت " + d.sent + " من " + d.requested + " — افتحنا لك لوحة الحملة", false);
    entSel.clear(); campName = ""; retargetCohort = null;
    setTimeout(() => { location.hash = d.campaignId ? "kmon/" + d.campaignId : "kmon"; refresh(); }, 1200);
  } catch (e) { launching = false; closeLaunch(); alertBar("خطأ في الإطلاق", true); }
};
window.alertBar = (txt, bad) => {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;bottom:22px;right:290px;z-index:99;background:" + (bad ? "#FBE9E9" : "#E6F4EC") +
    ";color:" + (bad ? "#c43d3d" : "#1f8a52") + ";font-weight:700;font-size:13px;border-radius:11px;padding:13px 18px;box-shadow:0 8px 24px rgba(16,38,68,.14);";
  el.textContent = txt;
  document.body.appendChild(el); setTimeout(() => el.remove(), 3800);
};

function wizProducts() { return kbRegistry(); }
function vAimkt() {
  const reg = wizProducts();
  if (selProd >= reg.length) selProd = 0;
  const tone = (sc) => sc >= 80 ? ["#1f8a52", "جاهز للبيع", "c-ok"] : sc >= 60 ? ["#b5810f", "جاهز بتحفّظ", "c-warn"] : ["#c43d3d", "غير جاهز", "c-bad"];
  const m = entMatches();
  const selN = launchTargets().length;
  const firstSel = retargetCohort ? retargetCohort.targets[0] : entities.find(e => entSel.has(e.id));
  const groups = segGroups();
  const allOn = m.length && m.every(e => entSel.has(e.id));
  const selName = reg[selProd] ? reg[selProd].name : "";
  const selAsset = prodAssets.find((a) => a.product === selName);

  let h = '<div class="step"><div class="hd"><span class="num done">1</span><div><div class="ht">أي منتج يبيعه المساعد؟</div><div class="hs">القائمة تشمل منتجات Product Hub المرفوعة بملفاتها — لا تقتصر على المنتجات المدمجة.</div></div></div><div class="prods">' +
    reg.map((x, i) => {
      const inner = x.sc !== null
        ? (() => { const t = tone(x.sc); return '<span class="sc" style="color:' + t[0] + '">' + x.sc + '%</span> <span class="scl">درجة معرفة المساعد</span><div class="bar"><i style="width:' + x.sc + '%;background:' + t[0] + ';"></i></div><span class="chip ' + t[2] + '">' + t[1] + "</span>"; })()
        : '<div style="height:6px;"></div><span class="chip c-teal">معرفة من Product Hub ✓</span>';
      const pa = prodAssets.some((a) => a.product === x.name) ? ' <span class="chip c-grey">ملف تعريفي 📎</span>' : "";
      return '<button class="prod' + (i === selProd ? " on" : "") + '" onclick="pick(' + i + ')"><div class="pn">' + esc(x.name) + "</div>" + inner + pa + "</button>";
    }).join("") + "</div></div>";

  h += '<div class="step"><div class="hd"><span class="num' + (selN ? " done" : "") + '">2</span><div><div class="ht">من يتواصل معهم؟</div><div class="hs">اختر شريحة كاملة أو حدّد جهات بعينها — العدد يتحدّث فورًا.</div></div>' +
    '<span style="flex:1"></span><span style="display:inline-flex;align-items:baseline;gap:7px;background:#F4FBFA;border:1px solid #B9E4E0;border-radius:11px;padding:9px 16px;"><span style="font-size:20px;font-weight:700;color:#2E7D77;">' + selN.toLocaleString("ar-SA") + '</span><span style="font-size:11.5px;color:#2E7D77;font-weight:600;">' + (retargetCohort ? "فئة معاد استهدافها" : "مختار من " + entities.length.toLocaleString("ar-SA")) + "</span></span></div>";
  if (retargetCohort) {
    h += '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;border:1px solid rgba(201,162,39,.45);background:rgba(201,162,39,.08);border-radius:14px;padding:16px 18px;">' +
      '<span style="font-size:22px;">⟲</span><div style="flex:1;min-width:220px;">' +
      '<div style="font-size:13.5px;font-weight:700;color:#13294b;">إعادة استهداف: ' + esc(retargetCohort.label) + " — " + retargetCohort.targets.length.toLocaleString("ar-SA") + " جهة</div>" +
      '<div style="font-size:11.5px;color:#7b8597;margin-top:5px;">من حملة «' + esc(retargetCohort.campaign) + '» — القائمة مقفلة على هذه الفئة كما رأيتها في صفحة الحملة.</div></div>' +
      '<button class="btn" style="font-size:12px;color:#7b8597;background:#fff;border:1px solid #e0e5ec;" onclick="clearRetarget()">مسح والاختيار يدويًا</button></div>';
  } else if (!entities.length) {
    h += '<div style="border:1.5px dashed #c9d2df;border-radius:12px;padding:26px;text-align:center;color:#7b8597;font-size:13px;line-height:2;">لا مستهدفين بعد — ارفع ملف Excel أو CSV في شاشة <a href="#customers" style="color:#2E7D77;font-weight:700;">قائمة المستهدفين</a>، وستظهر شرائح أعمدته هنا تلقائيًا.</div>';
  } else {
    h += groups.map((g, ki) =>
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;">' +
      '<span style="font-size:11.5px;font-weight:700;color:#7b8597;min-width:52px;">' + esc(g.key) + ":</span>" +
      chipBtn("الكل", !entFilters[g.key], "entSetAttr(" + ki + ",-1)") +
      g.values.map(([v, n], vi) => chipBtn(v + " (" + n + ")", entFilters[g.key] === v, "entSetAttr(" + ki + "," + vi + ")")).join("") +
      "</div>").join("");
    h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
      '<input id="eq" value="' + esc(entQ) + '" oninput="entSearch(this)" placeholder="ابحث بالاسم أو الرقم…" style="font-family:inherit;flex:1;min-width:200px;font-size:12.5px;border:1px solid #e9edf3;border-radius:10px;padding:9px 13px;background:#f8fafc;">' +
      '<button class="btn" style="font-size:12px;color:#1F4470;background:#E3ECF8;" onclick="entAllMatching()">' + (allOn ? "إلغاء تحديد المطابقين" : "تحديد المطابقين (" + m.length + ")") + '</button>' +
      (selN ? '<button class="btn" style="font-size:12px;color:#7b8597;background:#fff;border:1px solid #e0e5ec;" onclick="entClear()">مسح الاختيار</button>' : "") + "</div>";
    const shown = m.slice(0, LIST_CAP);
    if (m.length > LIST_CAP) {
      h += '<div style="display:flex;align-items:center;gap:12px;background:#F4FBFA;border:1px solid #B9E4E0;border-radius:12px;padding:12px 16px;margin-bottom:10px;">' +
        '<span style="font-size:19px;font-weight:700;color:#2E7D77;">' + m.length.toLocaleString("ar-SA") + '</span>' +
        '<span style="font-size:12px;color:#2E7D77;line-height:1.8;">جهة مطابقة للشرائح الحالية — القائمة أدناه معاينة لأول ' + LIST_CAP + '. «تحديد المطابقين» يختارهم <b>جميعًا</b> دون الحاجة لتصفحهم.</span></div>';
    }
    h += '<div style="border:1px solid #eef1f5;border-radius:12px;overflow:hidden;max-height:300px;overflow-y:auto;" class="ms-scroll">' +
      shown.map((e) => {
        const on = entSel.has(e.id);
        return '<div onclick="entTog(' + e.id + ')" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid #f4f6f9;cursor:pointer;' + (on ? "background:#F4FBFA;" : "") + '">' +
          '<span style="width:17px;height:17px;flex:none;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;' + (on ? "background:#2E8F89;" : "border:1.5px solid #cdd4de;background:#fff;") + '">' + (on ? "✓" : "") + "</span>" +
          '<span style="flex:1;min-width:0;font-size:13px;font-weight:600;color:#13294b;">' + esc(e.name) + "</span>" +
          attrChips(e, 3) +
          '<span style="font-size:11px;color:#9aa4b4;direction:ltr;">+' + esc(e.phone) + "</span></div>";
      }).join("") +
      (m.length > LIST_CAP ? '<div style="padding:12px;text-align:center;color:#7b8597;font-size:12px;background:#fafbfc;">+ ' + (m.length - LIST_CAP).toLocaleString("ar-SA") + ' آخرون مطابقون — ضيّق بالشرائح أو البحث لاستعراضهم</div>' : "") +
      (m.length ? "" : '<div style="padding:22px;text-align:center;color:#9aa4b4;font-size:12.5px;">لا نتائج مطابقة</div>') + "</div>";
  }
  h += "</div>";

  h += '<div class="step"><div class="hd"><span class="num">3</span><div><div class="ht">رسالة الافتتاح</div><div class="hs">استخدم {name} ليضع المساعد اسم الجهة تلقائيًا. بعد أول رد، يتولى المساعد البائع الحوار كاملًا.</div></div></div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;align-items:start;">' +
    '<div><div style="font-size:11.5px;color:#7b8597;font-weight:600;margin-bottom:8px;">نص الرسالة</div>' +
    '<textarea oninput="campMsgSet(this)" rows="6" style="font-family:inherit;width:100%;font-size:12.5px;color:#13294b;border:1.5px solid #e9edf3;border-radius:12px;padding:13px;line-height:2;resize:vertical;">' + esc(campMsg) + "</textarea></div>" +
    '<div><div style="font-size:11.5px;color:#7b8597;font-weight:600;margin-bottom:8px;">معاينة واتساب — رسالة واحدة: الملف مضمّن مع النص والأزرار</div>' +
    '<div class="wa-prev">' +
    (selAsset ? '<div style="display:flex;align-items:center;gap:9px;background:rgba(255,255,255,.75);border-radius:9px;padding:9px 11px;margin-bottom:8px;"><span style="width:30px;height:36px;flex:none;border-radius:5px;background:#d85151;color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;">PDF</span><span style="font-size:11px;color:#2b3648;direction:ltr;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(selAsset.filename) + "</span></div>" : "") +
    '<div class="b">' + esc(campMsg.replaceAll("{name}", (firstSel ? firstSel.name : "مجمع النور الطبي"))) + '</div><div class="t">الآن ✓✓</div>' +
    '<div style="display:flex;flex-direction:column;gap:5px;margin-top:9px;">' +
    ["أرغب بعرض تعريفي", "أرسلوا التفاصيل", "ليس الآن"].map((b) => '<div style="text-align:center;background:#fff;border-radius:8px;padding:8px;font-size:11.5px;font-weight:700;color:#2F5F94;box-shadow:0 1px 1px rgba(16,38,68,.08);">' + b + "</div>").join("") +
    "</div></div>" +
    (selAsset ? "" : '<div style="font-size:10.5px;color:#b5810f;margin-top:8px;">لا ملف تعريفيًا لهذا المنتج بعد — الرسالة ستصل نصًا بأزرار. أضف الملف من معرفة المنتج ليُضمَّن.</div>') +
    "</div></div></div>";

  const can = selN > 0 && campMsg.trim();
  h += '<div class="step" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">' +
    '<label style="font-size:12.5px;font-weight:700;color:#13294b;flex:none;">اسم الحملة</label>' +
    '<input value="' + esc(campName) + '" oninput="campNameSet(this)" placeholder="حملة ' + esc(selName) + ' — تُسمّى تلقائيًا إن تُركت فارغة" style="font-family:inherit;flex:1;min-width:220px;font-size:13px;font-weight:600;color:#13294b;border:1.5px solid #e9edf3;border-radius:11px;padding:11px 14px;">' +
    "</div>";
  h += '<div class="step" style="position:sticky;bottom:14px;z-index:5;display:flex;align-items:center;gap:14px;flex-wrap:wrap;box-shadow:0 14px 40px rgba(15,37,64,.16);border:1px solid #e2e8f1;">' +
    '<div style="flex:1;min-width:200px;"><div style="font-size:13px;font-weight:700;color:#13294b;">' + selN.toLocaleString("ar-SA") + " مستهدف · " + esc(selName) + (selAsset ? " · الملف مضمّن 📎" : "") + "</div>" +
    '<div style="font-size:10.5px;color:#9aa4b4;margin-top:4px;">ساندبوكس: يستلم فعليًا من انضم للرقم التجريبي — البقية تظهر «فشل الإرسال» بشفافية.</div></div>' +
    '<button class="btn ' + (can ? "btn-teal" : "btn-dis") + '" style="font-size:14.5px;padding:14px 30px;" onclick="openLaunch()">إطلاق الحملة ←</button></div>';

  h += '<div id="lmodal" style="display:none;position:fixed;inset:0;background:rgba(15,37,64,.5);z-index:60;align-items:flex-start;justify-content:center;padding:60px 24px;">' +
    '<div style="width:100%;max-width:460px;background:#fff;border-radius:16px;border-top:4px solid #3FB6B0;box-shadow:0 24px 60px rgba(15,37,64,.3);padding:24px;">' +
    '<div style="font-size:17px;font-weight:700;color:#13294b;margin-bottom:8px;">تأكيد إطلاق الحملة</div>' +
    '<div style="font-size:13px;color:#5b6678;line-height:2;margin-bottom:18px;">سيرسل المساعد رسالة الافتتاح إلى <b style="color:#2E7D77;">' + selN.toLocaleString("ar-SA") + ' مستهدف</b> عبر واتساب (ساندبوكس)، ثم يتابع كل ردّ ببيع كامل. هذه الخطوة هي موافقتك البشرية على الإرسال.</div>' +
    (selN > 50 ? '<div style="font-size:12px;color:#b5810f;background:#FBF3DC;border-radius:10px;padding:10px 14px;line-height:1.9;margin-bottom:14px;">حد الدفعة الواحدة حاليًا <b>50</b> — قلّص الاختيار أو أطلق على دفعات. الإرسال الجماعي المجدول يأتي مع محرك الحملات القادم.</div>' : "") +
    '<div style="display:flex;gap:10px;"><button id="lgo" class="btn btn-teal" onclick="confirmLaunch()">تأكيد الإطلاق ✓</button>' +
    '<button class="btn" style="color:#5b6678;background:#f0f2f6;" onclick="closeLaunch()">إلغاء</button></div></div></div>';
  return h;
}

function mdRender(md) {
  return md.split("\\n").map((raw) => {
    const l = raw.trim();
    if (!l) return "";
    if (l.startsWith("# ")) return '<div style="font-size:15px;font-weight:700;color:#13294b;margin:4px 0 10px;">' + esc(l.slice(2)) + "</div>";
    if (l.startsWith("## ")) return '<div style="font-size:12.5px;font-weight:700;color:#2E7D77;margin:14px 0 6px;">' + esc(l.slice(3)) + "</div>";
    if (l.startsWith("- ") || l.startsWith("* ")) return '<div style="display:flex;gap:8px;padding:2px 0;"><span style="width:5px;height:5px;flex:none;margin-top:9px;border-radius:999px;background:#3FB6B0;"></span><span style="font-size:12.5px;color:#5b6678;line-height:1.9;">' + esc(l.slice(2)) + "</span></div>";
    return '<div style="font-size:12.5px;color:#5b6678;line-height:1.9;">' + esc(l) + "</div>";
  }).join("");
}
window.kbPick = () => document.getElementById("kbfile").click();
window.paPick = () => document.getElementById("pafile").click();
window.paUpload = async (input) => {
  const f = input.files && input.files[0];
  if (!f) return;
  const st = document.getElementById("pastat");
  st.innerHTML = '<span class="chip c-warn">جارٍ رفع الملف…</span>';
  const fd = new FormData(); fd.append("product", input.dataset.product || ""); fd.append("file", f);
  try {
    const r = await fetch("/admin/product-asset/upload", { method: "POST", headers: { "x-admin-token": TOKEN }, body: fd });
    const d = await r.json();
    if (!r.ok) { st.innerHTML = '<span class="chip c-bad">تعذّر: ' + esc(d.error || r.status) + "</span>"; return; }
    st.innerHTML = '<span class="chip c-ok">أصبح المساعد يرسل هذا الملف ✓</span>';
    const ar = await fetch("/admin/product-assets", { headers: { "x-admin-token": TOKEN } });
    if (ar.ok) prodAssets = await ar.json();
    render(false);
  } catch (e) { st.innerHTML = '<span class="chip c-bad">خطأ في الرفع</span>'; }
  input.value = "";
};
window.kbUpload = async (input) => {
  const f = input.files && input.files[0];
  if (!f) return;
  const st = document.getElementById("kbstat");
  st.innerHTML = '<span class="chip c-warn">جارٍ التحليل والاستخراج… قد يستغرق دقيقة</span>';
  const scoped = input.dataset.product || "";
  const fd = new FormData();
  if (scoped) fd.append("product", scoped);   // field MUST precede the file in the multipart stream
  fd.append("file", f);
  try {
    const r = await fetch("/admin/kb/upload", { method: "POST", headers: { "x-admin-token": TOKEN }, body: fd });
    const d = await r.json();
    if (!r.ok) { st.innerHTML = '<span class="chip c-bad">تعذّر: ' + esc(d.error || r.status) + "</span>"; return; }
    st.innerHTML = '<span class="chip c-ok">تم — «' + esc(d.product) + '» أصبح ضمن معرفة المساعد ✓</span>';
    const kr = await fetch("/admin/kb", { headers: { "x-admin-token": TOKEN } });
    if (kr.ok) kbDocs = await kr.json();
    if (scoped) { render(false); } else { location.hash = "kb/" + encodeURIComponent(d.product); }
  } catch (e) { st.innerHTML = '<span class="chip c-bad">خطأ في الرفع</span>'; }
  input.value = "";
};

function kbRegistry() {
  const hubByName = new Map(kbDocs.map((d) => [d.product, d]));
  const reg = PRODUCTS.map((p) => ({ name: p.n, sc: p.sc, hub: hubByName.get(p.n) || null, seed: true }));
  kbDocs.forEach((d) => { if (d.product !== "__skill__" && !reg.some((r) => r.name === d.product)) reg.push({ name: d.product, sc: null, hub: d, seed: false }); });
  return reg;
}
function uploadZone(scopedProduct) {
  return '<div onclick="kbPick()" style="border:1.5px dashed #C6D8EE;background:#F8FAFD;border-radius:14px;padding:26px 20px;text-align:center;cursor:pointer;">' +
    '<div style="width:44px;height:44px;margin:0 auto 12px;border-radius:12px;background:#E3ECF8;display:flex;align-items:center;justify-content:center;"><span style="width:15px;height:15px;border:2.5px solid #2F5F94;border-radius:4px;"></span></div>' +
    '<div style="font-size:13.5px;font-weight:700;color:#13294b;">' + (scopedProduct ? "ارفع ملف هذا المنتج — PDF أو Word أو PowerPoint" : "أضف منتجًا جديدًا بملفه — PDF أو Word أو PowerPoint") + "</div>" +
    '<div style="font-size:11.5px;color:#7b8597;margin-top:7px;line-height:1.9;">الملفات الرسمية المعتمدة فقط · محرك التحليل: Firecrawl AnyDoc · يُحفظ Markdown في Product Hub' + (scopedProduct ? "<br>يُضاف تحت هذا المنتج ويقرأه المساعد فورًا" : "<br>يُستخرج اسم المنتج من الملف تلقائيًا") + "</div></div>" +
    '<input id="kbfile" type="file" accept=".pdf,.docx,.pptx,.xlsx,.rtf,.odt,.epub,.csv" style="display:none" data-product="' + esc(scopedProduct || "") + '" onchange="kbUpload(this)">' +
    '<div id="kbstat" style="margin-top:12px;"></div>';
}
function vKb() {
  let h0 = "";
  const reg = kbRegistry();
  const tone = (sc) => sc >= 80 ? "#1f8a52" : sc >= 60 ? "#b5810f" : "#c43d3d";
  const skill = prodAssets.find((a) => a.product === "__skill__");
  if (skill) {
    h0 = '<div class="card" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#F4FBFA;border-color:#B9E4E0;">' +
      '<div style="flex:1;min-width:220px;"><div style="font-size:13.5px;font-weight:700;color:#13294b;">مهارة إنشاء العروض — lean-proposal-deck</div>' +
      '<div style="font-size:11.5px;color:#5b6678;margin-top:5px;line-height:1.8;">حمّلها وأنتج بها عروض المنتجات (PDF) ثم ارفعها هنا في صفحة كل منتج. <span style="direction:ltr;color:#9aa4b4;">' + esc(skill.filename) + '</span></div></div>' +
      '<a class="btn btn-teal" style="text-decoration:none;" href="/assets/' + esc(skill.public_id) + '" download>تحميل المهارة ⬇</a></div>';
  }
  let h = h0 + '<div class="sec">منتجات المساعد <span class="meta">' + reg.length + ' منتج · اضغط منتجًا لعرض معرفته وإدارتها</span></div>';
  h += '<div class="prods" style="margin-bottom:20px;">' + reg.map((r) => {
    const inner =
      '<div class="pn">' + esc(r.name) + "</div>" +
      (r.sc !== null
        ? '<span class="sc" style="color:' + tone(r.sc) + '">' + r.sc + '%</span> <span class="scl">درجة معرفة المساعد</span><div class="bar"><i style="width:' + r.sc + '%;background:' + tone(r.sc) + ';"></i></div>'
        : '<div style="height:6px;"></div>') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' +
      (r.hub ? '<span class="chip c-ok">معرفة ✓</span>' : '<span class="chip c-grey">لا معرفة بعد</span>') +
      (prodAssets.some((a) => a.product === r.name) ? '<span class="chip c-teal">ملف تعريفي 📎</span>' : "") +
      '<span style="flex:1"></span><span style="font-size:12px;font-weight:700;color:#2F5F94;">افتح ←</span></div>';
    return '<a href="#kb/' + encodeURIComponent(r.name) + '" style="text-decoration:none;"><div class="prod" style="cursor:pointer;">' + inner + "</div></a>";
  }).join("") + "</div>";
  return h;
}
function vKbProduct(name) {
  const reg = kbRegistry();
  const r = reg.find((x) => x.name === name);
  if (!r) return '<div class="empty"><div class="ic"><span></span></div><div class="t">منتج غير موجود</div><div class="s"><a href="#kb" style="color:#2E7D77;font-weight:700;">→ كل المنتجات</a></div></div>';
  const seedP = PRODUCTS_FULL.find((p) => p.n === name);
  let h = '<a href="#kb" style="display:inline-block;font-size:12.5px;font-weight:700;color:#13294b;text-decoration:none;margin-bottom:14px;">→ كل المنتجات</a>';
  h += '<div class="card" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">' +
    '<div style="width:46px;height:46px;flex:none;border-radius:12px;background:#13294b;display:flex;align-items:center;justify-content:center;color:#3FB6B0;font-weight:700;font-size:20px;">' + esc(name.trim().charAt(0)) + "</div>" +
    '<div style="flex:1;min-width:200px;"><div style="font-size:18px;font-weight:700;color:#13294b;">' + esc(name) + "</div>" +
    '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:7px;">' +
    (r.hub ? '<span class="chip c-ok">يقرأه المساعد الآن ✓</span>' : '<span class="chip c-warn">بانتظار أول ملف</span>') +
    (r.sc !== null ? '<span class="chip c-teal">معرفة مدمجة ' + r.sc + "%</span>" : "") +
    (r.hub && r.hub.source_filename ? '<span style="font-size:10.5px;color:#9aa4b4;direction:ltr;align-self:center;">' + esc(r.hub.source_filename) + "</span>" : "") +
    "</div></div></div>";
  const pa = prodAssets.find((a) => a.product === name);
  h += '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;"><h3 style="margin:0;">الملف التعريفي — يرسله المساعد في واتساب</h3>' +
    (pa ? '<div style="display:flex;gap:7px;align-items:center;"><span class="chip c-ok">ملف مرفق ✓</span><span style="font-size:10.5px;color:#9aa4b4;direction:ltr;">' + esc(pa.filename) + "</span></div>" : '<span class="chip c-grey">لا ملف بعد</span>') + "</div>" +
    '<div style="font-size:12px;color:#7b8597;margin:10px 0;line-height:1.9;">يُرسل تلقائيًا مع افتتاحية الحملة لهذا المنتج، وعندما يطلب العميل تفاصيل أكثر أو ملفًا.</div>' +
    '<div onclick="paPick()" style="border:1.5px dashed #B9E4E0;background:#F4FBFA;border-radius:12px;padding:18px;text-align:center;cursor:pointer;">' +
    '<div style="font-size:12.5px;font-weight:700;color:#2E7D77;">' + (pa ? "استبدال الملف التعريفي (PDF)" : "ارفع الملف التعريفي (PDF)") + "</div></div>" +
    '<input id="pafile" type="file" accept=".pdf" style="display:none" data-product="' + esc(name) + '" onchange="paUpload(this)">' +
    '<div id="pastat" style="margin-top:10px;"></div></div>';
  h += '<div class="card"><h3>' + (r.hub ? "تحديث ملف المعرفة (Pitch Deck)" : "ارفع ملف المعرفة لهذا المنتج") + "</h3>" + uploadZone(name) + "</div>";
  if (r.hub) {
    h += '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px;">' +
      '<h3 style="margin:0;">المعرفة المعتمدة (Product Hub)</h3><span class="chip c-ok">يقرأها المساعد في كل محادثة</span></div>' +
      '<div style="border-top:1px solid #f0f2f6;padding-top:12px;">' + mdRender(r.hub.md) + "</div></div>";
  }
  if (seedP) {
    h += '<div class="card"><h3>المعرفة الأساسية المدمجة</h3><div style="border:1px solid #eef1f5;border-radius:12px;overflow:hidden;">' +
      [["العرض", seedP.pitch], ["الكفاءة", seedP.eff.join(" · ")], ["الأنسب لـ", seedP.best.join("، ")], ["التسعير المسموح ذكره", seedP.pricing]]
        .map((x) => '<div class="kbrow"><span class="dt" style="background:#2e9e6b;"></span><div class="ti"><div class="t1">' + esc(x[0]) + '</div><div class="t2">' + esc(x[1]) + "</div></div></div>").join("") + "</div></div>";
  }
  if (name === "الإجازات المرضية") {
    const dot = { ok: "#2e9e6b", warn: "#d6a01f", bad: "#d85151" };
    const chipm = { ok: ["c-ok", "مكتمل"], warn: ["c-warn", "ناقص"], bad: ["c-bad", "لم يبدأ"] };
    h += '<div class="card"><h3>جاهزية الأقسام — 92%</h3><div style="border:1px solid #eef1f5;border-radius:12px;overflow:hidden;">' +
      KB_SECTIONS.map((x) => '<div class="kbrow"><span class="dt" style="background:' + dot[x[2]] + ';"></span><div class="ti"><div class="t1">' + x[0] + '</div><div class="t2">' + x[1] + '</div></div><span class="chip ' + chipm[x[2]][0] + '">' + chipm[x[2]][1] + '</span><span class="ct">' + x[3] + "</span></div>").join("") + "</div></div>";
  }
  return h;
}

window.entImport = async () => {
  const ta = document.getElementById("entpaste");
  if (!ta.value.trim()) return;
  const st = document.getElementById("entstat");
  st.innerHTML = '<span class="chip c-warn">جارٍ الاستيراد…</span>';
  try {
    const r = await fetch("/admin/entities", { method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ text: ta.value }) });
    const d = await r.json();
    if (!r.ok) { st.innerHTML = '<span class="chip c-bad">' + esc(d.error || r.status) + "</span>"; return; }
    st.innerHTML = '<span class="chip c-ok">أُضيف ' + d.added + "</span> " + (d.updated ? '<span class="chip c-teal">حُدّث ' + d.updated + "</span> " : "") + (d.invalid ? '<span class="chip c-bad">غير صالح ' + d.invalid + "</span>" : "");
    ta.value = "";
    const er = await fetch("/admin/entities", { headers: { "x-admin-token": TOKEN } });
    if (er.ok) entities = await er.json();
    render(false);
  } catch (e) { st.innerHTML = '<span class="chip c-bad">خطأ</span>'; }
};
window.entFilePick = () => document.getElementById("entfile").click();
window.entFileUpload = async (input) => {
  const f = input.files && input.files[0];
  if (!f) return;
  const st = document.getElementById("entfstat");
  st.innerHTML = '<span class="chip c-warn">جارٍ قراءة الملف واستيراد الصفوف…</span>';
  const fd = new FormData(); fd.append("file", f);
  try {
    const r = await fetch("/admin/entities/import", { method: "POST", headers: { "x-admin-token": TOKEN }, body: fd });
    const d = await r.json();
    if (!r.ok) { st.innerHTML = '<span class="chip c-bad">تعذّر: ' + esc(d.error || r.status) + "</span>"; return; }
    let msg = '<span class="chip c-ok">أُضيف ' + d.added + "</span> ";
    if (d.updated) msg += '<span class="chip c-teal">حُدّث ' + d.updated + "</span> ";
    if (d.skippedCount) msg += '<span class="chip c-bad">تُخطّي ' + d.skippedCount + "</span> ";
    msg += '<div style="font-size:11px;color:#7b8597;margin-top:8px;line-height:1.9;">الأعمدة المكتشفة — الاسم: <b>' + esc(d.columns.name) + '</b> · الجوال: <b>' + esc(d.columns.phone) + "</b>" +
      (d.columns.attrs.length ? " · شرائح: " + d.columns.attrs.map(esc).join("، ") : " · لا أعمدة شرائح إضافية") + "</div>";
    if (d.skippedRows && d.skippedRows.length) {
      msg += '<div style="font-size:11px;color:#c43d3d;margin-top:4px;line-height:1.9;">' +
        d.skippedRows.map((s) => "صف " + s.row + ": " + esc(s.reason)).join(" · ") + "</div>";
    }
    entImportSummary = msg;   // survives the re-render (the status div is rebuilt by vCustomers)
    const er = await fetch("/admin/entities", { headers: { "x-admin-token": TOKEN } });
    if (er.ok) entities = await er.json();
    render(false);
    alertBar("استُورد الملف — " + d.added + " جديد، " + d.updated + " محدّث", false);
  } catch (e) { st.innerHTML = '<span class="chip c-bad">خطأ في الاستيراد</span>'; }
  input.value = "";
};
window.entDel = async (id) => {
  await fetch("/admin/entities/delete", { method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  entities = entities.filter((e) => e.id !== id); entSel.delete(id); render(false);
};
function vCustomers() {
  let h = '<div class="card">' +
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
    '<h3 style="margin:0;flex:1;min-width:180px;">المستهدفون</h3>' +
    '<button class="btn btn-teal" style="font-size:12.5px;padding:11px 18px;" onclick="entFilePick()">⬆ رفع ملف Excel/CSV</button>' +
    '<a href="/assets/audience-template.xlsx" download class="btn" style="font-size:12px;color:#1F4470;background:#E3ECF8;text-decoration:none;">القالب الجاهز</a></div>' +
    '<div style="font-size:11px;color:#9aa4b4;margin-top:9px;line-height:1.8;">قائمتك كما هي: عمود اسم + عمود جوال، وكل عمود إضافي (المدينة، الحجم…) يصبح <b style="color:#2E7D77;">شريحة استهداف</b> · التكرار يُحدَّث · أرقام 05 تتحول لـ966</div>' +
    '<input id="entfile" type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="entFileUpload(this)">' +
    '<div id="entfstat" style="margin-top:10px;">' + entImportSummary + "</div>" +
    '<details style="margin-top:10px;"><summary style="font-size:11.5px;color:#7b8597;cursor:pointer;font-weight:600;">إضافة سريعة بدون ملف (لصق سطور)</summary>' +
    '<div style="font-size:11.5px;color:#7b8597;margin:10px 0 8px;line-height:1.9;">سطر لكل جهة: <b style="color:#13294b;">الاسم، الرقم، الحجم، المدينة</b></div>' +
    '<textarea id="entpaste" rows="4" placeholder="مجمع النور الطبي، 966512345678، كبيرة، الرياض" style="font-family:inherit;width:100%;font-size:12.5px;border:1.5px solid #e9edf3;border-radius:12px;padding:13px;line-height:2;resize:vertical;"></textarea>' +
    '<div style="display:flex;align-items:center;gap:10px;margin-top:10px;"><button class="btn" style="color:#1F4470;background:#E3ECF8;" onclick="entImport()">استيراد ←</button><span id="entstat"></span></div></details></div>';
  const groups = segGroups();
  const cq = custQ.trim();
  const cm = cq ? entities.filter((e) => e.name.includes(cq) || e.phone.includes(cq)) : entities;
  const cshown = cm.slice(0, LIST_CAP);
  h += '<div class="sec">المستهدفون <span class="meta">' + entities.length.toLocaleString("ar-SA") + " جهة" +
    (groups.length ? " · شرائح: " + groups.map((g) => esc(g.key)).join("، ") : "") + "</span></div>";
  if (!entities.length) {
    h += '<div class="empty"><div class="ic"><span></span></div><div class="t">لا مستهدفين بعد</div><div class="s">ارفع ملفك أعلاه — ثم اخترهم بالشرائح أو فردًا في «إنشاء حملة».</div></div>';
  } else {
    h += '<div style="margin-bottom:10px;"><input id="cq" value="' + esc(custQ) + '" oninput="custSearch(this)" placeholder="ابحث بالاسم أو الرقم…" style="font-family:inherit;width:100%;font-size:12.5px;border:1px solid #e9edf3;border-radius:10px;padding:9px 13px;background:#fff;"></div>';
    h += '<div class="tblwrap">' + cshown.map((e) => {
      const hasConvo = Boolean(contactByPhone(e.phone));
      return '<div ' + (hasConvo ? 'onclick="location.hash=\\'customer/' + esc(e.phone) + '\\'" style="cursor:pointer;display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid #f3f5f8;"' : 'style="display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid #f3f5f8;"') + '>' +
      '<div class="avatar" style="width:34px;height:34px;border-radius:9px;background:#13294b;color:#3FB6B0;display:flex;align-items:center;justify-content:center;font-weight:700;">' + esc(e.name.trim().charAt(0)) + "</div>" +
      '<span style="flex:1;min-width:0;font-size:13px;font-weight:600;color:#13294b;">' + esc(e.name) + (hasConvo ? ' <span style="font-size:10.5px;color:#2E7D77;font-weight:700;">ملف ←</span>' : "") + "</span>" +
      '<span class="hidemob" style="display:flex;gap:6px;align-items:center;">' + attrChips(e, 3) + "</span>" +
      '<span style="font-size:11.5px;color:#9aa4b4;direction:ltr;">+' + esc(e.phone) + "</span>" +
      '<button onclick="event.stopPropagation();entDel(' + e.id + ')" style="font-family:inherit;font-size:15px;font-weight:700;color:#c43d3d;background:#fbe9e9;border:none;border-radius:8px;width:28px;height:28px;cursor:pointer;line-height:1;">×</button></div>';
    }).join("") +
    (cm.length > LIST_CAP ? '<div style="padding:12px;text-align:center;color:#7b8597;font-size:12px;background:#fafbfc;">+ ' + (cm.length - LIST_CAP).toLocaleString("ar-SA") + ' آخرون — استخدم البحث للوصول إليهم</div>' : "") +
    (cm.length ? "" : '<div style="padding:22px;text-align:center;color:#9aa4b4;font-size:12.5px;">لا نتائج مطابقة</div>') + "</div>";
  }
  return h;
}
window.custSearch = (el) => { custQ = el.value; clearTimeout(window.__cq); window.__cq = setTimeout(() => render(false), 250); };

function chartCard(title, sub, inner) {
  return '<div class="card" style="margin:0;"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;"><h3 style="margin:0;">' + title + '</h3><span style="font-size:10.5px;color:#9aa4b4;">' + sub + "</span></div>" + inner + "</div>";
}
function hbarRows(rows, color) {
  const mx = Math.max(1, ...rows.map((r) => r[1]));
  return '<div style="margin-top:12px;display:flex;flex-direction:column;gap:9px;">' + rows.map((r) =>
    '<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span style="font-weight:600;color:#3b4657;">' + esc(String(r[0])) + '</span><span style="font-weight:700;color:#13294b;">' + r[1].toLocaleString("ar-SA") + "</span></div>" +
    '<div style="height:8px;background:#eef1f5;border-radius:999px;overflow:hidden;"><i style="display:block;height:100%;border-radius:999px;width:' + Math.round(r[1] / mx * 100) + "%;background:" + (r[2] || color) + ';"></i></div></div>').join("") + "</div>";
}
function dailyActivitySvg(cs) {
  const days = []; const now = new Date(); now.setHours(0, 0, 0, 0);
  for (let i = 0; i <= 13; i++) { const d = new Date(now.getTime() - i * 864e5); days.push({ t0: d.getTime(), t1: d.getTime() + 864e5, inN: 0, outN: 0, label: i === 0 ? "اليوم" : d.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "numeric" }) }); }
  cs.forEach((c) => (c.transcript || []).forEach((t) => {
    const d = days.find((x) => t.ts >= x.t0 && t.ts < x.t1);
    if (d) { if (t.role === "customer") d.inN++; else if (t.role === "agent") d.outN++; }
  }));
  const mx = Math.max(1, ...days.map((d) => d.inN + d.outN));
  const W = 616, H = 132, bw = 30;
  let bars = "";
  days.forEach((d, i) => {
    const x = 8 + i * (bw + 14);
    const hOut = Math.round(d.outN / mx * 96), hIn = Math.round(d.inN / mx * 96);
    bars += '<rect x="' + x + '" y="' + (104 - hOut) + '" width="' + bw + '" height="' + hOut + '" rx="3" fill="#C6D8EE"/>' +
      '<rect x="' + x + '" y="' + (104 - hOut - hIn) + '" width="' + bw + '" height="' + hIn + '" rx="3" fill="#2E8F89"/>' +
      '<text x="' + (x + bw / 2) + '" y="122" text-anchor="middle" font-size="8.5" fill="#9aa4b4">' + d.label + "</text>";
  });
  return '<div dir="ltr" style="overflow-x:auto;" class="ms-scroll"><svg viewBox="0 0 ' + W + " " + H + '" style="width:100%;min-width:520px;height:auto;display:block;margin-top:10px;" role="img" aria-label="نشاط الرسائل ١٤ يومًا">' +
    '<line x1="4" y1="104" x2="' + (W - 4) + '" y2="104" stroke="#e9edf3" stroke-width="1"/>' + bars + "</svg></div>" +
    '<div style="display:flex;gap:14px;margin-top:8px;font-size:10.5px;color:#7b8597;"><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:#2E8F89;margin-inline-end:5px;"></i>واردة من العملاء</span><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:#C6D8EE;margin-inline-end:5px;"></i>صادرة</span></div>';
}
function vHomeCharts(cs) {
  const camps = showTest ? campaigns : campaigns.filter((cp) => !campIsTest(cp));
  const agg = { targeted: 0, sent: 0, delivered: 0, seen: 0, replied: 0, interested: 0 };
  camps.forEach((cp) => { const st = campStats(cp); Object.keys(agg).forEach((k) => { agg[k] += st[k] || 0; }); });
  const funnel = [["المستهدفون", agg.targeted, "#2F5F94"], ["أُرسلت", agg.sent, "#2F5F94"], ["وصلت", agg.delivered, "#3FB6B0"], ["شوهدت", agg.seen, "#3FB6B0"], ["ردّوا", agg.replied, "#2E8F89"], ["مهتمون", agg.interested, "#1f8a52"]];
  const byProd = new Map();
  cs.forEach((c) => { const seen = new Set(); (c.tags || []).forEach((t) => { if (!seen.has(t.product)) { seen.add(t.product); byProd.set(t.product, (byProd.get(t.product) || 0) + 1); } }); });
  const prodRows = [...byProd.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [k, v]);
  const byCity = new Map();
  entities.forEach((e) => { const city = (e.attrs || {})["المدينة"]; if (city) byCity.set(city, (byCity.get(city) || 0) + 1); });
  const cityRows = [...byCity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [k, v]);
  let h = '<div class="sec" style="margin-top:4px;">التحليلات <span class="meta">أرقام حية من الحملات والمحادثات' + (showTest ? " · شاملة التجريبية" : " · الحقيقية فقط") + "</span></div>";
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;align-items:start;margin-bottom:18px;">';
  h += chartCard("قمع الحملات", camps.length.toLocaleString("ar-SA") + " حملة", agg.targeted ? hbarRows(funnel, "#2F5F94") : '<div style="font-size:12px;color:#9aa4b4;margin-top:14px;line-height:1.9;">لا حملات ' + (showTest ? "" : "حقيقية ") + 'بعد — القمع يتعبأ مع أول إطلاق.</div>');
  h += chartCard("نشاط الرسائل", "آخر ١٤ يومًا", dailyActivitySvg(cs));
  h += chartCard("الاهتمام حسب المنتج", "من وسوم المساعد", prodRows.length ? hbarRows(prodRows, "#2E7D77") : '<div style="font-size:12px;color:#9aa4b4;margin-top:14px;">تظهر عند أول وسم اهتمام.</div>');
  h += chartCard("المستهدفون حسب المدينة", entities.length.toLocaleString("ar-SA") + " جهة", cityRows.length ? hbarRows(cityRows, "#C9A227") : '<div style="font-size:12px;color:#9aa4b4;margin-top:14px;">تظهر بعد استيراد قائمة فيها عمود المدينة.</div>');
  h += "</div>";
  return h;
}
const INTENT_META = { high: ["نية شراء مرتفعة", "#1f8a52"], medium: ["نية متوسطة", "#b5810f"], low: ["نية منخفضة", "#7b8597"], none: ["لا إشارة بعد", "#9aa4b4"] };
function toneBadge(label, color) {
  return '<span style="display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #e9edf3;border-radius:999px;padding:4px 11px;font-size:11px;font-weight:700;color:#3b4657;">' +
    '<span style="width:8px;height:8px;border-radius:999px;background:' + color + ';"></span>' + esc(label) + "</span>";
}
function tlDot(kind) {
  return { in: "#2F5F94", out: "#3FB6B0", camp: "#2E8F89", file: "#b5810f", tag: "#C9A227", st: "#9aa4b4", sys: "#c9d2df" }[kind] || "#c9d2df";
}
function vCustomer(ph) {
  if (!profileData || profilePhone !== ph) {
    return '<div class="empty"><div class="ic"><span></span></div><div class="t">جارٍ تجميع ملف العميل…</div><div class="s">السجل، قراءة المساعد، واكتمال السياق.</div></div>';
  }
  if (profileData.missing) {
    return '<div class="empty"><div class="ic"><span></span></div><div class="t">لا محادثة لهذا الرقم بعد</div><div class="s">يظهر ملف العميل بعد أول رسالة واتساب. <a href="#customers" style="color:#2E7D77;font-weight:700;">→ قائمة المستهدفين</a></div></div>';
  }
  const d = profileData; const c = d.contact; const ins = d.insights || {}; const ctx = d.context || { score: 0, parts: [] };
  const nm = c.waName || (d.entity && d.entity.name) || "غير معروف";
  const im = INTENT_META[ins.intent] || INTENT_META.none;
  const missing = (ctx.parts || []).filter((p) => !p.got).slice(0, 2);
  let h = '<a href="javascript:history.back()" style="display:inline-block;font-size:12.5px;font-weight:700;color:#13294b;text-decoration:none;margin-bottom:14px;">→ رجوع</a>';
  h += '<div class="card" style="display:flex;gap:18px;align-items:stretch;flex-wrap:wrap;">' +
    '<div style="flex:1;min-width:260px;display:flex;gap:14px;align-items:flex-start;">' +
    '<div style="width:52px;height:52px;flex:none;border-radius:14px;background:#13294b;color:#3FB6B0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:22px;">' + esc(nm.trim().charAt(0)) + "</div>" +
    '<div style="flex:1;min-width:0;"><div style="font-size:18px;font-weight:700;color:#13294b;">' + esc(nm) + (c.test ? ' <span class="chip" style="color:#8a6d10;background:rgba(201,162,39,.14);">تجريبي</span>' : "") + "</div>" +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' +
    (d.entity ? attrChips(d.entity, 4) : '<span class="chip c-grey">غير مستورد في القوائم</span>') +
    '<span class="chip c-teal">واتساب ✓</span>' + (c.human ? '<span class="chip c-warn">بيد البشر</span>' : "") + "</div>" +
    '<div style="font-size:11.5px;color:#9aa4b4;margin-top:8px;direction:ltr;text-align:right;">+' + esc(c.phone) + "</div>" +
    '<div style="font-size:11px;color:#9aa4b4;margin-top:4px;">أول ظهور: ' + fmtD(c.firstSeenAt) + " · آخر نشاط: " + fmtT(c.lastEventAt) + "</div>" +
    ((d.campaigns || []).length ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' + d.campaigns.map((cp) => '<a href="#kmon/' + cp.id + '" style="text-decoration:none;" class="chip c-blue">' + esc(cp.name.slice(0, 30)) + "</a>").join("") + "</div>" : "") +
    "</div></div>" +
    '<div style="flex:none;display:flex;gap:12px;align-items:center;border-inline-start:1px solid #f0f2f6;padding-inline-start:18px;">' +
    '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">' +
    '<div style="font-size:22px;font-weight:700;color:#2E7D77;">' + ctx.score + '%</div>' +
    '<div style="width:10px;height:110px;background:#eef1f5;border-radius:999px;position:relative;overflow:hidden;"><i style="position:absolute;bottom:0;left:0;right:0;height:' + ctx.score + '%;background:linear-gradient(180deg,#3FB6B0,#2E7D77);display:block;border-radius:999px;"></i></div>' +
    '<div style="font-size:10px;font-weight:700;color:#7b8597;">اكتمال السياق</div></div>' +
    (missing.length ? '<div style="max-width:150px;font-size:10.5px;color:#9aa4b4;line-height:1.9;">ينقصه:<br>' + missing.map((m) => "· " + esc(m.label)).join("<br>") + "</div>" : "") +
    "</div></div>";
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:2px 0 16px;">' +
    '<button class="btn btn-teal" onclick="openConvo(\\'' + esc(c.phone) + '\\')">فتح المحادثة</button>' +
    '<button id="insbtn" class="btn" style="color:#1F4470;background:#E3ECF8;" onclick="refreshInsights()">تحديث قراءة المساعد ↻</button></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:16px;align-items:start;">';
  // فهم المساعد
  h += '<div class="card" style="margin:0;background:#F4FBFA;border-color:#B9E4E0;">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><h3 style="margin:0;color:#2E7D77;">⁂ فهم المساعد</h3>' + toneBadge(im[0], im[1]) + "</div>";
  if (ins.learning) {
    h += '<div style="font-size:13px;color:#5b6678;line-height:2;margin-top:12px;">' + esc(ins.summary) + "</div>" +
      ((ins.product_interest || []).length ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' + ins.product_interest.map((p) => toneBadge(p.product, p.level === "high" ? "#1f8a52" : p.level === "medium" ? "#b5810f" : "#7b8597")).join("") + "</div>" : "") +
      '<div style="font-size:11.5px;color:#7b8597;margin-top:12px;line-height:1.9;">كل رسالة جديدة تجعل القراءة أدق — كما في مرحلة «Learning…».</div>';
  } else {
    h += '<div style="font-size:13.5px;font-weight:700;color:#13294b;line-height:2;margin-top:12px;">' + esc(ins.summary || "") + "</div>";
    if ((ins.product_interest || []).length) h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">' + ins.product_interest.map((p) => toneBadge(p.product + (p.level === "high" ? " · مرتفع" : p.level === "medium" ? " · متوسط" : " · منخفض"), p.level === "high" ? "#1f8a52" : p.level === "medium" ? "#b5810f" : "#7b8597")).join("") + "</div>";
    if ((ins.signals || []).length) h += '<div style="margin-top:12px;"><div style="font-size:11px;font-weight:700;color:#7b8597;margin-bottom:6px;">إشارات الشراء</div>' + ins.signals.map((sg) => '<div style="font-size:12px;color:#3b4657;line-height:1.9;">« ' + esc(sg) + ' »</div>').join("") + "</div>";
    if ((ins.objections || []).length) h += '<div style="margin-top:10px;"><div style="font-size:11px;font-weight:700;color:#7b8597;margin-bottom:6px;">اعتراضات</div>' + ins.objections.map((ob) => '<div style="font-size:12px;color:#8a5a2b;line-height:1.9;">· ' + esc(ob) + "</div>").join("") + "</div>";
    h += '<div style="margin-top:14px;background:#fff;border:1px solid #B9E4E0;border-inline-start:3px solid #2E7D77;border-radius:11px;padding:13px 15px;">' +
      '<div style="font-size:11px;font-weight:700;color:#2E7D77;margin-bottom:5px;">الخطوة التالية</div>' +
      '<div style="font-size:13px;font-weight:700;color:#13294b;line-height:1.9;">' + esc(ins.next_action || "") + "</div>" +
      (ins.why ? '<div style="font-size:11.5px;color:#5b6678;margin-top:5px;line-height:1.9;">' + esc(ins.why) + "</div>" : "") +
      (ins.best_time ? '<div style="font-size:11.5px;color:#2E7D77;font-weight:600;margin-top:7px;">أفضل وقت: ' + esc(ins.best_time) + "</div>" : "") + "</div>";
  }
  h += "</div>";
  // timeline
  h += '<div class="card" style="margin:0;"><h3 style="margin:0 0 4px;">سجل التفاعل</h3>' +
    '<div style="font-size:11px;color:#9aa4b4;margin-bottom:10px;">كل نقاط التماس — رسائل، حالات تسليم، وسوم، ملفات — الأحدث أولًا</div>' +
    '<div class="ms-scroll" style="max-height:430px;overflow-y:auto;">' +
    ((d.timeline || []).length ? d.timeline.map((ev) =>
      '<div style="display:flex;gap:11px;padding:9px 2px;border-bottom:1px solid #f3f5f8;">' +
      '<span style="width:9px;height:9px;flex:none;margin-top:6px;border-radius:999px;background:' + tlDot(ev.kind) + ';"></span>' +
      '<div style="flex:1;min-width:0;"><div style="font-size:12px;color:#13294b;line-height:1.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(ev.title) + "</div>" +
      '<div style="font-size:10.5px;color:#9aa4b4;margin-top:2px;">' + esc(ev.meta || "") + " · " + fmtD(ev.ts) + " " + fmtT(ev.ts) + "</div></div></div>").join("")
      : '<div style="padding:20px;text-align:center;color:#9aa4b4;font-size:12px;">لا أحداث بعد</div>') + "</div></div>";
  h += "</div>";
  return h;
}

function vPlaceholder(cur) {
  const t = TITLES[cur] || ["", ""];
  return '<div class="empty"><div class="ic"><span></span></div><div class="t">' + t[0] + '</div><div class="s">هذه الوحدة ضمن المرحلة القادمة من «مسار» وفق خارطة الطريق — وحدة التسويق هي النشطة حاليًا.</div></div>';
}

function gate(msg) {
  document.getElementById("body").innerHTML = '<div class="gate"><div style="font-size:16px;font-weight:700;">دخول مَسار</div>' +
    '<input id="tok" placeholder="admin token" dir="ltr"><button class="btn btn-teal" onclick="saveTok()">دخول</button>' +
    (msg ? '<div style="color:#c43d3d;font-size:12px;margin-top:10px;">' + esc(msg) + "</div>" : "") + "</div>";
}
window.saveTok = () => { TOKEN = document.getElementById("tok").value.trim(); localStorage.setItem("massar_admin_token", TOKEN); refresh(); };

function render(fetchNew) {
  nav();
  const af = document.activeElement;
  const afId = af && af.tagName === "INPUT" ? af.id || af.getAttribute("data-fid") : null;
  const afPos = afId && af.selectionStart != null ? af.selectionStart : null;
  const cur = (location.hash || "#kmon").slice(1).split("/")[0];
  const b = document.getElementById("body");
  if (cur === "kmon" || cur === "home") {
    if (!TOKEN) return gate();
    if (!cache) return; // first fetch pending
    const campId = cur === "kmon" ? (location.hash || "").split("/")[1] || "" : "";
    b.innerHTML = cur === "kmon" ? (campId ? vKmonDetail(campId, cache) : vKmon(cache)) : vHome(cache);
  } else if (cur === "customer") {
    if (!TOKEN) return gate();
    const ph = (location.hash || "").split("/")[1] || "";
    b.innerHTML = vCustomer(ph);
  } else if (cur === "aimkt" || cur === "kb" || cur === "customers") {
    if (!TOKEN) return gate();
    const kbProd = cur === "kb" ? decodeURIComponent((location.hash || "").split("/").slice(1).join("/") || "") : "";
    b.innerHTML = cur === "aimkt" ? vAimkt() : cur === "kb" ? (kbProd ? vKbProduct(kbProd) : vKb()) : vCustomers();
  } else {
    b.innerHTML = vPlaceholder(cur);
  }
  if (afId) {
    const el2 = document.getElementById(afId);
    if (el2) { el2.focus(); if (afPos != null && el2.setSelectionRange) try { el2.setSelectionRange(afPos, afPos); } catch (e) {} }
  }
}

async function refresh(force) {
  const cur = (location.hash || "#kmon").slice(1).split("/")[0];
  if (TOKEN) {
    try {
      const r = await fetch("/admin/state", { headers: { "x-admin-token": TOKEN } });
      if (r.status === 401) { if (cur === "kmon" || cur === "home") return gate("رمز غير صحيح"); }
      else { cache = await r.json(); document.getElementById("upd").textContent = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
      const [er, kr, cr, ir] = await Promise.all([
        fetch("/admin/entities", { headers: { "x-admin-token": TOKEN } }),
        fetch("/admin/kb", { headers: { "x-admin-token": TOKEN } }),
        fetch("/admin/campaigns", { headers: { "x-admin-token": TOKEN } }),
        fetch("/admin/insights", { headers: { "x-admin-token": TOKEN } }),
      ]);
      if (er.ok) entities = await er.json();
      if (kr.ok) kbDocs = await kr.json();
      if (cr.ok) campaigns = await cr.json();
      if (ir.ok) { const rows = await ir.json(); insCache = {}; rows.forEach((r) => { insCache[r.phone] = r.data; }); }
      try { const ar = await fetch("/admin/product-assets", { headers: { "x-admin-token": TOKEN } }); if (ar.ok) prodAssets = await ar.json(); } catch (e) {}
      const curR = (location.hash || "").slice(1).split("/")[0];
      if (curR === "customer") {
        const ph = (location.hash || "").split("/")[1] || "";
        if (ph) {
          const pr = await fetch("/admin/customer/" + ph, { headers: { "x-admin-token": TOKEN } });
          if (pr.ok) { profileData = await pr.json(); profilePhone = ph; }
          else if (pr.status === 404) { profileData = { missing: true }; profilePhone = ph; }
        }
      }
    } catch (e) { /* keep last view */ }
  }
  render(true);
  renderConvo();
}
window.refreshInsights = async () => {
  if (!profilePhone) return;
  const el = document.getElementById("insbtn");
  if (el) el.textContent = "جارٍ القراءة…";
  try {
    const pr = await fetch("/admin/customer/" + profilePhone + "?refresh=1", { headers: { "x-admin-token": TOKEN } });
    if (pr.ok) { profileData = await pr.json(); render(false); alertBar("حُدّثت قراءة المساعد لهذا العميل ✓", false); }
    else { if (el) el.textContent = "تحديث قراءة المساعد ↻"; alertBar("تعذّر التحديث (" + pr.status + ") — أعد المحاولة", true); }
  } catch (e) { const el2 = document.getElementById("insbtn"); if (el2) el2.textContent = "تحديث قراءة المساعد ↻"; alertBar("تعذّر تحديث القراءة", true); }
};
window.addEventListener("hashchange", () => {
  if (convoPhone) closeConvo(); rQ = "";
  const cur = (location.hash || "").slice(1).split("/")[0];
  if (cur === "customer") { profileData = null; render(false); refresh(); }
  else render(false);
});
if (!location.hash) location.hash = "kmon";
refresh();
setInterval(async () => {
  const cur = (location.hash || "#kmon").slice(1).split("/")[0];
  if (cur === "kmon" || cur === "home") { refresh(); }
  else if (TOKEN) { try { const r = await fetch("/admin/state", { headers: { "x-admin-token": TOKEN } }); if (r.ok) cache = await r.json(); } catch (e) {} }
}, 5000);
</script>
</body>
</html>`;
