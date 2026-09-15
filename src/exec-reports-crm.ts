// exec-reports-crm.ts — «نظرة تنفيذية»: the five pipeline reports, drawn.
//
// The rules live in pipeline-report-domain.ts and run on the server; this file only draws what
// /admin/reports/pipeline returns. Every card has the same grammar, because a CPO scans five of them
// in a row: a title and the question it answers, ONE signal figure, one chart whose geometry is the
// data, and one next action in words — never a paragraph (the «signals, not text» rule).
//
// Stage colours come from stage-tone-domain.ts through opTone() in opps-crm.ts, so a rung is the same
// colour here as on the board. Money goes through opMoney/opMoneyShort; every number through fmtN.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is spliced into dashboard.ts's template.

export const EXEC_REPORTS_CSS = `
.rx { display:flex; flex-direction:column; gap:var(--s3); container-type:inline-size; container-name:rxw; }
.rx-head { display:flex; align-items:flex-end; justify-content:space-between; gap:var(--s3); flex-wrap:wrap; }
.rx-q { font-size:var(--t-md); font-weight:600; color:var(--ink); line-height:var(--lh-tight); }
.rx-meta { font-size:var(--t-xs); color:var(--muted); margin-top:2px; display:flex; gap:var(--s2); flex-wrap:wrap; align-items:center; }
.rx-small { display:inline-flex; align-items:center; gap:4px; color:var(--s-attn-text); background:var(--s-attn-soft);
  border-radius:var(--r-pill); padding:0 8px; line-height:20px; font-weight:500; }
.rx-seg { display:inline-flex; background:var(--surface-2); border-radius:var(--r-md); padding:2px; }
.rx-seg button { font-family:inherit; font-size:var(--t-xs); font-weight:500; color:var(--muted-2); background:transparent; border:none;
  border-radius:var(--r-sm); min-height:30px; padding:0 12px; cursor:pointer; transition:background var(--fast) var(--ease), color var(--fast) var(--ease), transform 160ms var(--ease); }
.rx-seg button:active { transform:scale(0.97); }
.rx-seg button.on { background:var(--paper); color:var(--ink); box-shadow:0 0 0 1px var(--line); }
.rx :focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.rx-ref { font-family:inherit; font-size:var(--t-xs); font-weight:500; color:var(--accent-deep); background:transparent; border:none;
  cursor:pointer; padding:0 4px; min-height:24px; border-radius:var(--r-sm); }
.rx-ref:hover { text-decoration:underline; }
.rx-ref[disabled] { color:var(--s-off-text); cursor:default; text-decoration:none; }
/* DESIGN.md §3.10: 44px on a coarse pointer, the same floor the board's controls already meet. */
@media (pointer:coarse) {
  .rx-seg button, button.rx-act, .rx-ref { min-height:44px; }
}

/* KPI strip: one lead figure, the rest support it (DESIGN.md §5 Tile). */
.rx-kpis { display:grid; grid-template-columns:minmax(0,1.6fr) repeat(4,minmax(0,1fr)); background:var(--paper);
  border:1px solid var(--line); border-radius:var(--r-lg); }
.rx-kpi { padding:var(--s3) var(--s4); display:flex; flex-direction:column; gap:2px; min-width:0; }
.rx-kpi + .rx-kpi { border-inline-start:1px solid var(--line-soft); }
.rx-kpi .l { font-size:var(--t-xs); color:var(--muted); font-weight:500; }
.rx-kpi .n { font-size:var(--t-xl); font-weight:600; color:var(--ink); line-height:var(--lh-tight); font-variant-numeric:tabular-nums; }
.rx-kpi.lead .n { font-size:var(--t-2xl); }
.rx-kpi .n.none { color:var(--muted); font-weight:500; }
.rx-kpi .s { font-size:var(--t-xs); color:var(--muted); font-variant-numeric:tabular-nums; }
.rx-kpi.warn .n { color:var(--s-attn-text); }

.rx-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--s3); }
.rx-card { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); padding:var(--s4);
  display:flex; flex-direction:column; gap:var(--s3); min-width:0; }
.rx-card.wide { grid-column:1 / -1; }
.rx-card h3 { margin:0; font-size:var(--t-sm); font-weight:600; color:var(--ink); }
.rx-card header p { margin:2px 0 0; font-size:var(--t-xs); color:var(--muted); }
.rx-sig { display:flex; align-items:baseline; gap:var(--s2); flex-wrap:wrap; }
.rx-sig b { font-size:var(--t-2xl); font-weight:600; color:var(--ink); line-height:var(--lh-tight); font-variant-numeric:tabular-nums; }
.rx-sig b.none { color:var(--muted); font-weight:500; }
.rx-sig span { font-size:var(--t-xs); color:var(--muted); }
.rx-act { margin-top:auto; font-family:inherit; display:flex; align-items:flex-start; gap:var(--s2); text-align:start; width:100%;
  font-size:var(--t-xs); line-height:var(--lh-body); color:var(--ink-2); background:var(--surface); border:none;
  border-radius:var(--r-md); padding:var(--s2) var(--s3); }
.rx-act .ox-ico { width:14px; height:14px; margin-top:2px; color:var(--accent-deep); }
button.rx-act { cursor:pointer; transition:background var(--fast) var(--ease), transform 160ms var(--ease); }
button.rx-act:active { transform:scale(0.98); }
@media (hover:hover) and (pointer:fine) { button.rx-act:hover { background:var(--accent-bar-hover); } }
button.rx-act .go { margin-inline-start:auto; flex:none; color:var(--accent-deep); font-weight:500; }

/* shared row grammar: a label column, a track, a figure column */
.rx-row { display:grid; grid-template-columns:minmax(96px,132px) minmax(0,1fr) minmax(88px,auto); align-items:center;
  column-gap:var(--s2); min-height:30px; }
.rx-lab { font-size:var(--t-xs); color:var(--ink-2); display:flex; align-items:center; gap:6px; min-width:0; line-height:1.3; }
.rx-lab .ox-dot { flex:none; }
.rx-fig { font-size:var(--t-xs); color:var(--muted); font-variant-numeric:tabular-nums; text-align:end; white-space:nowrap; }
.rx-fig b { color:var(--ink); font-weight:600; font-size:var(--t-sm); }
.rx-track { position:relative; height:12px; background:var(--surface); border-radius:var(--r-pill); }
.rx-track > i { position:absolute; inset-block:0; inset-inline-start:0; border-radius:var(--r-pill); background:var(--tn, var(--accent));
  transform-origin:right center; animation:rxGrow 420ms cubic-bezier(0.23, 1, 0.32, 1) both; }
[dir="ltr"] .rx-track > i { transform-origin:left center; }
@keyframes rxGrow { from { transform:scaleX(0.6); opacity:0; } to { transform:scaleX(1); opacity:1; } }
@media (prefers-reduced-motion: reduce) { .rx-track > i, .rx-fun i, .rx-wk i { animation:none; } }

/* funnel: each band centred, so the narrowing between two bands IS the drop (DESIGN.md §6 rule 2) */
.rx-fun { display:flex; flex-direction:column; }
.rx-fun .rx-row { min-height:28px; }
.rx-fun .band { height:20px; display:flex; justify-content:center; }
.rx-fun i { display:block; height:100%; min-width:3px; border-radius:var(--r-sm); background:var(--tn); animation:rxGrow 420ms cubic-bezier(0.23, 1, 0.32, 1) both; }
.rx-conv { display:grid; grid-template-columns:minmax(96px,132px) minmax(0,1fr) minmax(88px,auto); column-gap:var(--s2); }
.rx-conv span { grid-column:2; justify-self:center; font-size:var(--t-xs); color:var(--muted); font-variant-numeric:tabular-nums; line-height:18px; }
.rx-conv.weak span { color:var(--s-attn-text); background:var(--s-attn-soft); border-radius:var(--r-pill); padding:0 8px; font-weight:500; }

/* velocity: bar = the oldest deal on the rung now; the tick = the rung's SLA */
.rx-sla { position:absolute; inset-block:-4px; width:2px; background:var(--ink-2); border-radius:var(--r-pill); }
.rx-over { color:var(--s-attn-text); font-weight:600; }

/* products: one stacked bar per product, segments in stage tones */
.rx-stack { display:flex; gap:2px; height:12px; border-radius:var(--r-pill); overflow:hidden; background:var(--surface); }
.rx-stack i { display:block; height:100%; min-width:4px; }
.rx-legend { display:flex; flex-wrap:wrap; gap:4px var(--s3); font-size:var(--t-xs); color:var(--ink-2); }
.rx-legend span { display:inline-flex; align-items:center; gap:5px; }
.rx-prow { grid-template-columns:minmax(120px,1.1fr) minmax(0,1.6fr) minmax(120px,auto); padding-block:6px; border-top:1px solid var(--line-soft); }
.rx-prow:first-of-type { border-top:none; }
.rx-pn { display:flex; flex-direction:column; min-width:0; }
.rx-pn b { font-size:var(--t-sm); font-weight:600; color:var(--ink); line-height:1.35; overflow-wrap:anywhere; }
.rx-pn span { font-size:var(--t-xs); color:var(--muted); font-variant-numeric:tabular-nums; }

/* sources: the track is every line, the fill is the share that moved past first contact */
.rx-src .rx-track { background:var(--accent-tint); }
.rx-src .rx-track > i { background:var(--accent); }

/* movement: weekly columns, stacked by kind; time runs right to left like the language */
.rx-wks { display:flex; align-items:flex-end; gap:var(--s2); height:132px; padding-top:var(--s2); }
.rx-wk { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; min-width:0; height:100%; }
.rx-wk .col { flex:1; width:100%; max-width:44px; display:flex; flex-direction:column-reverse; gap:2px; justify-content:flex-start; }
.rx-wk i { display:block; width:100%; border-radius:3px; min-height:3px; transform-origin:bottom center; animation:rxRise 420ms cubic-bezier(0.23, 1, 0.32, 1) both; }
@keyframes rxRise { from { transform:scaleY(0.4); opacity:0; } to { transform:scaleY(1); opacity:1; } }
.rx-wk .d { font-size:var(--t-xs); color:var(--muted); white-space:nowrap; font-variant-numeric:tabular-nums; }
.rx-wk .t { font-size:var(--t-xs); color:var(--ink-2); font-weight:600; font-variant-numeric:tabular-nums; min-height:16px; }
.rx-kinds { display:flex; flex-wrap:wrap; gap:var(--s1) var(--s2); }
.rx-kind { display:inline-flex; align-items:center; gap:6px; font-size:var(--t-xs); color:var(--ink-2); background:var(--surface);
  border-radius:var(--r-pill); padding:0 10px 0 8px; line-height:26px; }
.rx-kind b { font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; }
.rx-kind.zero, .rx-kind.zero b { color:var(--muted); font-weight:450; }

.rx-basis { font-size:var(--t-xs); color:var(--muted); line-height:var(--lh-body); padding-inline-start:9px;
  border-inline-start:2px solid var(--line); max-width:80ch; }
.rx-state { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; padding:var(--s4); background:var(--paper);
  border:1px solid var(--line); border-radius:var(--r-lg); font-size:var(--t-sm); color:var(--ink-2); }

@container rxw (max-width: 900px) {
  .rx-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .rx-kpi.lead { grid-column:1 / -1; }
  .rx-kpi + .rx-kpi { border-inline-start:none; }
  .rx-kpi:nth-child(n+2) { border-top:1px solid var(--line-soft); }
  .rx-kpi:nth-child(odd):not(.lead) { border-inline-start:1px solid var(--line-soft); }
  .rx-grid { grid-template-columns:minmax(0,1fr); }
}
@container rxw (max-width: 520px) {
  .rx-card { padding:var(--s3); }
  .rx-row, .rx-conv { grid-template-columns:minmax(84px,104px) minmax(0,1fr) auto; }
  .rx-prow { grid-template-columns:minmax(0,1fr) auto; row-gap:6px; }
  .rx-prow .rx-stack { grid-column:1 / -1; grid-row:2; }
  .rx-kpi { padding:var(--s2) var(--s3); }
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
  opSel = {}; if (typeof PAGE !== "undefined") PAGE.opps = 1;
  location.hash = "#opps";
};
var rxActions = [];

function rxPct(p) { return p === null || p === undefined ? "—" : fmtN(p) + "٪"; }
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
  var h = '<section class="rx-card' + (wide ? " wide" : "") + '" aria-labelledby="rx_' + id + '">' +
    '<header><h3 id="rx_' + id + '">' + title + "</h3><p>" + question + "</p></header>";
  if (signal) h += '<div class="rx-sig">' + signal + "</div>";
  h += body;
  if (action) {
    var drills = action.stage || action.source || action.product || action.shortcut;
    if (drills) {
      rxActions.push(action);
      h += '<button class="rx-act" onclick="rxGo(' + (rxActions.length - 1) + ')">' + opIco("warn") + "<span>" + esc(action.text) + '</span><span class="go">افتح هذه البنود</span></button>';
    } else {
      h += '<div class="rx-act">' + opIco("check") + "<span>" + esc(action.text) + "</span></div>";
    }
  }
  return h + "</section>";
}

function vReportsExec() {
  rxLoad(false);
  if (rxFailed && !rxData) {
    return '<div class="rx"><div class="rx-state" role="alert">' + opIco("warn") + "تعذّر تحميل التقارير التنفيذية." +
      '<button class="btn btn-ghost" onclick="rxRetry()">أعد المحاولة</button></div></div>';
  }
  if (!rxData) return '<div class="rx" aria-busy="true">' + moSkeleton(3, ["w40", "w80", "w60"]) + "</div>";
  var r = rxData.report;
  rxActions = [];
  var h = '<div class="rx">';
  h += '<div class="rx-head"><div><div class="rx-q">أين يتسرّب الأنبوب، وما الذي يتحرك؟</div>' +
    '<div class="rx-meta"><span>محسوب من ' + opNLine(r.lines) + " وسجل انتقالات المراحل</span>" +
    (rxFailed ? '<span class="rx-small" role="alert">' + opIco("warn") + "تعذّر التحديث — المعروض من آخر قراءة ناجحة</span>" : "") +
    '<span>' + (rxLoading ? "جارٍ التحديث…" : "حُدِّث " + new Date(r.generatedAt).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" })) + "</span>" +
    '<button class="rx-ref" onclick="rxRefresh()"' + (rxLoading ? " disabled" : "") + ">تحديث</button>" +
    (r.smallSample && r.lines ? '<span class="rx-small">' + opIco("warn") + "عيّنة صغيرة — كل نسبة معروضة مع عدد ما قيست عليه</span>" : "") + "</div></div>" +
    '<div class="rx-seg" role="group" aria-label="مدة الحركة">' +
      [30, 90].map(function (d) {
        return '<button class="' + (rxDays === d ? "on" : "") + '" aria-pressed="' + (rxDays === d) + '" onclick="rxSetDays(' + d + ')">آخر ' + fmtN(d) + " يومًا</button>";
      }).join("") + "</div></div>";

  if (!r.lines) {
    return h + shEmpty("chart", "لا فرص بعد", "تظهر التقارير التنفيذية حين تُسجَّل أول فرصة في «فرص البيع».") + "</div>";
  }

  var hd = r.headline;
  var kpi = function (cls, label, value, sub) {
    return '<div class="rx-kpi ' + cls + '"><span class="l">' + label + "</span>" + value + (sub ? '<span class="s">' + sub + "</span>" : "") + "</div>";
  };
  h += '<div class="rx-kpis">' +
    kpi("lead", "القيمة المفتوحة", hd.pricedOpen ? '<span class="n">' + opMoney(hd.openValue) + "</span>" : '<span class="n none">—</span>',
      (hd.weightedValue ? "المرجّحة بأوزان المراحل " + opMoneyShort(hd.weightedValue) : "لا قيمة مرجّحة") +
      (hd.unpricedOpen ? "، و" + opNLine(hd.unpricedOpen) + " بلا تسعير" : "")) +
    kpi("", "بنود مفتوحة", '<span class="n">' + fmtN(hd.openLines) + "</span>", "") +
    kpi("", "نسبة الفوز", '<span class="n' + (hd.winRatePct === null ? " none" : "") + '">' + rxPct(hd.winRatePct) + "</span>",
      hd.wonCount + hd.lostCount
        ? fmtN(hd.wonCount) + " ربح من " + fmtN(hd.wonCount + hd.lostCount) + " محسومة" + (hd.winRateSmall ? " — عيّنة صغيرة" : "")
        : "لم تُحسم صفقة بعد") +
    kpi("", "دورة البيع (الوسيط)", hd.medianCycleDays === null ? '<span class="n none">—</span>' : '<span class="n">' + opNDay(hd.medianCycleDays) + "</span>",
      hd.medianCycleDays === null ? "تُقاس على الصفقات الرابحة" : "من فتح الفرصة إلى الربح، على " + opPl(hd.cycleBasis, "صفقة واحدة", "صفقتين", "صفقات", "صفقة")) +
    kpi(r.velocity.overSla ? "warn" : "", "متأخرة عن المهلة", '<span class="n">' + fmtN(r.velocity.overSla) + "</span>",
      r.movement.quietOpen ? opNLine(r.movement.quietOpen) + " بلا حركة " + fmtN(r.movement.days) + " يومًا" : "كل البنود تحركت") +
    "</div>";

  h += '<div class="rx-grid">' + rxFunnel(r.funnel) + rxVelocity(r.velocity) + rxProducts(r.products) + rxSources(r.sources) + rxMovement(r.movement) + "</div>";
  if (rxData.valueBasis) h += '<div class="rx-basis"><b>' + esc(rxData.valueBasis.label) + "</b> — " + esc(rxData.valueBasis.note) + "</div>";
  return h + "</div>";
}

/* The chip between two bands says how many LEFT the rung and how many of them moved on — a rate with
   its own denominator, because «100٪» of one deal and of forty are different findings. */
function rxConv(st) {
  if (st.conversionPct === null) return "لم يُحسم بعد";
  return "انتقل " + rxPct(st.conversionPct) + " · " + fmtN(st.moved) + " من " + fmtN(st.decided);
}
function rxFunnel(f) {
  var top = Math.max(1, f.steps.length ? f.steps[0].reached : 0, f.won);
  var body = '<div class="rx-fun" role="list">';
  f.steps.forEach(function (s, i) {
    if (i > 0) {
      var prev = f.steps[i - 1];
      var weak = f.weakest && f.weakest.from === prev.key;
      body += '<div class="rx-conv' + (weak ? " weak" : "") + '" aria-hidden="true"><span>' + rxConv(prev) + "</span></div>";
    }
    body += '<div class="rx-row" role="listitem" style="' + rxTone(s.key) + '">' +
      '<span class="rx-lab">' + rxDotFor(s.key) + esc(s.label) + "</span>" +
      '<span class="band"><i style="width:' + Math.round((s.reached / top) * 100) + '%"></i></span>' +
      '<span class="rx-fig"><b>' + fmtN(s.reached) + "</b> وصلت · " + fmtN(s.now) + " الآن</span></div>";
  });
  var last = f.steps[f.steps.length - 1];
  if (last) body += '<div class="rx-conv' + (f.weakest && f.weakest.from === last.key ? " weak" : "") + '" aria-hidden="true"><span>' + rxConv(last) + "</span></div>";
  var wonKey = f.wonKey || "won";
  body += '<div class="rx-row" role="listitem" style="' + rxTone(wonKey) + '">' +
    '<span class="rx-lab">' + rxDotFor(wonKey) + esc(rxLabel(wonKey)) + "</span>" +
    '<span class="band"><i style="width:' + Math.round((f.won / top) * 100) + '%"></i></span>' +
    '<span class="rx-fig"><b>' + fmtN(f.won) + "</b> ربح · " + fmtN(f.lost) + " خسارة</span></div>";
  body += "</div>";
  var sig = f.weakest
    ? "<b>" + rxPct(f.weakest.conversionPct) + "</b><span>أضعف انتقال: «" + esc(rxLabel(f.weakest.from)) + "» ← «" + esc(rxLabel(f.weakest.to)) + "»، " + fmtN(f.weakest.moved) + " من " + fmtN(f.weakest.decided) + "</span>"
    : f.lostUnplaced
      ? "<b>" + fmtN(f.lostUnplaced) + "</b><span>خسارة بلا مرحلة معروفة، فلا يمكن تحديد موضع تسرّبها</span>"
    : f.measured
      ? "<b>" + rxPct(100) + "</b><span>لا تسرّب مقاس: كل فرصة غادرت مرحلة انتقلت إلى التالية</span>"
      : '<b class="none">—</b><span>لا انتقال يُقاس بعد: لم تغادر أي فرصة مرحلتها</span>';
  return rxCard("fun", "قمع المراحل", "كم فرصة وصلت كل مرحلة، وكم ممن غادرها انتقل إلى التالية؟ الفرصة الباقية في مرحلتها لا تُحسب تسرّبًا.", sig, body, f.action, false);
}

function rxVelocity(v) {
  var scale = 1;
  v.steps.forEach(function (s) { scale = Math.max(scale, s.maxOpenDays || 0, s.slaDays || 0, s.medianDoneDays || 0); });
  var body = '<div role="list">';
  v.steps.forEach(function (s) {
    var fig;
    if (s.openCount) {
      fig = "<b>" + fmtN(s.maxOpenDays) + "</b> الأقدم · " + fmtN(s.medianOpenDays) + " الوسيط" +
        (s.overSla ? ' · <span class="rx-over">' + fmtN(s.overSla) + " متأخرة</span>" : "");
    } else {
      fig = s.medianDoneDays === null ? "لا بنود الآن" : "كانت تستغرق " + (s.medianDoneDays < 1 ? "أقل من يوم" : opPl(s.medianDoneDays, "يومًا واحدًا", "يومين", "أيام", "يومًا"));
    }
    body += '<div class="rx-row" role="listitem" style="' + rxTone(s.key) + '">' +
      '<span class="rx-lab">' + rxDotFor(s.key) + esc(s.label) + "</span>" +
      '<span class="rx-track">' + (s.openCount ? '<i style="width:' + Math.max(2, Math.round(((s.maxOpenDays || 0) / scale) * 100)) + '%"></i>' : "") +
        (s.slaDays ? '<em class="rx-sla" title="المهلة ' + fmtN(s.slaDays) + ' يومًا" style="inset-inline-start:' + Math.min(100, Math.round((s.slaDays / scale) * 100)) + '%"></em>' : "") + "</span>" +
      '<span class="rx-fig">' + fig + "</span></div>";
  });
  body += '</div><div class="rx-legend"><span><i class="ox-dot" style="background:var(--ink-2);width:2px;height:12px;border-radius:0"></i>مهلة المرحلة</span><span>الأرقام بالأيام · الشريط = أقدم بند في المرحلة الآن</span></div>';
  var bn = v.steps.filter(function (s) { return s.key === v.bottleneck; })[0];
  var sig = v.overSla
    ? "<b>" + fmtN(v.overSla) + "</b><span>متأخرة عن مهلة مرحلتها — الأكثر في «" + esc(bn ? bn.label : "") + "»</span>"
    : bn ? "<b>" + opNDay(bn.maxOpenDays || 0) + "</b><span>أطول بقاء الآن — «" + esc(bn.label) + "»</span>" : '<b class="none">—</b><span>لا بنود مفتوحة</span>';
  return rxCard("vel", "زمن المراحل", "كم تبقى الفرصة في كل مرحلة، ومن تجاوز المهلة؟", sig, body, v.action, false);
}

function rxProducts(p) {
  var used = {};
  p.rows.forEach(function (r) { r.byStage.forEach(function (x) { used[x.key] = 1; }); });
  var legend = '<div class="rx-legend">' + (rxData.stages || []).filter(function (s) { return used[s.key]; })
    .sort(function (a, b) { return a.position - b.position; })
    .map(function (s) { return "<span>" + rxDotFor(s.key) + esc(s.label) + "</span>"; }).join("") + "</div>";
  var body = legend + '<div role="list">';
  p.rows.forEach(function (r) {
    var said = r.byStage.map(function (x) { return rxLabel(x.key) + " " + fmtN(x.n); }).join("، ");
    body += '<div class="rx-row rx-prow" role="listitem">' +
      '<span class="rx-pn"><b>' + esc(r.product) + "</b><span>" + opNLine(r.lines) + " · فوز " + rxPct(r.winRatePct) + (r.wonCount + r.lostCount ? " (" + fmtN(r.wonCount) + " من " + fmtN(r.wonCount + r.lostCount) + ")" : "") + "</span></span>" +
      '<span class="rx-stack" role="img" aria-label="' + esc(said) + '">' + r.byStage.map(function (x) {
        return '<i style="flex:' + x.n + ' 1 0;background:' + rxColor(x.key) + '" title="' + esc(rxLabel(x.key)) + " " + fmtN(x.n) + '"></i>';
      }).join("") + "</span>" +
      '<span class="rx-fig">' + (r.openLines - r.unpricedOpen > 0 ? "<b>" + opMoneyShort(r.openValue) + "</b> مفتوحة" : r.openLines ? "بلا تسعير" : "لا مفتوح") +
        (r.wonValue ? "<br>" + opMoneyShort(r.wonValue) + " ربح" : "") + "</span></div>";
  });
  body += "</div>";
  var top = p.rows[0];
  var openN = 0, unpN = 0;
  p.rows.forEach(function (r) { openN += r.openLines; unpN += r.unpricedOpen; });
  /* When most open lines have no price, a value share is mostly silence: lead with the gap instead. */
  var sig = openN && unpN * 2 >= openN
    ? "<b>" + fmtN(unpN) + "</b><span>بلا سعر من أصل " + opPl(openN, "بند واحد مفتوح", "بندين مفتوحين", "بنود مفتوحة", "بندًا مفتوحًا") + " — حصص القيمة أدناه لا تشملها</span>"
    : top && p.topSharePct !== null
    ? "<b>" + rxPct(p.topSharePct) + "</b><span>من القيمة المفتوحة في «" + esc(top.product) + "»</span>"
    : "<b>" + fmtN(p.rows.length) + "</b><span>" + (p.rows.length === 1 ? "منتج في الأنبوب" : "منتجات في الأنبوب، ولا قيمة مسعَّرة بعد") + "</span>";
  return rxCard("prd", "المنتجات", "أي منتج يحمل الأنبوب، وفي أي مرحلة تقف بنوده؟", sig, body, p.action, true);
}

function rxSources(s) {
  var max = 1;
  s.rows.forEach(function (r) { max = Math.max(max, r.lines); });
  var labels = rxData.sourceLabels || {};
  var body = '<div class="rx-src" role="list">';
  s.rows.forEach(function (r) {
    body += '<div class="rx-row" role="listitem">' +
      '<span class="rx-lab">' + opIco(r.source in OPP_ICO ? r.source : "other") + esc(labels[r.source] || r.source) + "</span>" +
      '<span class="rx-track" style="width:' + Math.max(8, Math.round((r.lines / max) * 100)) + '%"><i style="width:' + (r.advancedPct || 0) + '%"></i></span>' +
      '<span class="rx-fig"><b>' + fmtN(r.lines) + "</b> · تقدّم " + rxPct(r.advancedPct) + " (" + fmtN(r.advanced) + ") · فوز " + rxPct(r.winRatePct) +
        (r.wonCount + r.lostCount ? " (" + fmtN(r.wonCount) + " من " + fmtN(r.wonCount + r.lostCount) + ")" : "") + "</span></div>";
  });
  body += '</div><div class="rx-legend"><span><i class="ox-dot" style="background:var(--accent)"></i>تقدّمت بعد التواصل الأولي</span><span><i class="ox-dot" style="background:var(--accent-tint);box-shadow:inset 0 0 0 1px var(--accent-mark)"></i>لم تتقدّم</span></div>';
  var best = s.rows.filter(function (r) { return r.source === s.best; })[0];
  var sig = best
    ? "<b>" + rxPct(best.advancedPct) + "</b><span>أعلى تقدّم بين " + opPl(s.eligible, "مصدر واحد", "مصدرين", "مصادر", "مصدرًا") + " لكلٍّ منها بندان أو أكثر — «" + esc(labels[best.source] || best.source) + "»</span>"
    : '<b class="none">—</b><span>لا ترتيب بعد: يُقارن المصدر حين يملك بندين أو أكثر، ' + (s.eligible ? "ولا يملك ذلك الآن إلا مصدر واحد" : "ولا مصدر يملك ذلك الآن") + "</span>";
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
    return '<span class="rx-kind' + (n ? "" : " zero") + '"><i class="ox-dot" style="background:' + k[2] + '"></i>' + k[1] + " <b>" + fmtN(n) + "</b></span>";
  }).join("") + "</div>";
  body += '<div class="rx-wks" role="img" aria-label="الحركة أسبوعيًا، الأقدم يمينًا">';
  m.weeks.forEach(function (w) {
    var t = 0, bars = "";
    RX_KINDS.forEach(function (k) {
      var n = w.counts[k[0]]; t += n;
      if (n) bars += '<i style="height:' + Math.round((n / maxWk) * 100) + '%;background:' + k[2] + '" title="' + k[1] + " " + fmtN(n) + '"></i>';
    });
    var d = new Date(w.endMs).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "numeric" });
    body += '<div class="rx-wk" title="الأسبوع المنتهي ' + esc(d) + '"><span class="t">' + (t ? fmtN(t) : "") + '</span><span class="col">' + bars + '</span><span class="d">' + esc(d) + "</span></div>";
  });
  body += "</div>";
  var moved = m.totals.advanced + m.totals.won;
  var sig = "<b>" + fmtN(moved) + "</b><span>انتقال إلى الأمام أو ربح خلال " + fmtN(m.days) + " يومًا" +
    (m.wonValue ? "، صفقات رابحة بقيمتها الحالية " + opMoneyShort(m.wonValue) : "") + (m.lostValue ? "، وخاسرة " + opMoneyShort(m.lostValue) : "") + "</span>";
  return rxCard("mov", "الحركة", "ماذا تغيّر في الأنبوب خلال الفترة؟", sig, body, m.action, false);
}
`;
