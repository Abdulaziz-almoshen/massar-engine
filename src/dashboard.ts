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
let entities = []; const entSel = new Set(); let entQ = ""; let entSize = ""; let entCity = "";
let kbDocs = []; let launching = false;
let campMsg = "مرحبًا {name} 👋 معك مساعد لِين الرقمي. نساعد المنشآت الصحية على تقليل زمن إصدار الإجازات المرضية بنسبة 70% بتوثيق رسمي وتكامل مع أنظمتكم. هل يناسبكم عرض تعريفي قصير هذا الأسبوع؟";

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

function entMatches() {
  const q = entQ.trim();
  return entities.filter((e) =>
    (!entSize || (e.size || "") === entSize) &&
    (!entCity || (e.city || "") === entCity) &&
    (!q || e.name.includes(q) || e.phone.includes(q)));
}
function chipBtn(label, on, fn) {
  return '<button class="btn" style="padding:8px 14px;font-size:12px;border-radius:999px;' +
    (on ? 'color:#2E7D77;background:#DCF1EF;border:1px solid #3FB6B0;' : 'color:#5b6678;background:#fff;border:1px solid #e9edf3;') +
    '" onclick="' + fn + '">' + esc(label) + "</button>";
}
window.entSetSize = (i) => { const vals = ["", ...new Set(entities.map(e => e.size).filter(Boolean))]; entSize = vals[i] || ""; render(false); };
window.entSetCity = (i) => { const vals = ["", ...new Set(entities.map(e => e.city).filter(Boolean))]; entCity = vals[i] || ""; render(false); };
window.entSearch = (el) => { entQ = el.value; clearTimeout(window.__eq); window.__eq = setTimeout(() => render(false), 250); };
window.entTog = (id) => { entSel.has(id) ? entSel.delete(id) : entSel.add(id); render(false); };
window.entAllMatching = () => { const m = entMatches(); const all = m.every(e => entSel.has(e.id)); m.forEach(e => all ? entSel.delete(e.id) : entSel.add(e.id)); render(false); };
window.entClear = () => { entSel.clear(); render(false); };
window.campMsgSet = (el) => { campMsg = el.value; };
window.pick = (i) => { selProd = i; render(false); };
window.openLaunch = () => { if (!entSel.size || !campMsg.trim() || launching) return; document.getElementById("lmodal").style.display = "flex"; };
window.closeLaunch = () => { const m = document.getElementById("lmodal"); if (m) m.style.display = "none"; };
window.confirmLaunch = async () => {
  if (launching) return; launching = true;
  const btn = document.getElementById("lgo"); if (btn) { btn.textContent = "جارٍ الإرسال…"; }
  const targets = entities.filter(e => entSel.has(e.id)).map(e => ({ phone: e.phone, name: e.name }));
  try {
    const r = await fetch("/admin/campaign/launch", { method: "POST",
      headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ targets, message: campMsg }) });
    const d = await r.json();
    launching = false; closeLaunch();
    if (!r.ok) { alertBar("فشل الإطلاق: " + esc(d.error || r.status), true); render(false); return; }
    alertBar("أُرسلت " + d.sent + " من " + d.requested + " — تابع الحالة الآن في متابعة الحملات", false);
    entSel.clear();
    setTimeout(() => { location.hash = "kmon"; refresh(); }, 1200);
  } catch (e) { launching = false; closeLaunch(); alertBar("خطأ في الإطلاق", true); }
};
window.alertBar = (txt, bad) => {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;bottom:22px;right:290px;z-index:99;background:" + (bad ? "#FBE9E9" : "#E6F4EC") +
    ";color:" + (bad ? "#c43d3d" : "#1f8a52") + ";font-weight:700;font-size:13px;border-radius:11px;padding:13px 18px;box-shadow:0 8px 24px rgba(16,38,68,.14);";
  el.textContent = txt;
  document.body.appendChild(el); setTimeout(() => el.remove(), 3800);
};

function vAimkt() {
  const p = PRODUCTS[selProd];
  const tone = (sc) => sc >= 80 ? ["#1f8a52", "جاهز للبيع", "c-ok"] : sc >= 60 ? ["#b5810f", "جاهز بتحفّظ", "c-warn"] : ["#c43d3d", "غير جاهز", "c-bad"];
  const m = entMatches();
  const selN = entSel.size;
  const firstSel = entities.find(e => entSel.has(e.id));
  const sizes = ["", ...new Set(entities.map(e => e.size).filter(Boolean))];
  const cities = ["", ...new Set(entities.map(e => e.city).filter(Boolean))];
  const allOn = m.length && m.every(e => entSel.has(e.id));

  let h = '<div class="step"><div class="hd"><span class="num done">1</span><div><div class="ht">أي منتج يبيعه المساعد؟</div><div class="hs">يعتمد المساعد على معرفة المنتج المسجّلة + ملفات Product Hub.</div></div></div><div class="prods">' +
    PRODUCTS.map((x, i) => { const t = tone(x.sc); return '<button class="prod' + (i === selProd ? " on" : "") + '" onclick="pick(' + i + ')"><div class="pn">' + x.n + '</div><span class="sc" style="color:' + t[0] + '">' + x.sc + '%</span> <span class="scl">درجة معرفة المساعد</span><div class="bar"><i style="width:' + x.sc + '%;background:' + t[0] + ';"></i></div><span class="chip ' + t[2] + '">' + t[1] + "</span></button>"; }).join("") + "</div></div>";

  h += '<div class="step"><div class="hd"><span class="num' + (selN ? " done" : "") + '">2</span><div><div class="ht">من يتواصل معهم؟</div><div class="hs">اختر شريحة كاملة أو حدّد جهات بعينها — العدد يتحدّث فورًا.</div></div>' +
    '<span style="flex:1"></span><span style="display:inline-flex;align-items:baseline;gap:7px;background:#F4FBFA;border:1px solid #B9E4E0;border-radius:11px;padding:9px 16px;"><span style="font-size:20px;font-weight:700;color:#2E7D77;">' + selN + '</span><span style="font-size:11.5px;color:#2E7D77;font-weight:600;">مختار من ' + entities.length + "</span></span></div>";
  if (!entities.length) {
    h += '<div style="border:1.5px dashed #c9d2df;border-radius:12px;padding:26px;text-align:center;color:#7b8597;font-size:13px;line-height:2;">لا مستهدفين بعد — أضفهم من شاشة <a href="#customers" style="color:#2E7D77;font-weight:700;">قائمة المستهدفين</a> (لصق: الاسم، الرقم، الحجم، المدينة).</div>';
  } else {
    h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">' +
      '<span style="font-size:11.5px;font-weight:700;color:#7b8597;">الحجم:</span>' +
      sizes.map((v, i) => chipBtn(v || "الكل", entSize === v, "entSetSize(" + i + ")")).join("") +
      (cities.length > 1 ? '<span style="font-size:11.5px;font-weight:700;color:#7b8597;margin-inline-start:8px;">المدينة:</span>' + cities.map((v, i) => chipBtn(v || "الكل", entCity === v, "entSetCity(" + i + ")")).join("") : "") + "</div>";
    h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
      '<input value="' + esc(entQ) + '" oninput="entSearch(this)" placeholder="ابحث بالاسم أو الرقم…" style="font-family:inherit;flex:1;min-width:200px;font-size:12.5px;border:1px solid #e9edf3;border-radius:10px;padding:9px 13px;background:#f8fafc;">' +
      '<button class="btn" style="font-size:12px;color:#1F4470;background:#E3ECF8;" onclick="entAllMatching()">' + (allOn ? "إلغاء تحديد المطابقين" : "تحديد المطابقين (" + m.length + ")") + '</button>' +
      (selN ? '<button class="btn" style="font-size:12px;color:#7b8597;background:#fff;border:1px solid #e0e5ec;" onclick="entClear()">مسح الاختيار</button>' : "") + "</div>";
    h += '<div style="border:1px solid #eef1f5;border-radius:12px;overflow:hidden;max-height:300px;overflow-y:auto;" class="ms-scroll">' +
      m.map((e) => {
        const on = entSel.has(e.id);
        return '<div onclick="entTog(' + e.id + ')" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid #f4f6f9;cursor:pointer;' + (on ? "background:#F4FBFA;" : "") + '">' +
          '<span style="width:17px;height:17px;flex:none;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;' + (on ? "background:#2E8F89;" : "border:1.5px solid #cdd4de;background:#fff;") + '">' + (on ? "✓" : "") + "</span>" +
          '<span style="flex:1;min-width:0;font-size:13px;font-weight:600;color:#13294b;">' + esc(e.name) + "</span>" +
          (e.size ? '<span class="chip ' + (e.size === "كبيرة" ? "c-blue" : e.size === "متوسطة" ? "c-teal" : "c-grey") + '">' + esc(e.size) + "</span>" : "") +
          (e.city ? '<span style="font-size:11px;color:#9aa4b4;">' + esc(e.city) + "</span>" : "") +
          '<span style="font-size:11px;color:#9aa4b4;direction:ltr;">+' + esc(e.phone) + "</span></div>";
      }).join("") + (m.length ? "" : '<div style="padding:22px;text-align:center;color:#9aa4b4;font-size:12.5px;">لا نتائج مطابقة</div>') + "</div>";
  }
  h += "</div>";

  h += '<div class="step"><div class="hd"><span class="num">3</span><div><div class="ht">رسالة الافتتاح</div><div class="hs">استخدم {name} ليضع المساعد اسم الجهة تلقائيًا. بعد أول رد، يتولى المساعد البائع الحوار كاملًا.</div></div></div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;align-items:start;">' +
    '<div><div style="font-size:11.5px;color:#7b8597;font-weight:600;margin-bottom:8px;">نص الرسالة</div>' +
    '<textarea oninput="campMsgSet(this)" rows="6" style="font-family:inherit;width:100%;font-size:12.5px;color:#13294b;border:1.5px solid #e9edf3;border-radius:12px;padding:13px;line-height:2;resize:vertical;">' + esc(campMsg) + "</textarea></div>" +
    '<div><div style="font-size:11.5px;color:#7b8597;font-weight:600;margin-bottom:8px;">معاينة واتساب</div>' +
    '<div class="wa-prev"><div class="b">' + esc(campMsg.replaceAll("{name}", (firstSel ? firstSel.name : "مجمع النور الطبي"))) + '</div><div class="t">الآن ✓✓</div></div></div></div></div>';

  const can = selN > 0 && campMsg.trim();
  h += '<div class="step" style="text-align:center;">' +
    '<button class="btn ' + (can ? "btn-teal" : "btn-dis") + '" style="font-size:15px;padding:16px 34px;" onclick="openLaunch()">🚀 إطلاق الحملة إلى ' + selN + " مستهدف</button>" +
    '<div style="font-size:11.5px;color:#9aa4b4;margin-top:12px;">قناة الساندبوكس: يستلم فعليًا من انضم للرقم التجريبي فقط — البقية تظهر حالتهم «فشل الإرسال» بشفافية. الإطلاق بالقوالب الرسمية يأتي مع رقم الأعمال الإنتاجي.</div></div>';

  h += '<div id="lmodal" style="display:none;position:fixed;inset:0;background:rgba(15,37,64,.5);z-index:60;align-items:flex-start;justify-content:center;padding:60px 24px;">' +
    '<div style="width:100%;max-width:460px;background:#fff;border-radius:16px;border-top:4px solid #3FB6B0;box-shadow:0 24px 60px rgba(15,37,64,.3);padding:24px;">' +
    '<div style="font-size:17px;font-weight:700;color:#13294b;margin-bottom:8px;">تأكيد إطلاق الحملة</div>' +
    '<div style="font-size:13px;color:#5b6678;line-height:2;margin-bottom:18px;">سيرسل المساعد رسالة الافتتاح إلى <b style="color:#2E7D77;">' + selN + ' مستهدف</b> عبر واتساب (ساندبوكس)، ثم يتابع كل ردّ ببيع كامل. هذه الخطوة هي موافقتك البشرية على الإرسال.</div>' +
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
window.kbUpload = async (input) => {
  const f = input.files && input.files[0];
  if (!f) return;
  const st = document.getElementById("kbstat");
  st.innerHTML = '<span class="chip c-warn">جارٍ التحليل والاستخراج… قد يستغرق دقيقة</span>';
  const fd = new FormData(); fd.append("file", f);
  const scoped = input.dataset.product || "";
  if (scoped) fd.append("product", scoped);
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
  kbDocs.forEach((d) => { if (!reg.some((r) => r.name === d.product)) reg.push({ name: d.product, sc: null, hub: d, seed: false }); });
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
  const reg = kbRegistry();
  const tone = (sc) => sc >= 80 ? "#1f8a52" : sc >= 60 ? "#b5810f" : "#c43d3d";
  let h = '<div class="sec">منتجات المساعد <span class="meta">' + reg.length + ' منتج · اضغط منتجًا لعرض معرفته وإدارتها</span></div>';
  h += '<div class="prods" style="margin-bottom:20px;">' + reg.map((r) => {
    const inner =
      '<div class="pn">' + esc(r.name) + "</div>" +
      (r.sc !== null
        ? '<span class="sc" style="color:' + tone(r.sc) + '">' + r.sc + '%</span> <span class="scl">درجة معرفة المساعد</span><div class="bar"><i style="width:' + r.sc + '%;background:' + tone(r.sc) + ';"></i></div>'
        : '<div style="height:6px;"></div>') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' +
      (r.hub ? '<span class="chip c-ok">ملف معتمد ✓</span>' : '<span class="chip c-grey">لا ملفات بعد</span>') +
      '<span style="flex:1"></span><span style="font-size:12px;font-weight:700;color:#2F5F94;">افتح ←</span></div>';
    return '<a href="#kb/' + encodeURIComponent(r.name) + '" style="text-decoration:none;"><div class="prod" style="cursor:pointer;">' + inner + "</div></a>";
  }).join("") + "</div>";
  h += '<div class="card"><h3>منتج جديد من ملف</h3>' + uploadZone("") + "</div>";
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
  h += '<div class="card"><h3>' + (r.hub ? "تحديث ملف المنتج" : "ارفع أول ملف لهذا المنتج") + "</h3>" + uploadZone(name) + "</div>";
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
    st.innerHTML = '<span class="chip c-ok">أُضيف ' + d.added + "</span> " + (d.skipped ? '<span class="chip c-grey">مكرر ' + d.skipped + "</span> " : "") + (d.invalid ? '<span class="chip c-bad">غير صالح ' + d.invalid + "</span>" : "");
    ta.value = "";
    const er = await fetch("/admin/entities", { headers: { "x-admin-token": TOKEN } });
    if (er.ok) entities = await er.json();
    render(false);
  } catch (e) { st.innerHTML = '<span class="chip c-bad">خطأ</span>'; }
};
window.entDel = async (id) => {
  await fetch("/admin/entities/delete", { method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  entities = entities.filter((e) => e.id !== id); entSel.delete(id); render(false);
};
function vCustomers() {
  let h = '<div class="card"><h3>استيراد مستهدفين</h3>' +
    '<div style="font-size:12px;color:#7b8597;margin-bottom:10px;line-height:1.9;">سطر لكل جهة: <b style="color:#13294b;">الاسم، الرقم، الحجم، المدينة</b> — الحجم والمدينة اختياريان (مثال: مجمع النور الطبي، 9665xxxxxxxx، كبيرة، الرياض)</div>' +
    '<textarea id="entpaste" rows="5" placeholder="مجمع النور الطبي، 966512345678، كبيرة، الرياض&#10;صيدلية الدواء، 966598765432، صغيرة، جدة" style="font-family:inherit;width:100%;font-size:12.5px;border:1.5px solid #e9edf3;border-radius:12px;padding:13px;line-height:2;resize:vertical;"></textarea>' +
    '<div style="display:flex;align-items:center;gap:10px;margin-top:12px;"><button class="btn btn-teal" onclick="entImport()">استيراد ←</button><span id="entstat"></span></div></div>';
  h += '<div class="sec">المستهدفون <span class="meta">' + entities.length + ' جهة</span></div>';
  if (!entities.length) {
    h += '<div class="empty"><div class="ic"><span></span></div><div class="t">لا مستهدفين بعد</div><div class="s">الصق القائمة أعلاه — ثم اخترهم بالشرائح أو فردًا في «إنشاء حملة».</div></div>';
  } else {
    h += '<div class="tblwrap">' + entities.map((e) =>
      '<div style="display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid #f3f5f8;">' +
      '<div class="avatar" style="width:34px;height:34px;border-radius:9px;background:#13294b;color:#3FB6B0;display:flex;align-items:center;justify-content:center;font-weight:700;">' + esc(e.name.trim().charAt(0)) + "</div>" +
      '<span style="flex:1;min-width:0;font-size:13px;font-weight:600;color:#13294b;">' + esc(e.name) + "</span>" +
      (e.size ? '<span class="chip ' + (e.size === "كبيرة" ? "c-blue" : e.size === "متوسطة" ? "c-teal" : "c-grey") + '">' + esc(e.size) + "</span>" : "") +
      (e.city ? '<span style="font-size:11.5px;color:#9aa4b4;">' + esc(e.city) + "</span>" : "") +
      '<span style="font-size:11.5px;color:#9aa4b4;direction:ltr;">+' + esc(e.phone) + "</span>" +
      '<button onclick="entDel(' + e.id + ')" style="font-family:inherit;font-size:15px;font-weight:700;color:#c43d3d;background:#fbe9e9;border:none;border-radius:8px;width:28px;height:28px;cursor:pointer;line-height:1;">×</button></div>'
    ).join("") + "</div>";
  }
  return h;
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
  const cur = (location.hash || "#kmon").slice(1).split("/")[0];
  const b = document.getElementById("body");
  if (cur === "kmon" || cur === "home") {
    if (!TOKEN) return gate();
    if (!cache) return; // first fetch pending
    b.innerHTML = cur === "kmon" ? vKmon(cache) : vHome(cache);
  } else if (cur === "aimkt" || cur === "kb" || cur === "customers") {
    if (!TOKEN) return gate();
    const kbProd = cur === "kb" ? decodeURIComponent((location.hash || "").split("/").slice(1).join("/") || "") : "";
    b.innerHTML = cur === "aimkt" ? vAimkt() : cur === "kb" ? (kbProd ? vKbProduct(kbProd) : vKb()) : vCustomers();
  } else {
    b.innerHTML = vPlaceholder(cur);
  }
}

async function refresh(force) {
  const cur = (location.hash || "#kmon").slice(1).split("/")[0];
  if (TOKEN) {
    try {
      const r = await fetch("/admin/state", { headers: { "x-admin-token": TOKEN } });
      if (r.status === 401) { if (cur === "kmon" || cur === "home") return gate("رمز غير صحيح"); }
      else { cache = await r.json(); document.getElementById("upd").textContent = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
      const [er, kr] = await Promise.all([
        fetch("/admin/entities", { headers: { "x-admin-token": TOKEN } }),
        fetch("/admin/kb", { headers: { "x-admin-token": TOKEN } }),
      ]);
      if (er.ok) entities = await er.json();
      if (kr.ok) kbDocs = await kr.json();
    } catch (e) { /* keep last view */ }
  }
  render(true);
}
window.addEventListener("hashchange", () => render(false));
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
