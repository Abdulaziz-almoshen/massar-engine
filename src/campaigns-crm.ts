// campaigns-crm.ts — «الحملات»: the list, the three views over it, and the campaign record.
//
// WHY THIS FILE EXISTS. dashboard.ts is ONE template literal with the whole client script inside it,
// and ADR-0001 forbids range edits there. So the screen lives here as two exported strings that
// dashboard.ts interpolates at two anchor points. Everything below is CLIENT JS: it is appended into
// the same <script> scope as the original views, which is deliberate — it lets these views call
// campStats, campWin, atOrAfter, seenOf, repliedIn, interestedOf, esc, fmtN, fmtD, ic and
// contactByPhone directly instead of reimplementing them. Product discovery named that
// reimplementation as the exact path by which round-22's invented numbers would come back, so there
// is ONE definition of every statistic and this file owns none of them.
//
// PORTED to the new design system (docs/PORT-SPEC.md). Both screens are wrapped in .ds6 and the
// nine-track .crow grid is gone: the list, every group and the campaign's target cohort are real
// .m-table elements inside .m-tablewrap, the board is .m-board/.m-col/.m-deal, the record's tabs are
// .m-tabs, and every figure goes through .m-n or dsFig. Every empty cell states WHICH KIND of
// absence it is; there is no bare em-dash left on either screen.
//
// TWO DEFECTS FIXED IN THE SAME PASS, both of them figures the records do not support:
//   1. «أبرز الأسباب» was the mode of a loss-cause tally with NO MINIMUM and no count rendered, so a
//      single lost deal carrying a cause was printed as the campaign's leading reason. The count is
//      now printed with its denominator, and the card is suppressed unless the cause was recorded on
//      at least two deals — one lost deal is an anecdote, not a pattern.
//   2. A verdict tile labelled «جهات مهتمة لكل 100» rendered its unit as «٪», stating the unit twice
//      in two different systems. It is one measure and it is a percentage, so it is named as one:
//      «نسبة الجهات المهتمة», with «من جهات الاستهداف» underneath saying what it is measured on.
//
// SMOKE LANDMARKS: #kmon asserts «كانبان» (the view switch, which renders before any fetch) and
// accepts «لا حملات بعد» as an honest empty render; #kmon/<id> asserts «حكم الحملة». None of the
// three may be reworded without smoke.py.
//
// NO HANDLER IN THIS FILE SENDS A WHATSAPP MESSAGE. The only network call is the pre-existing
// POST /admin/campaign/test (reclassify), reached through the pre-existing setCampClass.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included — and exactly four in the file, the two
// template-literal delimiters (check-numerals asserts the count).

export const CAMPAIGNS_CRM_CSS = `
  /* ===== what this file still owns for OTHER screens =====
     These are not the campaign screen's classes any more — it is fully on the m-* vocabulary. They
     are declared here because dashboard.ts's own legacy views (the fallback vKmon/vKmonDetail, the
     services board and the opportunity groups), indicators-crm and record-tabs still render them,
     and those files are not ported. They come out with the last screen, not with this one.
     .bulkbar is the exception that is still LIVE here: a floating action bar over a table is the one
     thing the vocabulary has no equivalent for, and both this screen and جهات الاستهداف use it. */
  .crmbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:12px 16px;
    background:#fff; border:1px solid #ECEEF2; border-radius:13px; margin-bottom:14px; }
  .crmbar .hair { width:1px; height:22px; background:#ECEEF2; flex:none; }
  .vtog { display:inline-flex; background:#E5E8EE; border-radius:999px; padding:3px; flex:none; }
  .vtog button { font-family:inherit; font-size:12px; font-weight:600; color:#545A66; background:transparent;
    border:none; border-radius:999px; padding:7px 15px; cursor:pointer; white-space:nowrap; }
  .vtog button.on { background:#fff; color:#2563EB; box-shadow:0 1px 3px rgba(16,24,40,.10); }
  .qpill { font-family:inherit; font-size:12px; font-weight:600; border-radius:999px; padding:7px 13px;
    cursor:pointer; white-space:nowrap; color:#33373E; background:#fff; border:1px solid #ECEEF2; }
  /* --accent on --blue-wash is 4.18 — below the floor, and this is the SELECTED state, so the
     chip a person just clicked was the least readable one on the row. --accent-deep is 6.32. */
  .qpill.on { color:#1A47BE; background:#DCE8FC; border-color:#5B8DEF; }
  .crmsel { font-family:inherit; height:38px; border:1px solid #ECEEF2; border-radius:999px;
    background:#EFF1F5; color:#14161A; font-size:12px; font-weight:600; padding:0 12px; cursor:pointer; }
  .crmflat { background:var(--paper); border:0; border-radius:var(--r-md);
             box-shadow:var(--sh-1); overflow:hidden; margin-bottom:var(--s4); }
  .crmgrid { min-width: 940px; }
  .crmflat .thead { position:sticky; inset-block-start:0; background:var(--surface);
                    z-index:var(--z-sticky); border-block-end:1px solid var(--line); }
  .thead-narrow { display:none; align-items:center; gap:10px; padding:12px 16px; background:#EFF1F5;
    border-block-end:1px solid #ECEEF2; font-size:12px; font-weight:600; color:#656B76; }
  @media (max-width: 939px) {
    .crmgrid { min-width: 0; }
    .thead-wide { display:none; }
    .thead-narrow { display:flex; }
  }
  /* the KPI card dashboard.ts draws on الرئيسية; revamp.ts gives it radius and shadow, this gives
     it its ground */
  .kcard { background:#fff; border:1px solid #ECEEF2; }
  /* the skeleton row record-tabs.ts writes while a tab loads */
  @keyframes crmpulse { 0%,100% { opacity:1; } 50% { opacity:.45; } }
  .skel-row { display:grid; grid-template-columns:40px 2fr 1.1fr 1.5fr 1fr; gap:12px;
    padding:8px 20px 8px 12px; border-top:1px solid #ECEEF2; align-items:center; }
  .skel-row > i { display:block; height:12px; border-radius:4px; background:#ECEEF2;
    animation:crmpulse 1.4s ease-in-out infinite; }
  .skel-row > i:nth-child(2) { width:70%; } .skel-row > i:nth-child(3) { width:50%; }
  .skel-row > i:nth-child(4) { width:60%; } .skel-row > i:nth-child(5) { width:40%; }
  @media (prefers-reduced-motion: reduce) { .skel-row > i { animation:none; } }

  /* ===== the floating bulk bar, on the new system's tokens =====
     Selection acts on rows you can see, and the bar has to clear the table without covering the
     row that is selected — so it is fixed to the block-end edge, above alertBar's z-index, which
     occluded it for its whole first life. */
  .bulkbar { position:fixed; inset-block-end:18px; inset-inline:0; display:flex; justify-content:center;
    z-index:var(--z-toast); pointer-events:none; padding-inline:12px; }
  .bulkbar > div { pointer-events:auto; display:flex; align-items:center; gap:9px; flex-wrap:wrap;
    background:var(--m-ink, #17201F); color:#fff; border-radius:var(--m-r-chip, 999px);
    padding:9px 14px; max-inline-size:92vw; box-shadow:var(--m-lift, 0 12px 32px rgba(16,24,40,.28)); }
  .bulkbar .cnt { font-size:13px; font-weight:600; background:rgba(255,255,255,.14);
    border-radius:999px; padding:5px 12px; white-space:nowrap; }
  .bulkbar button, .bulkbar select { font-family:inherit; font-size:13px; font-weight:600;
    border-radius:999px; padding:7px 13px; cursor:pointer; border:1px solid rgba(255,255,255,.22);
    background:transparent; color:#fff; white-space:nowrap; min-block-size:34px;
    transition:background-color var(--m-out, 120ms) var(--m-ease, ease); }
  .bulkbar select { background:#fff; color:#14161A; border-color:#fff; }
  .bulkbar button.pri { background:#5B8DEF; border-color:#5B8DEF; color:#14161A; }
  .bulkbar button.x { border:none; background:transparent; font-size:16px; padding:4px 8px; }
  .bulkbar button:focus-visible, .bulkbar select:focus-visible { outline:2px solid #fff; outline-offset:2px; }
  @media (hover:hover) and (pointer:fine) { .bulkbar button:hover { background:rgba(255,255,255,.14); } }
  @media (pointer:coarse) { .bulkbar button, .bulkbar select { min-block-size:44px; } }
  @media (prefers-reduced-motion: reduce) { .bulkbar button { transition:none; } }

  /* ===== the campaign screens, on the m-* vocabulary =====
     Only what the vocabulary genuinely lacks survives here: the quoted WhatsApp message (a real
     surface with its own two grounds, both measured), the row meter, and the board card's own
     figure line. */
  .ds6 .cx { display:flex; flex-direction:column; gap:var(--m-4); }
  .ds6 .cx-tbl .m-table { min-inline-size:940px; }
  /* A FILTER BAR IS A ROW, NOT A STACK. .m-input and .m-select are authored at inline-size:100%
     for a form field, which is right inside .m-form and wrong inside a filter bar: every control
     then claims a full line and five filters become five rows. Sized here rather than in the
     vocabulary because massar-ds-crm.ts is generated. */
  .ds6 .cx .m-tools .m-input, .ds6 .cx .m-tools .m-select { inline-size:auto; flex:0 1 auto;
    min-inline-size:176px; max-inline-size:320px; }
  .ds6 .cx .m-tools .m-head__a { flex:1 1 auto; }
  .ds6 .cx-sub { display:block; font-weight:400; margin-block-start:2px; }
  .ds6 .cx-clip { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-inline-size:30ch; }
  .ds6 .cx-prog { display:flex; align-items:center; gap:var(--m-2); min-inline-size:0; }
  .ds6 .cx-prog .m-meter { margin-block:0; flex:1 1 auto; min-inline-size:56px; }
  .ds6 .cx-dot { inline-size:9px; block-size:9px; border-radius:50%; flex:none; display:inline-block; }
  /* The board card is an ANCHOR here — the whole card opens the campaign — and .m-deal is authored
     for the opportunity board's draggable div, so it carries no link reset. Without this every
     card title renders underlined in the page's default link ink. */
  .ds6 a.m-deal { text-decoration:none; color:inherit; display:block; }
  .ds6 .m-deal__n { display:flex; align-items:center; gap:6px; }
  .ds6 .m-deal__p { display:block; }
  /* BRIDGE, not a second vocabulary. chipRow() and interestChips() come from dashboard.ts and own
     the status and interest reading — they are called rather than forked, so there is one
     definition of what a status chip means — but they still emit .chip with the old tokens, and
     that file is under ADR-0001. The old class is re-drawn on the new system's tokens INSIDE .ds6
     only, so one table does not carry two chip designs. It comes out when dashboard.ts is ported. */
  .ds6 .cx .m-table .chip { display:inline-flex; align-items:center; gap:4px; font-size:var(--m-t-micro);
    font-weight:600; border-radius:var(--m-r-chip); padding-inline:9px; padding-block:2px;
    background:var(--m-sunk); border:0; color:var(--m-ink-2); white-space:nowrap; }
  .ds6 .cx .m-table .chip.c-ok { background:var(--m-ok-dim); color:var(--m-ok); }
  .ds6 .cx .m-table .chip.c-warn { background:var(--m-warn-dim); color:var(--m-warn); }
  .ds6 .cx .m-table .chip.c-bad { background:var(--m-bad-dim); color:var(--m-bad); }
  .ds6 .cx .m-table .chip.c-blue, .ds6 .cx .m-table .chip.c-teal { background:var(--m-ac-dim); color:var(--m-ac-deep); }

  /* the message, quoted on WhatsApp's own wallpaper. #54594B clears 4.5 on BOTH grounds — the
     wallpaper at 5.37 and the bubble at 6.29 — and is the one ink allowed on either. */
  .ds6 .cx-wa { flex:1 1 260px; min-inline-size:0; background:#E5DDD4; border-radius:var(--m-r-card); padding:11px; }
  .ds6 .cx-bub { background:#DCF8C6; border-radius:9px; padding:10px 12px; font-size:var(--m-t-cap);
    color:#14161A; line-height:24px; white-space:pre-wrap; overflow-wrap:anywhere; }
  /* line-height and the clamp height are both in px on purpose: -webkit-line-clamp only works on
     display:-webkit-box and the computed display here resolves to flow-root, so an explicit
     max-height of exactly two line-heights is what clips on a line boundary. */
  .ds6 .cx-bub.clamp { max-block-size:48px; overflow:hidden; }
  .ds6 .cx-spec { display:flex; gap:var(--m-5); flex-wrap:wrap; align-items:flex-start; }
  .ds6 .cx-spec__f { flex:none; min-inline-size:150px; display:flex; flex-direction:column; gap:var(--m-3); }

  /* the board card's figure line: four label/value pairs that must stay on one reading line */
  .ds6 .cx-kf { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 10px;
    border-block-start:1px solid var(--m-line); margin-block-start:var(--m-2); padding-block-start:var(--m-2); }
  .ds6 .cx-kf .kl { font-size:var(--m-t-micro); color:var(--m-mut); }
  .ds6 .cx-kf .kv { font-size:var(--m-t-cap); font-weight:600; color:var(--m-ink); }
  .ds6 .cx-kf .kb { color:var(--m-bad); font-size:var(--m-t-micro); font-weight:600; }

  /* the next-step strip and its cards: a leading rule in the tone of what it is about */
  /* SPECIFICITY. massar-ds-crm.ts is interpolated AFTER every module stylesheet, so a rule that
     only matches a private class loses to the .m-card rule it overrides at equal weight. */
  .ds6 .m-card.cx-move { border-inline-start:3px solid var(--tn, var(--m-ac)); }
  .ds6 .cx-moves { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:var(--m-3); }

  @media (max-width: 939px) { .ds6 .cx-tbl .m-table { min-inline-size:680px; } }
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
/* The five states, declared ONCE and in board order. campPerfState selects from this table and the
   kanban seeds its empty columns from it, so a renamed label cannot leave the board saying one
   thing and the row chip another — the drift the check:crm assertion exists to catch. The tone is
   the vocabulary's own status chip: colour means status, never decoration. */
var CRM_PERF = [
  { key: "test",       label: "تجريبية",       cls: "m-chip--warn",  dot: "var(--m-warn)" },
  { key: "noaudience", label: "بلا جمهور",     cls: "m-chip--plain", dot: "var(--m-idle)" },
  { key: "unsent",     label: "لم تُرسل بعد",   cls: "m-chip--plain", dot: "var(--m-idle)" },
  { key: "replied",    label: "فيها ردود",     cls: "m-chip--ok",    dot: "var(--m-ok)" },
  { key: "silent",     label: "بلا ردود بعد",  cls: "m-chip--ac",    dot: "var(--m-ac)" }
];
function crmPerf(key) {
  for (var i = 0; i < CRM_PERF.length; i++) if (CRM_PERF[i].key === key) return CRM_PERF[i];
  return CRM_PERF[CRM_PERF.length - 1];
}
function campPerfState(c, st) {
  if (campIsTest(c)) return crmPerf("test");
  /* «بلا ردود بعد» on a campaign that was never sent is the same invented state the hero used to
     carry. The distinction crmVerdict() learned has to reach the chip, the board column, the group
     header and the record header — a vocabulary that exists on one screen is a contradiction. */
  if (!st.targeted) return crmPerf("noaudience");
  if (!crmWasSent(st)) return crmPerf("unsent");
  if (st.replied > 0) return crmPerf("replied");
  return crmPerf("silent");
}
function crmChip(ps) { return '<span class="m-chip ' + ps.cls + '">' + ps.label + "</span>"; }
/* A rate with no denominator is not zero, it is unknown. Returning null (rendered as an absence) is
   the whole point: base=Math.max(1,targeted) used to print a confident 0٪ for a campaign with no
   audience. */
function crmRate(a, b) { return b ? Math.round(a / b * 100) : null; }
/* Delivery rates for a campaign that was never sent are undefined, not zero. */
function crmDeliveryRate(a, st) { return crmWasSent(st) ? crmRate(a, st.targeted) : null; }
/* The three numeric columns say «لم يُقَس», not WHY: the state column on the same row already says
   whether the campaign has no audience or has simply not been sent, and repeating the reason three
   times per row is how a reader learns to stop reading the column. */
function crmPctD(a, st) { var r = crmDeliveryRate(a, st); return r === null ? mNil("لم يُقَس", "none") : mPct(r); }
function crmPct(a, b) { var r = crmRate(a, b); return r === null ? mNil("لم يُقَس", "none") : mPct(r); }
/* SELECTION IS INTERSECTED WITH WHAT IS ON SCREEN, STRUCTURALLY.
   Clearing on every state change is necessary but not sufficient — it relies on remembering to call
   it from each of the four handlers, and a missed one stages the WRONG cohort into the launch
   wizard under a label naming the campaign you are looking at. So the accessors themselves refuse
   to return anything the operator cannot currently see: a hidden selection is unactionable by
   construction, not by discipline. Both layers are kept; this one is the guarantee. */
function crmVisibleIds() {
  /* Deliberately the whole filter match, NOT the page slice: «تحديد المطابقين» selects beyond what
     is rendered, and that is legitimate because the operator asked for it explicitly and the count
     says so. What must never be actionable is a selection the CURRENT FILTER excludes. */
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
   fabricated 0٪ removed from the rates beside it. */
function crmVerdict(st) {
  if (!st.targeted) return "لا جهات استهداف لهذه الحملة — لم يُرسل شيء.";
  if (st.replied) {
    return "وصلت إلى " + mN(st.delivered) + " جهة، ردّ " + mN(st.replied) + " منهم" +
      (st.interested ? " وأبدى " + mN(st.interested) + " اهتمامًا مؤهلًا" : "") + ".";
  }
  if (crmWasSent(st)) return "أُرسلت، وبانتظار الرد الأول.";
  return "لم يُسجَّل إرسال لهذه الحملة بعد.";
}

/* Drop the selection and say so. Silence here is how «2 محدَّدة» survives onto a screen showing
   two different campaigns' rows. */
function crmDropSel(which) {
  var n = which === "targets" ? Object.keys(crmSelD).length : Object.keys(crmSel).length;
  if (which === "targets") crmSelD = {}; else crmSel = {};
  if (n && typeof alertBar === "function") alertBar("أُلغي تحديد " + fmtN(n) + " عند تغيير العرض", false);
}

function crmMonth(ts) {
  return new Date(Number(ts)).toLocaleDateString("ar-SA-u-nu-latn", { month: "long", year: "numeric" });
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
/* The unit noun is four-way and agrees with its own count (PORT-SPEC §5). dsPageBar prints the
   number, so this returns the noun alone. */
function crmNoun(n) { return n === 1 ? "حملة" : n === 2 ? "حملتان" : (n >= 3 && n <= 10) ? "حملات" : "حملة"; }

/* The campaign count is printed on the «الكل» tab, beside the filter bar and in the pager, and the
   match count in two of those. Both are bound to the arrays they are counted from, so no two sites
   can disagree (PORT-SPEC §6). */
function crmBind() {
  dsD("crmAll", function () { return campaigns.length; });
  dsD("crmShown", function () { return crmFiltered().length; });
}

/* ------------------------------- control bar ------------------------------- */
function crmControlBar(nShown, nTotal) {
  var tabs = [["all", "الكل", campaigns.length],
    ["real", "فعلية", campaigns.filter(function (c) { return !campIsTest(c); }).length],
    ["test", "تجريبية", campaigns.filter(function (c) { return campIsTest(c); }).length]];
  /* Two controls, two different questions, so two different idioms: the tab rail chooses WHICH
     campaigns, the segmented control chooses HOW they are drawn. */
  var h = '<div class="m-tabs" role="tablist" aria-label="تصنيف الحملات">' + tabs.map(function (t) {
    return '<button type="button" class="m-tab" role="tab" aria-selected="' + (campTab === t[0]) + '"' +
      ' onclick="setCampTab(&quot;' + t[0] + '&quot;)">' + t[1] +
      "<b>" + (t[0] === "all" ? dsFig("crmAll", t[2]) : fmtN(t[2])) + "</b></button>";
  }).join("") + "</div>";

  h += '<div class="m-tools"><div class="m-head__a">';
  h += '<input class="m-input" id="campq" value="' + esc(campQ) + '" oninput="campSearchFn(this)" ' +
    'placeholder="ابحث في الحملات…" aria-label="بحث في الحملات">';
  if (campProd) h += '<button type="button" class="m-btn" aria-pressed="true" onclick="campClearProd()" title="إزالة تصفية المنتج">المنتج: ' + esc(campProd) + " &#215;</button>";
  /* SMOKE: «كانبان» is the landmark smoke.py asserts for #kmon, and it renders before any fetch. */
  h += '<span class="m-seg" role="group" aria-label="طريقة العرض">' +
    [["list", "قائمة"], ["group", "تجميع"], ["kanban", "كانبان"]].map(function (v) {
      return '<button type="button" aria-pressed="' + (crmView === v[0]) + '" onclick="crmSetView(&quot;' + v[0] + '&quot;)">' + v[1] + "</button>";
    }).join("") + "</span>";
  if (crmView === "list") {
    h += '<select class="m-select" aria-label="الترتيب" onchange="setCampSort(this)">' +
      '<option value="new"' + (campSortKey === "new" ? " selected" : "") + ">الأحدث أولًا</option>" +
      '<option value="replies"' + (campSortKey === "replies" ? " selected" : "") + ">الأكثر ردودًا</option>" +
      '<option value="seen"' + (campSortKey === "seen" ? " selected" : "") + ">الأكثر مشاهدة</option></select>";
  } else {
    h += '<select class="m-select" aria-label="مفتاح التجميع" onchange="crmSetGroup(this.value)">' +
      CRM_KEYS.map(function (k) {
        return '<option value="' + k[0] + '"' + (crmActiveKey() === k[0] ? " selected" : "") + ">" +
          (crmView === "kanban" ? "لوحة: " : "تجميع حسب: ") + k[1] + "</option>";
      }).join("") + "</select>";
  }
  h += '<button type="button" class="m-btn" onclick="exportCampaigns()">' + ic("doc", 15) + " تصدير CSV</button>";
  h += '</div><span class="m-cap">' + dsFig("crmShown", nTotal) + " " + crmNoun(nTotal) + "</span></div>";
  /* Said ONCE, beside the selector that chose it, instead of repeated on every group header and
     again under the board. */
  if (crmView !== "list") {
    var kd = crmKeyDef(crmActiveKey());
    h += '<p class="m-meta">' + esc(kd[1]) + " — " + esc(kd[3]) +
      (crmView === "kanban" && crmActiveKey() !== "class" ? " · هذه اللوحة للعرض فقط." : "") + "</p>";
  }
  return h;
}

/* ------------------------------- shared list plumbing ------------------------------- */
/* Exact product, set by the product record's «الحملات» link so the list shows exactly its count. */
var campProd = "";
window.campClearProd = function () { campProd = ""; render(false); };
function crmFiltered() {
  var q = campQ.trim();
  var list = campaigns.filter(function (c) {
    return (campTab === "all" || (campTab === "test") === campIsTest(c)) &&
      (!campProd || (c.product || "") === campProd) &&
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
  /* ONE icon with STATE, not two directional glyphs. The two actions are opposite ends of a single
     boolean, and it reuses the row's own status-dot colours so the dot above teaches the mapping.
     The directional title/aria-label stay — they are the a11y floor for an icon button. */
  var actTitle = isTest ? "إعادة الحملة إلى القائمة الفعلية" : "نقل الحملة إلى التجريبية";
  return "<tr" + (on ? ' aria-selected="true"' : "") + ">" +
    '<td class="m-sel"><input type="checkbox" class="m-cb" aria-label="تحديد ' + esc(c.name) + '"' + (on ? " checked" : "") + ' onclick="crmToggle(' + c.id + ')"></td>' +
    '<td class="m-td-n"><span class="cx-dot" style="background:' + (isTest ? "var(--m-idle)" : "var(--m-ac)") + '" role="img" aria-label="' + (isTest ? "حملة تجريبية" : "حملة فعلية") + '"></span> ' +
      '<a class="m-link" href="#kmon/' + c.id + '">' + esc(c.name) + "</a>" +
      '<span class="cx-sub m-meta">' + fmtD(c.created_at) + "</span></td>" +
    '<td><span class="cx-clip">' + (c.product ? esc(c.product) : mNil("بلا خدمة", "unset")) + "</span>" +
      /* BR-MON-001 / BR-CAM-001: the objective the campaign was launched for, and whether it came
         from a Massar recommendation — the two things a report groups a campaign by. */
      (c.objective && typeof CAMPAIGN_OBJECTIVE_LABELS !== "undefined"
        ? '<span class="cx-sub m-meta">' + esc(CAMPAIGN_OBJECTIVE_LABELS[c.objective] || "") + "</span>" : "") +
      (c.origin && c.origin.suggestionKey
        ? ' <span class="m-chip m-chip--plain" title="' + (c.origin.rule === "indicator" ? "مبنية على قائمة مؤشر استخدام" : "مبنية على توصية من مسار") + '">' +
          (c.origin.rule === "indicator" ? "من مؤشر" : "من توصية") + "</span>" : "") + "</td>" +
    "<td>" + crmChip(ps) + "</td>" +
    '<td class="m-td-v">' + mN(st.targeted) + "</td>" +
    '<td class="m-td-v">' + crmPctD(st.seen, st) + "</td>" +
    '<td class="m-td-v">' + crmPctD(st.replied, st) + "</td>" +
    "<td>" + (prog === null
      ? mNil("بلا جمهور", "none")
      : !crmWasSent(st)
      ? mNil("لم تُرسل بعد", "none")
      : '<span class="cx-prog"><span class="m-meter"><i style="--m-pct:' + prog + '%"></i></span>' + mPct(prog) + "</span>") + "</td>" +
    '<td><button type="button" class="m-btn m-btn--icon" title="' + actTitle + '" aria-label="' + actTitle + '" onclick="setCampClass(' + c.id + ',' + (isTest ? "false" : "true") + ')">' +
      ic("target", 17) + "</button></td></tr>";
}

function crmHeaderRow(withSelectAll, allOn, nOver, nTotal) {
  var selAll = withSelectAll && nOver > 0
    ? ' <button type="button" class="m-link" onclick="crmSelectAllMatching()">تحديد المطابقين (' + fmtN(nTotal) + ")</button>"
    : "";
  var box = withSelectAll
    ? '<input type="checkbox" class="m-cb" aria-label="تحديد المعروض"' + (allOn ? " checked" : "") + ' onclick="crmTogglePage()">'
    : "";
  return "<thead><tr>" +
    '<th class="m-sel">' + box + "</th>" +
    "<th>الحملة" + selAll + "</th><th>الخدمة</th><th>الحالة</th>" +
    '<th class="num">الجمهور</th><th class="num">مشاهدة</th><th class="num">ردود</th>' +
    "<th>التقدّم</th><th>التصنيف</th></tr></thead>";
}

function crmListView(withStAll) {
  /* Paged, not truncated. At 200 launches the old slice made campaign 61 unreachable however the
     reader searched, under a line that said searching would reach it. */
  var withSt = pageSlice("kmon", withStAll);
  var nOver = withStAll.length - withSt.length;
  var allOn = withSt.length > 0 && withSt.every(function (x) { return crmSel[x.c.id]; });
  var h = '<section class="m-card m-card--pad0 cx-tbl"><div class="m-tablewrap">' +
    '<table class="m-table m-table--sticky">' + crmHeaderRow(true, allOn, nOver, withStAll.length) + "<tbody>";
  withSt.forEach(function (x) { h += crmRow(x.c, x.st); });
  if (!withSt.length) h += '<tr class="m-table__empty"><td colspan="9">' + crmEmptyList() + "</td></tr>";
  h += "</tbody></table></div>";
  h += '<div class="m-foot">' + dsPageBar("kmon", withStAll.length, crmNoun(withStAll.length), "crmShown") +
    '<span class="m-cap">' + ic("clock", 14) + " الأرقام تُحدَّث لحظيًا من حالات تسليم واتساب. لا تقديرات.</span></div></section>";
  return h;
}

function crmEmptyList() {
  if (campQ.trim()) {
    return '<div class="m-empty"><p class="m-empty__t">لا حملة تطابق «' + esc(campQ.trim()) + "»</p>" +
      '<p class="m-empty__d">امسح البحث أو جرّب تبويبًا آخر.</p></div>';
  }
  return '<div class="m-empty"><p class="m-empty__t">لا حملات في هذا التبويب</p>' +
    '<p class="m-empty__d">يمكن اختيار «الكل» أو إطلاق حملة</p></div>';
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
     empty rather than hiding it, so «تجريبية: 0» is visible instead of silently missing.
     Only seed an empty group the CURRENT filter could actually contain. Seeding «تجريبية 0» while
     the فعلية tab reads «تجريبية (1)» puts two different counts of the same thing on one screen. */
  if (crmActiveKey() === "class") {
    ["فعلية", "تجريبية"].forEach(function (k) {
      var excluded = (campTab === "real" && k === "تجريبية") || (campTab === "test" && k === "فعلية");
      if (!by[k] && !excluded) { by[k] = []; order.push(k); }
    });
  }
  if (crmActiveKey() === "perf") CRM_PERF.map(function (x) { return x.label; }).forEach(function (k) { if (!by[k]) { by[k] = []; order.push(k); } });
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
    return '<div class="m-alert">' + ic("eye", 16) +
      '<span class="m-alert__d">كل الحملات في مجموعة واحدة حسب <b>' + esc(g.def[1]) + "</b> — التجميع لا يضيف شيئًا هنا.</span>" +
      '<button type="button" class="m-btn" onclick="crmSetView(&quot;list&quot;)">عد إلى القائمة</button></div>' +
      crmListView(withStAll);
  }
  var h = "";
  g.order.forEach(function (k) {
    var rows = g.by[k].slice(0, LIST_CAP);
    var over = g.by[k].length - rows.length;
    h += '<section class="m-card m-card--pad0 cx-tbl"><div class="m-card__h" style="padding:var(--m-4) var(--m-5);margin-block-end:0;border-block-end:1px solid var(--m-line)">' +
      '<h2 class="m-card__t">' + esc(k) + "</h2>" +
      '<span class="m-cap">' + mN(g.by[k].length) + " " + crmNoun(g.by[k].length) + "</span></div>" +
      '<div class="m-tablewrap"><table class="m-table">' + crmHeaderRow(false) + "<tbody>";
    rows.forEach(function (x) { h += crmRow(x.c, x.st); });
    if (!rows.length) {
      h += '<tr class="m-table__empty"><td colspan="9"><div class="m-empty">' +
        '<p class="m-empty__t">لا حملات في هذه المجموعة</p></div></td></tr>';
    }
    h += "</tbody></table></div>";
    if (over > 0) {
      h += '<div class="m-foot"><span class="m-status m-status--warn">تُعرض ' + mN(rows.length) +
        " من " + mN(g.by[k].length) + " في هذه المجموعة.</span></div>";
    }
    h += "</section>";
  });
  return h;
}

/* ---------------------------------- kanban ---------------------------------- */
function crmKanbanView(withStAll) {
  var g = crmGroups(withStAll);
  /* Drag is enabled ONLY on the التصنيف board, because POST /admin/campaign/test is the only write
     that exists for a campaign. A card must never be draggable into a state nothing can persist. */
  var canDrag = crmActiveKey() === "class";
  var h = '<div class="m-board">';
  g.order.forEach(function (k) {
    h += '<div class="m-col" data-col="' + esc(k) + '"' +
      (canDrag ? ' ondragover="crmDragOver(event,this)" ondragleave="crmDragLeave(this)" ondrop="crmDrop(event,&quot;' + (k === "تجريبية" ? "test" : "real") + '&quot;,this)"' : "") + ">" +
      '<div class="m-col__t"><span class="m-col__n">' + esc(k) + "</span>" +
      '<span class="m-col__c">' + mN(g.by[k].length) + "</span></div>" +
      '<div class="m-col__b">';
    var rows = g.by[k].slice(0, LIST_CAP);
    rows.forEach(function (x) {
      var st = x.st, c = x.c;
      var ps = campPerfState(c, st);
      /* The card's footer carries campStats, which is real engagement, as label/figure pairs.
         Frappe's avatar, assignee, relative time and @/note/task/comment counters are all DROPPED —
         none of those entities exist here, and four permanently-zero counters is exactly the
         invented-value failure the founder catches. «مشاهدة» and «ردود» have no honest glyph, and a
         wrong icon is worse than a word. */
      var foot;
      if (!st.targeted) {
        foot = '<span class="kl">' + mNil("بلا جمهور", "none") + "</span>";
      } else {
        foot = [["الجمهور", mN(st.targeted)], ["شوهدت", crmPctD(st.seen, st)],
                ["ردّوا", crmPctD(st.replied, st)], ["مهتمة", crmPctD(st.interested, st)]]
          .map(function (f) {
            return '<span class="kl">' + f[0] + '</span><span class="kv">' + f[1] + "</span>";
          }).join("");
        /* a zero failure is a default state, not a vocabulary slot — it renders nothing */
        if (st.failed > 0) foot += '<span class="kb">تعذّر ' + mN(st.failed) + "</span>";
      }
      h += '<a class="m-deal" href="#kmon/' + c.id + '" aria-label="' + esc(c.name) + '"' +
        (canDrag ? ' draggable="true" ondragstart="crmDragStart(event,' + c.id + ')" ondragend="crmDragEnd()"' : "") + ">" +
        '<span class="m-deal__n"><span class="cx-dot" style="background:' + ps.dot + '"></span>' + esc(c.name) + "</span>" +
        '<span class="m-deal__p">' + (c.product ? esc(c.product) : mNil("بلا خدمة", "unset")) + " · " + fmtD(c.created_at) + "</span>" +
        '<span class="cx-kf">' + foot + "</span></a>";
    });
    if (!rows.length) h += '<div class="m-empty-col">' + (canDrag ? "اسحب حملة هنا لتغيير تصنيفها" : "لا حملات") + "</div>";
    h += "</div>";
    if (g.by[k].length > rows.length) {
      h += '<span class="m-col__v">تُعرض ' + mN(rows.length) + " من " + mN(g.by[k].length) + "</span>";
    }
    h += "</div>";
  });
  return h + "</div>";
}

/* -------------------------------- bulk bar -------------------------------- */
function crmBulkBar() {
  var ids = crmSelIds();
  if (!ids.length) return "";
  var sel = ids.map(function (i) { return campaigns.find(function (c) { return String(c.id) === String(i); }); }).filter(Boolean);
  var nTest = sel.filter(campIsTest).length, nReal = sel.length - nTest;
  var h = '<div class="bulkbar"><div>' +
    '<span class="cnt">' + mN(sel.length) + " محدَّدة</span>" +
    '<button onclick="crmExportSel()">تصدير المحدد CSV</button>';
  if (nReal) h += '<button onclick="crmBulkClass(true)">نقل إلى التجريبية (' + mN(nReal) + ")</button>";
  if (nTest) h += '<button onclick="crmBulkClass(false)">إعادة إلى الفعلية (' + mN(nTest) + ")</button>";
  h += '<button class="x" aria-label="إلغاء التحديد" onclick="crmClear()">&#215;</button></div></div>';
  return h;
}

/* ============================== the list screen ============================== */
function vKmonCrm(d) {
  crmBind();
  var withStAll = crmFiltered();
  /* No page title band: the breadcrumb carries the module name and the ONE primary action. */
  setTimeout(crmPaintCrumb, 0);
  if (!campaigns.length) {
    /* SMOKE: «لا حملات بعد» is the accepted empty render for #kmon. */
    return '<div class="ds6"><section class="m-card m-empty"><p class="m-empty__t">لا حملات بعد</p>' +
      '<p class="m-empty__d">تُطلق الحملة من «إنشاء حملة»، ويظهر كل إطلاق بلوحته وأرقامه الحية.</p>' +
      '<p class="m-empty__a"><a class="m-btn m-btn--primary" href="#aimkt">إنشاء حملة</a></p></section></div>';
  }
  var h = '<div class="ds6"><div class="cx">';
  h += crmControlBar(Math.min(withStAll.length, PAGE_SIZE), withStAll.length);
  if (crmView === "kanban") h += crmKanbanView(withStAll);
  else if (crmView === "group") h += crmGroupView(withStAll);
  else h += crmListView(withStAll);
  h += crmBulkBar();
  return h + "</div></div>";
}

/* ============================= the record screen ============================= */
function crmSpecStrip(camp, st) {
  var msg = camp.message ? String(camp.message) : "";
  /* The link is emitted hidden and unhidden only if the clamped bubble ACTUALLY overflows.
     msg.length > 90 was a proxy and it was wrong in the visible direction: measured at 1440, a
     155-char message fits on one line (scrollHeight 44 == clientHeight 44) and still offered
     «عرض النص كاملًا» — a control that expands nothing. */
  var body = msg
    ? '<div class="cx-bub' + (crmMsgOpen ? "" : " clamp") + '" id="crmmsg">' + esc(msg) + "</div>" +
      '<div id="crmmsgmore"' + (crmMsgOpen ? "" : ' style="display:none"') + '><button type="button" class="m-link" onclick="crmToggleMsg()">' +
      (crmMsgOpen ? "طيّ النص" : "عرض النص كاملًا") + "</button></div>"
    : '<p class="m-meta">' + mNil("لم يُحفظ نص هذه الحملة", "unset") + "</p>";
  return '<section class="m-card"><div class="cx-spec">' +
    '<div class="cx-wa">' + body + "</div>" +
    '<dl class="m-facts cx-spec__f">' +
      "<div><dt>الخدمة</dt><dd>" + (camp.product ? esc(camp.product) : mNil("غير محددة", "unset")) + "</dd></div>" +
      "<div><dt>حجم الجمهور</dt><dd>" + mN(st.targeted) + "</dd></div>" +
      "<div><dt>التصنيف</dt><dd>" + (campIsTest(camp) ? "تجريبية" : "فعلية") + "</dd></div>" +
    "</dl></div>" +
    '<p class="m-meta">النص المرسل فعليًا؛ لا يُعدَّل بعد الإطلاق.</p></section>';
}

function crmDetailBulkBar(camp) {
  var ph = crmSelPhones();
  if (!ph.length) return "";
  return '<div class="bulkbar"><div>' +
    '<span class="cnt">' + mN(ph.length) + " محدَّدة</span>" +
    '<button class="pri" onclick="crmRetargetSel()">إعادة استهداف المحدد (' + mN(ph.length) + ")</button>" +
    '<button onclick="crmExportSelTargets()">تصدير المحدد CSV</button>' +
    '<button class="x" aria-label="إلغاء التحديد" onclick="crmClearD()">&#215;</button></div></div>';
}

function vKmonDetailCrm(id, d) {
  var camp = campaigns.find(function (x) { return String(x.id) === String(id); });
  if (!camp) {
    return '<div class="ds6"><section class="m-card m-empty"><p class="m-empty__t">حملة غير موجودة</p>' +
      '<p class="m-empty__a"><a class="m-link" href="#kmon">كل الحملات &#8592;</a></p></section></div>';
  }
  var st = campStats(camp), cwin = campWin(camp);
  var ps = campPerfState(camp, st);
  var rows = camp.targets.map(function (t) { return { phone: t.phone, name: t.name, contact: contactByPhone(t.phone) }; });

  var h = '<div class="ds6"><div class="cx">';
  h += '<p class="m-crumb"><a class="m-link" href="#kmon">كل الحملات &#8592;</a></p>';
  h += '<header class="m-head"><div class="m-section-head__t"><h1 class="m-h1">' + esc(camp.name) + "</h1>" +
    '<p class="m-meta">' + (camp.product ? esc(camp.product) + " · " : "") + "واتساب · " + fmtD(camp.created_at) + "</p></div>" +
    '<div class="m-head__a">' + crmChip(ps) + "</div></header>";

  /* حكم الحملة — the verdict hero stays page-level so it is never hidden behind a tab.
     SMOKE: «حكم الحملة» is the landmark smoke.py asserts for #kmon/<id>. */
  h += '<section class="m-card" aria-labelledby="cxVerdict"><div class="m-between" style="flex-wrap:wrap;align-items:flex-start">' +
    '<div style="flex:1 1 240px;min-inline-size:0"><h2 class="m-label" id="cxVerdict">حكم الحملة</h2>' +
    '<p class="m-body">' + crmVerdict(st) + "</p></div>" +
    '<div class="m-stats">' +
    /* THE UNIT IS STATED ONCE. The third tile was labelled «جهات مهتمة لكل 100» and then rendered
       its value with «٪» — the same unit twice, in two different systems, on one figure. It is a
       percentage, so it is named as one and the denominator is spelled out underneath. */
    [["نسبة المشاهدة", crmDeliveryRate(st.seen, st), "من جهات الاستهداف"],
     ["نسبة الردود", crmDeliveryRate(st.replied, st), "من جهات الاستهداف"],
     ["نسبة الجهات المهتمة", crmDeliveryRate(st.interested, st), "من جهات الاستهداف"]]
      .map(function (x) {
        return '<div><div class="m-stat__v">' + (x[1] === null ? mNil("لم يُقَس", "none") : mPct(x[1])) + "</div>" +
          '<div class="m-stat__k">' + x[0] + "</div>" +
          '<div class="m-stat__s">' + (x[1] === null ? "لم تُرسل هذه الحملة بعد" : x[2]) + "</div></div>";
      }).join("") + "</div></div></section>";

  /* ---- the move cards, computed once: the count rides on the tab label ---- */
  var seenSilent = rows.filter(function (r) { return r.contact && atOrAfter((r.contact.statusTimes || {}).read, cwin) && !repliedIn(r.contact, cwin); });
  var notDelivered = rows.filter(function (r) { return r.contact && atOrAfter((r.contact.statusTimes || {}).failed, cwin) && !atOrAfter((r.contact.statusTimes || {}).delivered, cwin); });
  var hotHere = rows.filter(function (r) { return r.contact && ((r.contact.tags || []).some(function (t) { return t.level === "hot"; }) || (insCache[r.phone] || {}).intent === "high"); });
  var lostHere = rows.map(function (r) { return insCache[r.phone]; }).filter(function (i) { return i && i.deal_state === "lost" && i.loss_cause; });
  var causeTally = {};
  lostHere.forEach(function (i) { causeTally[i.loss_cause] = (causeTally[i.loss_cause] || 0) + 1; });
  var causeKeys = Object.keys(causeTally).sort(function (a, b) { return causeTally[b] - causeTally[a]; });
  var topCause = causeKeys.length ? causeKeys[0] : "";
  var topCauseN = topCause ? causeTally[topCause] : 0;
  /* «أبرز الأسباب» WITH A MINIMUM, and with its count on screen. The mode of a tally of one is not
     a leading reason, it is the only reason there is — and it used to be printed as the campaign's
     headline finding with no figure beside it to show how thin it was. Two recorded deals is the
     floor, and the count and its denominator are printed wherever the cause is. */
  var hasTopCause = topCauseN >= 2;
  var causeSaid = hasTopCause
    ? topCause + " — سُجّل على " + opPl(topCauseN, "صفقة واحدة", "صفقتين", "صفقات", "صفقة") +
      " من " + opPl(lostHere.length, "صفقة خاسرة واحدة", "صفقتين خاسرتين", "صفقات خاسرة", "صفقة خاسرة")
    : "";
  var moves = [];
  /* The card esc()s its own title, so these are PLAIN text and the count is four-way through opPl
     rather than «n + noun» (PORT-SPEC §5). */
  if (hotHere.length) moves.push(["ابدأ التواصل مع " + opPl(hotHere.length, "جهة واحدة تستحق المتابعة", "جهتين تستحقان المتابعة", "جهات تستحق المتابعة", "جهة تستحق المتابعة"), "وسوم اهتمام مؤكدة، أو نية مرتفعة قرأها المساعد من نص المحادثة ولم تُسجَّل وسمًا بعد", "var(--m-ok)", "interested"]);
  if (seenSilent.length) moves.push(["أعد استهداف " + opPl(seenSilent.length, "جهة واحدة شاهدت دون ردّ", "جهتين شاهدتا دون ردّ", "جهات شاهدت دون ردّ", "جهة شاهدت دون ردّ"), "الاهتمام قائم، وأثر الرسالة غير واضح" + (hasTopCause ? " وعالج «" + topCause + "»" : ""), "var(--m-warn)", "silent"]);
  if (notDelivered.length) moves.push([opPl(notDelivered.length, "جهة واحدة لم تصلها الرسالة", "جهتان لم تصلهما الرسالة", "جهات لم تصلها الرسالة", "جهة لم تصلها الرسالة"), "تحقق من الأرقام، ثم أعد المحاولة لاحقًا", "var(--m-bad)", "failed"]);
  if (hasTopCause) moves.push(["أبرز أسباب عدم الإغلاق: " + causeSaid, "عالِج السبب في رسالة الحملة القادمة لهذه الخدمة", "var(--m-ac)", ""]);

  /* The single highest-value move, surfaced under the verdict so the operator sees the next action
     without opening a tab. moves is already ordered hot -> seen-silent -> not-delivered ->
     top-cause, which is a value order; this shows moves[0] and invents no score. The fourth kind
     has no filter action, so the strip degrades to the tab link. ZERO moves renders NOTHING — a
     strip announcing an absence is chrome, and the count-less tab plus «لا توصية الآن» carries it. */
  if (moves.length) {
    var m0 = moves[0];
    h += '<section class="m-card cx-move" style="--tn:' + m0[2] + '"><div class="m-between" style="flex-wrap:wrap">' +
      '<span class="m-body">' + ic("spark", 16) + " " + esc(m0[0]) + "</span>" +
      '<span class="m-head__a">' +
      (m0[3] ? '<button type="button" class="m-btn" onclick="crmGoFilter(&quot;' + m0[3] + '&quot;)">افتح هذه الفئة</button>' : "") +
      '<button type="button" class="m-link" onclick="crmSetDetailTab(&quot;next&quot;)">كل الخطوات (' + fmtN(moves.length) + ")</button>" +
      "</span></div></section>";
  }

  h += crmSpecStrip(camp, st);
  setTimeout(crmMeasureMsg, 0);
  setTimeout(crmPaintCrumb, 0);

  /* A «(0)» beside «الخطوة التالية» reads as a broken counter rather than as "nothing to do"; the
     panel itself says so in words. Show the count only when there is one. */
  var tabs = [["targets", "جهات الاستهداف", rows.length], ["perf", "الأداء", null], ["next", "الخطوة التالية", moves.length || null]];
  h += '<div class="m-tabs" role="tablist" aria-label="أقسام الحملة">' + tabs.map(function (t) {
    return '<button type="button" class="m-tab" role="tab" aria-selected="' + (crmDetailTab === t[0]) + '" onclick="crmSetDetailTab(&quot;' + t[0] + '&quot;)">' +
      t[1] + (t[2] === null ? "" : "<b>" + fmtN(t[2]) + "</b>") + "</button>";
  }).join("") + "</div>";

  if (crmDetailTab === "perf") {
    /* THE ASYMMETRY IS DELIBERATE. أُرسلت and وصلت describe the SEND itself, so «0٪ من جهات
       الاستهداف» on them is an honest statement about a send that did not happen. شوهدت / ردّوا /
       جهات مهتمة describe what the RECIPIENTS did, and those are undefined until something was
       dispatched — a 0٪ there asserts that a delivered message went unseen. Flag per card (c[3]). */
    var cards = [["جهات الاستهداف", st.targeted, false], ["أُرسلت", st.sent, false],
      ["وصلت", st.delivered, false], ["شوهدت", st.seen, true],
      ["ردّوا", st.replied, true], ["جهات مهتمة", st.interested, true]];
    h += '<div class="m-kpis">' + cards.map(function (c, i) {
      var r = c[2] ? crmDeliveryRate(c[1], st) : crmRate(c[1], st.targeted);
      var caption = i === 0 ? "كل من استهدفتهم الحملة"
        : r !== null ? mPct(r) + " من جهات الاستهداف"
        : !st.targeted ? "لا جهات استهداف"
        : "لم تُرسل بعد";
      return '<div class="m-card"><div class="m-stat__k">' + c[0] + "</div>" +
        '<div class="m-stat__v">' + mN(c[1]) + "</div>" +
        '<div class="m-stat__s">' + caption + "</div>" +
        '<span class="m-meter"><i style="--m-pct:' + (i === 0 ? 100 : (r === null ? 0 : r)) + '%"></i></span></div>';
    }).join("") + "</div>" +
    '<p class="m-meta">«شوهدت» = قُرئت أو ردّت؛ تأكيد أن العميل رأى الرسالة.</p>';
    /* BR-MON-004/006: what the campaign led to after «مهتم» (campaign-results-crm). */
    if (typeof crChainCard === "function") h += crChainCard(camp, st);
    return h + "</div></div>";
  }

  if (crmDetailTab === "next") {
    if (!moves.length) {
      return h + '<section class="m-card m-empty"><p class="m-empty__t">لا توصية الآن</p>' +
        '<p class="m-empty__d">لم يُسجَّل حدث بعد الإطلاق.</p></section></div></div>';
    }
    h += '<div class="cx-moves">' + moves.map(function (m) {
      return '<section class="m-card cx-move" style="--tn:' + m[2] + '">' +
        '<h3 class="m-body">' + esc(m[0]) + "</h3>" +
        '<p class="m-meta">' + esc(m[1]) + "</p>" +
        (m[3] ? '<div class="m-actions"><button type="button" class="m-btn" onclick="crmGoFilter(&quot;' + m[3] + '&quot;)">افتح هذه الفئة</button></div>' : "") +
        "</section>";
    }).join("") + "</div>";
    return h + "</div></div>";
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
    label: active[1].replace(/[\\u2713\\u2b50]/g, "").trim(), campaign: camp.name,
    targets: shown.map(function (r) { return { phone: r.phone, name: (r.contact && r.contact.waName) || r.name || "" }; })
  };
  crmLastShown = shown.map(function (r) { return r.phone; });
  /* The cohort size is printed on the filter tab AND above the table, so it is bound to the rows
     the filter actually returned (PORT-SPEC §6). */
  dsD("cxCohort", function () { return crmLastShown.length; });

  h += '<div class="m-tabs" role="tablist" aria-label="تصفية جهات الاستهداف">' + filters.map(function (f) {
    return '<button type="button" class="m-tab" role="tab" aria-selected="' + (campFilter === f[0]) + '" onclick="crmSetCampFilter(&quot;' + f[0] + '&quot;)">' +
      f[1] + "<b>" + fmtN(f[2]) + "</b></button>";
  }).join("") + "</div>";

  h += '<section class="m-card m-card--pad0 cx-tbl"><div class="m-tools"><div class="m-head__a">' +
    '<span class="m-cap">' + dsFig("cxCohort", shown.length) + " من " + mN(rows.length) + "</span>" +
    mSearch({ id: "rq", value: rQ, placeholder: "بحث…", label: "بحث في جهات الاستهداف", wide: true, attrs: ' oninput="rSearch(this)"' }) +
    "</div>" +
    (shown.length ? '<button type="button" class="m-btn" onclick="startRetarget()">إعادة استهداف هذه الفئة (' + fmtN(shown.length) + ")</button>" : "") +
    "</div>";
  h += '<div class="m-tablewrap"><table class="m-table m-table--sticky">' + crmTargetHeader(shown) +
    "<tbody>" + (shown.length
      ? crmTargetRows(shown, cwin)
      : '<tr class="m-table__empty"><td colspan="7"><div class="m-empty"><p class="m-empty__t">لا نتائج</p>' +
        '<p class="m-empty__d">يُمسح البحث أو تُغيّر التصفية.</p></div></td></tr>') +
    "</tbody></table></div></section>";
  h += crmDetailBulkBar(camp);
  return h + "</div></div>";
}

/* The targets table is a LIST, so it uses the same chrome as every other list. chipRow() and
   interestChips() come from dashboard.ts and own the status and interest reading; they are called
   rather than forked, so there is one definition of what a status chip means. They still emit the
   old .chip markup because that file is under ADR-0001 and is not range-edited from here. */
function crmTargetHeader(shown) {
  var allOn = shown.length > 0 && shown.every(function (r) { return crmSelD[r.phone]; });
  return "<thead><tr>" +
    '<th class="m-sel"><input type="checkbox" class="m-cb" aria-label="تحديد المعروض"' + (allOn ? " checked" : "") + ' onclick="crmTogglePageD()"></th>' +
    "<th>العميل</th><th>الحالة</th><th>اهتمام المساعد</th><th>آخر رسالة</th><th>الوقت</th>" +
    "<th>المحادثة</th></tr></thead>";
}

function crmTargetRows(shown, cwin) {
  var out = "";
  shown.forEach(function (r) {
    var c = r.contact || { phone: r.phone, waName: r.name, statusTimes: {}, tags: [], transcript: [] };
    var nm = c.waName || r.name || "";
    var tr = c.transcript || [];
    var last = tr[tr.length - 1];
    var ci = insCache[c.phone] || {};
    var on = !!crmSelD[r.phone];
    /* cap the interest chips: three stacked chips is what made these rows 90px tall */
    var tags = (c.tags || []).slice();
    var chips = interestChips({ tags: tags.slice(0, 2), phone: c.phone });
    var extra = tags.length > 2 ? '<span class="m-cap">+' + fmtN(tags.length - 2) + "</span>" : "";
    out += "<tr" + (on ? ' aria-selected="true"' : "") + ">" +
      '<td class="m-sel"><input type="checkbox" class="m-cb" aria-label="تحديد ' + esc(nm || c.phone) + '"' + (on ? " checked" : "") + ' onclick="crmToggleD(&quot;' + esc(c.phone) + '&quot;)"></td>' +
      '<td class="m-td-n"><a class="m-link" href="#customer/' + esc(c.phone) + '">' +
        (nm ? esc(nm) : mNil("بلا اسم مسجّل", "unset")) + "</a>" +
        '<span class="cx-sub m-meta"><bdi dir="ltr">' + esc(c.phone) + "</bdi></span></td>" +
      "<td>" + chipRow(c, cwin) + "</td>" +
      "<td>" + (chips || extra ? chips + extra : mNil("لم يُصنَّف", "unset")) + "</td>" +
      "<td>" + (ci.next_action
        ? '<span class="m-link">&#8592; ' + esc(ci.next_action) + "</span>"
        : last ? '<span class="cx-clip">' + esc(clip(last.text, 60)) + "</span>" : mNil("لا رسالة", "none")) + "</td>" +
      "<td>" + (last ? fmtT(last.ts) : mNil("لا رسالة", "none")) + "</td>" +
      '<td><button type="button" class="m-link" onclick="openConvo(&quot;' + esc(c.phone) + '&quot;)">المحادثة &#8592;</button></td></tr>';
  });
  return out;
}

/* Writes the breadcrumb's view label and its primary action. Called after render() has replaced
   #body, because the header lives outside #body and nav() only sets #pt/#ps by route. */
function crmPaintCrumb() {
  var ps = document.getElementById("ps");
  var act = document.getElementById("crumbact");
  var id = (location.hash || "").split("/")[1];
  if (ps) {
    ps.textContent = id ? "حملة" :
      (crmView === "kanban" ? "كانبان" : crmView === "group" ? "تجميع" : "قائمة");
  }
  if (act) {
    act.innerHTML = '<a href="#aimkt" class="btn" style="text-decoration:none;color:#fff;background:#2563EB;">' +
      ic("send", 15, "#fff") + " إنشاء حملة</a>";
  }
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

/* Holds the list's shape while data loads. A centred «جارٍ التحميل» both shifts the layout when
   rows arrive and tells the operator nothing about what is coming. */
function crmSkeleton(n) {
  return '<div class="ds6"><section class="m-card" aria-busy="true" aria-live="polite">' +
    moSkeleton(n || 4, ["w40", "w80", "w60"]) + "</section></div>";
}

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
    contactByPhone: typeof contactByPhone, chipRow: typeof chipRow, interestChips: typeof interestChips,
    campIsTest: typeof campIsTest, fmtN: typeof fmtN, fmtD: typeof fmtD, esc: typeof esc, ic: typeof ic,
    mN: typeof mN, mNil: typeof mNil, mPct: typeof mPct, dsFig: typeof dsFig, dsD: typeof dsD,
    dsPageBar: typeof dsPageBar, moSkeleton: typeof moSkeleton,
    vKmon: typeof vKmon, vKmonDetail: typeof vKmonDetail
  };
  var missing = Object.keys(need).filter(function (k) { return need[k] !== "function"; });
  if (missing.length) throw new Error("campaigns-crm: missing helpers " + missing.join(", "));
}
var crmBooted = false;
function crmCampaignsHtml(campId) {
  try {
    if (!crmBooted) { crmBoot(); crmBooted = true; }
    /* BR-MON-002: suggested campaign opportunities greet the campaigns page (indicators-crm). Guarded
       like everything else here, so a fault in the panel cannot take the list down with it. */
    var sg = "";
    if (!campId && typeof sgPanel === "function") { try { sg = '<div style="margin-bottom:var(--s4,24px)">' + sgPanel("kmon") + "</div>"; } catch (e) { sg = ""; } }
    /* The campaign indicators live here now, under the list they describe, rather than on
       الرئيسية where they answered «what did marketing do» before that page had finished
       answering «are we going to hit the number». Guarded like the panel above: a fault in
       the indicators must not take the campaign list down with it. */
    var act = "";
    if (!campId && typeof vCampaignActivity === "function") {
      try { act = vCampaignActivity(); } catch (e) { act = ""; }
    }
    return campId ? vKmonDetailCrm(campId, cache) : sg + vKmonCrm(cache) + act;
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
      return '<div class="ds6"><section class="m-card m-empty"><p class="m-empty__t">تعذّر عرض الحملات</p>' +
        '<p class="m-empty__d">تُحمَّل الصفحة مجددًا؛ إن تكرر الخلل فهو في الإصدار لا في بياناتك.</p></section></div>';
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
/* Distinct from select-page: this reaches the matches the page slice hides. Named and counted so
   the operator knows the difference between "the 60 I can see" and "the 137 that match". */
window.crmSelectAllMatching = function () {
  var all = crmFiltered();
  all.forEach(function (x) { crmSel[x.c.id] = true; });
  render(false);
  alertBar("حُدِّدت " + opPl(all.length, "حملة واحدة مطابقة", "حملتان مطابقتان", "حملات مطابقة", "حملة مطابقة") + "، بما فيها غير المعروضة", false);
};
window.crmTogglePage = function () {
  var shown = pageSlice("kmon", crmFiltered());
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
   failure is reported with its count rather than swallowed. NO DISPATCH PATH EXISTS HERE. */
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
  /* Keep the failures selected. «تعذّر 3 — أعد المحاولة» with an empty selection is an instruction
     the operator cannot follow: they would have to work out which three. */
  crmSel = {};
  failed.forEach(function (id) { crmSel[id] = true; });
  render(false);
  alertBar(fail ? "غُيّر تصنيف " + fmtN(ok) + " وتعذّر " + fmtN(fail) + " — أعد المحاولة"
                : "غُيّر تصنيف " + opPl(ok, "حملة واحدة", "حملتان", "حملات", "حملة"), !!fail);
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
  alertBar("صُدّرت " + opPl(ids.length, "حملة واحدة", "حملتان", "حملات", "حملة"), false);
};
window.crmExportSelTargets = function () {
  var ph = crmSelPhones();
  var rows = [["الرقم", "الاسم"]];
  ph.forEach(function (p) {
    var c = contactByPhone(p);
    rows.push([p, (c && c.waName) || ""]);
  });
  crmDownloadCsv(rows, "massar-targets-selected.csv");
  alertBar("صُدّرت " + opPl(ph.length, "جهة واحدة", "جهتان", "جهات", "جهة"), false);
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
