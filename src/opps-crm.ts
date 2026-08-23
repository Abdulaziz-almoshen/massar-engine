// opps-crm.ts — «فرص البيع», the opportunity board, built to the prototype's own screen.
//
// THE SPEC IS _مسار/مسار.dc.html, screen «opportunities», and its model is taken whole:
// «فرصة = عميل + عدة منتجات». One row in the ledger is ONE PRODUCT LINE; the card is the ACCOUNT,
// and everything on its head — the status word, the breakdown, the total — is computed from the
// lines beneath it at render time. Nothing about a group is stored, so the head can never disagree
// with the rows it sits above.
//
// WHAT THIS ROUTE USED TO BE, and where that went. #opps rendered «لوحة الفرز» — the founder's
// three questions about WhatsApp replies (who is interested, who is not, when do we call them).
// That board is not deleted and not moved to another URL: it is the SECOND tab of this route,
// «فرز الردود», because it is the feeder of this one. The first tab is now the thing he asked for.
//
// THE FOUNDER'S OWN DISTINCTION, which is why an opportunity is stored rather than derived:
// «sometimes the oppurtiunity comes from whatsapp campaign and sometimes we call them or visit
// them and record the client in our massar». A conversation's CRM stage is readable from the
// ledger, so storing it could only let it drift — that is why CRM_STAGE is derived. A deal's stage
// is not readable from anything this system holds: «التقييم الفني والمالي» is a fact about a
// meeting nobody here witnessed. So it is stored, with its author and the day it was last moved,
// and every line carries the SOURCE that produced it. A whatsapp line names its campaign; a visit
// names nothing, which is honest — nobody logged the visit.
//
// PORTED FROM THE PROTOTYPE: the group model, the five-rung stage ladder with its labels, the
// status rollup (قائمة / مكتملة جزئياً / ربح / خسارة), the «متوقّف» reading (≥14 days in تقييم or
// تفاوض), the value arithmetic (سعر × سنوات × كمية × (١−خصم)), the card composition, and the
// multi-line create form.
// NOT PORTED, and named here because an omission nobody wrote down is indistinguishable from a bug:
//   · the «دعم» chip (a help-request/escalation object). Massar has no such record, and a chip
//     that can never light is furniture. Its slot on the card carries the SOURCE instead — the
//     thing the founder actually asked to see. Re-trigger: the first real escalation workflow.
//   · the full opportunity DETAIL screen (stage rail + per-stage result log + probability). Its
//     substance — move the stage, name the next step, own it, price it — is an inline expander on
//     the line itself. A second screen for six fields is a click, not a feature.
//   · daysInStage as a typed field: it is derived from stage_at, which moves only on a real stage
//     change, so «متوقّف منذ ١٨ يومًا» counts days in the stage and not days since anyone touched
//     the row.
//
// Client JS in the dashboard.ts <script> scope (see campaigns-crm.ts for the seam). It borrows
// esc, fmtN, fmtD, ic, clip, contactByPhone, entities, campaigns, cache, tagList, crmSkeleton,
// alertBar, pageSlice, pageBar, PAGE_SIZES, TOKEN and vMorningList — and defines no statistic that
// exists anywhere else.

export const OPPS_CRM_CSS = `
  /* ===== opps board ===== */
  .opgrid { display:grid; grid-template-columns:repeat(auto-fill,minmax(390px,1fr)); gap:14px; }
  @media (max-width: 860px) { .opgrid { grid-template-columns:1fr; } }
  .opcard { background:#fff; border:1px solid #EDEDED; border-radius:14px; overflow:hidden;
    display:flex; flex-direction:column; }
  .opcard:hover { border-color:#C7C7C7; }
  .opcard .oph { padding:15px 18px; }
  .opcard .opt { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
  .opcard .av { width:38px; height:38px; flex:none; border-radius:9px; background:#F3F3F3; color:#525252;
    display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:500; }
  .opcard .nm { font-size:14.5px; font-weight:500; color:#171717; overflow:hidden;
    text-overflow:ellipsis; white-space:nowrap; }
  .opcard .sub { font-size:11.5px; color:#999999; margin-top:3px; overflow:hidden;
    text-overflow:ellipsis; white-space:nowrap; }
  .opcard .opm { display:flex; align-items:center; justify-content:space-between; gap:8px;
    margin-top:13px; flex-wrap:wrap; }
  .opcard .val { font-size:16px; font-weight:600; color:#1F7A73; font-variant-numeric:tabular-nums;
    white-space:nowrap; }
  .opcard .brk { font-size:11px; color:#999999; font-variant-numeric:tabular-nums; }
  .opst { flex:none; font-size:11px; font-weight:500; padding:4px 11px; border-radius:999px; white-space:nowrap; }
  .opsrc { font-size:10.5px; font-weight:500; color:#525252; background:#F3F3F3; border-radius:999px;
    padding:3px 9px; white-space:nowrap; }
  .opwarn { font-size:10.5px; font-weight:500; color:#B54708; background:#FEF6E7; border-radius:999px;
    padding:3px 9px; white-space:nowrap; }
  .opcard .oplines { border-top:1px solid #F3F3F3; background:#FBFBFB; padding:2px 18px 8px; flex:1; }
  .opline { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid #F3F3F3;
    cursor:pointer; }
  .opline:last-child { border-bottom:none; }
  .opline:hover { opacity:.75; }
  .opline .d { width:7px; height:7px; border-radius:999px; flex:none; }
  .opline .pn { flex:1; min-width:0; font-size:12.5px; font-weight:450; color:#171717;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .opline .sg { font-size:11px; color:#7C7C7C; white-space:nowrap; }
  .opauto { font-size:9.5px; font-weight:500; color:#2E7D77; background:#E9F7F6; border-radius:999px;
    padding:2px 7px; margin-inline-start:7px; vertical-align:middle; }
  .opline .lv { font-size:12px; font-weight:500; color:#1F7A73; min-width:84px; text-align:end;
    font-variant-numeric:tabular-nums; }
  /* the inline expander — the detail screen the prototype spends a page on, as six controls */
  .opedit { border-bottom:1px solid #F3F3F3; padding:4px 0 13px; }
  .opedit .lb { font-size:11px; color:#999999; margin:9px 0 6px; }
  .opedit .rail { display:flex; flex-wrap:wrap; gap:6px; }
  .opedit .rung { font-family:inherit; font-size:11.5px; font-weight:500; border-radius:999px;
    padding:6px 11px; cursor:pointer; color:#525252; background:#fff; border:1px solid #EDEDED;
    display:inline-flex; align-items:center; gap:6px; white-space:nowrap; }
  .opedit .rung .d { width:6px; height:6px; border-radius:999px; flex:none; }
  .opedit .rung.on { color:#171717; background:#F3F3F3; border-color:#C7C7C7; }
  .opedit .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(96px,1fr)); gap:8px; }
  .opedit .inp { padding:8px 11px; font-size:12px; border-radius:8px; width:100%; }
  .opedit .acts { display:flex; align-items:center; gap:8px; margin-top:11px; flex-wrap:wrap; }
  .opedit .acts .btn { height:30px; padding:0 11px; font-size:12px; }
  .opedit .dngr:hover { color:#B42318; border-color:#F3C7C2; background:#FEF3F2; }
  .opedit .dngr.arm { color:#B42318; border-color:#B42318; background:#FEF3F2; }

  /* ===== the LIST — seven tracks, seven cells; the arity rule that wrapped three earlier tables ===== */
  .opflat .crow { grid-template-columns: 40px 1.7fr 1.5fr 1.15fr .85fr .7fr 1.5fr; padding-inline:20px 12px; }
  .opflat .crow .o-ac { display:flex; align-items:center; gap:10px; min-width:0; }
  .opflat .crow .o-ac .av { width:26px; height:26px; flex:none; border-radius:7px; background:#F3F3F3;
    color:#525252; display:flex; align-items:center; justify-content:center; font-size:11.5px; font-weight:500; }
  .opflat .crow .o-ac .lb { font-size:13.5px; color:#171717; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .opflat .crow .o-pr { font-size:12.5px; color:#525252; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .opflat .crow .o-st { display:flex; align-items:center; gap:7px; font-size:12.5px; color:#525252; min-width:0; }
  .opflat .crow .o-st .d { width:6px; height:6px; border-radius:999px; flex:none; }
  .opflat .crow .o-st .lb { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .opflat .crow .o-vl { font-size:13px; font-weight:500; color:#1F7A73; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .opflat .crow .o-nx { font-size:12px; color:#7C7C7C; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .opexp { padding:0 20px 4px; background:#FBFBFB; border-bottom:1px solid #EDEDED; }
  @media (max-width: 1100px) {
    .opflat .crow { grid-template-columns: 40px minmax(0,1fr) auto; row-gap:5px; column-gap:10px; padding:12px 16px; }
    .opflat .crow .selcell { grid-row:1 / 5; grid-column:1; align-self:center; }
    .opflat .crow .o-ac { grid-row:1; grid-column:2; }
    .opflat .crow .o-vl { grid-row:1; grid-column:3; text-align:end; }
    .opflat .crow .o-pr { grid-row:2; grid-column:2 / 4; }
    .opflat .crow .o-st { grid-row:3; grid-column:2 / 4; }
    .opflat .crow .o-sr { grid-row:4; grid-column:2; }
    .opflat .crow .o-nx { grid-row:5; grid-column:2 / 4; }
  }

  /* ===== the stage strip — the pipeline in one line, and the stage filter ===== */
  .opstrip { display:flex; gap:8px; overflow-x:auto; margin-bottom:14px; padding-bottom:2px; }
  .opstrip .opsc { font-family:inherit; flex:1; min-width:118px; text-align:start; cursor:pointer;
    background:#fff; border:1px solid #EDEDED; border-radius:12px; padding:10px 13px;
    display:flex; flex-direction:column; gap:3px; }
  .opstrip .opsc:hover { border-color:#C7C7C7; }
  .opstrip .opsc.on { border-color:#3FB6B0; background:#F4FCFB; }
  .opstrip .opsc .t { font-size:11.5px; color:#7C7C7C; display:flex; align-items:center; gap:6px;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .opstrip .opsc .t .d { width:6px; height:6px; border-radius:999px; flex:none; }
  .opstrip .opsc .n { font-size:19px; font-weight:600; color:#171717; font-variant-numeric:tabular-nums; line-height:1.2; }
  .opstrip .opsc .v { font-size:11.5px; color:#1F7A73; font-variant-numeric:tabular-nums;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .opstrip .opsc .u { color:#B54708; margin-inline-start:6px; }
  .opstrip .opsc .u2 { color:#999999; margin-inline-start:6px; }

  /* bulk-bar controls, on the dark bar the campaigns list already established */
  .bulkbar .opbulk { font-family:inherit; font-size:11.5px; height:30px; border-radius:999px;
    padding:0 11px; border:1px solid rgba(255,255,255,.22); background:transparent; color:#fff;
    max-width:150px; }
  .bulkbar .opbulk option { color:#171717; }
  .bulkbar .opbulk::placeholder { color:rgba(255,255,255,.6); }

  /* ===== the un-recorded band: replies that are already opportunities and are not on the board ===== */
  .optriage { background:#fff; border:1px solid #EDEDED; border-radius:13px; margin-bottom:14px; }
  .optriage > summary { list-style:none; cursor:pointer; padding:13px 18px; display:flex;
    align-items:center; gap:10px; font-size:12.5px; color:#525252; }
  .optriage > summary::-webkit-details-marker { display:none; }
  .optriage .trow3 { display:flex; align-items:center; gap:10px; padding:10px 18px;
    border-top:1px solid #F3F3F3; }
  .optriage .trow3 .nm { flex:1; min-width:0; font-size:13px; color:#171717;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .optriage .trow3 .pr { font-size:11.5px; color:#7C7C7C; white-space:nowrap; }
  .optriage .trow3 .btn { height:28px; padding:0 10px; font-size:12px; }

  /* ===== إضافة فرصة ===== */
  .opsheet { position:fixed; inset:0; z-index:140; background:rgba(23,23,23,.32);
    display:flex; align-items:flex-start; justify-content:center; padding:48px 20px; overflow-y:auto; }
  .opsheet .sheet { background:#fff; border:1px solid #EDEDED; border-radius:14px; width:100%;
    max-width:660px; padding:20px; box-shadow:0 18px 48px rgba(16,24,40,.22); }
  .opsheet .sh { display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .opsheet .sh .t { font-size:16px; font-weight:600; color:#171717; }
  .opsheet .hint { font-size:12px; color:#7C7C7C; line-height:1.9; margin-top:6px; }
  .opsheet .fld { margin-top:13px; }
  .opsheet .fld > label { display:block; font-size:11.5px; color:#999999; margin-bottom:6px; }
  .opsheet .inp, .opsheet select.inp { width:100%; height:38px; padding:0 12px; font-size:13px; border-radius:9px; }
  .opsheet .two { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  @media (max-width: 560px) { .opsheet .two { grid-template-columns:1fr; } }
  .opsheet .lrow { border:1px solid #EDEDED; border-radius:11px; padding:11px; margin-top:9px; background:#FBFBFB; }
  .opsheet .lrow .num { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:8px; }
  @media (max-width: 560px) { .opsheet .lrow .num { grid-template-columns:1fr 1fr; } }
  .opsheet .lrow .num label { display:block; font-size:10.5px; color:#999999; margin-bottom:4px; }
  .opsheet .lfoot { display:flex; align-items:center; justify-content:space-between; gap:9px; margin-top:9px; }
  .opsheet .lfoot .v { font-size:12.5px; font-weight:500; color:#1F7A73; font-variant-numeric:tabular-nums; }
  .opsheet .tot { display:flex; align-items:center; justify-content:space-between; gap:10px;
    margin-top:14px; padding-top:13px; border-top:1px solid #EDEDED; }
  .opsheet .tot .v { font-size:18px; font-weight:600; color:#1F7A73; font-variant-numeric:tabular-nums; }
  .opsheet .err { font-size:12.5px; color:#B42318; margin-top:10px; }
  .opsheet .acts { display:flex; gap:9px; margin-top:16px; flex-wrap:wrap; }
`;

export const OPPS_CRM_JS = `
/* ============================ opps-crm (client) ============================ */
/* Own state, own names. oppTab/oppQ belong to «فرز الردود» (vMorningList) and are NOT reused: two
   screens sharing one search box is how a filter typed on one silently narrows the other. */
var oppRows = null, oppLoading = false, oppBusy = false;
/* THE TAB, and inside it THE VIEW. «فرص» is the board; «فرز الردود» is the WhatsApp triage this
   board feeds off. The board itself has the product's three-view control — قائمة · كانبان · بطاقات
   — the same one #kmon carries, because a card grid answers «show me these six deals» and nothing
   else: at two hundred lines it is a scroll, not a screen. The LIST is the default and the thing
   that scales; the KANBAN is where a pipeline is actually worked; the CARDS are the account view
   the prototype drew. */
var opView = "board";        /* board | triage — the tab, not a filter */
var opMode = "list";         /* list | kanban | cards */
var opSort = "value";        /* value | recent | stage | account */
var opSel = {};              /* selected LINE ids for the bulk bar, keyed by id */
var opQ = "", opStat = "all", opSrc = "all", opStg = "all";
var opDragId = null;
var opOpen = 0;              /* id of the expanded line; 0 = none. One at a time, by construction. */
var opArm = 0;               /* id of the line whose delete is armed */
var opSheet = null;          /* the create form's whole draft, or null when closed */
var opErr = "";

var OPP_ST = [
  { key: "contact",   label: "تواصل أولي",            dot: "#999999" },
  { key: "present",   label: "عرض المنتج",            dot: "#2F5F94" },
  { key: "tech",      label: "التقييم الفني والمالي", dot: "#7A5CC4" },
  { key: "negotiate", label: "التفاوض والاعتماد",     dot: "#1F7A73" },
  { key: "won",       label: "إغلاق الصفقة",          dot: "#027A48" },
  { key: "lost",      label: "خسارة",                 dot: "#B42318" }
];
/* The founder's own list of where a deal comes from. «حملة واتساب» is the only one this system can
   witness by itself; the rest are a human telling it what happened offline, which is exactly why
   they are recorded rather than guessed. */
var OPP_SRC = {
  whatsapp: "حملة واتساب", call: "مكالمة", visit: "زيارة",
  referral: "إحالة", inbound: "طلب وارد", other: "غير محدد"
};
var OPP_STALL = { tech: 1, negotiate: 1 };   /* the two rungs that actually stall */
var OPP_STALL_DAYS = 14;

/* ARABIC COUNTS ARE NOT «n + noun». The board first shipped «١ منتجات» and «٥ جهة» — both wrong
   in the product's own language, on the two lines a reader's eye lands on first. The rule is
   four-way: مفرد · مثنى · جمع القلة (٣–١٠) · تمييز مفرد منصوب (١١+), and zero takes the plural.
   Scoped to this file deliberately: retrofitting every count in the dashboard is its own change,
   and the counts here are the ones this screen emits. */
function opPl(n, one, two, few, many) {
  n = Number(n || 0);
  if (n === 1) return one;
  if (n === 2) return two;
  return fmtN(n) + " " + (n >= 3 && n <= 10 ? few : many);
}
function opNProd(n) { return opPl(n, "منتج واحد", "منتجان", "منتجات", "منتجًا"); }
function opNOpp(n) { return opPl(n, "فرصة واحدة", "فرصتان", "فرص", "فرصة"); }
function opNEnt(n) { return opPl(n, "جهة واحدة", "جهتان", "جهات", "جهة"); }
function opNDay(n) { return opPl(n, "يوم", "يومين", "أيام", "يومًا"); }

function opStage(k) {
  for (var i = 0; i < OPP_ST.length; i++) if (OPP_ST[i].key === k) return OPP_ST[i];
  return OPP_ST[0];
}
function opIsWon(o) { return o.stage === "won"; }
function opIsLost(o) { return o.stage === "lost"; }
function opIsOpen(o) { return !opIsWon(o) && !opIsLost(o); }
function opDays(o) { return Math.floor((Date.now() - Number(o.stage_at || o.created_at || Date.now())) / 864e5); }
function opStalled(o) { return opIsOpen(o) && Boolean(OPP_STALL[o.stage]) && opDays(o) >= OPP_STALL_DAYS; }
/* سعر البيع × السنوات × الكمية × (١ − الخصم). The prototype's arithmetic, unchanged — and the ONE
   definition of what a line is worth: the card total, the board total and the form preview all
   call this, so no two numbers on the screen can be computed differently. */
function opValue(o) {
  return Math.round(Number(o.sale_price || 0) * Number(o.years || 1) * Number(o.qty || 1) *
    (1 - Number(o.discount || 0) / 100));
}
/* AN AUTO-CREATED LINE HAS NO PRICE, and «٠ ر.س» is not the same statement as «we have not priced
   this yet» — the first reads as a worthless deal on a board whose whole left column is money. The
   conversation contains no number and inventing one would be a forecast dressed as a reading, so
   the absence is rendered as an absence. It also keeps the totals honest: an unpriced line adds
   nothing to a sum, and now says why. */
function opPriced(l) { return Number(l.sale_price || 0) > 0; }
var OPP_UNPRICED = "لم تُسعَّر";
/* «٥٫٣ م ر.س» / «٤٥٠ ألف ر.س» — the prototype's short money, in Arabic-Indic digits. */
function opMoney(v) {
  v = Number(v || 0);
  if (v >= 1e6) return fmtN(Math.round(v / 1e5) / 10) + " م ر.س";
  if (v >= 1000) return fmtN(Math.round(v / 1000)) + " ألف ر.س";
  return fmtN(v) + " ر.س";
}
/* The group key. A phone is the account's identity everywhere else in this product (entities and
   contacts are both phone-keyed), so a line that has one groups by it and a line recorded after a
   visit with no number groups by its name. Never by both, or one client would open two cards. */
function opKey(o) { return o.phone ? "p:" + o.phone : "n:" + String(o.account_name || "").trim(); }

function opLoad(force) {
  if (oppLoading || (oppRows && !force)) return;
  oppLoading = true;
  fetch("/admin/opps", { headers: { "x-admin-token": TOKEN } })
    .then(function (r) { return r.json(); })
    .then(function (j) { oppRows = j.opps || []; oppLoading = false; render(false); })
    .catch(function () { oppRows = []; oppLoading = false; render(false); });
}

/* ---- grouping ---- */
function opGroups() {
  var by = {}, order = [];
  (oppRows || []).forEach(function (o) {
    var k = opKey(o);
    if (!by[k]) { by[k] = { key: k, name: o.account_name, phone: o.phone || "", lines: [] }; order.push(k); }
    /* The newest line's name wins for the card head: renaming an account on a later line is the
       only way to correct a typo, and a card that keeps showing the first spelling is unfixable.
       listOpps returns newest-first, so the FIRST row seen for a key is the newest. */
    by[k].lines.push(o);
  });
  /* Live lines lead. The ledger's own order is newest-first, which put a LOST line at the top of a
     card whose head said «قائمة» — the first thing read under a live deal was the one part of it
     that is over. Within a class, the biggest number first. */
  var cls = { open: 0, won: 1, lost: 2 };
  var classOf = function (l) { return opIsOpen(l) ? "open" : opIsWon(l) ? "won" : "lost"; };
  return order.map(function (k) {
    by[k].lines.sort(function (a, b) {
      return (cls[classOf(a)] - cls[classOf(b)]) || (opValue(b) - opValue(a));
    });
    return by[k];
  });
}
/* ONE MONEY RULE, and it is the prototype's: A LOST LINE IS WORTH NOTHING, so it never counts
   toward any total that MIXES stages. It shipped broken for one build — the card head excluded
   lost while the stage strip and the list footer added it back, so two numbers on one screen
   disagreed by the exact value of every deal we had already failed to win. Single-stage figures
   (the خسارة column, the خسارة strip cell) still state their own sum: that is a fact about one
   stage, not a total across them. Every mixed total says «دون الخسارة» when the set it is drawn
   from contains one — a silent exclusion is the same defect wearing better manners. */
function opSumLive(ls) {
  return ls.filter(function (l) { return !opIsLost(l); })
    .reduce(function (a, l) { return a + opValue(l); }, 0);
}
function opHasLost(ls) { return ls.some(opIsLost); }

function opGroupValue(g) { return opSumLive(g.lines); }
/* قائمة while anything is still live; ربح/خسارة only once every line has landed; مكتملة جزئياً for
   the mixed close. The prototype's exact rollup — the head must never claim a deal is won while a
   line under it is still open. */
function opGroupStatus(g) {
  var open = 0, won = 0, lost = 0;
  g.lines.forEach(function (l) { if (opIsOpen(l)) open++; else if (opIsWon(l)) won++; else lost++; });
  if (open > 0) return { key: "open", label: "قائمة", bg: "#EEF4FB", color: "#2F5F94" };
  if (won > 0 && lost > 0) return { key: "partial", label: "مكتملة جزئياً", bg: "#FEF6E7", color: "#B54708" };
  if (won > 0) return { key: "won", label: "ربح", bg: "#E7F6EE", color: "#027A48" };
  return { key: "lost", label: "خسارة", bg: "#FEF3F2", color: "#B42318" };
}
function opGroupSources(g) {
  var seen = [];
  g.lines.forEach(function (l) { var s = OPP_SRC[l.source] || OPP_SRC.other; if (seen.indexOf(s) === -1) seen.push(s); });
  return seen;
}
function opGroupOwners(g) {
  var seen = [];
  g.lines.forEach(function (l) { if (l.owner && seen.indexOf(l.owner) === -1) seen.push(l.owner); });
  return seen;
}
/* ONE filter, applied to LINES, and every view reads it — the list, the kanban, the cards and the
   totals. Two definitions of «what is on screen» is how a header ends up disagreeing with the rows
   beneath it, which is the defect this file's own card head was designed to make impossible. */
function opLines() {
  var q = opQ.trim();
  return (oppRows || []).filter(function (l) {
    if (opSrc !== "all" && l.source !== opSrc) return false;
    if (opStg !== "all") {
      if (opStg === "open" ? !opIsOpen(l) : opStg === "live" ? !(opIsOpen(l) || opIsWon(l)) : l.stage !== opStg) return false;
    }
    if (!q) return true;
    return String(l.account_name).includes(q) || String(l.product).includes(q) ||
      String(l.phone || "").includes(q) || String(l.owner || "").includes(q);
  });
}
/* Sorted lines for the list. «القيمة» leads by default because the question a pipeline answers
   first is «what is the biggest thing at risk», and an unpriced line sorts last rather than as
   zero-among-equals — it is not a small deal, it is an unanswered one. */
function opSorted() {
  var rows = opLines().slice();
  var pos = {}; OPP_ST.forEach(function (st, i) { pos[st.key] = i; });
  return rows.sort(function (a, b) {
    if (opSort === "recent") return (b.updated_at || 0) - (a.updated_at || 0);
    if (opSort === "stage") return (pos[a.stage] - pos[b.stage]) || (opValue(b) - opValue(a));
    if (opSort === "account") return String(a.account_name).localeCompare(String(b.account_name), "ar");
    return (opPriced(b) - opPriced(a)) || (opValue(b) - opValue(a));
  });
}
/* Selection INTERSECTED with what is visible on read — the rule the reviewer forced on the
   campaigns list after a selection survived navigation and staged one campaign's phones under
   another campaign's name. A filter that hides a row also drops it from the bulk write. */
function opSelIds() {
  var live = {};
  opLines().forEach(function (l) { live[l.id] = true; });
  return Object.keys(opSel).map(Number).filter(function (id) { return live[id]; });
}

/* The CARDS view groups the SAME filtered lines — it does not re-filter. A card that showed lines
   the list had excluded would be a second answer to «what is on screen». */
function opMatches() {
  var keep = {};
  opLines().forEach(function (l) { keep[l.id] = true; });
  return opGroups().map(function (g) {
    return { key: g.key, name: g.name, phone: g.phone, lines: g.lines.filter(function (l) { return keep[l.id]; }) };
  }).filter(function (g) {
    if (!g.lines.length) return false;
    return opStat === "all" || opGroupStatus(g).key === opStat;
  }).sort(function (a, b) {
    var ord = { open: 0, partial: 1, won: 2, lost: 3 };
    return (ord[opGroupStatus(a).key] - ord[opGroupStatus(b).key]) || (opGroupValue(b) - opGroupValue(a));
  });
}

/* ---- the stage strip: the pipeline in one line ----
   Six cells, count and money per stage, over EVERY match rather than the visible page — a total
   that changes when you turn a page is not a total. It doubles as the stage filter, so the fastest
   way to ask «what is sitting in التفاوض» is to click the number that says how much is. */
function opStageStrip() {
  var rows = (oppRows || []).filter(function (l) {
    var q = opQ.trim();
    if (opSrc !== "all" && l.source !== opSrc) return false;
    if (!q) return true;
    return String(l.account_name).includes(q) || String(l.product).includes(q) ||
      String(l.phone || "").includes(q) || String(l.owner || "").includes(q);
  });
  var cell = function (key, label, dot, ls, mixed) {
    /* mixed = this cell spans more than one stage, so the money rule applies */
    var val = mixed ? opSumLive(ls) : ls.reduce(function (a, l) { return a + opValue(l); }, 0);
    var unpriced = ls.filter(function (l) { return !opPriced(l); }).length;
    return '<button class="opsc' + (opStg === key ? " on" : "") + '" onclick="opSetStg(&quot;' + key + '&quot;)">' +
      '<span class="t">' + (dot ? '<span class="d" style="background:' + dot + ';"></span>' : "") + label + "</span>" +
      '<span class="n">' + fmtN(ls.length) + "</span>" +
      '<span class="v">' + (val ? opMoney(val) : "—") +
      (mixed && opHasLost(ls) ? '<span class="u2">دون الخسارة</span>' : "") +
      (unpriced ? '<span class="u" title="بند بلا سعر — لا يدخل في أي مجموع">' + fmtN(unpriced) + " بلا تسعير</span>" : "") +
      "</span></button>";
  };
  var h = '<div class="opstrip rise">' + cell("all", "الكل", "", rows, true);
  OPP_ST.forEach(function (st) {
    h += cell(st.key, st.label, st.dot, rows.filter(function (l) { return l.stage === st.key; }), false);
  });
  return h + "</div>";
}

/* ---- the un-recorded band ----
   Contacts the assistant already read as interested that have NO line on the board. This is the
   founder's «sometimes the opportunity comes from whatsapp campaign» made actionable: the reply is
   already in the ledger, and the only missing act is a human saying what it is worth. It lists what
   is MISSING, never what exists, so it empties itself as the board fills. */
function opUnrecorded() {
  var have = {};
  (oppRows || []).forEach(function (o) { if (o.phone) have[o.phone] = 1; });
  return ((cache && cache.contacts) || []).filter(function (c) {
    if (c.test && !showTest) return false;
    if (c.optedOut || c.outcome === "stopped" || c.outcome === "not_interested") return false;
    if (have[c.phone]) return false;
    var warm = (c.tags || []).some(function (t) { return t.level === "hot" || t.level === "warm"; });
    return warm || c.outcome === "interested" || c.outcome === "scheduled" || c.outcome === "handoff";
  }).sort(function (a, b) { return (b.lastEventAt || 0) - (a.lastEventAt || 0); });
}
/* Which service the assistant heard them ask about — the prefill for the form, and blank when the
   reading names none. A guessed product on a money form is worse than an empty select. */
function opReadProduct(c) {
  var t = (c.tags || []).filter(function (x) { return x.product; })
    .sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); })[0];
  return t ? t.product : "";
}
/* The campaign this contact was actually targeted by, so a whatsapp line lands with the campaign it
   came from rather than an id someone had to remember. Newest wins when several targeted them. */
function opLastCampaign(phone) {
  var hit = null;
  (campaigns || []).forEach(function (cp) {
    if ((cp.targets || []).some(function (t) { return t.phone === phone; })) {
      if (!hit || Number(cp.id) > Number(hit.id)) hit = cp;
    }
  });
  return hit;
}

/* ---- the card ---- */
function opCard(g) {
  var stt = opGroupStatus(g);
  var open = 0, won = 0, lost = 0;
  g.lines.forEach(function (l) { if (opIsOpen(l)) open++; else if (opIsWon(l)) won++; else lost++; });
  var owners = opGroupOwners(g);
  var stalled = g.lines.filter(function (l) { return opStalled(l); }).length;
  var h = '<div class="opcard">';
  h += '<div class="oph">';
  h += '<div class="opt"><div style="display:flex;align-items:center;gap:11px;min-width:0;">' +
    '<span class="av">' + esc(String(g.name).trim().charAt(0)) + "</span>" +
    '<div style="min-width:0;"><div class="nm">' + esc(g.name) + "</div>" +
    '<div class="sub">' + opNProd(g.lines.length) +
      (owners.length ? " · " + esc(clip(owners.slice(0, 2).join("، "), 34)) : "") + "</div></div></div>" +
    '<span class="opst" style="background:' + stt.bg + ';color:' + stt.color + ';">' + stt.label + "</span></div>";
  h += '<div class="opm"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;">' +
    (stalled ? '<span class="opwarn" title="بند تجاوز مدته في مرحلته">متوقّف</span>' : "") +
    opGroupSources(g).slice(0, 2).map(function (s) {
      return '<span class="opsrc" title="مصدر الفرصة">' + esc(s) + "</span>";
    }).join("") +
    '<span class="brk">قائمة ' + fmtN(open) + " · ربح " + fmtN(won) + " · خسارة " + fmtN(lost) + "</span></div>" +
    (g.lines.some(opPriced)
      ? '<span class="val">' + opMoney(opGroupValue(g)) + "</span>"
      : '<span class="val" style="color:#999999;font-size:13px;font-weight:450;">' + OPP_UNPRICED + "</span>") + "</div>";
  h += "</div>";
  h += '<div class="oplines">' + g.lines.map(function (l) {
    var st = opStage(l.stage);
    var row = '<div class="opline" onclick="opToggleLine(' + l.id + ')">' +
      '<span class="d" style="background:' + st.dot + ';"></span>' +
      '<span class="pn">' + esc(l.product) +
      (l.created_by === "المساعد" ? '<span class="opauto" title="فتحها المساعد تلقائيًا عند قراءة نية مرتفعة">تلقائي</span>' : "") +
      "</span>" +
      (opStalled(l) ? '<span class="opwarn">' + opNDay(opDays(l)) + "</span>" : "") +
      '<span class="sg">' + st.label + "</span>" +
      '<span class="lv"' + (opPriced(l) ? "" : ' style="color:#999999;font-weight:450;"') + ">" +
      (opPriced(l) ? opMoney(opValue(l)) : OPP_UNPRICED) + "</span></div>";
    return row + (opOpen === l.id ? opLineEditor(l) : "");
  }).join("") + "</div>";
  return h + "</div>";
}

/* The prototype's detail screen, as the six controls that actually change something. Every field
   writes through PATCH /admin/opps/:id, so what the card shows next paint is what the ledger
   stored — never a local optimism that a failed request would leave standing. */
function opLineEditor(l) {
  var h = '<div class="opedit" onclick="event.stopPropagation()">';
  h += '<div class="lb">المرحلة</div><div class="rail">' + OPP_ST.map(function (s) {
    return '<button class="rung' + (s.key === l.stage ? " on" : "") + '" onclick="opSetStage(' + l.id + ',&quot;' + s.key + '&quot;)">' +
      '<span class="d" style="background:' + s.dot + ';"></span>' + s.label + "</button>";
  }).join("") + "</div>";
  h += '<div class="lb">الخطوة التالية · المسؤول</div>' +
    '<div class="grid" style="grid-template-columns:2fr 1fr;">' +
    '<input class="inp" id="opns_' + l.id + '" value="' + esc(l.next_step || "") + '" placeholder="ما الذي يجب فعله بعد؟" ' +
      'onchange="opSaveField(' + l.id + ',&quot;next_step&quot;,this.value)">' +
    '<input class="inp" id="opow_' + l.id + '" value="' + esc(l.owner || "") + '" placeholder="المسؤول" ' +
      'onchange="opSaveField(' + l.id + ',&quot;owner&quot;,this.value)"></div>';
  h += '<div class="lb">السعر السنوي · السنوات · الكمية · الخصم ٪</div><div class="grid">' +
    '<input class="inp" type="number" min="0" value="' + esc(l.sale_price) + '" onchange="opSaveField(' + l.id + ',&quot;sale_price&quot;,this.value)">' +
    '<input class="inp" type="number" min="1" max="20" value="' + esc(l.years) + '" onchange="opSaveField(' + l.id + ',&quot;years&quot;,this.value)">' +
    '<input class="inp" type="number" min="1" value="' + esc(l.qty) + '" onchange="opSaveField(' + l.id + ',&quot;qty&quot;,this.value)">' +
    '<input class="inp" type="number" min="0" max="100" value="' + esc(l.discount) + '" onchange="opSaveField(' + l.id + ',&quot;discount&quot;,this.value)"></div>';
  h += '<div class="acts"><span style="font-size:11.5px;color:#999999;">' +
    "مصدرها " + esc(OPP_SRC[l.source] || OPP_SRC.other) +
    (l.source === "whatsapp" && l.source_ref ? " · " + esc(opCampName(l.source_ref)) : "") +
    (l.created_by ? " · سجّلها " + esc(l.created_by) : "") +
    " · في هذه المرحلة " + (opDays(l) === 0 ? "منذ اليوم" : "منذ " + opNDay(opDays(l))) + "</span>" + '<span style="flex:1"></span>' +
    (l.phone ? '<a class="btn btn-ghost" href="#customer/' + esc(l.phone) + '" style="text-decoration:none;line-height:30px;">ملف العميل ←</a>' : "") +
    (opArm === l.id
      ? '<button class="btn btn-ghost dngr arm" onclick="opDel(' + l.id + ')">تأكيد الحذف</button>' +
        '<button class="btn btn-ghost" onclick="opArmDel(0)">تراجع</button>'
      : '<button class="btn btn-ghost dngr" onclick="opArmDel(' + l.id + ')">حذف البند</button>') +
    "</div>";
  return h + "</div>";
}
function opCampName(id) {
  var cp = (campaigns || []).find(function (x) { return String(x.id) === String(id); });
  return cp ? cp.name : "حملة محذوفة";
}

/* ---- the LIST: the view that scales ----
   The product's own flat-table idiom (.tblwrap/.crow/.krow/.thead-wide), so this reads as the same
   application as #kmon, #customers and #targets rather than a screen with private furniture. Seven
   real columns, every one of them a stored field; a row expands in place rather than navigating,
   because the work here is «move this along», not «go read about it». */
function opListView() {
  var rows = opSorted();
  var sel = opSelIds();
  var page = pageSlice("opps", rows);
  var allOn = page.length > 0 && page.every(function (l) { return opSel[l.id]; });
  var h = '<div class="tblwrap opflat rise">';
  h += '<div class="crow thead-wide" style="padding:8px 20px 8px 12px;background:#fff;border-bottom:1px solid #EDEDED;font-size:12px;font-weight:500;color:#7C7C7C;">' +
    '<div class="selcell" style="opacity:1;"><input type="checkbox" aria-label="تحديد المعروض"' +
    (allOn ? " checked" : "") + ' onclick="opTogglePage()"></div>' +
    "<div>الجهة</div><div>الخدمة</div><div>المرحلة</div><div>القيمة</div><div>المصدر</div>" +
    "<div>المسؤول والخطوة التالية</div></div>" +
    '<div class="thead-narrow"><span class="selcell" style="opacity:1;"><input type="checkbox" aria-label="تحديد المعروض"' +
    (allOn ? " checked" : "") + ' onclick="opTogglePage()"></span><span>الفرصة</span><span style="flex:1"></span><span>المرحلة</span></div>';
  if (!page.length) {
    h += '<div style="padding:26px 20px;text-align:center;font-size:12.5px;color:#999999;">' +
      (oppRows.length ? "لا بند يطابق ما اخترته." : "لا فرص مسجّلة بعد.") + "</div>";
  }
  page.forEach(function (l) {
    var st = opStage(l.stage);
    h += '<div class="trow km krow crow' + (opSel[l.id] ? " sel" : "") + '" onclick="opToggleLine(' + l.id + ')">' +
      '<div class="selcell" onclick="event.stopPropagation()"><input type="checkbox"' +
        (opSel[l.id] ? " checked" : "") + ' aria-label="تحديد ' + esc(l.product) + '" onclick="opToggleSel(' + l.id + ')"></div>' +
      '<div class="o-ac"><span class="av">' + esc(String(l.account_name).trim().charAt(0)) + "</span>" +
        '<span class="lb">' + esc(l.account_name) + "</span></div>" +
      '<div class="o-pr">' + esc(l.product) +
        (l.created_by === "المساعد" ? '<span class="opauto">تلقائي</span>' : "") + "</div>" +
      '<div class="o-st"><span class="d" style="background:' + st.dot + ';"></span><span class="lb">' + st.label + "</span>" +
        (opStalled(l) ? '<span class="opwarn">' + opNDay(opDays(l)) + "</span>" : "") + "</div>" +
      '<div class="o-vl"' + (opPriced(l) ? "" : ' style="color:#C7C7C7;font-weight:450;"') + ">" +
        (opPriced(l) ? opMoney(opValue(l)) : OPP_UNPRICED) + "</div>" +
      '<div class="o-sr"><span class="opsrc">' + esc(OPP_SRC[l.source] || OPP_SRC.other) + "</span></div>" +
      '<div class="o-nx">' + (l.owner ? '<b style="font-weight:500;color:#525252;">' + esc(clip(l.owner, 18)) + "</b> · " : "") +
        (l.next_step ? esc(clip(l.next_step, 46)) : '<span style="color:#C7C7C7;">لم تُحدَّد خطوة</span>') + "</div>" +
      "</div>";
    if (opOpen === l.id) h += '<div class="opexp">' + opLineEditor(l) + "</div>";
  });
  /* «٠ ر.س» is the one thing this footer must never say when nothing under it is priced — it is the
     same false claim the line cells were fixed to stop making, one row lower. */
  var live = opSumLive(rows);
  h += '<div class="tfoot">' + pageBar("opps", rows.length, "بند") +
    "<span>" + (live ? opMoney(live) + " قيمة المعروض" + (opHasLost(rows) ? " · دون الخسارة" : "")
                     : "لا قيمة مسعَّرة بعد") + "</span></div></div>";
  if (sel.length) h += opBulkBar(sel);
  return h;
}

/* ---- the KANBAN: where a pipeline is worked ----
   The prototype's own «لوحة متابعة الفرص — أدر فرص البيع واسحبها بين المراحل», on the board chrome
   #kmon already uses. Each column states its count AND its money, because a stage with four deals
   worth 40k and a stage with four worth 4m are not the same stage. Dragging writes the stage
   through the same PATCH the rungs use — there is no second write path. */
function opKanbanView() {
  var rows = opLines();
  var h = '<div class="kboard ms-scroll rise">';
  OPP_ST.forEach(function (st) {
    var cards = rows.filter(function (l) { return l.stage === st.key; })
      .sort(function (a, b) { return (opPriced(b) - opPriced(a)) || (opValue(b) - opValue(a)); });
    var val = cards.reduce(function (a, l) { return a + opValue(l); }, 0);
    h += '<div class="kcol" data-col="' + esc(st.key) + '" ondragover="opDragOver(event,this)" ' +
      'ondragleave="opDragLeave(this)" ondrop="opDrop(event,&quot;' + st.key + '&quot;,this)">' +
      '<div class="kcolh"><span style="width:8px;height:8px;border-radius:999px;flex:none;background:' + st.dot + ';"></span>' +
      '<div class="lb">' + st.label + "</div><span style=\'flex:1\'></span>" +
      '<span class="cntpill">' + fmtN(cards.length) + "</span></div>" +
      '<div style="font-size:11.5px;color:#7C7C7C;padding:0 4px 9px;font-variant-numeric:tabular-nums;">' +
      (val ? opMoney(val) : "بلا تسعير") + "</div>";
    var shown = cards.slice(0, LIST_CAP);
    shown.forEach(function (l) {
      h += '<div class="kcard" draggable="true" ondragstart="opDragStart(event,' + l.id + ')" ondragend="opDragEnd()" ' +
        'onclick="opToggleLine(' + l.id + ')">' +
        '<div class="ktitle"><span class="nm">' + esc(l.account_name) + "</span></div>" +
        '<div class="kline">' + esc(l.product) +
          (l.created_by === "المساعد" ? '<span class="opauto">تلقائي</span>' : "") + "</div>" +
        '<div class="kfoot"><span class="kl">' + esc(OPP_SRC[l.source] || OPP_SRC.other) + "</span>" +
        '<span class="ksep">·</span><span class="kv">' + (opPriced(l) ? opMoney(opValue(l)) : OPP_UNPRICED) + "</span>" +
        (opStalled(l) ? '<span class="ksep">·</span><span class="kl" style="color:#B54708;">متوقّف ' + opNDay(opDays(l)) + "</span>" : "") +
        "</div></div>";
    });
    if (!shown.length) h += '<div class="kdrop">اسحب بندًا هنا لنقله إلى «' + st.label + "»</div>";
    /* A board that silently shows the first 200 of 900 is a board that lies about the stage. */
    if (cards.length > shown.length) {
      h += '<div style="font-size:10.5px;color:#B54708;font-weight:500;padding:4px;">تُعرض ' +
        fmtN(shown.length) + " من " + fmtN(cards.length) + " — استخدم «قائمة» لرؤيتها كلها</div>";
    }
    h += "</div>";
  });
  return h + "</div>" + (opOpen ? opOpenCardSheet() : "");
}
/* The kanban has no room for an expander inside a 290px column, so a clicked card opens the SAME
   editor in a sheet — one editor, two placements, never two implementations. */
function opOpenCardSheet() {
  var l = (oppRows || []).find(function (x) { return x.id === opOpen; });
  if (!l) return "";
  return '<div class="opsheet" onclick="opToggleLine(0)"><div class="sheet" style="max-width:560px;" onclick="event.stopPropagation()">' +
    '<div class="sh"><span class="t">' + esc(l.account_name) + " · " + esc(l.product) + "</span>" +
    '<button class="btn btn-ghost" onclick="opToggleLine(0)">إغلاق</button></div>' +
    opLineEditor(l) + "</div></div>";
}

/* ---- the bulk bar ----
   The scale affordance the list exists for: at two hundred lines the work is «move these eleven to
   التفاوض», not eleven visits to eleven rows. Same floating-bar idiom as the campaigns list, and
   the same intersect-on-read rule — a hidden row is never in the write. */
function opBulkBar(sel) {
  return '<div class="bulkbar"><div>' +
    '<span class="cnt">' + opPl(sel.length, "بند واحد", "بندان", "بنود", "بندًا") + " محدّد</span>" +
    '<select class="opbulk" onchange="opBulkStage(this)" ' + (oppBusy ? "disabled" : "") + ">" +
    '<option value="">انقل إلى مرحلة…</option>' +
    OPP_ST.map(function (st) { return '<option value="' + st.key + '">' + st.label + "</option>"; }).join("") +
    "</select>" +
    '<input class="opbulk" id="opbulkowner" placeholder="أسنِد إلى…" onchange="opBulkOwner(this)">' +
    '<button class="x" title="إلغاء التحديد" onclick="opClearSel()">×</button></div></div>';
}

/* ---- the view ---- */
function vOppsCrm() {
  opLoad(false);
  var h = '<div class="crmbar rise">';
  h += '<span class="vtog">' +
    '<button class="' + (opView === "board" ? "on" : "") + '" onclick="opSetView(&quot;board&quot;)">الفرص</button>' +
    '<button class="' + (opView === "triage" ? "on" : "") + '" onclick="opSetView(&quot;triage&quot;)">فرز الردود</button></span>';
  if (opView !== "board") {
    h += '<span style="flex:1"></span><span style="font-size:12px;color:#7C7C7C;">' +
      "من ردّ، ومن لم يردّ، ومتى موعد المهتمين</span></div>";
    return h + vMorningList();
  }
  h += '<span class="hair"></span>';
  h += '<span class="vtog">' + [["list", "قائمة"], ["kanban", "كانبان"], ["cards", "بطاقات"]].map(function (v) {
    return '<button class="' + (opMode === v[0] ? "on" : "") + '" onclick="opSetMode(&quot;' + v[0] + '&quot;)">' + v[1] + "</button>";
  }).join("") + "</span>";
  h += '<span style="position:relative;display:inline-flex;align-items:center;flex:1;min-width:170px;max-width:260px;">' +
    '<span style="position:absolute;inset-inline-start:13px;color:#999999;display:flex;">' + ic("search", 17) + "</span>" +
    '<input id="opq" class="inp" value="' + esc(opQ) + '" oninput="opSearch(this)" placeholder="جهة، خدمة، مسؤول…" ' +
    'style="width:100%;padding-inline-start:40px;height:38px;border-radius:999px;font-size:12px;"></span>';
  h += '<select class="crmsel' + (opSrc !== "all" ? " on" : "") + '" onchange="opSetSrc(this.value)"' +
    (opSrc !== "all" ? ' style="border-color:#3FB6B0;color:#2E7D77;background:#DCF1EF;"' : "") + ">" +
    '<option value="all">كل المصادر</option>' +
    Object.keys(OPP_SRC).map(function (k) {
      return '<option value="' + k + '"' + (opSrc === k ? " selected" : "") + ">" + OPP_SRC[k] + "</option>";
    }).join("") + "</select>";
  /* Sorting belongs to the list; a kanban is sorted by its own columns and a card grid by account
     status, so offering a sort control there would be a control that does nothing. */
  if (opMode === "list") {
    h += '<select class="crmsel" onchange="opSetSort(this.value)">' +
      [["value", "الأعلى قيمة"], ["recent", "الأحدث حركة"], ["stage", "حسب المرحلة"], ["account", "حسب الجهة"]]
        .map(function (o) { return '<option value="' + o[0] + '"' + (opSort === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") +
      "</select>";
  }
  if (opMode === "cards") {
    h += '<select class="crmsel' + (opStat !== "all" ? " on" : "") + '" onchange="opSetStat(this.value)"' +
      (opStat !== "all" ? ' style="border-color:#3FB6B0;color:#2E7D77;background:#DCF1EF;"' : "") + ">" +
      [["all", "كل الحالات"], ["open", "قائمة"], ["partial", "مكتملة جزئياً"], ["won", "ربح"], ["lost", "خسارة"]]
        .map(function (o) { return '<option value="' + o[0] + '"' + (opStat === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") +
      "</select>";
  }
  h += '<span style="flex:1"></span>';
  h += '<button class="btn btn-dark" onclick="opOpenSheet()">+ إضافة فرصة</button>';
  h += "</div>";
  if (opSheet) h += opSheetHtml();
  if (oppRows === null) return h + crmSkeleton(5);

  h += opStageStrip();

  var un = opUnrecorded();
  if (un.length) {
    var shown = un.slice(0, 8);
    h += '<details class="optriage rise"' + (oppRows.length ? "" : " open") + ">" +
      "<summary>" + ic("reply", 16) + '<b style="font-weight:500;color:#171717;">' + opNEnt(un.length) +
      " أبدت اهتمامًا في واتساب ولا فرصة مسجّلة لها</b>" +
      '<span style="color:#999999;font-size:11.5px;">النية المرتفعة تُفتح فرصةً تلقائيًا — هذه أقل من ذلك</span>' +
      '<span style="flex:1"></span><span style="color:#999999;font-size:12px;">اضغط للعرض</span></summary>' +
      shown.map(function (c) {
        var pr = opReadProduct(c);
        return '<div class="trow3"><span class="nm">' + esc(c.waName || c.phone) + "</span>" +
          '<span class="pr">' + (pr ? esc(clip(pr, 26)) : "لم تُقرأ خدمة") + "</span>" +
          '<button class="btn btn-ghost" onclick="opFromContact(&quot;' + esc(c.phone) + '&quot;)">سجّل فرصة</button></div>';
      }).join("") +
      (un.length > shown.length
        ? '<div class="trow3"><span class="nm" style="color:#999999;">' +
          "وبقيّتها في «فرز الردود» — " + opNEnt(un.length - shown.length) + " أخرى</span></div>"
        : "") +
      "</details>";
  }

  if (!oppRows.length) {
    return h + '<div class="tblwrap rise" style="padding:34px 22px;text-align:center;">' +
      '<div style="font-size:14px;color:#171717;margin-bottom:7px;">لا فرص مسجّلة بعد.</div>' +
      '<div style="font-size:12.5px;color:#7C7C7C;line-height:1.9;">' +
      "الفرصة تُسجَّل هنا سواء جاءت من ردّ على حملة واتساب أو من مكالمة أو زيارة. " +
      "النية المرتفعة التي يقرأها المساعد تفتح فرصةً تلقائيًا؛ وما دون ذلك يُسجَّل بضغطة" +
      (un.length ? " من القائمة أعلاه" : "") + "، أو بـ«إضافة فرصة».</div></div>";
  }
  if (opMode === "kanban") return h + opKanbanView();
  if (opMode === "cards") {
    var groups = opMatches();
    if (!groups.length) {
      return h + '<div class="tblwrap rise" style="padding:30px 22px;text-align:center;font-size:12.5px;color:#999999;">' +
        "لا فرصة تطابق ما اخترته.</div>";
    }
    var page = pageSlice("opps", groups);
    h += '<div class="opgrid rise">' + page.map(opCard).join("") + "</div>";
    if (groups.length > PAGE_SIZES[0]) {
      h += '<div class="tblwrap" style="margin-top:14px;"><div class="tfoot">' +
        pageBar("opps", groups.length, "فرصة") + "</div></div>";
    }
    return h;
  }
  return h + opListView();
}

/* ---- the create form ---- */
function opBlankLine() { return { product: "", sale_price: "", years: 1, qty: 1, discount: 0 }; }
/* One numeric field, one definition. Four near-identical inputs written out four times is how a
   min= or an oninput target drifts on one of them and nobody notices until a discount of 400
   renders a negative deal value. */
function opNumFld(label, i, key, val, min, max) {
  return "<div><label>" + label + "</label>" +
    '<input class="inp" type="number" min="' + min + '"' + (max ? ' max="' + max + '"' : "") +
    ' value="' + esc(val) + '" oninput="opLineSet(' + i + ',&quot;' + key + '&quot;,this.value)"></div>';
}
function opSheetHtml() {
  var d = opSheet;
  var reg = tagList();
  var total = 0;
  var h = '<div class="opsheet" onclick="opCloseSheet()"><div class="sheet" onclick="event.stopPropagation()">';
  h += '<div class="sh"><span class="t">إضافة فرصة</span>' +
    '<button class="btn btn-ghost" onclick="opCloseSheet()">إغلاق</button></div>';
  h += '<div class="hint">الفرصة = عميل واحد + منتج أو أكثر. سجّل من أين جاءت — ردّ على حملة، أو مكالمة، أو زيارة — لأن ذلك هو ما يجعل «من أين تأتي صفقاتنا؟» سؤالًا له جواب.</div>';
  h += '<div class="fld two"><div><label>الجهة</label>' +
    '<input class="inp" id="opd_name" list="opaccts" value="' + esc(d.name) + '" placeholder="اسم الجهة" ' +
    'oninput="opDraft(&quot;name&quot;,this.value)"></div>' +
    "<div><label>الجوال (اختياري)</label>" +
    '<input class="inp" id="opd_phone" value="' + esc(d.phone) + '" placeholder="9665…" dir="ltr" ' +
    'oninput="opDraft(&quot;phone&quot;,this.value)"></div></div>';
  /* The suggestion list is CAPPED, and says so: 3,000 <option> nodes rebuilt on every keystroke is
     a measurable stall, and a cap nobody is told about reads as «that client is not in the system». */
  var accts = entities.slice(0, 400);
  h += '<datalist id="opaccts">' + accts.map(function (e) {
    return '<option value="' + esc(e.name) + '"></option>';
  }).join("") + "</datalist>";
  if (entities.length > accts.length) {
    h += '<div style="font-size:11px;color:#999999;margin-top:5px;">الاقتراحات تعرض أول ' +
      fmtN(accts.length) + " جهة من " + fmtN(entities.length) + " — اكتب اسم أي جهة أخرى كاملًا.</div>";
  }
  h += '<div class="fld two"><div><label>مصدر الفرصة</label><select class="inp" onchange="opDraft(&quot;source&quot;,this.value)">' +
    Object.keys(OPP_SRC).map(function (k) {
      return '<option value="' + k + '"' + (d.source === k ? " selected" : "") + ">" + OPP_SRC[k] + "</option>";
    }).join("") + "</select></div>";
  h += "<div>" + (d.source === "whatsapp"
    ? '<label>من أي حملة؟</label><select class="inp" onchange="opDraft(&quot;source_ref&quot;,this.value)">' +
      '<option value="">— لم تُحدَّد —</option>' +
      (campaigns || []).map(function (cp) {
        return '<option value="' + esc(cp.id) + '"' + (String(d.source_ref) === String(cp.id) ? " selected" : "") + ">" +
          esc(clip(cp.name, 40)) + "</option>";
      }).join("") + "</select>"
    : '<label>المسؤول (اختياري)</label><input class="inp" value="' + esc(d.owner || "") + '" placeholder="اسم المسؤول" oninput="opDraft(&quot;owner&quot;,this.value)">') + "</div></div>";

  h += '<div class="fld"><label>المنتجات</label>';
  d.lines.forEach(function (l, i) {
    var v = opValue(l);
    total += v;
    h += '<div class="lrow"><select class="inp" onchange="opLineSet(' + i + ',&quot;product&quot;,this.value)">' +
      '<option value="">— اختر الخدمة —</option>' +
      reg.map(function (t) {
        return '<option value="' + esc(t.name) + '"' + (l.product === t.name ? " selected" : "") + ">" + esc(t.name) + "</option>";
      }).join("") + "</select>" +
      '<div class="num">' +
      opNumFld("السعر السنوي", i, "sale_price", l.sale_price, 0, "") +
      opNumFld("سنوات", i, "years", l.years, 1, "20") +
      opNumFld("الكمية", i, "qty", l.qty, 1, "") +
      opNumFld("خصم ٪", i, "discount", l.discount, 0, "100") +
      "</div>" +
      '<div class="lfoot"><span class="v">' + opMoney(v) + "</span>" +
      (d.lines.length > 1 ? '<button class="btn btn-ghost" style="height:28px;padding:0 10px;font-size:12px;" onclick="opLineDel(' + i + ')">إزالة</button>' : "") +
      "</div></div>";
  });
  h += '<button class="btn btn-ghost" style="margin-top:9px;" onclick="opLineAdd()">+ إضافة منتج</button></div>';
  h += '<div class="tot"><span style="font-size:12.5px;color:#7C7C7C;">قيمة الفرصة</span>' +
    '<span class="v">' + opMoney(total) + "</span></div>";
  if (opErr) h += '<div class="err">' + esc(opErr) + "</div>";
  h += '<div class="acts"><button class="btn btn-dark" onclick="opSubmit()"' + (oppBusy ? " disabled" : "") + ">" +
    (oppBusy ? "جارٍ الحفظ…" : "إنشاء الفرصة") + "</button>" +
    '<button class="btn btn-ghost" onclick="opCloseSheet()">إلغاء</button></div>';
  return h + "</div></div>";
}

/* ---- handlers ---- */
window.opSetView = function (v) { opView = v; opOpen = 0; opArm = 0; render(false); };
/* PAGE is reset on every control that changes WHAT is listed: a filter that shrinks 34 pages to 1
   must not strand the reader on an empty page 34. Selection is cleared with it — a checkbox the
   reader can no longer see is a write they did not authorise. */
window.opSetMode = function (v) { opMode = v; opOpen = 0; opArm = 0; PAGE.opps = 1; render(false); };
window.opSetSort = function (v) { opSort = v; PAGE.opps = 1; render(false); };
window.opSetStg = function (v) { opStg = opStg === v && v !== "all" ? "all" : v; PAGE.opps = 1; opSel = {}; render(false); };
window.opToggleSel = function (id) { if (opSel[id]) delete opSel[id]; else opSel[id] = 1; render(false); };
window.opTogglePage = function () {
  var page = pageSlice("opps", opSorted());
  var allOn = page.length > 0 && page.every(function (l) { return opSel[l.id]; });
  page.forEach(function (l) { if (allOn) delete opSel[l.id]; else opSel[l.id] = 1; });
  render(false);
};
window.opClearSel = function () { opSel = {}; render(false); };
/* A bulk write is N single writes through the ONE endpoint — no second server path that could
   validate differently from the one a single row uses. It reports what actually landed, including
   the failures, rather than assuming the whole set went. */
async function opBulkPatch(patch, label) {
  var ids = opSelIds();
  if (!ids.length || oppBusy) return;
  oppBusy = true; render(false);
  var ok = 0, bad = 0;
  for (var i = 0; i < ids.length; i++) {
    try {
      var r = await fetch("/admin/opps/" + fmtId(ids[i]), {
        method: "PATCH", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify(patch) });
      var j = await r.json();
      if (r.ok && j.ok) { ok++; oppRows = oppRows.map(function (o) { return o.id === j.opp.id ? j.opp : o; }); }
      else bad++;
    } catch (e) { bad++; }
  }
  oppBusy = false; opSel = {}; render(false);
  alertBar(label + " — " + opPl(ok, "بند واحد", "بندان", "بنود", "بندًا") +
    (bad ? " · تعذّر " + fmtN(bad) : ""), bad > 0);
}
window.opBulkStage = function (el) {
  var v = el.value; el.value = "";
  if (!v) return;
  var st = opStage(v);
  void opBulkPatch({ stage: v }, "نُقلت إلى «" + st.label + "»");
};
window.opBulkOwner = function (el) {
  var v = String(el.value || "").trim(); el.value = "";
  if (!v) return;
  void opBulkPatch({ owner: v }, "أُسندت إلى " + v);
};
/* Drag writes through the same PATCH the stage rungs use. The column's own key is the payload —
   never the rendered label, which is the mistake the campaigns board documented: a visible string
   is a coincidence, a key is a contract. */
window.opDragStart = function (e, id) { opDragId = id; if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"; };
window.opDragEnd = function () { opDragId = null; };
window.opDragOver = function (e, el) { e.preventDefault(); if (el) el.classList.add("over"); };
window.opDragLeave = function (el) { if (el) el.classList.remove("over"); };
window.opDrop = function (e, stage, el) {
  e.preventDefault();
  if (el) el.classList.remove("over");
  var id = opDragId; opDragId = null;
  if (id === null) return;
  var l = (oppRows || []).find(function (x) { return x.id === id; });
  if (!l || l.stage === stage) return;   /* a drop onto the same column is not a write */
  void window.opSaveField(id, "stage", stage);
};
window.opSearch = function (el) { opQ = el.value; clearTimeout(window.__opq); window.__opq = setTimeout(function () { render(false); }, 250); };
window.opSetStat = function (v) { opStat = v; PAGE.opps = 1; render(false); };
window.opSetSrc = function (v) { opSrc = v; PAGE.opps = 1; render(false); };
window.opToggleLine = function (id) { opOpen = opOpen === id ? 0 : id; opArm = 0; render(false); };
window.opArmDel = function (id) { opArm = id; render(false); };
window.opDraft = function (k, v) { opSheet[k] = v; opErr = ""; if (k === "source") render(false); };
window.opLineSet = function (i, k, v) { opSheet.lines[i][k] = v; opErr = ""; render(false); };
window.opLineAdd = function () { opSheet.lines.push(opBlankLine()); render(false); };
window.opLineDel = function (i) { opSheet.lines.splice(i, 1); render(false); };
window.opCloseSheet = function () { opSheet = null; opErr = ""; render(false); };
window.opOpenSheet = function () {
  opSheet = { name: "", phone: "", source: "call", source_ref: "", owner: "", lines: [opBlankLine()] };
  opErr = ""; render(false);
};
/* Prefill from a reply the assistant already read: the account, its number, the service it asked
   about and the campaign that reached it. Everything here is a value already in the ledger — the
   form asks only for the one thing nobody recorded, which is what it is worth. */
window.opFromContact = function (phone) {
  var c = contactByPhone(phone);
  var ent = entities.find(function (e) { return e.phone === phone; });
  var cp = opLastCampaign(phone);
  var pr = c ? opReadProduct(c) : "";
  var line = opBlankLine();
  if (pr) line.product = pr;
  opSheet = {
    name: (ent && ent.name) || (c && c.waName) || phone,
    phone: phone, source: "whatsapp", source_ref: cp ? String(cp.id) : "", owner: "", lines: [line]
  };
  opErr = ""; render(false);
};

window.opSubmit = async function () {
  if (oppBusy) return;
  var d = opSheet;
  if (!d) return;
  if (!String(d.name || "").trim()) { opErr = "اسم الجهة مطلوب."; return render(false); }
  var lines = d.lines.filter(function (l) { return String(l.product || "").trim(); });
  if (!lines.length) { opErr = "اختر خدمة واحدة على الأقل."; return render(false); }
  oppBusy = true; render(false);
  try {
    var r = await fetch("/admin/opps", {
      method: "POST",
      headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({
        account_name: String(d.name).trim(), phone: String(d.phone || "").trim(),
        source: d.source, source_ref: d.source === "whatsapp" ? d.source_ref : "",
        lines: lines.map(function (l) {
          return {
            product: l.product, sale_price: Number(l.sale_price || 0), years: Number(l.years || 1),
            qty: Number(l.qty || 1), discount: Number(l.discount || 0), owner: d.owner || ""
          };
        })
      })
    });
    var j = await r.json();
    oppBusy = false;
    if (!r.ok || !j.ok) {
      /* The server names the field it rejected; repeating that name is the difference between a
         form the operator can fix and one they can only retry. */
      opErr = j.error === "unknown_product" ? "خدمة غير معروفة: " + String(j.product || "")
        : j.error === "invalid_field" ? "قيمة غير صالحة في الحقل: " + String(j.field || "")
        : j.error === "db_unavailable" ? "قاعدة البيانات غير متاحة — لم تُحفظ الفرصة."
        : "تعذّر الحفظ (" + fmtN(r.status) + ")";
      return render(false);
    }
    opSheet = null; opErr = "";
    oppRows = (j.opps || []).concat(oppRows || []);
    render(false);
    alertBar("سُجّلت الفرصة — " + opPl((j.opps || []).length, "بند واحد", "بندان", "بنود", "بندًا"), false);
  } catch (e) {
    oppBusy = false; opErr = "تعذّر الاتصال بالخادم. أعد المحاولة."; render(false);
  }
};

/* One write path for every field on the line, and it re-reads the row the server returned rather
   than patching the local copy — the difference between what the ledger holds and what the screen
   hopes it holds is exactly the bug class this codebase keeps paying for. */
window.opSaveField = async function (id, key, val) {
  var body = {};
  body[key] = val;
  try {
    var r = await fetch("/admin/opps/" + fmtId(id), {
      method: "PATCH",
      headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    var j = await r.json();
    if (!r.ok || !j.ok) { alertBar("تعذّر حفظ التعديل (" + fmtN(r.status) + ")", true); return opLoad(true); }
    oppRows = (oppRows || []).map(function (o) { return o.id === j.opp.id ? j.opp : o; });
    render(false);
  } catch (e) { alertBar("تعذّر الاتصال بالخادم. أعد المحاولة.", true); }
};
window.opSetStage = function (id, stage) { return window.opSaveField(id, "stage", stage); };
window.opDel = async function (id) {
  try {
    var r = await fetch("/admin/opps/" + fmtId(id), { method: "DELETE", headers: { "x-admin-token": TOKEN } });
    if (!r.ok) { alertBar("تعذّر الحذف (" + fmtN(r.status) + ")", true); return; }
    oppRows = (oppRows || []).filter(function (o) { return o.id !== id; });
    opArm = 0; opOpen = 0; render(false);
    alertBar("حُذف البند", false);
  } catch (e) { alertBar("تعذّر الاتصال بالخادم. أعد المحاولة.", true); }
};
/* A URL segment is not UI copy: fmtN would put Arabic-Indic digits in the path and the route would
   404. One named helper so the distinction is visible at every call site. */
function fmtId(id) { return String(Number(id)); }
`;
