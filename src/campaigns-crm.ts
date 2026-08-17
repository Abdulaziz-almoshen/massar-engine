// campaigns-crm.ts — the Frappe-CRM view layer for Massar's campaigns module.
//
// WHY THIS FILE EXISTS. dashboard.ts is ONE template literal (lines 9-2329) with the whole client
// script inside it, and ADR-0001 forbids range edits there. So the port lives here as two exported
// strings that dashboard.ts interpolates at two anchor points. Everything below is CLIENT JS: it is
// appended into the same <script> scope as the original views, which is deliberate — it lets these
// views call campStats, campWin, atOrAfter, seenOf, repliedIn, interestedOf, esc,
// fmtN, fmtD, ic and contactRowsHtml directly instead of reimplementing them. Product
// discovery named that reimplementation as the exact path by which round-22's invented numbers
// would come back, so there is ONE definition of every statistic and this file owns none of them.
//
// WHAT IS PORTED (patterns only — user-model Rule 3: adopt the pattern, never the palette):
//   Frappe ViewControls   -> one merged control bar with a قائمة|تجميع|كانبان toggle
//   Frappe ListBulkActions-> row selection + a floating bulk bar (the highest-value gap)
//   Frappe Deal.vue tabs  -> a 3-tab campaign record
// WHAT IS NOT: the right-hand field rail (field census: 1 unrendered substantive field vs a >=5
// threshold), the Create modal, assignment/owner/@mentions, Tasks/Notes/Email tabs, and the
// WhatsAppBox composer — a send affordance under the standing NO-SEND rule.
//
// DESCOPED, and named here because an omission nobody wrote down is indistinguishable from a bug:
//   FR-2 filter CONDITION BUILDER (add/remove AND-ed conditions over name/product/class/date/
//        counters). Shipped instead: search + the three class quick-filters + sort. Re-trigger:
//        the first time a real question needs two conditions at once.
//   FR-5 COLUMN PICKER (choose/reorder from the closed set of real fields). Shipped instead: one
//        fixed column set. Re-trigger: a second operator, or a column someone wants gone.
// Both are Frappe ViewControls affordances over six fields; neither was worth its surface yet.
//
// NO HANDLER IN THIS FILE SENDS A WHATSAPP MESSAGE. The only network call is the pre-existing
// POST /admin/campaign/test (reclassify), reached through the pre-existing setCampClass.

export const CAMPAIGNS_CRM_CSS = `
  /* ===== campaigns-crm: control bar ===== */
  .crmbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 16px;
    background:#fff; border:1px solid #EAECF0; border-radius:13px; margin-bottom:14px; }
  .crmbar .hair { width:1px; height:22px; background:#EAECF0; flex:none; }
  .vtog { display:inline-flex; background:#F2F4F7; border-radius:999px; padding:3px; flex:none; }
  .vtog button { font-family:inherit; font-size:12px; font-weight:700; color:#667085; background:transparent;
    border:none; border-radius:999px; padding:7px 15px; cursor:pointer; white-space:nowrap; }
  .vtog button.on { background:#fff; color:#1F7A73; box-shadow:0 1px 3px rgba(16,24,40,.10); }
  .qpill { font-family:inherit; font-size:11.5px; font-weight:700; border-radius:999px; padding:7px 13px;
    cursor:pointer; white-space:nowrap; color:#475467; background:#fff; border:1px solid #EAECF0; }
  .qpill.on { color:#2E7D77; background:#DCF1EF; border-color:#3FB6B0; }
  .crmsel { font-family:inherit; height:38px; border:1px solid #EAECF0; border-radius:999px;
    background:#F9FAFB; color:#344054; font-size:11.5px; font-weight:700; padding:0 12px; cursor:pointer; }

  /* ===== selection ===== */
  .selcell { width:40px; flex:none; display:flex; align-items:center; justify-content:center; }
  .selcell input { width:16px; height:16px; accent-color:#1F7A73; cursor:pointer; }
  .krow .selcell { opacity:0; transition:opacity .12s ease; }
  .krow:hover .selcell, .krow:focus-within .selcell, .krow.sel .selcell { opacity:1; }
  @media (pointer:coarse) { .krow .selcell { opacity:1; } }
  /* border-inline-start, not an inset box-shadow: a +3px x-offset is PHYSICAL, so in RTL it
     painted the accent on the end (left) edge while every other rule here is logical. */
  .krow.sel { background:#F4F6FA; border-inline-start: 3px solid #1F7A73; }

  /* ===== bulk bar ===== */
  .bulkbar { position:fixed; inset-block-end:18px; inset-inline:0; display:flex; justify-content:center;
    z-index:120; pointer-events:none; padding:0 12px; }  /* above alertBar (z-index:99), which occluded this for its full lifetime on the select-page path */
  .bulkbar > div { pointer-events:auto; display:flex; align-items:center; gap:9px; flex-wrap:wrap;
    background:#101828; color:#fff; border-radius:999px; padding:9px 14px; max-width:92vw;
    box-shadow:0 12px 32px rgba(16,24,40,.28); }
  .bulkbar .cnt { font-size:12px; font-weight:700; background:rgba(255,255,255,.14); border-radius:999px;
    padding:5px 12px; white-space:nowrap; }
  .bulkbar button { font-family:inherit; font-size:11.5px; font-weight:700; border-radius:999px;
    padding:7px 13px; cursor:pointer; border:1px solid rgba(255,255,255,.22); background:transparent;
    color:#fff; white-space:nowrap; }
  .bulkbar button.pri { background:#3FB6B0; border-color:#3FB6B0; color:#06312e; }
  .bulkbar button.x { border:none; background:transparent; font-size:16px; padding:4px 8px; }

  /* ===== kanban / group ===== */
  .kboard { display:flex; gap:14px; overflow-x:auto; padding-bottom:10px; align-items:flex-start; }
  .kcol { flex:none; width:290px; background:#F9FAFB; border:1px solid #EAECF0; border-radius:13px; padding:11px; }
  .kcol.over { border-color:#3FB6B0; background:#F0FAF9; }
  .kcolh { display:flex; align-items:center; gap:8px; margin-bottom:10px; padding:0 4px; }
  .kcolh .lb { font-size:12.5px; font-weight:700; color:#101828; }
  .kcolh .why { font-size:10.5px; color:#98A2B3; margin-top:2px; }
  .kcard { background:#fff; border:1px solid #EAECF0; border-radius:11px; padding:12px; margin-bottom:9px;
    cursor:pointer; }
  .kcard:hover { border-color:#3FB6B0; }
  .kcard .nm { font-size:13px; font-weight:700; color:#101828; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .kcard .mt { font-size:10.5px; color:#98A2B3; margin-top:3px; }
  .kcard .fig { display:flex; gap:12px; margin-top:9px; font-size:11px; color:#475467; }
  .kdrop { border:1.5px dashed #D0D5DD; border-radius:11px; padding:18px 12px; text-align:center;
    color:#98A2B3; font-size:11.5px; }

  /* ===== detail: spec strip + tabs ===== */
  .spec { display:flex; gap:18px; flex-wrap:wrap; align-items:flex-start; background:#F9FAFB;
    border:1px solid #EAECF0; border-radius:13px; padding:16px 18px; margin-bottom:16px; }
  .spec .wa { flex:1; min-width:260px; background:#E5DDD4; border-radius:11px; padding:11px; }
  .spec .bub2 { background:#DCF8C6; border-radius:9px; padding:10px 12px; font-size:12.5px; color:#101828;
    line-height:1.9; white-space:pre-wrap; word-break:break-word; }
  .spec .clamp { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .spec .facts { flex:none; display:flex; flex-direction:column; gap:10px; min-width:150px; }
  .spec .facts .k { font-size:10.5px; color:#98A2B3; font-weight:700; }
  .spec .facts .v { font-size:12.5px; color:#101828; font-weight:700; margin-top:2px; }
  .spec .ro { flex-basis:100%; font-size:11px; color:#98A2B3; }
  .ctabs { display:flex; gap:22px; border-bottom:1px solid #EAECF0; margin-bottom:16px; flex-wrap:wrap; }
  .ctabs button { font-family:inherit; font-size:13px; font-weight:700; color:#667085; background:none;
    border:none; border-bottom:2px solid transparent; padding:0 0 11px; cursor:pointer; white-space:nowrap; }
  .ctabs button.on { color:#1F7A73; border-bottom-color:#1F7A73; }

  /* ===== S1: the row grid lives in CSS, not in an inline style attribute =====
     It was an inline style on every row and header, which no media query can override — the phone
     layout was unreachable without !important until this moved here. .c-fig uses display:contents
     on the wide layout so its three children act as grid items, and becomes a flex line on the
     phone: ONE dom for both, never a parallel mobile row. */
  .crmgrid { min-width: 940px; }
  .crow { display:grid; grid-template-columns: 40px 2fr 1.15fr .95fr .7fr .7fr .7fr 1.15fr 44px;
    gap:12px; align-items:center; }
  .crow .c-fig, .crow .c-meta { display: contents; }
  .fig { display:flex; gap:12px; font-size:11px; color:#475467; }
  .crow .c-num { text-align:center; font-size:13px; font-weight:700; color:#101828; font-variant-numeric:tabular-nums; }
  /* display lives in CSS, never inline: an inline display:flex beats a media query and
     kept التقدّم rendering as a squeezed 40px stub on the phone row. */
  .crow .c-prog { display:flex; align-items:center; gap:9px; }
  .cedge { display:none; }

  @media (max-width: 599px) {
    /* The nine-column grid cannot answer "which campaign, did it work" on a phone — at 375 every
       figure sat behind a sideways drag. Three stacked lines, same DOM, same cells. */
    .crmgrid { min-width: 0; }
    .crow { grid-template-columns: 40px minmax(0,1fr) auto; row-gap:6px; column-gap:10px;
      align-items:start; position:relative; padding-block-end:16px !important; }
    .crow .selcell { grid-row: 1 / 4; grid-column: 1; align-self:center; }
    .crow .c-name  { grid-row: 1; grid-column: 2; }
    .crow .c-act   { grid-row: 1; grid-column: 3; }
    /* product + chip are ONE line: the chip is flex:none and the product ellipsizes first, so a
       long state label can never squeeze the campaign name the way it did when both sat in the
       auto-sized third column. */
    .crow .c-meta  { display:flex; align-items:center; gap:8px; min-width:0;
      grid-row: 2; grid-column: 2 / 4; }
    .crow .c-meta .c-prod  { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .crow .c-meta .c-state { flex:none; }
    .crow .c-fig   { display:flex; grid-row: 3; grid-column: 2 / 4; flex-wrap:wrap; }
    .crow .c-num   { text-align:start; }
    /* التقدّم is the one column that cannot survive as text here: it becomes a hairline meter on
       the row's block-end edge, so stacked rows read as a scannable column of bars. */
    .crow .c-prog  { display:none; }
    .crow .cedge   { display:block; position:absolute; inset-inline:0; inset-block-end:0; height:3px;
      background:#EAECF0; }
    .crow .cedge > i { display:block; height:100%; background:#1F7A73; }
    .thead-wide { display:none; }
    .thead-narrow { display:flex !important; }
  }
  .thead-narrow { display:none; align-items:center; gap:10px; padding:12px 16px; background:#F9FAFB;
    border-block-end:1px solid #EAECF0; font-size:11.5px; font-weight:700; color:#667085; }
`;

export const CAMPAIGNS_CRM_JS = `
/* ============================ campaigns-crm (client) ============================ */
var crmView = "list";        /* list | group | kanban */
/* Two separate keys on purpose. The BOARD defaults to التصنيف because that is the only board whose
   drop can be persisted (POST /admin/campaign/test) — defaulting the kanban to a read-only board
   would hide its one real gesture behind a dropdown. Grouping defaults to الخدمة, where the useful
   question is "how did each service do", and where nothing is draggable anyway. */
var crmGroupKey = "product"; /* product | class | month | perf — تجميع view */
var crmBoardKey = "class";   /* product | class | month | perf — كانبان view */
var crmSel = {};             /* campaign id -> true */
var crmDetailTab = "targets";/* targets | perf | next */
var crmSelD = {};            /* phone -> true */
var crmMsgOpen = false;
var crmDragId = null;

/* ONE function emits the campaign's state — the row chip and the board column both read it, so they
   can never disagree. Retires the old "completed" chip: a reply is not a completed campaign, and there is no
   lifecycle field on the campaigns table to back such a claim (user-model Rule 2). */
function crmWasSent(st) { return !!(st.sent || st.delivered); }
function campPerfState(c, st) {
  if (campIsTest(c)) return { key: "test", label: "تجريبية", cls: "c-warn", dot: "#B54708" };
  /* «بلا ردود بعد» on a campaign that was never sent is the same invented state the hero used to
     carry. The distinction crmVerdict() learned has to reach the chip, the board column, the group
     header and the record header — a vocabulary that exists on one screen is a contradiction. */
  if (!st.targeted) return { key: "noaudience", label: "بلا جمهور", cls: "c-grey", dot: "#98A2B3" };
  if (!crmWasSent(st)) return { key: "unsent", label: "لم تُرسل بعد", cls: "c-grey", dot: "#98A2B3" };
  if (st.replied > 0) return { key: "replied", label: "فيها ردود", cls: "c-ok", dot: "#027A48" };
  return { key: "silent", label: "بلا ردود بعد", cls: "c-blue", dot: "#2F5F94" };
}
/* A rate with no denominator is not zero, it is unknown. Returning null (rendered «—») is the whole
   point: base=Math.max(1,targeted) used to print a confident ٠٪ for a campaign with no audience. */
function crmRate(a, b) { return b ? Math.round(a / b * 100) : null; }
/* Delivery rates for a campaign that was never sent are undefined, not zero. */
function crmDeliveryRate(a, st) { return crmWasSent(st) ? crmRate(a, st.targeted) : null; }
function crmPctD(a, st) { var r = crmDeliveryRate(a, st); return r === null ? "—" : fmtN(r) + "٪"; }
function crmPct(a, b) { var r = crmRate(a, b); return r === null ? "—" : fmtN(r) + "٪"; }
/* SELECTION IS INTERSECTED WITH WHAT IS ON SCREEN, STRUCTURALLY.
   Clearing on every state change is necessary but not sufficient — it relies on remembering to call
   it from each of the four handlers, and a missed one stages the WRONG cohort into the launch
   wizard under a label naming the campaign you are looking at. So the accessors themselves refuse
   to return anything the operator cannot currently see: a hidden selection is unactionable by
   construction, not by discipline. Both layers are kept; this one is the guarantee. */
function crmVisibleIds() {
  /* Deliberately the whole filter match, NOT the LIST_CAP slice: «تحديد المطابقين» selects beyond
     what is rendered, and that is legitimate because the operator asked for it explicitly and the
     count says so. What must never be actionable is a selection the CURRENT FILTER excludes. */
  var ids = {};
  crmFiltered().forEach(function (x) { ids[x.c.id] = true; });
  return ids;
}
function crmSelIds() {
  var vis = crmVisibleIds();
  return Object.keys(crmSel).filter(function (k) { return crmSel[k] && vis[k]; });
}
function crmSelPhones() {
  /* crmLastShown is the cohort the targets tab last rendered, for the campaign currently open. */
  var vis = {};
  crmLastShown.forEach(function (p) { vis[p] = true; });
  return Object.keys(crmSelD).filter(function (k) { return crmSelD[k] && vis[k]; });
}
/* The campaign verdict must not describe an event that did not occur. A campaign with no audience
   was never sent, so «أُرسلت، وبانتظار الرد الأول» is an invented state — the same class as the
   fabricated ٠٪ removed from the rates beside it. */
function crmVerdict(st) {
  if (!st.targeted) return "لا جهات استهداف لهذه الحملة — لم يُرسل شيء.";
  if (st.replied) {
    return "وصلت إلى " + fmtN(st.delivered) + " جهة، ردّ " + fmtN(st.replied) + " منهم" +
      (st.interested ? " وأبدى " + fmtN(st.interested) + " اهتمامًا مؤهلًا" : "") + ".";
  }
  if (st.sent || st.delivered) return "أُرسلت، وبانتظار الرد الأول.";
  return "لم يُسجَّل إرسال لهذه الحملة بعد.";
}

/* Drop the selection and say so. Silence here is how «٢ محدَّدة» survives onto a screen showing
   two different campaigns' rows. */
function crmDropSel(which) {
  var n = which === "targets" ? Object.keys(crmSelD).length : Object.keys(crmSel).length;
  if (which === "targets") crmSelD = {}; else crmSel = {};
  if (n && typeof alertBar === "function") alertBar("أُلغي تحديد " + fmtN(n) + " عند تغيير العرض", false);
}

function crmMonth(ts) {
  return new Date(Number(ts)).toLocaleDateString("ar-SA", { month: "long", year: "numeric" });
}
/* Group/board keys are restricted to fields that EXIST. There is no stage, owner, value or close
   date on a campaign, so nothing here invents one; «حالة الأداء» is explicitly labelled as computed
   from delivery numbers so it is never read as a lifecycle. */
var CRM_KEYS = [
  ["class",   "التصنيف",      function (c, st) { return campIsTest(c) ? "تجريبية" : "فعلية"; },        "الحقل الوحيد القابل للتغيير بعد الإطلاق"],
  ["product", "الخدمة",       function (c, st) { return c.product || "بلا خدمة"; },                    "تُحدَّد عند الإطلاق ولا تتغيّر"],
  ["month",   "شهر الإطلاق",  function (c, st) { return crmMonth(c.created_at); },                     "من تاريخ الإطلاق"],
  ["perf",    "حالة الأداء",  function (c, st) { return campPerfState(c, st).label; },                 "محسوبة من أرقام التسليم"]
];
/* The active key depends on the view: كانبان reads crmBoardKey, تجميع reads crmGroupKey. One
   accessor so no call site can read the wrong one. */
function crmActiveKey() { return crmView === "kanban" ? crmBoardKey : crmGroupKey; }
function crmSetActiveKey(k) { if (crmView === "kanban") crmBoardKey = k; else crmGroupKey = k; }
function crmKeyDef(k) {
  for (var i = 0; i < CRM_KEYS.length; i++) if (CRM_KEYS[i][0] === k) return CRM_KEYS[i];
  return CRM_KEYS[0];
}

/* ------------------------------- control bar ------------------------------- */
function crmControlBar(nShown, nTotal) {
  var tabs = [["all", "الكل", campaigns.length],
    ["real", "فعلية", campaigns.filter(function (c) { return !campIsTest(c); }).length],
    ["test", "تجريبية", campaigns.filter(function (c) { return campIsTest(c); }).length]];
  var h = '<div class="crmbar rise">';
  h += '<span style="position:relative;display:inline-flex;align-items:center;flex:1;min-width:200px;max-width:320px;">' +
    '<span style="position:absolute;inset-inline-start:13px;color:#98A2B3;display:flex;">' + ic("search", 17) + '</span>' +
    '<input id="campq" class="inp" value="' + esc(campQ) + '" oninput="campSearchFn(this)" placeholder="ابحث في الحملات…" style="width:100%;padding-inline-start:40px;height:38px;border-radius:999px;font-size:12px;"></span>';
  h += '<span class="vtog">' +
    [["list", "قائمة"], ["group", "تجميع"], ["kanban", "كانبان"]].map(function (v) {
      return '<button class="' + (crmView === v[0] ? "on" : "") + '" onclick="crmSetView(&quot;' + v[0] + '&quot;)">' + v[1] + '</button>';
    }).join("") + '</span>';
  /* Today's three class tabs, unchanged in behaviour — these ARE Frappe's quick filters, keyed on
     the one real boolean on the table. */
  h += tabs.map(function (t) {
    return '<button class="qpill' + (campTab === t[0] ? " on" : "") + '" onclick="setCampTab(&quot;' + t[0] + '&quot;)">' + t[1] + " (" + fmtN(t[2]) + ")</button>";
  }).join("");
  h += '<span style="flex:1"></span><span class="hair"></span>';
  if (crmView === "list") {
    h += '<select onchange="setCampSort(this)" class="crmsel">' +
      '<option value="new"' + (campSortKey === "new" ? " selected" : "") + '>الأحدث أولًا</option>' +
      '<option value="replies"' + (campSortKey === "replies" ? " selected" : "") + '>الأكثر ردودًا</option>' +
      '<option value="seen"' + (campSortKey === "seen" ? " selected" : "") + '>الأكثر مشاهدة</option></select>';
  } else {
    h += '<select onchange="crmSetGroup(this.value)" class="crmsel">' +
      CRM_KEYS.map(function (k) {
        return '<option value="' + k[0] + '"' + (crmActiveKey() === k[0] ? " selected" : "") + '>' +
          (crmView === "kanban" ? "لوحة: " : "تجميع حسب: ") + k[1] + '</option>';
      }).join("") + '</select>';
  }
  h += '<span class="cntpill">' + fmtN(nTotal) + " حملة</span>";
  /* Said ONCE, beside the selector that chose it, instead of repeated on every group header and
     again under the board. */
  if (crmView !== "list") {
    var kd = crmKeyDef(crmActiveKey());
    h += '<div style="flex-basis:100%;font-size:10.5px;color:#98A2B3;padding-top:2px;">' +
      esc(kd[1]) + " — " + esc(kd[3]) +
      (crmView === "kanban" && crmActiveKey() !== "class" ? " · هذه اللوحة للعرض فقط." : "") + '</div>';
  }
  h += "</div>";
  return h;
}

/* ------------------------------- shared list plumbing ------------------------------- */
function crmFiltered() {
  var q = campQ.trim();
  var list = campaigns.filter(function (c) {
    return (campTab === "all" || (campTab === "test") === campIsTest(c)) &&
      (!q || c.name.includes(q) || (c.product || "").includes(q));
  });
  var withSt = list.map(function (c) { return { c: c, st: campStats(c) }; });
  if (campSortKey === "replies") withSt.sort(function (a, b) { return b.st.replied - a.st.replied; });
  else if (campSortKey === "seen") withSt.sort(function (a, b) { return b.st.seen - a.st.seen; });
  else withSt.sort(function (a, b) { return Number(b.c.created_at) - Number(a.c.created_at); });
  return withSt;
}

function crmRow(c, st) {
  var isTest = campIsTest(c);
  var ps = campPerfState(c, st);
  var prog = crmRate(st.delivered, st.targeted);
  var on = !!crmSel[c.id];
  /* N1: one icon with STATE, not two directional glyphs. The two actions are opposite ends of a
     single boolean, and it reuses the row's own status-dot colours so the dot above teaches the
     mapping. The directional title/aria-label stay — they are the a11y floor for an icon button. */
  var actTitle = isTest ? "إعادة الحملة إلى القائمة الفعلية" : "نقل الحملة إلى التجريبية";
  /* The km class is not decoration: dashboard.ts:229 applies a legacy 4-column mobile grid to
     .trow:not(.km) below 900px, with nth-child(4) and (5) hidden. That selector is (0,2,0) and
     beat .crow, which is why the phone row rendered four tracks with the figures line missing.
     The original vKmon row carries km for exactly this reason. */
  return '<div class="trow km krow crow' + (on ? " sel" : "") + '" onclick="location.hash=&quot;kmon/' + c.id + '&quot;" style="padding:16px 22px;">' +
    '<div class="selcell"><input type="checkbox" aria-label="تحديد ' + esc(c.name) + '"' + (on ? " checked" : "") + ' onclick="event.stopPropagation();crmToggle(' + c.id + ')"></div>' +
    '<div class="c-name" style="display:flex;align-items:center;gap:12px;min-width:0;"><span role="img" aria-label="' + (isTest ? "حملة تجريبية" : "حملة فعلية") + '" style="width:9px;height:9px;border-radius:999px;flex:none;background:' + (isTest ? "#D0D5DD" : "#1F7A73") + ';box-shadow:0 0 0 3px ' + (isTest ? "rgba(208,213,221,.28)" : "rgba(31,122,115,.16)") + ';"></span>' +
    '<div style="min-width:0;"><div style="font-size:13.5px;font-weight:700;color:#101828;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(c.name) + '</div>' +
    '<div style="font-size:11px;color:#98A2B3;margin-top:3px;">' + fmtD(c.created_at) + '</div></div></div>' +
    '<div class="c-meta">' +
    '<div class="c-prod" style="font-size:12.5px;color:#475467;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">' + esc(c.product || "—") + '</div>' +
    '<div class="c-state"><span class="chip ' + ps.cls + '" style="white-space:nowrap;"><span style="width:6px;height:6px;border-radius:999px;background:' + ps.dot + ';"></span>' + ps.label + '</span></div></div>' +
    '<div class="c-fig fig">' +
      '<div class="c-num"><span class="lbl-ph">الجمهور </span>' + fmtN(st.targeted) + '</div>' +
      '<div class="c-num"><span class="lbl-ph">مشاهدة </span>' + crmPctD(st.seen, st) + '</div>' +
      '<div class="c-num"><span class="lbl-ph">ردود </span>' + crmPctD(st.replied, st) + '</div>' +
    '</div>' +
    '<div class="c-prog">' +
      (prog === null
        ? '<span style="font-size:11.5px;color:#98A2B3;">لا جهات استهداف</span>'
        : '<div class="prog" style="flex:1;height:6px;background:#EAECF0;border-radius:999px;overflow:hidden;"><i style="display:block;height:100%;width:' + prog + '%;background:#1F7A73;border-radius:999px;"></i></div><span style="font-size:11.5px;font-weight:700;color:#667085;flex:none;font-variant-numeric:tabular-nums;">' + fmtN(prog) + '٪</span>') +
    '</div>' +
    '<div class="c-act" style="text-align:center;"><button class="kebab" title="' + actTitle + '" aria-label="' + actTitle + '" onclick="event.stopPropagation();setCampClass(' + c.id + ',' + (isTest ? "false" : "true") + ')">' + ic("target", 17, isTest ? "#D0D5DD" : "#1F7A73") + '</button></div>' +
    /* prog === null renders NO bar rather than an empty one: the «بلا جمهور» chip already says why. */
    (prog === null ? "" : '<div class="cedge" role="img" aria-label="التقدّم ' + fmtN(prog) + '٪"><i style="width:' + prog + '%;"></i></div>') +
  '</div>';
}

function crmHeaderRow(withSelectAll, allOn, nOver, nTotal) {
  var selAll = withSelectAll && nOver > 0
    ? ' <span class="lnk" onclick="event.stopPropagation();crmSelectAllMatching()" style="color:#1F7A73;font-weight:700;cursor:pointer;font-size:10.5px;">تحديد المطابقين (' + fmtN(nTotal) + ')</span>'
    : "";
  var box = withSelectAll
    ? '<input type="checkbox" aria-label="تحديد المعروض"' + (allOn ? " checked" : "") + ' onclick="crmTogglePage()">'
    : "";
  /* Below 600 the nine-column header cannot render and must not be faked — the stacked row labels
     its own figures. It collapses to one strip carrying only the selection controls. */
  return '<div class="crow thead-wide" style="padding:14px 22px;background:#F9FAFB;border-bottom:1px solid #EAECF0;font-size:11.5px;font-weight:700;color:#667085;">' +
      '<div class="selcell" style="opacity:1;">' + box + '</div>' +
      '<div>الحملة' + selAll + '</div><div class="c-meta"><div>الخدمة</div><div>الحالة</div></div>' +
      '<div class="c-fig fig" style="font-weight:700;color:#667085;">' +
        '<div class="c-num" style="color:#667085;font-size:11.5px;">الجمهور</div>' +
        '<div class="c-num" style="color:#667085;font-size:11.5px;">مشاهدة</div>' +
        '<div class="c-num" style="color:#667085;font-size:11.5px;">ردود</div>' +
      '</div>' +
      '<div>التقدّم</div><div></div></div>' +
    '<div class="thead-narrow">' + (withSelectAll ? '<span class="selcell" style="opacity:1;">' + box + '</span><span>تحديد المعروض</span>' : "") +
      '<span style="flex:1"></span>' + selAll + '</div>';
}

function crmListView(withStAll) {
  var withSt = withStAll.slice(0, LIST_CAP);
  var nOver = withStAll.length - withSt.length;
  var allOn = withSt.length > 0 && withSt.every(function (x) { return crmSel[x.c.id]; });
  var h = '<div class="tblwrap rise"><div style="overflow-x:auto;" class="ms-scroll"><div class="crmgrid">' +
    crmHeaderRow(true, allOn, nOver, withStAll.length);
  withSt.forEach(function (x) { h += crmRow(x.c, x.st); });
  if (!withSt.length) h += crmEmptyList();
  h += '</div></div>';
  h += '<div class="tfoot"><span>' + ic("clock", 14) + ' الأرقام تُحدَّث لحظيًا من حالات تسليم واتساب. لا تقديرات.</span>' +
    (nOver ? '<span style="color:#B54708;font-weight:700;">تُعرض أحدث ' + fmtN(LIST_CAP) + " حملة من " + fmtN(withStAll.length) + ". ضيّق بالبحث لرؤية الباقي.</span>" : "") + '</div></div>';
  return h;
}

function crmEmptyList() {
  if (campQ.trim()) return '<div style="padding:44px;text-align:center;color:#667085;font-size:13px;line-height:1.9;">لا حملة تطابق «' + esc(campQ.trim()) + '».<br><span style="color:#98A2B3;">امسح البحث أو جرّب تبويبًا آخر.</span></div>';
  return '<div style="padding:44px;text-align:center;color:#98A2B3;font-size:13px;">لا حملات في هذا التبويب</div>';
}

/* --------------------------------- grouping --------------------------------- */
function crmGroups(withStAll) {
  var def = crmKeyDef(crmActiveKey()), fn = def[2];
  var order = [], by = {};
  withStAll.forEach(function (x) {
    var k = fn(x.c, x.st);
    if (!by[k]) { by[k] = []; order.push(k); }
    by[k].push(x);
  });
  /* A group that exists in the vocabulary but holds nothing is a FACT, not an absence: render it
     empty rather than hiding it, so «تجريبية: ٠» is visible instead of silently missing. */
  /* Only seed an empty group the CURRENT filter could actually contain. Seeding «تجريبية ٠» while
     the فعلية pill reads «تجريبية (١)» puts two different counts of the same thing on one screen. */
  if (crmActiveKey() === "class") {
    ["فعلية", "تجريبية"].forEach(function (k) {
      var excluded = (campTab === "real" && k === "تجريبية") || (campTab === "test" && k === "فعلية");
      if (!by[k] && !excluded) { by[k] = []; order.push(k); }
    });
  }
  if (crmActiveKey() === "perf") ["تجريبية", "بلا جمهور", "لم تُرسل بعد", "فيها ردود", "بلا ردود بعد"].forEach(function (k) { if (!by[k]) { by[k] = []; order.push(k); } });
  /* Months must run newest-first regardless of the row sort, or «أغسطس» lands after «يوليو»
     whenever the list is sorted by replies. Keyed on each group's newest launch. */
  if (crmActiveKey() === "month") {
    order.sort(function (a, b) {
      var newest = function (k) { return Math.max.apply(null, by[k].map(function (x) { return Number(x.c.created_at); })); };
      return newest(b) - newest(a);
    });
  }
  return { def: def, order: order, by: by };
}

function crmGroupView(withStAll) {
  var g = crmGroups(withStAll);
  if (g.order.length <= 1) {
    return '<div class="sparse rise">' + ic("eye", 16, "#1F7A73") +
      '<div>كل الحملات في مجموعة واحدة حسب <b>' + g.def[1] + '</b> — التجميع لا يضيف شيئًا هنا. ' +
      '<span class="lnk" onclick="crmSetView(&quot;list&quot;)" style="color:#1F7A73;font-weight:700;cursor:pointer;">→ عد إلى القائمة</span></div></div>' +
      crmListView(withStAll);
  }
  var h = "";
  g.order.forEach(function (k) {
    var rows = g.by[k].slice(0, LIST_CAP);
    var over = g.by[k].length - rows.length;
    h += '<div class="tblwrap rise" style="margin-bottom:14px;">' +
      '<div style="display:flex;align-items:center;gap:9px;padding:13px 18px;border-bottom:1px solid #EAECF0;background:#F9FAFB;">' +
      '<span style="font-size:13px;font-weight:700;color:#101828;">' + esc(k) + '</span>' +
      '<span class="cntpill">' + fmtN(g.by[k].length) + '</span>' +
      '</div>' +
      '<div style="overflow-x:auto;" class="ms-scroll"><div class="crmgrid">' +
      crmHeaderRow(false);
    rows.forEach(function (x) { h += crmRow(x.c, x.st); });
    if (!rows.length) h += '<div style="padding:26px;text-align:center;color:#98A2B3;font-size:12px;">لا حملات في هذه المجموعة</div>';
    h += '</div></div>';
    if (over > 0) h += '<div class="tfoot"><span style="color:#B54708;font-weight:700;">تُعرض ' + fmtN(rows.length) + " من " + fmtN(g.by[k].length) + " في هذه المجموعة.</span></div>";
    h += '</div>';
  });
  return h;
}

/* ---------------------------------- kanban ---------------------------------- */
function crmKanbanView(withStAll) {
  var g = crmGroups(withStAll);
  /* Drag is enabled ONLY on the التصنيف board, because POST /admin/campaign/test is the only write
     that exists for a campaign. A card must never be draggable into a state nothing can persist. */
  var canDrag = crmActiveKey() === "class";
  var h = '<div class="kboard ms-scroll rise">';
  g.order.forEach(function (k) {
    h += '<div class="kcol" data-col="' + esc(k) + '"' +
      (canDrag ? ' ondragover="crmDragOver(event,this)" ondragleave="crmDragLeave(this)" ondrop="crmDrop(event,&quot;' + (k === "تجريبية" ? "test" : "real") + '&quot;,this)"' : "") + '>' +
      '<div class="kcolh"><div><div class="lb">' + esc(k) + '</div></div>' +
      '<span style="flex:1"></span><span class="cntpill">' + fmtN(g.by[k].length) + '</span></div>';
    var rows = g.by[k].slice(0, LIST_CAP);
    rows.forEach(function (x) {
      var st = x.st, c = x.c;
      h += '<div class="kcard"' + (canDrag ? ' draggable="true" ondragstart="crmDragStart(event,' + c.id + ')" ondragend="crmDragEnd()"' : "") +
        ' onclick="location.hash=&quot;kmon/' + c.id + '&quot;">' +
        '<div class="nm">' + esc(c.name) + '</div>' +
        '<div class="mt">' + fmtD(c.created_at) + (c.product ? " · " + esc(c.product) : "") + '</div>' +
        '<div class="fig"><span>الجمهور <b>' + fmtN(st.targeted) + '</b></span><span>مشاهدة <b>' + crmPctD(st.seen, st) + '</b></span><span>ردود <b>' + crmPctD(st.replied, st) + '</b></span></div>' +
        '</div>';
    });
    if (!rows.length) h += '<div class="kdrop">' + (canDrag ? "اسحب حملة هنا لتغيير تصنيفها" : "لا حملات") + '</div>';
    if (g.by[k].length > rows.length) h += '<div style="font-size:10.5px;color:#B54708;font-weight:700;padding:4px;">تُعرض ' + fmtN(rows.length) + " من " + fmtN(g.by[k].length) + '</div>';
    h += '</div>';
  });
  h += '</div>';
  return h;
}

/* -------------------------------- bulk bar -------------------------------- */
function crmBulkBar() {
  var ids = crmSelIds();
  if (!ids.length) return "";
  var sel = ids.map(function (i) { return campaigns.find(function (c) { return String(c.id) === String(i); }); }).filter(Boolean);
  var nTest = sel.filter(campIsTest).length, nReal = sel.length - nTest;
  var h = '<div class="bulkbar"><div>' +
    '<span class="cnt">' + fmtN(sel.length) + ' محدَّدة</span>' +
    '<button onclick="crmExportSel()">تصدير المحدد CSV</button>';
  if (nReal) h += '<button onclick="crmBulkClass(true)">نقل إلى التجريبية (' + fmtN(nReal) + ')</button>';
  if (nTest) h += '<button onclick="crmBulkClass(false)">إعادة إلى الفعلية (' + fmtN(nTest) + ')</button>';
  h += '<button class="x" aria-label="إلغاء التحديد" onclick="crmClear()">×</button></div></div>';
  return h;
}

/* ============================== the list screen ============================== */
function vKmonCrm(d) {
  var withStAll = crmFiltered();
  var h = '<div class="ptitle rise"><div><h1>الحملات</h1><p>كل إطلاق، أرقامه الفعلية، ونتيجته. اضغط أي حملة لفتح لوحتها.</p></div>' +
    '<div class="acts"><button class="btn btn-ghost" onclick="exportCampaigns()">' + ic("doc", 17) + ' تصدير CSV</button>' +
    '<a href="#aimkt" class="btn btn-dark" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">' + ic("send", 17) + ' إنشاء حملة</a></div></div>';
  if (!campaigns.length) {
    return h + '<div class="empty" style="padding:60px 20px;"><div class="ic"><span></span></div><div class="t">لا حملات بعد</div><div class="s">أطلق أول حملة من <a href="#aimkt" style="color:#1F7A73;font-weight:700;">إنشاء حملة</a> — كل إطلاق يظهر هنا بلوحته وأرقامه الحية.</div></div>';
  }
  h += crmControlBar(Math.min(withStAll.length, LIST_CAP), withStAll.length);
  if (crmView === "kanban") h += crmKanbanView(withStAll);
  else if (crmView === "group") h += crmGroupView(withStAll);
  else h += crmListView(withStAll);
  h += crmBulkBar();
  return h;
}

/* ============================= the record screen ============================= */
function crmSpecStrip(camp, st) {
  var msg = camp.message ? String(camp.message) : "";
  /* The link is emitted hidden and unhidden only if the clamped bubble ACTUALLY overflows.
     msg.length > 90 was a proxy and it was wrong in the visible direction: measured at 1440, a
     155-char message fits on one line (scrollHeight 44 == clientHeight 44) and still offered
     «عرض النص كاملًا» — a control that expands nothing. */
  var body = msg
    ? '<div class="bub2' + (crmMsgOpen ? "" : " clamp") + '" id="crmmsg">' + esc(msg) + '</div>' +
      '<div id="crmmsgmore" style="margin-top:7px;' + (crmMsgOpen ? "" : "display:none;") + '"><span class="lnk" onclick="crmToggleMsg()" style="color:#1F7A73;font-weight:700;font-size:11.5px;cursor:pointer;">' + (crmMsgOpen ? "طيّ النص" : "عرض النص كاملًا") + '</span></div>'
    : '<div style="font-size:12px;color:#98A2B3;padding:8px 2px;">لم يُحفظ نص هذه الحملة.</div>';
  return '<div class="spec rise">' +
    '<div class="wa">' + body + '</div>' +
    '<div class="facts">' +
      '<div><div class="k">الخدمة</div><div class="v">' + esc(camp.product || "غير محددة") + '</div></div>' +
      '<div><div class="k">حجم الجمهور</div><div class="v">' + fmtN(st.targeted) + '</div></div>' +
      '<div><div class="k">التصنيف</div><div class="v">' + (campIsTest(camp) ? "تجريبية" : "فعلية") + '</div></div>' +
    '</div>' +
    '<div class="ro">هذا نصّ ما أُرسل فعليًا. لا يقبل التعديل بعد الإطلاق.</div>' +
  '</div>';
}

function crmDetailBulkBar(camp) {
  var ph = crmSelPhones();
  if (!ph.length) return "";
  return '<div class="bulkbar"><div>' +
    '<span class="cnt">' + fmtN(ph.length) + ' محدَّدة</span>' +
    '<button class="pri" onclick="crmRetargetSel()">إعادة استهداف المحدد (' + fmtN(ph.length) + ')</button>' +
    '<button onclick="crmExportSelTargets()">تصدير المحدد CSV</button>' +
    '<button class="x" aria-label="إلغاء التحديد" onclick="crmClearD()">×</button></div></div>';
}

function vKmonDetailCrm(id, d) {
  var camp = campaigns.find(function (x) { return String(x.id) === String(id); });
  if (!camp) return '<div class="empty"><div class="ic"><span></span></div><div class="t">حملة غير موجودة</div><div class="s"><a href="#kmon" style="color:#2E7D77;font-weight:700;">→ كل الحملات</a></div></div>';
  var st = campStats(camp), cwin = campWin(camp);
  var ps = campPerfState(camp, st);
  var rows = camp.targets.map(function (t) { return { phone: t.phone, name: t.name, contact: contactByPhone(t.phone) }; });

  var h = '<a href="#kmon" style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#475467;text-decoration:none;margin-bottom:14px;">→ كل الحملات</a>' +
    '<div class="ptitle rise"><div><h1 style="font-size:26px;">' + esc(camp.name) + '</h1>' +
    '<p>' + (camp.product ? esc(camp.product) + " · " : "") + 'واتساب · ' + fmtD(camp.created_at) + '</p></div>' +
    '<div class="acts"><span class="chip ' + ps.cls + '">' + ps.label + '</span></div></div>';

  /* حكم الحملة — the verdict hero stays page-level so it is never hidden behind a tab. */
  var yieldPer100 = crmDeliveryRate(st.interested, st);
  h += '<div class="card rise" style="background:linear-gradient(135deg,#0F2E52,#1F4470);border:none;color:#fff;display:flex;gap:26px;flex-wrap:wrap;align-items:center;">' +
    '<div style="flex:1;min-width:240px;"><div style="font-size:11.5px;color:#9FC0E4;font-weight:700;">حكم الحملة</div>' +
    '<div style="font-size:17px;font-weight:700;margin-top:7px;line-height:1.7;">' +
    crmVerdict(st) + '</div></div>' +
    '<div style="display:flex;gap:30px;flex-wrap:wrap;">' +
    [["نسبة المشاهدة", crmDeliveryRate(st.seen, st)], ["نسبة الردود", crmDeliveryRate(st.replied, st)], ["جهات مهتمة لكل ١٠٠", yieldPer100]]
      .map(function (x) {
        return '<div><div style="font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;">' +
          (x[1] === null ? "—" : fmtN(x[1]) + '<span style="font-size:14px;color:#9FC0E4;">٪</span>') +
          '</div><div style="font-size:11px;color:#9FC0E4;margin-top:3px;">' + x[0] + '</div></div>';
      }).join("") + '</div></div>';

  /* ---- the move cards, computed once: the count rides on the tab label ---- */
  var seenSilent = rows.filter(function (r) { return r.contact && atOrAfter((r.contact.statusTimes || {}).read, cwin) && !repliedIn(r.contact, cwin); });
  var notDelivered = rows.filter(function (r) { return r.contact && atOrAfter((r.contact.statusTimes || {}).failed, cwin) && !atOrAfter((r.contact.statusTimes || {}).delivered, cwin); });
  var hotHere = rows.filter(function (r) { return r.contact && ((r.contact.tags || []).some(function (t) { return t.level === "hot"; }) || (insCache[r.phone] || {}).intent === "high"); });
  var lostHere = rows.map(function (r) { return insCache[r.phone]; }).filter(function (i) { return i && i.deal_state === "lost" && i.loss_cause; });
  var causeTally = {};
  lostHere.forEach(function (i) { causeTally[i.loss_cause] = (causeTally[i.loss_cause] || 0) + 1; });
  var topCause = Object.keys(causeTally).sort(function (a, b) { return causeTally[b] - causeTally[a]; })[0];
  var moves = [];
  if (hotHere.length) moves.push(["ابدأ التواصل مع " + fmtN(hotHere.length) + " جهة تستحق المتابعة", "وسوم اهتمام مؤكدة، أو نية مرتفعة قرأها المساعد من نص المحادثة ولم تُسجَّل وسمًا بعد", "#027A48", "#ECFDF3", "interested"]);
  if (seenSilent.length) moves.push(["أعد استهداف " + fmtN(seenSilent.length) + " جهة شاهدت دون ردّ", "الاهتمام قائم، وأثر الرسالة غير واضح" + (topCause ? " وعالج «" + topCause + "»" : ""), "#B54708", "#FFFAEB", "silent"]);
  if (notDelivered.length) moves.push([fmtN(notDelivered.length) + " لم تصلهم الرسالة", "تحقق من الأرقام، ثم أعد المحاولة لاحقًا", "#B42318", "#FEF3F2", "failed"]);
  if (topCause) moves.push(["أبرز أسباب عدم الإغلاق: " + topCause, "عالِج السبب في رسالة الحملة القادمة لهذه الخدمة", "#2F5F94", "#EFF4FB", ""]);

  /* S4 — the single highest-value move, surfaced under the verdict so the operator sees the next
     action without opening a tab. moves is already ordered hot -> seen-silent -> not-delivered ->
     top-cause, which is a value order; this shows moves[0] and invents no score. The fourth kind
     has no filter action, so the strip degrades to the tab link. ZERO moves renders NOTHING — a
     strip announcing an absence is chrome, and the count-less tab plus «لا توصية الآن» carries it. */
  if (moves.length) {
    var m0 = moves[0];
    h += '<div class="rise" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:' + m0[3] + ';border:1px solid #EAECF0;border-radius:13px;padding:12px 16px;margin-bottom:14px;">' +
      ic("spark", 17, m0[2]) +
      '<span style="font-size:13px;font-weight:700;color:' + m0[2] + ';">' + esc(m0[0]) + '</span>' +
      '<span style="flex:1;min-width:12px;"></span>' +
      (m0[4] ? '<button class="btn" style="padding:6px 12px;font-size:11.5px;border-radius:999px;color:#2E7D77;background:#fff;border:1px solid #3FB6B0;font-weight:700;" onclick="crmGoFilter(&quot;' + m0[4] + '&quot;)">افتح هذه الفئة</button>' : "") +
      '<span class="lnk" onclick="crmSetDetailTab(&quot;next&quot;)" style="color:#475467;font-weight:700;font-size:11.5px;cursor:pointer;">كل الخطوات (' + fmtN(moves.length) + ')</span>' +
      '</div>';
  }

  h += crmSpecStrip(camp, st);
  setTimeout(crmMeasureMsg, 0);


  /* A «(٠)» beside «الخطوة التالية» reads as a broken counter rather than as "nothing to do"; the
     panel itself says so in words. Show the count only when there is one. */
  var tabs = [["targets", "جهات الاستهداف", rows.length], ["perf", "الأداء", null], ["next", "الخطوة التالية", moves.length || null]];
  h += '<div class="ctabs rise">' + tabs.map(function (t) {
    return '<button class="' + (crmDetailTab === t[0] ? "on" : "") + '" onclick="crmSetDetailTab(&quot;' + t[0] + '&quot;)">' + t[1] + (t[2] === null ? "" : " (" + fmtN(t[2]) + ")") + '</button>';
  }).join("") + '</div>';

  if (crmDetailTab === "perf") {
    /* THE ASYMMETRY IS DELIBERATE. أُرسلت and وصلت describe the SEND itself, so «٠٪ من جهات
       الاستهداف» on them is an honest statement about a send that did not happen. شوهدت / ردّوا /
       جهات مهتمة describe what the RECIPIENTS did, and those are undefined until something was
       sent — a ٠٪ there asserts that a delivered message went unseen. Flag per card (c[3]). */
    var cards = [["جهات الاستهداف", st.targeted, "#2F5F94", false], ["أُرسلت", st.sent, "#2F5F94", false],
      ["وصلت", st.delivered, "#3FB6B0", false], ["شوهدت", st.seen, "#3FB6B0", true],
      ["ردّوا", st.replied, "#2E8F89", true], ["جهات مهتمة", st.interested, "#1f8a52", true]];
    h += '<div class="statgrid">' + cards.map(function (c, i) {
      var r = c[3] ? crmDeliveryRate(c[1], st) : crmRate(c[1], st.targeted);
      var caption = i === 0 ? "&nbsp;"
        : r !== null ? fmtN(r) + "٪ من جهات الاستهداف"
        : !st.targeted ? "لا جهات استهداف"
        : "لم تُرسل بعد";
      return '<div class="statc"><div class="l">' + c[0] + '</div><div class="v">' + fmtN(c[1]) + '</div>' +
        '<div class="p">' + caption + '</div>' +
        '<div class="mb"><i style="width:' + (i === 0 ? 100 : (r === null ? 0 : r)) + '%;background:' + c[2] + ';"></i></div></div>';
    }).join("") + '</div>' +
    '<div style="font-size:11.5px;color:#98A2B3;margin-top:10px;">«شوهدت» = قُرئت أو ردّت — أي إشارة مؤكدة أن الرسالة وصلت لعين العميل.</div>';
    return h;
  }

  if (crmDetailTab === "next") {
    if (!moves.length) return h + '<div class="empty" style="padding:44px;"><div class="t">لا توصية الآن</div><div class="s">لم يُسجَّل حدث بعد الإطلاق.</div></div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;">' +
      moves.map(function (m) {
        return '<div style="background:' + m[3] + ';border:1px solid #EAECF0;border-radius:13px;padding:14px 16px;">' +
          '<div style="font-size:13px;font-weight:700;color:' + m[2] + ';">' + esc(m[0]) + '</div>' +
          '<div style="font-size:11.5px;color:#475467;margin-top:5px;line-height:1.8;">' + esc(m[1]) + '</div>' +
          (m[4] ? '<div style="margin-top:10px;"><button class="btn" style="padding:6px 12px;font-size:11.5px;border-radius:999px;color:#2E7D77;background:#DCF1EF;border:1px solid #3FB6B0;font-weight:700;" onclick="crmGoFilter(&quot;' + m[4] + '&quot;)">افتح هذه الفئة</button></div>' : "") +
          '</div>';
      }).join("") + '</div>';
    return h;
  }

  /* ---- targets tab: the existing six filters + table, now with selection ---- */
  var filters = [
    ["all", "الكل", rows.length, function (r) { return true; }],
    ["seen", "شوهدت", st.seen, function (r) { return seenOf(r.contact, cwin); }],
    ["replied", "ردّوا", st.replied, function (r) { return repliedIn(r.contact, cwin); }],
    ["interested", "جهات مهتمة", st.interested, function (r) { return interestedOf(r.contact, cwin); }],
    ["silent", "شوهدت دون ردّ", seenSilent.length, function (r) { return r.contact && atOrAfter((r.contact.statusTimes || {}).read, cwin) && !repliedIn(r.contact, cwin); }],
    ["failed", "فشل الإرسال", st.failed, function (r) { return r.contact && atOrAfter((r.contact.statusTimes || {}).failed, cwin) && !atOrAfter((r.contact.statusTimes || {}).delivered, cwin); }]
  ];
  var active = filters.find(function (f) { return f[0] === campFilter; }) || filters[0];
  var q = rQ.trim();
  var shown = rows.filter(active[3]).filter(function (r) { return !q || (r.contact && (r.contact.waName || "").includes(q)) || (r.name || "").includes(q) || r.phone.includes(q); });
  lastDetailCohort = {
    label: active[1].replace(/[✓⭐]/g, "").trim(), campaign: camp.name,
    targets: shown.map(function (r) { return { phone: r.phone, name: (r.contact && r.contact.waName) || r.name || "" }; })
  };
  crmLastShown = shown.map(function (r) { return r.phone; });

  h += '<div class="tblwrap"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #EAECF0;background:#fff;">' +
    '<span style="font-size:13px;font-weight:700;color:#101828;flex:none;">جهات الاستهداف</span>' +
    '<span style="font-size:11px;color:#98A2B3;flex:none;">' + fmtN(shown.length) + ' من ' + fmtN(rows.length) + '</span>' +
    '<span style="flex:1;"></span>' +
    (shown.length ? '<button class="btn" style="padding:7px 14px;font-size:11.5px;border-radius:999px;color:#8a6d10;background:rgba(201,162,39,.14);border:1px solid rgba(201,162,39,.45);font-weight:700;" onclick="startRetarget()">⟲ إعادة استهداف هذه الفئة (' + fmtN(shown.length) + ')</button>' : "") +
    filters.map(function (f) {
      return '<button class="btn" style="padding:6px 12px;font-size:11.5px;border-radius:999px;' +
        (campFilter === f[0] ? 'color:#2E7D77;background:#DCF1EF;border:1px solid #3FB6B0;' : 'color:#475467;background:#fff;border:1px solid #EAECF0;') +
        '" onclick="crmSetCampFilter(&quot;' + f[0] + '&quot;)">' + f[1] + ' (' + fmtN(f[2]) + ')</button>';
    }).join("") +
    '<input id="rq" value="' + esc(rQ) + '" oninput="rSearch(this)" placeholder="بحث…" style="font-family:inherit;font-size:11.5px;border:1px solid #EAECF0;border-radius:999px;padding:7px 13px;background:#F9FAFB;width:130px;">' +
    '</div>';
  var allOnD = shown.length > 0 && shown.every(function (r) { return crmSelD[r.phone]; });
  h += '<div style="display:flex;align-items:center;gap:8px;padding:9px 16px;border-bottom:1px solid #F2F4F7;background:#F9FAFB;">' +
    '<span class="selcell" style="opacity:1;"><input type="checkbox" aria-label="تحديد المعروض"' + (allOnD ? " checked" : "") + ' onclick="crmTogglePageD()"></span>' +
    '<span style="font-size:11px;color:#667085;">حدِّد جهات بعينها لإعادة استهدافها — بدل الفئة كاملة.</span></div>';
  h += (shown.length ? crmTargetRows(shown, cwin) : '<div style="padding:30px;text-align:center;color:#98A2B3;font-size:12.5px;">لا نتائج</div>') + '</div>';
  h += crmDetailBulkBar(camp);
  return h;
}

/* The existing contactRowsHtml owns the row's visual language and its status/interest logic. We keep
   it as the single source and only prepend the selection cell, rather than forking that markup. */
function crmTargetRows(shown, cwin) {
  var out = '<div>';
  shown.forEach(function (r) {
    var on = !!crmSelD[r.phone];
    out += '<div style="display:flex;align-items:stretch;" class="krow' + (on ? " sel" : "") + '">' +
      '<div class="selcell" style="border-bottom:1px solid #F2F4F7;"><input type="checkbox" aria-label="تحديد ' + esc(r.phone) + '"' + (on ? " checked" : "") + ' onclick="event.stopPropagation();crmToggleD(&quot;' + esc(r.phone) + '&quot;)"></div>' +
      '<div style="flex:1;min-width:0;">' + contactRowsHtml([r], cwin) + '</div></div>';
  });
  out += '</div>';
  return out;
}

/* Measured after layout, again once the webfont swaps (the swap is the real reason a length proxy
   was reached for), and on a debounced resize. Never measures the unclamped node. */
function crmMeasureMsg() {
  var el = document.getElementById("crmmsg"), more = document.getElementById("crmmsgmore");
  if (!el || !more) return;
  if (crmMsgOpen) { more.style.display = ""; return; }
  more.style.display = (el.scrollHeight > el.clientHeight + 1) ? "" : "none";
}
window.addEventListener("resize", function () {
  clearTimeout(window.__crmrz); window.__crmrz = setTimeout(crmMeasureMsg, 150);
});
try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(crmMeasureMsg); } catch (e) {}

/* ============================== the guarded entry ==============================
   dashboard.ts's render() calls ONLY this. Two jobs:
   1. Boot assertion (ADR-0001's runtime half). tsc and node --check are structurally blind to this
      code — it is a string inside a template literal — so the helpers this module reuses are checked
      at runtime. A missing helper throws, which surfaces as a pageerror, which smoke.py already
      fails on. That is the only mechanism that can catch this class before production.
   2. Degrade, never blank. A fault in the new views falls back to the original vKmon/vKmonDetail
      rather than painting an empty campaigns screen — the exact failure ADR-0001 was written for. */
function crmBoot() {
  var need = {
    campStats: typeof campStats, campWin: typeof campWin, atOrAfter: typeof atOrAfter,
    seenOf: typeof seenOf, repliedIn: typeof repliedIn, interestedOf: typeof interestedOf,
    contactByPhone: typeof contactByPhone, contactRowsHtml: typeof contactRowsHtml,
    campIsTest: typeof campIsTest, fmtN: typeof fmtN, fmtD: typeof fmtD, esc: typeof esc, ic: typeof ic,
    vKmon: typeof vKmon, vKmonDetail: typeof vKmonDetail
  };
  var missing = Object.keys(need).filter(function (k) { return need[k] !== "function"; });
  if (missing.length) throw new Error("campaigns-crm: missing helpers " + missing.join(", "));
}
var crmBooted = false;
function crmCampaignsHtml(campId) {
  try {
    if (!crmBooted) { crmBoot(); crmBooted = true; }
    return campId ? vKmonDetailCrm(campId, cache) : vKmonCrm(cache);
  } catch (e) {
    /* Say it out loud rather than silently serving the old screen: a fallback nobody knows about is
       how a regression lives for a week. */
    try { console.error("campaigns-crm fell back:", e); } catch (e2) {}
    try {
      return campId ? vKmonDetail(campId, cache) : vKmon(cache);
    } catch (e3) {
      /* Last resort. If the ORIGINAL view is what broke, calling it from the catch propagates out
         of render() and b.innerHTML is never assigned — a blank screen, which is the exact failure
         ADR-0001 was written after. Say something rather than nothing. */
      try { console.error("campaigns-crm fallback also failed:", e3); } catch (e4) {}
      return '<div class="empty" style="padding:60px 20px;"><div class="t">تعذّر عرض الحملات</div>' +
        '<div class="s">أعد تحميل الصفحة. إن تكرر الأمر، فالمشكلة في هذا الإصدار وليست في بياناتك.</div></div>';
    }
  }
}

/* ================================= handlers ================================= */
var crmLastShown = [];
window.crmSetView = function (v) { crmView = v; crmClear(); render(false); };
window.crmSetGroup = function (k) { crmSetActiveKey(k); render(false); };
window.crmToggleMsg = function () { crmMsgOpen = !crmMsgOpen; render(false); };
window.crmSetDetailTab = function (t) { crmDetailTab = t; render(false); };
window.crmGoFilter = function (f) { crmDetailTab = "targets"; campFilter = f; render(false); };
/* Changing the filter must drop the selection: a hidden selection reaching a bulk action is exactly
   the "emitted values must be readable" defect class. */
window.crmSetCampFilter = function (f) {
  var n = crmSelPhones().length;
  campFilter = f; crmSelD = {};
  if (n) alertBar("أُلغي تحديد " + fmtN(n) + " عند تغيير التصفية", false);
  render(false);
};
window.crmToggle = function (id) { if (crmSel[id]) delete crmSel[id]; else crmSel[id] = true; render(false); };
window.crmToggleD = function (ph) { if (crmSelD[ph]) delete crmSelD[ph]; else crmSelD[ph] = true; render(false); };
window.crmClear = function () { crmSel = {}; render(false); };
window.crmClearD = function () { crmSelD = {}; render(false); };
/* FR-6. Distinct from select-page: this reaches the matches LIST_CAP hides. Named and counted so
   the operator knows the difference between "the 60 I can see" and "the 137 that match". */
window.crmSelectAllMatching = function () {
  var all = crmFiltered();
  all.forEach(function (x) { crmSel[x.c.id] = true; });
  render(false);
  alertBar("حُدِّدت " + fmtN(all.length) + " حملة مطابقة، بما فيها غير المعروضة", false);
};
window.crmTogglePage = function () {
  var shown = crmFiltered().slice(0, LIST_CAP);
  var allOn = shown.length > 0 && shown.every(function (x) { return crmSel[x.c.id]; });
  shown.forEach(function (x) { if (allOn) delete crmSel[x.c.id]; else crmSel[x.c.id] = true; });
  var total = crmFiltered().length;
  if (!allOn && total > shown.length) alertBar("حُدِّدت " + fmtN(shown.length) + " المعروضة فقط — من " + fmtN(total) + "، والباقي غير مشمول", false);
  render(false);
};
window.crmTogglePageD = function () {
  var allOn = crmLastShown.length > 0 && crmLastShown.every(function (p) { return crmSelD[p]; });
  crmLastShown.forEach(function (p) { if (allOn) delete crmSelD[p]; else crmSelD[p] = true; });
  render(false);
};
/* Reclassify each selected campaign through the SAME endpoint the single-row button uses. Partial
   failure is reported with its count rather than swallowed. NO SEND PATH EXISTS HERE. */
var crmBulkBusy = false;
window.crmBulkClass = async function (test) {
  /* Re-entrancy guard: the bar stays on screen while the requests run, and a second click would
     otherwise fire an overlapping batch against the same ids. */
  if (crmBulkBusy) return;
  var ids = crmSelIds().map(Number);
  var targets = ids.filter(function (id) {
    var c = campaigns.find(function (x) { return Number(x.id) === id; });
    return c && campIsTest(c) !== Boolean(test);
  });
  if (!targets.length) return;
  crmBulkBusy = true;
  var ok = 0, fail = 0, next = 0, failed = [];
  /* Bounded concurrency rather than one-at-a-time: 400 selected campaigns was 400 sequential
     round-trips with the operator staring at a frozen bar. Bounded rather than unbounded so a
     large selection cannot open 400 sockets at once against our own admin endpoint. */
  var LANES = 4;
  async function lane() {
    while (next < targets.length) {
      var id = targets[next++];
      try {
        var r = await fetch("/admin/campaign/test", {
          method: "POST",
          headers: { "content-type": "application/json", "x-admin-token": TOKEN },
          body: JSON.stringify({ id: id, test: Boolean(test) })
        });
        if (r.ok) {
          ok++;
          var cp = campaigns.find(function (x) { return Number(x.id) === id; });
          if (cp) cp.test = Boolean(test);   /* only on a confirmed write */
        } else { fail++; failed.push(id); }
      } catch (e) { fail++; failed.push(id); }
    }
  }
  var lanes = [];
  for (var i = 0; i < Math.min(LANES, targets.length); i++) lanes.push(lane());
  await Promise.all(lanes);
  crmBulkBusy = false;
  /* Keep the failures selected. «تعذّر ٣ — أعد المحاولة» with an empty selection is an instruction
     the operator cannot follow: they would have to work out which three. */
  crmSel = {};
  failed.forEach(function (id) { crmSel[id] = true; });
  render(false);
  alertBar(fail ? "غُيّر تصنيف " + fmtN(ok) + " وتعذّر " + fmtN(fail) + " — أعد المحاولة"
                : "غُيّر تصنيف " + fmtN(ok) + " حملة", !!fail);
};
window.crmExportSel = function () {
  var ids = crmSelIds();
  var rows = [["الحملة", "الخدمة", "التاريخ", "الجمهور", "وصلت", "شوهدت", "ردّوا", "جهات مهتمة"]];
  ids.forEach(function (id) {
    var c = campaigns.find(function (x) { return String(x.id) === String(id); });
    if (!c) return;
    var st = campStats(c);
    rows.push([c.name, c.product || "", fmtD(c.created_at), st.targeted, st.delivered, st.seen, st.replied, st.interested]);
  });
  crmDownloadCsv(rows, "massar-campaigns-selected.csv");
  alertBar("صُدّرت " + fmtN(ids.length) + " حملة", false);
};
window.crmExportSelTargets = function () {
  var ph = crmSelPhones();
  var rows = [["الرقم", "الاسم"]];
  ph.forEach(function (p) {
    var c = contactByPhone(p);
    rows.push([p, (c && c.waName) || ""]);
  });
  crmDownloadCsv(rows, "massar-targets-selected.csv");
  alertBar("صُدّرت " + fmtN(ph.length) + " جهة", false);
};
function crmDownloadCsv(rows, filename) {
  var safe = function (x) { var v = String(x); if (/^[=+\\-@\\t\\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  var csv = "\\ufeff" + rows.map(function (r) { return r.map(safe).join(","); }).join("\\n");
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename; a.click();
}
/* The whole point of selection: hand the wizard the EXPLICIT subset instead of the whole filter.
   This stages a cohort and stops — the launch itself remains behind the wizard's human gate. */
window.crmRetargetSel = function () {
  var ph = crmSelPhones();
  if (!ph.length) return;
  var camp = campaigns.find(function (x) { return String(x.id) === String((location.hash || "").split("/")[1]); });
  lastDetailCohort = {
    label: "مختارة يدويًا",
    campaign: camp ? camp.name : "",
    targets: ph.map(function (p) { var c = contactByPhone(p); return { phone: p, name: (c && c.waName) || "" }; })
  };
  crmSelD = {};
  startRetarget();
};
/* ---- wrap the pre-existing state changers so a selection cannot outlive its rows ----
   These four are the handlers that change WHICH rows are on screen. They live in dashboard.ts and
   are deliberately not edited there: wrapping keeps the seam to two anchored interpolations, and
   keeps the rule in one place instead of four. */
var _origSetCampTab = window.setCampTab;
window.setCampTab = function (t) { crmDropSel("list"); if (_origSetCampTab) _origSetCampTab(t); };
var _origCampSearchFn = window.campSearchFn;
window.campSearchFn = function (el) { crmDropSel("list"); if (_origCampSearchFn) _origCampSearchFn(el); };
var _origRSearch = window.rSearch;
window.rSearch = function (el) { crmDropSel("targets"); if (_origRSearch) _origRSearch(el); };
var _origSetCampSort = window.setCampSort;
window.setCampSort = function (el) { crmDropSel("list"); if (_origSetCampSort) _origSetCampSort(el); };
/* Moving between campaigns must not carry a cohort with it — the wizard would be handed campaign
   A's phone numbers under campaign B's name. */
window.addEventListener("hashchange", function () { crmSelD = {}; crmSel = {}; });

window.crmDragStart = function (e, id) { crmDragId = id; try { e.dataTransfer.effectAllowed = "move"; } catch (err) {} };
window.crmDragEnd = function () { crmDragId = null; };
window.crmDragOver = function (e, el) { e.preventDefault(); if (el) el.classList.add("over"); };
window.crmDragLeave = function (el) { if (el) el.classList.remove("over"); };
window.crmDrop = function (e, token, el) {
  e.preventDefault();
  if (el) el.classList.remove("over");
  if (crmDragId === null) return;
  /* A stable token, never the rendered label: «تجريبية» is also a column on the حالة الأداء board,
     so keying the write on the visible string would write the wrong flag the moment another board
     is made draggable. Anything that is not the test token is refused rather than assumed. */
  if (token !== "test" && token !== "real") return;
  var want = token === "test";
  var c = campaigns.find(function (x) { return Number(x.id) === Number(crmDragId); });
  crmDragId = null;
  if (!c || campIsTest(c) === want) return;
  setCampClass(c.id, want);
};
/* ========================= end campaigns-crm (client) ========================= */
`;
