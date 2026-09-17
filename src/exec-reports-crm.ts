// exec-reports-crm.ts — «نظرة تنفيذية»: the five pipeline reports, drawn.
//
// The rules live in pipeline-report-domain.ts and run on the server; this file only draws what
// /admin/reports/pipeline returns. Every card has the same grammar, because a CPO scans five of them
// in a row: a title and the question it answers, ONE signal figure, one chart whose geometry is the
// data, and one next action in words — never a paragraph (the «signals, not text» rule).
//
// Stage colours come from stage-tone-domain.ts through opTone() in opps-crm.ts, so a rung is the same
// colour here as on the board. Money goes through opMoney/opMoneyShort.
//
// PORTED to the new design system (docs/PORT-SPEC.md). The screen body is wrapped in .ds6 by
// vReportsCrm, which owns the tab rail this view sits under. Every figure goes through .m-n, every
// empty cell states WHICH KIND of absence it is, and the two counts that appear both in the KPI
// strip and in a card below it are bound with dsD/dsFig so they cannot drift.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is spliced into dashboard.ts's template.

export const EXEC_REPORTS_CSS = `
/* PORTED to the m-* vocabulary (docs/PORT-SPEC.md). What survives in this file is chart geometry
   the vocabulary does not carry: the funnel bands, the velocity tracks with their SLA ticks, the
   stacked product bars and the weekly movement columns. Everything the vocabulary DOES carry —
   titles, meta lines, cards, chips, segmented controls, buttons, empty states, numbers and the
   three kinds of absence — was deleted here and is drawn by massar-ds-crm.ts.

   MONEY. opMoney/opMoneyShort stay as the money formatter rather than being re-wrapped in .m-n:
   they already emit a bdi element, which supplies the bidi isolation .m-n exists to give, and
   forcing direction:ltr onto an Arabic currency phrase would move the unit to the wrong side.
   They also carry the counted-noun rule for «ألف/آلاف/مليون/ملايين», which must not be
   re-implemented per screen. The one property bdi lacks is tabular figures, stated once below.
   Every other figure on this screen goes through .m-n. */
.ds6 bdi { font-variant-numeric: lining-nums tabular-nums; }

.ds6 .rx { display:flex; flex-direction:column; gap:var(--m-4); container-type:inline-size; container-name:rxw; }
.ds6 .rx-head { display:flex; align-items:flex-end; justify-content:space-between; gap:var(--m-4); flex-wrap:wrap; }
.ds6 .rx-meta { display:flex; gap:var(--m-3); flex-wrap:wrap; align-items:center; margin-block-start:var(--m-1); }
/* The refresh control is an m-btn; inside a meta line it must not impose the 44px control height
   on the whole row, so only here it sits down to the text's own rhythm. */
.ds6 .rx-meta .m-btn { min-block-size:32px; padding-block:3px; }
@media (pointer:coarse) { .ds6 .rx-meta .m-btn { min-block-size:44px; } }

/* KPI strip: one lead figure, the rest support it. The GRID is bespoke (a wide lead column plus
   four equal ones); every cell's type is m-stat__k / m-stat__v / m-stat__s. */
.ds6 .rx-kpis { display:grid; grid-template-columns:minmax(0,1.6fr) repeat(4,minmax(0,1fr));
  background:var(--m-paper); border:1px solid var(--m-line); border-radius:var(--m-r-card); }
.ds6 .rx-kpi { padding-inline:var(--m-5); padding-block:var(--m-4); display:flex; flex-direction:column; gap:2px; min-inline-size:0; }
.ds6 .rx-kpi + .rx-kpi { border-inline-start:1px solid var(--m-line); }
.ds6 .rx-kpi.lead .m-stat__v { font-size:var(--m-t-display); line-height:var(--m-leading-figure); }
.ds6 .rx-kpi.warn .m-stat__v { color:var(--m-warn); }

.ds6 .rx-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--m-4); }
.ds6 .rx-card { display:flex; flex-direction:column; gap:var(--m-4); min-inline-size:0; }
.ds6 .rx-card.wide { grid-column:1 / -1; }
.ds6 .rx-sig { display:flex; align-items:baseline; gap:var(--m-2); flex-wrap:wrap; }

/* the next action: one sentence, and where it opens */
.ds6 .rx-act { margin-block-start:auto; font:inherit; display:flex; align-items:flex-start; gap:var(--m-2);
  text-align:start; inline-size:100%; font-size:var(--m-t-cap); line-height:var(--m-leading-meta);
  color:var(--m-ink-2); background:var(--m-sunk); border:0; border-radius:var(--m-r-ctl);
  padding-inline:var(--m-3); padding-block:var(--m-2); }
.ds6 .rx-act .ox-ico { inline-size:14px; block-size:14px; margin-block-start:4px; color:var(--m-ac-deep); }
.ds6 button.rx-act { cursor:pointer; transition:background var(--m-out) var(--m-ease), transform var(--m-press) var(--m-ease); }
.ds6 button.rx-act:active { transform:scale(0.97); }
@media (hover:hover) and (pointer:fine) { .ds6 button.rx-act:hover { background:var(--m-ac-dim); } }
.ds6 button.rx-act .go { margin-inline-start:auto; flex:none; color:var(--m-ac-deep); font-weight:600; }

/* shared row grammar: a label column, a track, a figure column, and the drill caret (BR-RPT-004 —
   reserved on every row so drillable and inert rows keep one alignment) */
.ds6 .rx-row { display:grid; grid-template-columns:minmax(96px,132px) minmax(0,1fr) minmax(88px,auto) 14px;
  align-items:center; column-gap:var(--m-2); min-block-size:30px; }
.ds6 .rx-open { inline-size:14px; display:flex; align-items:center; justify-content:center; color:var(--m-ac-deep); }
.ds6 .rx-open svg { inline-size:13px; block-size:13px; }
.ds6 button.rx-row { font:inherit; inline-size:100%; text-align:start; background:none; border:0; border-radius:var(--m-r-ctl);
  padding:2px 6px; margin-inline:-6px; cursor:pointer; color:inherit;
  transition:background var(--m-out) var(--m-ease), transform var(--m-press) var(--m-ease); }
.ds6 button.rx-row:active { transform:scale(0.97); }
/* the drill sentence, for a screen reader only: aria-label would REPLACE the row's own figures */
.ds6 .rx-say { position:absolute; inline-size:1px; block-size:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
@media (hover:hover) and (pointer:fine) { .ds6 button.rx-row:hover { background:var(--m-ac-dim); } }
.ds6 .rx-lab { font-size:var(--m-t-cap); color:var(--m-ink-2); display:flex; align-items:center; gap:6px; min-inline-size:0; line-height:1.3; }
.ds6 .rx-lab .ox-dot { flex:none; }
.ds6 .rx-fig { font-size:var(--m-t-cap); color:var(--m-mut); text-align:end; white-space:nowrap; }
.ds6 .rx-fig b { color:var(--m-ink); font-weight:600; }
.ds6 .rx-track { position:relative; block-size:12px; background:var(--m-sunk); border-radius:var(--m-r-chip); }
.ds6 .rx-track > i { position:absolute; inset-block:0; inset-inline-start:0; border-radius:var(--m-r-chip);
  background:var(--tn, var(--m-ac)); transform-origin:right center; animation:rxGrow var(--m-in) var(--m-ease) both; }
[dir="ltr"] .ds6 .rx-track > i { transform-origin:left center; }
@keyframes rxGrow { from { transform:scaleX(0.6); opacity:0; } to { transform:scaleX(1); opacity:1; } }
@media (prefers-reduced-motion: reduce) { .ds6 .rx-track > i, .ds6 .rx-fun i, .ds6 .rx-wk i { animation:none; } }

/* funnel: each band centred, so the narrowing between two bands IS the drop */
.ds6 .rx-fun { display:flex; flex-direction:column; }
.ds6 .rx-fun .rx-row { min-block-size:28px; }
.ds6 .rx-fun .band { block-size:20px; display:flex; justify-content:center; }
.ds6 .rx-fun i { display:block; block-size:100%; min-inline-size:3px; border-radius:5px; background:var(--tn);
  animation:rxGrow var(--m-in) var(--m-ease) both; }
.ds6 .rx-conv { display:grid; grid-template-columns:minmax(96px,132px) minmax(0,1fr) minmax(88px,auto) 14px; column-gap:var(--m-2); }
.ds6 .rx-conv span { grid-column:2; justify-self:center; font-size:var(--m-t-cap); color:var(--m-mut); line-height:18px; }
.ds6 .rx-conv.weak span { color:var(--m-warn); background:var(--m-warn-dim); border-radius:var(--m-r-chip);
  padding-inline:8px; font-weight:600; }

/* velocity: bar = the oldest deal on the rung now; the tick = the rung's SLA */
.ds6 .rx-sla { position:absolute; inset-block:-4px; inline-size:2px; background:var(--m-ink-2); border-radius:var(--m-r-chip); }
.ds6 .rx-over { color:var(--m-warn); font-weight:600; }

/* products: one stacked bar per product, segments in stage tones */
.ds6 .rx-stack { display:flex; gap:2px; block-size:12px; border-radius:var(--m-r-chip); overflow:hidden; background:var(--m-sunk); }
.ds6 .rx-stack i { display:block; block-size:100%; min-inline-size:4px; }
.ds6 .rx-legend { display:flex; flex-wrap:wrap; gap:4px var(--m-4); font-size:var(--m-t-cap); color:var(--m-ink-2); }
.ds6 .rx-legend span { display:inline-flex; align-items:center; gap:5px; }
/* two classes: a product row is a button now, and button.rx-row must not outrank its separator */
.ds6 .rx-row.rx-prow { grid-template-columns:minmax(120px,1.1fr) minmax(0,1.6fr) minmax(120px,auto) 14px;
  padding-block:6px; border-block-start:1px solid var(--m-line); }
.ds6 .rx-row.rx-prow:first-of-type { border-block-start:none; }
.ds6 .rx-pn { display:flex; flex-direction:column; min-inline-size:0; }
.ds6 .rx-pn b { font-size:var(--m-t-body); font-weight:600; color:var(--m-ink); line-height:1.35; overflow-wrap:anywhere; }
.ds6 .rx-pn span { font-size:var(--m-t-cap); color:var(--m-mut); }

/* sources: the track is every line, the fill is the share that moved past first contact */
.ds6 .rx-src .rx-track { background:var(--m-ac-dim); }
.ds6 .rx-src .rx-track > i { background:var(--m-ac); }

/* movement: weekly columns, stacked by kind; time runs right to left like the language */
.ds6 .rx-wks { display:flex; align-items:flex-end; gap:var(--m-2); block-size:132px; padding-block-start:var(--m-2); }
.ds6 .rx-wk { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; min-inline-size:0; block-size:100%; }
.ds6 .rx-wk .col { flex:1; inline-size:100%; max-inline-size:44px; display:flex; flex-direction:column-reverse; gap:2px; justify-content:flex-start; }
.ds6 .rx-wk i { display:block; inline-size:100%; border-radius:3px; min-block-size:3px; transform-origin:bottom center;
  animation:rxRise var(--m-in) var(--m-ease) both; }
@keyframes rxRise { from { transform:scaleY(0.4); opacity:0; } to { transform:scaleY(1); opacity:1; } }
.ds6 .rx-wk .d { font-size:var(--m-t-micro); color:var(--m-mut); white-space:nowrap; }
.ds6 .rx-wk .t { font-size:var(--m-t-micro); color:var(--m-ink-2); font-weight:600; min-block-size:16px; }
.ds6 .rx-kinds { display:flex; flex-wrap:wrap; gap:var(--m-1) var(--m-2); }
/* a kind with no events this period stays legible but recedes; it is a real zero, not an absence */
.ds6 .rx-kind.zero { opacity:.62; }

/* the accounting basis, quoted rather than asserted */
.ds6 .rx-basis { padding-inline-start:9px; border-inline-start:2px solid var(--m-line-2); max-inline-size:80ch; }

@container rxw (max-width: 900px) {
  .ds6 .rx-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .ds6 .rx-kpi.lead { grid-column:1 / -1; }
  .ds6 .rx-kpi + .rx-kpi { border-inline-start:none; }
  .ds6 .rx-kpi:nth-child(n+2) { border-block-start:1px solid var(--m-line); }
  .ds6 .rx-kpi:nth-child(odd):not(.lead) { border-inline-start:1px solid var(--m-line); }
  .ds6 .rx-grid { grid-template-columns:minmax(0,1fr); }
}
@container rxw (max-width: 520px) {
  .ds6 .rx-card { padding-inline:var(--m-4); padding-block:var(--m-4); }
  .ds6 .rx-row, .ds6 .rx-conv { grid-template-columns:minmax(84px,104px) minmax(0,1fr) auto 14px; }
  .ds6 .rx-row.rx-prow { grid-template-columns:minmax(0,1fr) auto 14px; row-gap:6px; }
  .ds6 .rx-prow .rx-stack { grid-column:1 / -1; grid-row:2; }
  .ds6 .rx-kpi { padding-inline:var(--m-3); padding-block:var(--m-2); }
}
/* 44px on a coarse pointer, the floor every other control in the system already meets. */
@media (pointer:coarse) {
  .ds6 button.rx-act { min-block-size:44px; }
  .ds6 button.rx-row, .ds6 .rx-fun button.rx-row { min-block-size:44px; }
}
`;

export const EXEC_REPORTS_JS = `
/* ============================ exec-reports-crm (client) ============================ */
var rxData = null, rxDays = 30, rxLoading = false, rxFailed = false, rxTries = 0;

function rxLoad(force) {
  /* After the retries are spent the screen waits for «أعد المحاولة». Without this guard the failed
     render called rxLoad again and a dead database was hit in a tight loop (GPT review). */
  if (rxLoading || (rxFailed && !force)) return;
  if (rxData && !force && rxData.report.movement.days === rxDays) return;
  rxLoading = true;
  fetch("/admin/reports/pipeline?days=" + rxDays, { headers: { "x-admin-token": TOKEN } })
    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(function (j) { rxData = j; rxFailed = false; rxTries = 0; rxLoading = false; render(false); })
    .catch(function () {
      rxLoading = false;
      /* A transient 503 from the 256MB database is retried twice before the screen says it failed,
         the same policy the products screens use. */
      if (rxTries < 2) { rxTries++; setTimeout(function () { rxLoad(true); }, rxTries === 1 ? 700 : 2000); return; }
      rxFailed = true; render(false);
    });
}
/* Every ENTRY to «التقارير» re-reads: a stage moved on the board a minute ago must show here. The old
   figures stay on screen while the new ones load, so re-entry never flashes a skeleton. */
if (!window.__rxHash) {
  window.__rxHash = 1;
  window.addEventListener("hashchange", function () {
    if ((location.hash || "").split("/")[0] === "#reports" && rxData) { rxFailed = false; rxTries = 0; rxLoad(true); }
  });
}
window.rxRefresh = function () { rxFailed = false; rxTries = 0; rxLoad(true); render(false); };
window.rxRetry = function () { rxFailed = false; rxTries = 0; rxLoad(true); render(false); };
window.rxSetDays = function (d) { if (rxDays === d) return; rxDays = d; rxData = null; rxLoad(true); render(false); };
/* A next action opens «فرص البيع» on EXACTLY the population it named: its stage, source, product and
   shortcut, with every other filter cleared. Setting only the stage left last visit's product and
   owner filters in place, and the list could hide the very deals the sentence was about. */
window.rxGo = function (i) {
  var a = rxActions[i];
  if (!a || typeof opStg === "undefined") { location.hash = "#opps"; return; }
  opQ = ""; opStat = "all"; opOwn = "all";
  opStg = a.stage || "all"; opSrc = a.source || "all"; opProd = a.product || ""; opShort = a.shortcut || "";
  /* BR-RPT-004: a population the board cannot express arrives as the ids the card counted. */
  if (typeof opSetIds === "function") opSetIds(a.ids || null, a.idsLabel || "");
  opSel = {}; if (typeof PAGE !== "undefined") PAGE.opps = 1;
  location.hash = "#opps";
};
var rxActions = [];
/* BR-RPT-004 — every FIGURE on a card opens the records behind it, not only the card's next action.
   The row carries the filter it is drawn from, so «قمع المراحل» opens that rung, a product row opens
   that product and a source row opens that channel. What opens is what the board can prove it holds
   NOW: a funnel row counts everything that ever reached the rung, so its button says «الآن» and its
   own now-count, and nobody reads the shorter list as a contradiction. */
function rxRow(cls, inner, drill, label, style) {
  var st = style ? ' style="' + style + '"' : "";
  /* The chevron column is reserved on EVERY row, drillable or not, so a rung with nothing to open
     does not shift its band out of line with the rungs above it. */
  var caret = '<span class="rx-open" aria-hidden="true">' + (drill ? opIco("chevS") : "") + "</span>";
  if (!drill) return '<div class="rx-row' + (cls ? " " + cls : "") + '"' + st + ">" + inner + caret + "</div>";
  rxActions.push(drill);
  /* The sentence is APPENDED, not an aria-label: a label would replace the accessible name computed
     from the row, and the figures the row exists to report would stop being announced. */
  return '<button type="button" class="rx-row rx-drill' + (cls ? " " + cls : "") + '"' + st +
    ' title="' + esc(label) + '" onclick="rxGo(' + (rxActions.length - 1) + ')">' + inner + caret +
    '<span class="rx-say">' + esc(label) + "</span></button>";
}

/* ---- the vocabulary helpers (docs/PORT-SPEC.md §3, §4, §6) ----
   Declared here and used by the other ported screens too: every *-crm payload is concatenated into
   ONE classic script, so a function declaration in this module hoists across all of them. One
   definition means one behaviour, which is the whole point of a vocabulary. */
function mN(v) { return '<span class="m-n">' + fmtN(v) + "</span>"; }
/* kind: "owed" a number someone owes, "unset" a classification nobody made, "none" a legitimate
   nothing. Drawing all three the same is how a page of dashes teaches the reader to stop seeing
   dashes — PORT-SPEC §4, and never a bare em-dash. */
function mNil(t, kind) {
  return '<span class="m-td-nil m-nil--' + (kind || "none") + '">' + esc(t) + "</span>";
}
/* The percent sign belongs INSIDE the span: outside it, bidi lands it to the left of the digits. */
function mPct(p) { return '<span class="m-n">' + fmtN(p) + "٪</span>"; }
/* Money as a FULL amount: digits inside .m-n, the currency word outside it — the shape the
   reference screen prints (home-ds-crm.ts). opMoney/opMoneyShort stay in use where a cell is too
   narrow for the whole figure; they carry their own bdi and their own counted nouns. */
function mMoney(v) { return '<span class="m-n">' + fmtN(Math.round(Number(v) || 0)) + "</span> ر.س"; }

/* Arabic counts are four-way and .m-n is mandatory, and the two rules meet here. pluralizeArabic
   spells the count as a WORD for one and two («بند واحد», «بندان») — there are no digits to
   isolate — and prefixes the formatted number for everything else. So the digits are wrapped by
   splitting the phrase the domain rule already produced, never by re-implementing it. */
function mPlOf(n, phrase) {
  var i = phrase.indexOf(" ");
  if (Number(n) === 1 || Number(n) === 2 || i < 0) return phrase;
  return '<span class="m-n">' + phrase.slice(0, i) + "</span>" + phrase.slice(i);
}
function mPl(n, one, two, few, many) { return mPlOf(n, opPl(n, one, two, few, many)); }

/* A rate with no denominator is UNMEASURED, not zero and not missing data. It is a legitimate
   nothing, so it takes the quiet treatment rather than the owed one. */
function rxPct(p) { return p === null || p === undefined ? mNil("لم يُقَس", "none") : mPct(p); }
function rxLabel(key) {
  var s = (rxData && rxData.stages || []).filter(function (x) { return x.key === key; })[0];
  return s ? s.label : (typeof opStage === "function" ? opStage(key).label : key);
}
/* Tones resolve against the ladder THIS report was computed on, with the same domain resolver the
   board uses — so the colours agree, and a direct visit to #reports (before the board ever loaded the
   live ladder) cannot give two custom rungs the same fallback tone. */
function rxToneObj(key) {
  var st = (rxData && rxData.stages || []).slice().sort(function (a, b) { return a.position - b.position; });
  var open = st.filter(function (s) { return !s.terminal && s.key !== "won" && s.key !== "lost"; }).map(function (s) { return s.key; });
  var me = st.filter(function (s) { return s.key === key; })[0];
  return stageToneOf(key, me ? me.terminal : null, customToneIndex(open, key));
}
function rxTone(key) { var t = rxToneObj(key); return "--tn:" + t.solid + ";--tn-soft:" + t.soft + ";--tn-text:" + t.text; }
function rxColor(key) { return rxToneObj(key).solid; }
function rxDotFor(key) { return '<i class="ox-dot" style="background:' + rxColor(key) + '"></i>'; }

function rxCard(id, title, question, signal, body, action, wide) {
  var h = '<section class="m-card rx-card' + (wide ? " wide" : "") + '" aria-labelledby="rx_' + id + '">' +
    '<header><h3 class="m-card__t" id="rx_' + id + '">' + title + "</h3>" +
    '<p class="m-meta">' + question + "</p></header>";
  if (signal) h += '<div class="rx-sig">' + signal + "</div>";
  h += body;
  if (action) {
    var drills = action.stage || action.source || action.product || action.shortcut || (action.ids && action.ids.length);
    if (drills) {
      rxActions.push(action);
      /* A drill that carries ids may be capped; the button says so rather than opening «كل الراكد»
         and showing three hundred of a thousand. */
      var go = action.idsMore ? "افتح أول " + mN((action.ids || []).length) : "افتح هذه البنود";
      h += '<button class="rx-act" onclick="rxGo(' + (rxActions.length - 1) + ')">' + opIco("warn") + "<span>" + esc(action.text) + '</span><span class="go">' + go + '</span></button>';
    } else {
      h += '<div class="rx-act">' + opIco("check") + "<span>" + esc(action.text) + "</span></div>";
    }
  }
  return h + "</section>";
}

/* One signal per card: the figure, then the sentence that says what it is measured on. */
function rxSig(fig, words) {
  return '<b class="m-stat__v">' + fig + '</b><span class="m-meta">' + words + "</span>";
}

/* Counts this screen prints in TWO places are bound to the rows they are summed from, so the KPI
   strip and the card below it cannot drift apart (PORT-SPEC §6). headline.openLines and
   headline.unpricedOpen are themselves reductions over products.rows in pipeline-report-domain, so
   the derivation reads the same array both print sites do. */
function rxBind() {
  dsD("rxOpenLines", function () {
    return (rxData.report.products.rows || []).reduce(function (n, r) { return n + r.openLines; }, 0);
  });
  dsD("rxUnpriced", function () {
    return (rxData.report.products.rows || []).reduce(function (n, r) { return n + r.unpricedOpen; }, 0);
  });
  dsD("rxOverSla", function () { return rxData.report.velocity.overSla; });
}

/* «كم تحت السعر المعلن بيعت» — the same rollup the home card prints, from the same function, over the
   same rows. Computed from the deal lines in the browser rather than from the server report, and it
   says so: the exec report above it is the server's, and two figures that look alike must not be
   allowed to come from two different places without the reader being told. */
function rxOffListCard() {
  if (typeof opLoad === "function") opLoad(false);
  var rows = (typeof oppRows !== "undefined" && oppRows) ? oppRows : null;
  if (!rows) return "";
  var lines = rows.map(function (l) {
    return { value: opValue(l), quotedListPrice: l.quoted_list_price == null ? null : Number(l.quoted_list_price),
             qty: Number(l.qty || 1), years: Number(l.years || 1) };
  });
  var off = offListRollup(lines);
  var h = '<section class="m-card"><div class="m-card__h"><div>' +
    '<h2 class="m-card__t">الخصم عن السعر المعلن</h2>' +
    '<p class="m-meta">من البنود المرتبطة بباقة منشورة · بالمقارنة مع السعر وقت الربط، لا سعر اليوم</p>' +
    "</div></div>";
  if (off.pct === null) {
    h += '<div class="m-empty"><div class="m-empty__t">' + mNil("لا بند مرتبط بباقة", "none") + "</div>" +
      '<div class="m-empty__d">اربط البنود بباقاتها من سجل الفرصة ليصبح الفرق قابلًا للقياس.</div></div>';
    return h + "</section>";
  }
  var pctR = Math.round(off.pct);
  h += '<div class="m-stats">' +
    '<div class="m-stat"><span class="m-stat__k">الفرق</span><span class="m-stat__v"><span class="m-n">' +
      fmtN(pctR) + '٪</span></span><span class="m-stat__s">' +
      (off.pct >= 0 ? "أقل من المعلن" : "أعلى من المعلن") + "</span></div>" +
    '<div class="m-stat"><span class="m-stat__k">المعلن</span><span class="m-stat__v">' + mMoney(off.referenceTotal) + "</span>" +
      '<span class="m-stat__s">مجموع المرجع</span></div>' +
    '<div class="m-stat"><span class="m-stat__k">المتفق عليه</span><span class="m-stat__v">' + mMoney(off.valueTotal) + "</span>" +
      '<span class="m-stat__s">مجموع قيم البنود</span></div>' +
    '<div class="m-stat"><span class="m-stat__k">الفارق بالريال</span><span class="m-stat__v">' + mMoney(off.savedTotal) + "</span>" +
      '<span class="m-stat__s">' + mPlOf(off.withReference, opNLine(off.withReference)) + " من " + mN(off.lines) + "</span></div>" +
    "</div>";
  return h + "</section>";
}

function vReportsExec() {
  rxLoad(false);
  if (rxFailed && !rxData) {
    return '<div class="rx"><div class="m-alert" role="alert">' + opIco("warn") +
      '<span class="m-alert__d">تعذّر تحميل التقارير التنفيذية.</span>' +
      '<button class="m-btn" onclick="rxRetry()">أعد المحاولة</button></div></div>';
  }
  if (!rxData) return '<div class="rx" aria-busy="true">' + moSkeleton(3, ["w40", "w80", "w60"]) + "</div>";
  var r = rxData.report;
  rxActions = [];
  rxBind();
  var h = '<div class="rx">';
  h += '<div class="rx-head"><div><h2 class="m-h2">أين يتسرّب الأنبوب، وما الذي يتحرك؟</h2>' +
    '<div class="rx-meta m-meta"><span>محسوب من ' + mPlOf(r.lines, opNLine(r.lines)) + " وسجل انتقالات المراحل</span>" +
    (rxFailed ? '<span class="m-chip m-chip--warn" role="alert">تعذّر التحديث — المعروض من آخر قراءة ناجحة</span>' : "") +
    '<span>' + (rxLoading ? "جارٍ التحديث…" : "حُدِّث " + new Date(r.generatedAt).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" })) + "</span>" +
    '<button class="m-btn m-btn--quiet" onclick="rxRefresh()"' + (rxLoading ? " disabled" : "") + ">تحديث</button>" +
    (r.smallSample && r.lines ? '<span class="m-chip m-chip--warn">عيّنة صغيرة — كل نسبة معروضة مع عدد ما قيست عليه</span>' : "") + "</div></div>" +
    '<div class="m-seg" role="group" aria-label="مدة الحركة">' +
      [30, 90].map(function (d) {
        return '<button type="button" aria-pressed="' + (rxDays === d) + '" onclick="rxSetDays(' + d + ')">آخر ' + mN(d) + " يومًا</button>";
      }).join("") + "</div></div>";

  if (!r.lines) {
    return h + '<div class="m-card m-empty"><p class="m-empty__t">لا فرص بعد</p>' +
      '<p class="m-empty__d">تظهر التقارير التنفيذية حين تُسجَّل أول فرصة في «فرص البيع».</p></div></div>';
  }

  var hd = r.headline;
  var kpi = function (cls, label, value, sub) {
    return '<div class="rx-kpi ' + cls + '"><span class="m-stat__k">' + label + "</span>" +
      '<span class="m-stat__v">' + value + "</span>" +
      (sub ? '<span class="m-stat__s">' + sub + "</span>" : "") + "</div>";
  };
  h += '<div class="rx-kpis">' +
    kpi("lead", "القيمة المفتوحة", hd.pricedOpen ? opMoney(hd.openValue) : mNil("لا بند مسعّر مفتوح", "none"),
      /* «مرجّحة بوزن المرحلة» — a weighting the ladder stores, never a probability of winning. */
      (hd.weightedValue ? "المرجّحة بأوزان المراحل " + opMoneyShort(hd.weightedValue) : "لا قيمة مرجّحة") +
      (hd.unpricedOpen ? "، و" + dsFig("rxUnpriced", hd.unpricedOpen) + " بلا تسعير" : "")) +
    kpi("", "بنود مفتوحة", dsFig("rxOpenLines", hd.openLines), "") +
    kpi("", "نسبة الفوز", rxPct(hd.winRatePct),
      hd.wonCount + hd.lostCount
        ? mN(hd.wonCount) + " ربح من " + mN(hd.wonCount + hd.lostCount) + " محسومة" + (hd.winRateSmall ? " — عيّنة صغيرة" : "")
        : "لم تُحسم صفقة بعد") +
    kpi("", "دورة البيع (الوسيط)",
      hd.medianCycleDays === null ? mNil("لم تُقَس", "none") : mPlOf(hd.medianCycleDays, opNDay(hd.medianCycleDays)),
      hd.medianCycleDays === null ? "تُقاس على الصفقات الرابحة" : "من فتح الفرصة إلى الربح، على " + mPl(hd.cycleBasis, "صفقة واحدة", "صفقتين", "صفقات", "صفقة")) +
    /* pipeline_stages.sla_days is nullable and only two keys were ever backfilled, so a stage
       with no deadline scored 0 and summed into the headline. A flat «0» then read as "nothing
       is late" when most rungs cannot be judged at all. No stage with a deadline means no
       verdict, and a partial ladder says what it covered. */
    kpi(r.velocity.slaStages && r.velocity.overSla ? "warn" : "", "متأخرة عن المهلة",
      r.velocity.slaStages
        ? dsFig("rxOverSla", r.velocity.overSla)
        : mNil("لا مهلة مسجّلة", "unset"),
      r.velocity.slaStages
        ? (r.velocity.slaStages < r.velocity.openStages
            ? "على " + mN(r.velocity.slaStages) + " من " + mN(r.velocity.openStages) + " مرحلة لها مهلة مسجّلة"
            : (r.movement.quietOpen
                ? mPlOf(r.movement.quietOpen, opNLine(r.movement.quietOpen)) + " بلا حركة " + mN(r.movement.days) + " يومًا"
                : "كل البنود تحركت"))
        : "لا مهلة مسجّلة على أي مرحلة مفتوحة") +
    "</div>";

  h += '<div class="rx-grid">' + rxFunnel(r.funnel) + rxVelocity(r.velocity) + rxProducts(r.products) + rxSources(r.sources) + rxMovement(r.movement) + "</div>";
  h += rxOffListCard();
  if (rxData.valueBasis) {
    h += '<p class="rx-basis m-meta"><b>' + esc(rxData.valueBasis.label) + "</b> — " + esc(rxData.valueBasis.note) + "</p>";
  }
  return h + "</div>";
}

/* The chip between two bands says how many LEFT the rung and how many of them moved on — a rate with
   its own denominator, because «100٪» of one deal and of forty are different findings. */
function rxConv(st) {
  if (st.conversionPct === null) return mNil("لم يُحسم بعد", "none");
  return "انتقل " + rxPct(st.conversionPct) + " · " + mN(st.moved) + " من " + mN(st.decided);
}
function rxFunnel(f) {
  var top = Math.max(1, f.steps.length ? f.steps[0].reached : 0, f.won);
  var body = '<div class="rx-fun">';
  f.steps.forEach(function (s, i) {
    if (i > 0) {
      var prev = f.steps[i - 1];
      var weak = f.weakest && f.weakest.from === prev.key;
      body += '<div class="rx-conv' + (weak ? " weak" : "") + '" aria-hidden="true"><span>' + rxConv(prev) + "</span></div>";
    }
    body += rxRow("", '<span class="rx-lab">' + rxDotFor(s.key) + esc(s.label) + "</span>" +
      '<span class="band"><i style="width:' + Math.round((s.reached / top) * 100) + '%"></i></span>' +
      '<span class="rx-fig"><b>' + mN(s.reached) + "</b> وصلت · " + mN(s.now) + " الآن</span>",
      s.now ? { text: "", stage: s.key } : null,
      "افتح بنود «" + s.label + "» في «فرص البيع» — " + fmtN(s.now) + " الآن", rxTone(s.key));
  });
  var last = f.steps[f.steps.length - 1];
  if (last) body += '<div class="rx-conv' + (f.weakest && f.weakest.from === last.key ? " weak" : "") + '" aria-hidden="true"><span>' + rxConv(last) + "</span></div>";
  var wonKey = f.wonKey || "won";
  body += rxRow("", '<span class="rx-lab">' + rxDotFor(wonKey) + esc(rxLabel(wonKey)) + "</span>" +
    '<span class="band"><i style="width:' + Math.round((f.won / top) * 100) + '%"></i></span>' +
    '<span class="rx-fig"><b>' + mN(f.won) + "</b> ربح · " + mN(f.lost) + " خسارة</span>",
    f.won ? { text: "", stage: wonKey } : null,
    "افتح الصفقات الرابحة — " + fmtN(f.won), rxTone(wonKey));
  body += "</div>";
  /* The 100٪ branch CARRIES ITS DENOMINATOR: «100٪ of one decided deal» and «100٪ of forty» are
     different findings, and a bare 100٪ is the one that gets quoted in a meeting. */
  var sig = f.weakest
    ? rxSig(rxPct(f.weakest.conversionPct),
        "أضعف انتقال: «" + esc(rxLabel(f.weakest.from)) + "» ← «" + esc(rxLabel(f.weakest.to)) + "»، " +
        mN(f.weakest.moved) + " من " + mN(f.weakest.decided) +
        (f.lostUnplaced ? "، و" + mN(f.lostUnplaced) + " خسارة بلا مرحلة معروفة" : ""))
    : f.lostUnplaced
      ? rxSig(mN(f.lostUnplaced), "خسارة بلا مرحلة معروفة، فلا يمكن تحديد موضع تسرّبها")
    : f.measured
      ? rxSig(mPct(100), "لا تسرّب مقاس: كل فرصة غادرت مرحلة انتقلت إلى التالية، على " +
          mPl(f.decidedTotal, "فرصة واحدة محسومة", "فرصتين محسومتين", "فرص محسومة", "فرصة محسومة"))
      : rxSig(mNil("لم يُقَس", "none"), "لا انتقال يُقاس بعد: لم تغادر أي فرصة مرحلتها");
  return rxCard("fun", "قمع المراحل", "كم فرصة وصلت كل مرحلة، وكم ممن غادرها انتقل إلى التالية؟ الفرصة الباقية في مرحلتها لا تُحسب تسرّبًا.", sig, body, f.action, false);
}

function rxVelocity(v) {
  var scale = 1;
  v.steps.forEach(function (s) { scale = Math.max(scale, s.maxOpenDays || 0, s.slaDays || 0, s.medianDoneDays || 0); });
  var body = "<div>";
  v.steps.forEach(function (s) {
    var fig;
    if (s.openCount) {
      fig = "<b>" + mN(s.maxOpenDays) + "</b> الأقدم · " + mN(s.medianOpenDays) + " الوسيط" +
        (s.overSla ? ' · <span class="rx-over">' + mN(s.overSla) + " متأخرة</span>" : "");
    } else {
      fig = s.medianDoneDays === null
        ? mNil("لا بنود الآن", "none")
        : "كانت تستغرق " + (s.medianDoneDays < 1 ? "أقل من يوم" : mPl(s.medianDoneDays, "يومًا واحدًا", "يومين", "أيام", "يومًا"));
    }
    body += rxRow("", '<span class="rx-lab">' + rxDotFor(s.key) + esc(s.label) + "</span>" +
      '<span class="rx-track">' + (s.openCount ? '<i style="width:' + Math.max(2, Math.round(((s.maxOpenDays || 0) / scale) * 100)) + '%"></i>' : "") +
        (s.slaDays ? '<em class="rx-sla" title="المهلة ' + fmtN(s.slaDays) + ' يومًا" style="inset-inline-start:' + Math.min(100, Math.round((s.slaDays / scale) * 100)) + '%"></em>' : "") + "</span>" +
      '<span class="rx-fig">' + fig + "</span>",
      s.openCount ? { text: "", stage: s.key } : null,
      "افتح بنود «" + s.label + "» المفتوحة — " + fmtN(s.openCount), rxTone(s.key));
  });
  body += '</div><div class="rx-legend"><span><i class="ox-dot" style="background:var(--m-ink-2);inline-size:2px;block-size:12px;border-radius:0"></i>مهلة المرحلة</span><span>الأرقام بالأيام · الشريط = أقدم بند في المرحلة الآن</span></div>';
  var bn = v.steps.filter(function (s) { return s.key === v.bottleneck; })[0];
  /* «متأخرة عن المهلة» reads «—» when no open stage carries an SLA: a flat zero would say nothing
     is late on a ladder where lateness cannot be judged at all. The KPI strip above states the
     same fact from the same field, and dsD binds the two so they cannot drift. */
  var sig = v.overSla
    ? rxSig(dsFig("rxOverSla", v.overSla), "متأخرة عن مهلة مرحلتها — الأكثر في «" + esc(bn ? bn.label : "") + "»")
    : bn
      ? rxSig(mPlOf(bn.maxOpenDays || 0, opNDay(bn.maxOpenDays || 0)), "أطول بقاء الآن — «" + esc(bn.label) + "»")
      : rxSig(mNil("لا بنود مفتوحة", "none"), "لا مرحلة تحمل بندًا مفتوحًا الآن");
  return rxCard("vel", "زمن المراحل", "كم تبقى الفرصة في كل مرحلة، ومن تجاوز المهلة؟", sig, body, v.action, false);
}

function rxProducts(p) {
  var used = {};
  p.rows.forEach(function (r) { r.byStage.forEach(function (x) { used[x.key] = 1; }); });
  var legend = '<div class="rx-legend">' + (rxData.stages || []).filter(function (s) { return used[s.key]; })
    .sort(function (a, b) { return a.position - b.position; })
    .map(function (s) { return "<span>" + rxDotFor(s.key) + esc(s.label) + "</span>"; }).join("") + "</div>";
  var body = legend + "<div>";
  p.rows.forEach(function (r) {
    var said = r.byStage.map(function (x) { return rxLabel(x.key) + " " + fmtN(x.n); }).join("، ");
    body += rxRow("rx-prow", '<span class="rx-pn"><b>' + esc(r.product) + "</b><span>" + mPlOf(r.lines, opNLine(r.lines)) + " · فوز " + rxPct(r.winRatePct) + (r.wonCount + r.lostCount ? " (" + mN(r.wonCount) + " من " + mN(r.wonCount + r.lostCount) + ")" : "") + "</span></span>" +
      '<span class="rx-stack" role="img" aria-label="' + esc(said) + '">' + r.byStage.map(function (x) {
        return '<i style="flex:' + x.n + ' 1 0;background:' + rxColor(x.key) + '" title="' + esc(rxLabel(x.key)) + " " + fmtN(x.n) + '"></i>';
      }).join("") + "</span>" +
      '<span class="rx-fig">' + (r.openLines - r.unpricedOpen > 0
          ? "<b>" + opMoneyShort(r.openValue) + "</b> مفتوحة"
          : r.openLines ? mNil("لم يُسعَّر", "owed") : mNil("لا بنود مفتوحة", "none")) +
        (r.wonValue ? "<br>" + opMoneyShort(r.wonValue) + " ربح" : "") + "</span>",
      { text: "", stage: null, product: r.product },
      "افتح بنود «" + r.product + "» — " + fmtN(r.lines));
  });
  body += "</div>";
  var top = p.rows[0];
  var openN = 0, unpN = 0;
  p.rows.forEach(function (r) { openN += r.openLines; unpN += r.unpricedOpen; });
  /* When most open lines have no price, a value share is mostly silence: lead with the gap instead.
     Both counts are printed in the KPI strip too, so both go through dsFig. */
  var sig = openN && unpN * 2 >= openN
    ? rxSig(dsFig("rxUnpriced", unpN),
        "بلا سعر من أصل " + mPl(openN, "بند واحد مفتوح", "بندين مفتوحين", "بنود مفتوحة", "بندًا مفتوحًا") +
        " — حصص القيمة أدناه لا تشملها")
    : top && p.topSharePct !== null
    ? rxSig(rxPct(p.topSharePct), "من القيمة المفتوحة في «" + esc(top.product) + "»")
    : rxSig(mN(p.rows.length), p.rows.length === 1 ? "منتج في الأنبوب" : "منتجات في الأنبوب، ولا قيمة مسعَّرة بعد");
  return rxCard("prd", "المنتجات", "أي منتج يحمل الأنبوب، وفي أي مرحلة تقف بنوده؟", sig, body, p.action, true);
}

function rxSources(s) {
  var max = 1;
  s.rows.forEach(function (r) { max = Math.max(max, r.lines); });
  var labels = rxData.sourceLabels || {};
  var body = '<div class="rx-src">';
  s.rows.forEach(function (r) {
    body += rxRow("", '<span class="rx-lab">' + opIco(r.source in OPP_ICO ? r.source : "other") + esc(labels[r.source] || r.source) + "</span>" +
      '<span class="rx-track" style="width:' + Math.max(8, Math.round((r.lines / max) * 100)) + '%"><i style="width:' + (r.advancedPct || 0) + '%"></i></span>' +
      '<span class="rx-fig"><b>' + mN(r.lines) + "</b> · تقدّم " + rxPct(r.advancedPct) + " (" + mN(r.advanced) + ") · فوز " + rxPct(r.winRatePct) +
        (r.wonCount + r.lostCount ? " (" + mN(r.wonCount) + " من " + mN(r.wonCount + r.lostCount) + ")" : "") + "</span>",
      { text: "", stage: null, source: r.source },
      "افتح فرص «" + (labels[r.source] || r.source) + "» — " + fmtN(r.lines));
  });
  body += '</div><div class="rx-legend"><span><i class="ox-dot" style="background:var(--m-ac)"></i>تقدّمت بعد التواصل الأولي</span><span><i class="ox-dot" style="background:var(--m-ac-dim);box-shadow:inset 0 0 0 1px var(--m-ac-line)"></i>لم تتقدّم</span></div>';
  var best = s.rows.filter(function (r) { return r.source === s.best; })[0];
  var sig = s.level || s.leadTie
    ? rxSig(rxPct(s.topPct), s.level ? "المصادر المؤهلة متساوية في التقدّم" : "مصدران أو أكثر يتقاسمان أعلى تقدّم")
    : best
    ? rxSig(rxPct(best.advancedPct),
        "أعلى تقدّم بين " + mPl(s.eligible, "مصدر واحد", "مصدرين", "مصادر", "مصدرًا") +
        " لكلٍّ منها بندان أو أكثر — «" + esc(labels[best.source] || best.source) + "»")
    : rxSig(mNil("لم يُقَس", "none"),
        "لا ترتيب بعد: يُقارن المصدر حين يملك بندين أو أكثر، " +
        (s.eligible ? "ولا يملك ذلك الآن إلا مصدر واحد" : "ولا مصدر يملك ذلك الآن"));
  return rxCard("src", "مصادر الفرص", "أي قناة تُنتج فرصًا تتقدّم فعلًا؟", sig, body, s.action, false);
}

var RX_KINDS = [
  ["opened", "فُتحت", "#475569"], ["advanced", "تقدّمت", "#2563EB"], ["regressed", "تراجعت", "#B37F00"],
  ["won", "ربح", "#15803D"], ["lost", "خسارة", "#B91C1C"], ["reopened", "أُعيد فتحها", "#7C3AED"]
];
function rxMovement(m) {
  var maxWk = 1;
  m.weeks.forEach(function (w) {
    var t = 0; RX_KINDS.forEach(function (k) { t += w.counts[k[0]]; }); maxWk = Math.max(maxWk, t);
  });
  var body = '<div class="rx-kinds">' + RX_KINDS.map(function (k) {
    var n = m.totals[k[0]];
    return '<span class="m-chip m-chip--plain rx-kind' + (n ? "" : " zero") + '"><i class="ox-dot" style="background:' + k[2] + '"></i>' + k[1] + " <b>" + mN(n) + "</b></span>";
  }).join("") + "</div>";
  body += '<div class="rx-wks" role="img" aria-label="الحركة أسبوعيًا، الأقدم يمينًا">';
  m.weeks.forEach(function (w) {
    var t = 0, bars = "";
    RX_KINDS.forEach(function (k) {
      var n = w.counts[k[0]]; t += n;
      if (n) bars += '<i style="height:' + Math.round((n / maxWk) * 100) + '%;background:' + k[2] + '" title="' + k[1] + " " + fmtN(n) + '"></i>';
    });
    var d = new Date(w.endMs).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "numeric" });
    body += '<div class="rx-wk" title="الأسبوع المنتهي ' + esc(d) + '"><span class="t">' + (t ? mN(t) : "") + '</span><span class="col">' + bars + '</span><span class="d"><span class="m-n">' + esc(d) + "</span></span></div>";
  });
  body += "</div>";
  var moved = m.totals.advanced + m.totals.won;
  var sig = rxSig(mN(moved), "انتقال إلى الأمام أو ربح خلال " + mN(m.days) + " يومًا" +
    (m.wonValue ? "، صفقات رابحة بقيمتها الحالية " + opMoneyShort(m.wonValue) : "") +
    (m.lostValue ? "، وخاسرة " + opMoneyShort(m.lostValue) : ""));
  return rxCard("mov", "الحركة", "ماذا تغيّر في الأنبوب خلال الفترة؟", sig, body, m.action, false);
}
`;
