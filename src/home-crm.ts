// home-crm.ts — «الرئيسية» as the founder's prototype opens it: four figures, the health of the
// pipeline, and the partners' week. The bands below this one (sectors, products, quarters) are the
// exec band products-crm already ships; this file adds what the prototype has and Massar did not.
//
// The prototype's four health cards are static text. Here every one of them OPENS the deals it
// counted — the BR-RPT-004 rule: a figure a reader cannot follow is a claim, and this screen is read
// by the person who has to act on it.
//
// No backticks in this file (gate: check-crm-literals).

export const HOME_CRM_CSS = `
.hm { display:flex; flex-direction:column; gap:var(--s5); }
.hm-h { display:flex; align-items:baseline; gap:var(--s3); flex-wrap:wrap; }
.hm-h h2 { margin:0; font-size:var(--t-md); font-weight:600; color:var(--ink); }
.hm-h .s { font-size:var(--t-xs); color:var(--muted); }
.hm-h .sp { flex:1; }
.hm-lnk { font-family:inherit; font-size:var(--t-xs); font-weight:500; color:var(--accent-deep); background:none;
  border:0; cursor:pointer; padding:6px 8px; border-radius:var(--r-sm); text-decoration:none; }
@media (hover:hover) and (pointer:fine) { .hm-lnk:hover { background:var(--accent-bar-hover); } }
.hm-lnk:active { transform:scale(0.98); }

/* the four leading figures */
.hm-kpis { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:var(--s3); }
.hm-kpi { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); padding:var(--s4);
  display:flex; flex-direction:column; gap:4px; min-width:0; }
.hm-kpi .l { font-size:var(--t-xs); color:var(--muted); }
.hm-kpi .n { font-size:var(--t-2xl); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; line-height:1.15; }
.hm-kpi .n.none { color:var(--muted); }
.hm-kpi .u { font-size:var(--t-xs); color:var(--muted); font-weight:500; }
.hm-kpi.lead .n { color:var(--accent-deep); }

/* صحة خط البيع — one card per state, each one a door into its own deals */
.hm-health { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:var(--s3); }
.hm-st { position:relative; text-align:start; font-family:inherit; background:var(--paper); border:1px solid var(--line);
  border-radius:var(--r-lg); padding:var(--s4); display:flex; flex-direction:column; gap:6px; min-width:0; cursor:pointer;
  border-inline-start:3px solid var(--tn, var(--accent)); color:inherit;
  transition:background var(--fast) var(--ease), transform 160ms var(--ease); }
.hm-st[disabled] { cursor:default; opacity:1; }
@media (hover:hover) and (pointer:fine) { .hm-st:not([disabled]):hover { background:var(--surface); } }
.hm-st:not([disabled]):active { transform:scale(0.98); }
.hm-st .t { display:flex; align-items:center; gap:7px; font-size:var(--t-sm); font-weight:600; color:var(--tn-text, var(--ink)); }
.hm-st .n { font-size:var(--t-xl); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; line-height:1.15; }
.hm-st .hint { font-size:var(--t-xs); color:var(--muted); line-height:1.7; }
.hm-st .v { font-size:var(--t-xs); font-weight:600; color:var(--ink-2); font-variant-numeric:tabular-nums; margin-top:auto; }
.hm-st .go { position:absolute; inset-inline-start:var(--s3); inset-block-start:var(--s4); color:var(--accent-deep); display:flex; }
.hm-st .go svg { width:13px; height:13px; }

/* the partners' week */
.hm-pt { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); padding:var(--s4);
  display:flex; align-items:center; gap:var(--s5); flex-wrap:wrap; }
.hm-ring { flex:none; display:flex; align-items:center; gap:var(--s3); }
.hm-ring svg { width:78px; height:78px; transform:rotate(-90deg); }
.hm-ring .track { fill:none; stroke:var(--surface-2); stroke-width:9; }
.hm-ring .arc { fill:none; stroke:var(--accent); stroke-width:9; stroke-linecap:round;
  transition:stroke-dashoffset 420ms cubic-bezier(0.23, 1, 0.32, 1); }
.hm-ring .cap { font-size:var(--t-sm); font-weight:600; color:var(--ink); }
.hm-ring .cap span { display:block; font-size:var(--t-xs); font-weight:400; color:var(--muted); margin-top:2px; }
.hm-figs { display:flex; flex:1; min-width:0; flex-wrap:wrap; gap:var(--s4) var(--s5); }
.hm-fig { min-width:96px; border-inline-start:2px solid var(--line); padding-inline-start:var(--s3); }
.hm-fig:first-child { border-inline-start:0; padding-inline-start:0; }
/* one fact per line: label, figure, share. Inline spans ran «تم التواصل» and «2» and «33.3٪» together. */
.hm-fig .l, .hm-fig .n, .hm-fig .p { display:block; }
.hm-fig .l { font-size:var(--t-xs); color:var(--muted); }
.hm-fig .n { font-size:var(--t-lg); font-weight:600; font-variant-numeric:tabular-nums; line-height:1.3; margin-top:2px; }
.hm-fig .p { font-size:var(--t-xs); color:var(--muted); font-variant-numeric:tabular-nums; }
.hm-fig.ok .n { color:var(--s-ok-text, #12633F); }
.hm-fig.bad .n { color:var(--s-fail-text); }
.hm-fig.mute .n { color:var(--muted); }
.hm-state { font-size:var(--t-xs); color:var(--muted); padding:var(--s3) 0; display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; }

@media (prefers-reduced-motion: reduce) { .hm-ring .arc { transition:none; } }
@media (max-width: 1100px) { .hm-kpis, .hm-health { grid-template-columns:repeat(2, minmax(0,1fr)); } }
@media (max-width: 560px) {
  .hm-kpis, .hm-health { grid-template-columns:minmax(0,1fr); }
  .hm-st, .hm-lnk { min-height:44px; }
}
`;

export const HOME_CRM_JS = `
/* ---------- what the bands read ---------- */
var hmEsc = null, hmEscLoading = false, hmEscFailed = false;
var hmPt = null, hmPtLoading = false, hmPtFailed = false, hmPtWeek = "";

function hmT() { return { headers: { "x-admin-token": TOKEN } }; }

/* Open escalations decide «بانتظار الدعم». One read for the whole board — the drawer's own per-deal
   read stays where it is, because it must reflect a change the moment someone records one. */
function hmEscLoad(force) {
  if (hmEscLoading || (hmEsc && !force) || (hmEscFailed && !force)) return;
  hmEscLoading = true;
  fetch("/admin/escalations", hmT())
    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(function (j) { hmEsc = (j && j.escalations) || []; hmEscFailed = false; })
    .catch(function () { hmEscFailed = true; })
    .then(function () { hmEscLoading = false; render(false); });
}
function hmPtLoad(force) {
  if (hmPtLoading || (hmPt && !force) || (hmPtFailed && !force)) return;
  hmPtLoading = true;
  fetch("/admin/partners", hmT())
    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(function (j) { hmPt = j; hmPtWeek = (j && j.week) || ""; hmPtFailed = false; })
    .catch(function () { hmPtFailed = true; })
    .then(function () { hmPtLoading = false; render(false); });
}
window.hmRetry = function () { hmEscFailed = false; hmPtFailed = false; hmEscLoad(true); hmPtLoad(true); render(false); };

/* ---------- the health of the pipeline ---------- */
function hmOpenEscIds() {
  var ids = {};
  (hmEsc || []).forEach(function (e) { if (!e.resolvedAt && e.oppId != null) ids[e.oppId] = 1; });
  return ids;
}
function hmHealth() {
  var rows = (typeof oppRows !== "undefined" && oppRows) ? oppRows : [];
  var esc = hmOpenEscIds();
  var now = Date.now();
  return pipelineHealth(rows.map(function (l) {
    return {
      id: l.id,
      value: opValue(l),
      lost: opIsLost(l),
      won: opIsWon(l),
      stalled: opStalled(l),
      /* an escalation that nobody closed, on a line that is still open */
      awaitingSupport: opIsOpen(l) && !!esc[l.id]
    };
  }));
}
/* Each state opens exactly the deals it counted. «بانتظار الدعم» has no board filter of its own — it is
   read from the escalations table — so it travels as ids, the same mechanism the reports use. */
window.hmOpenState = function (key) {
  if (typeof opStg === "undefined") { location.hash = "#opps"; return; }
  var rows = (typeof oppRows !== "undefined" && oppRows) ? oppRows : [];
  var esc = hmOpenEscIds();
  opQ = ""; opStat = "all"; opOwn = "all"; opProd = ""; opStg = "all"; opShort = "";
  if (typeof opSetIds === "function") opSetIds(null, "");
  if (key === "late") opShort = "stalled";
  else if (key === "on_track") {
    var ok = rows.filter(function (l) { return opIsOpen(l) && !opStalled(l) && !esc[l.id]; }).map(function (l) { return l.id; });
    if (typeof opSetIds === "function") opSetIds(ok, "على المسار");
  } else if (key === "support") {
    var sup = rows.filter(function (l) { return opIsOpen(l) && esc[l.id]; }).map(function (l) { return l.id; });
    if (typeof opSetIds === "function") opSetIds(sup, "بانتظار الدعم");
  } else if (key === "rejected") {
    var lost = rows.filter(opIsLost).map(function (l) { return l.id; });
    if (typeof opSetIds === "function") opSetIds(lost, "مرفوضة");
  }
  opSel = {}; if (typeof PAGE !== "undefined") PAGE.opps = 1;
  location.hash = "#opps";
};

function hmIco(n) { return typeof opIco === "function" ? opIco(n) : ""; }
function hmMoney(v) { return typeof opMoneyShort === "function" ? opMoneyShort(v) : fmtN(Math.round(v || 0)) + " ر.س"; }
var HM_TONE = {
  on_track: "--tn:#12633F;--tn-text:#12633F",
  late: "--tn:#B37F00;--tn-text:#7A5600",
  support: "--tn:#2563EB;--tn-text:#1A47BE",
  rejected: "--tn:#8E2A27;--tn-text:#8E2A27"
};

function vHomeHealth() {
  if (typeof opLoad === "function") opLoad(false);
  hmEscLoad(false);
  var loading = (typeof oppLoading !== "undefined" && oppLoading) || hmEscLoading;
  var failed = (typeof oppFailed !== "undefined" && oppFailed) || hmEscFailed;
  var h = '<section class="hm"><div class="hm-h"><h2>صحة خط البيع</h2>' +
    '<span class="s">كل فرصة في حالة واحدة فقط — والمجموع هو خط البيع كاملًا.</span><span class="sp"></span>' +
    (hmEscFailed ? '<span class="s" role="alert">تعذّر قراءة سجل التصعيد — «بانتظار الدعم» غير مكتملة.</span><button class="hm-lnk" onclick="hmRetry()">أعد المحاولة</button>' : "") +
    "</div>";
  if (!((typeof oppRows !== "undefined" && oppRows)) && loading) {
    return h + '<div class="hm-state" aria-busy="true">جارٍ قراءة الفرص…</div></section>';
  }
  if (!((typeof oppRows !== "undefined" && oppRows)) && failed) {
    return h + '<div class="hm-state" role="alert">' + hmIco("warn") + 'تعذّر تحميل الفرص.<button class="hm-lnk" onclick="opRetry()">أعد المحاولة</button></div></section>';
  }
  var st = hmHealth();
  if (!st.total) {
    return h + '<div class="hm-state">لا فرص مسجّلة بعد — تظهر الحالات هنا فور تسجيل أول فرصة في «فرص البيع».</div></section>';
  }
  h += '<div class="hm-health">' + st.buckets.map(function (b) {
    var off = !b.count;
    return '<button type="button" class="hm-st"' + (off ? " disabled" : "") + ' style="' + (HM_TONE[b.key] || "") + '"' +
      (off ? "" : ' onclick="hmOpenState(&quot;' + b.key + '&quot;)"') +
      ' title="' + esc(b.hint) + (off ? "" : " — افتح هذه الفرص") + '">' +
      (off ? "" : '<span class="go" aria-hidden="true">' + hmIco("chevS") + "</span>") +
      '<span class="t">' + esc(b.label) + "</span>" +
      '<span class="n">' + fmtN(b.count) + "</span>" +
      '<span class="hint">' + esc(b.hint) + "</span>" +
      '<span class="v">' + hmMoney(b.value) + "</span></button>";
  }).join("") + "</div></section>";
  return h;
}

/* ---------- the partners' week ---------- */
function vHomePartners() {
  if (typeof meCan === "function" && !meCan("partners.view")) return "";
  hmPtLoad(false);
  var h = '<section class="hm"><div class="hm-h"><h2>ملخص أداء شركاء المبيعات</h2>' +
    '<span class="s">' + (hmPtWeek ? "أسبوع " + esc(hmPtWeek) : "الأسبوع الحالي") + "</span><span class=\\"sp\\"></span>" +
    '<a class="hm-lnk" href="#partners">عرض التفاصيل ←</a></div>';
  if (!hmPt && hmPtLoading) return h + '<div class="hm-state" aria-busy="true">جارٍ قراءة أسبوع الشركاء…</div></section>';
  if (!hmPt) {
    return h + '<div class="hm-state" role="alert">' + hmIco("warn") + 'تعذّر تحميل أداء الشركاء.<button class="hm-lnk" onclick="hmRetry()">أعد المحاولة</button></div></section>';
  }
  var wk = summarizeWeek(hmPt.targets || [], hmPt.results || []);
  var b = partnerWeekBand(wk);
  if (!b.target && !b.contacted) {
    return h + '<div class="hm-state">لا مستهدفات ولا نتائج في هذا الأسبوع — تُحدَّد من «شركاء المبيعات».</div></section>';
  }
  var pct = wholePct(attainmentPct(b.contacted, b.target));
  var R = 33, C = 2 * Math.PI * R;
  var dash = pct === null ? 0 : Math.max(0, Math.min(100, pct)) / 100 * C;
  var fig = function (cls, label, n, p, sub) {
    return '<div class="hm-fig ' + cls + '"><span class="l">' + label + "</span>" +
      '<span class="n">' + fmtN(n) + "</span>" +
      '<span class="p">' + (p === null || p === undefined ? esc(sub || "") : fmtN(p) + "٪ من المستهدف") + "</span></div>";
  };
  h += '<div class="hm-pt"><div class="hm-ring">' +
    '<svg viewBox="0 0 80 80" role="img" aria-label="تحقيق المستهدف ' + (pct === null ? "غير محسوب" : fmtN(pct) + "٪") + '">' +
    '<circle class="track" cx="40" cy="40" r="' + R + '"></circle>' +
    '<circle class="arc" cx="40" cy="40" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C - dash).toFixed(1) + '"></circle></svg>' +
    '<span class="cap">' + (pct === null ? "—" : fmtN(pct) + "٪") + "<span>تحقيق المستهدف</span></span></div>" +
    '<div class="hm-figs">' +
    fig("", "إجمالي المستهدف الأسبوعي", b.target, null, "منشأة متعاقد عليها") +
    fig("", "تم التواصل", b.contacted, b.contactedPct, "") +
    fig("ok", "العملاء المهتمون", b.interested, b.interestedPct, "") +
    fig("bad", "غير مهتمين", b.notInterested, b.notInterestedPct, "") +
    fig("mute", "لم يردوا", b.noReply, b.noReplyPct, "") +
    "</div></div></section>";
  return h;
}

/* ---------- the four leading figures ---------- */
function vHomeKpis() {
  if (typeof pcLoad === "function") pcLoad(false);
  if (typeof opLoad === "function") opLoad(false);
  var secs = (typeof pcSectors !== "undefined" && pcSectors && pcSectors.sectors) || [];
  var target = 0, achieved = 0;
  secs.forEach(function (s) { target += Number(s.target) || 0; achieved += Number(s.achieved) || 0; });
  var st = hmHealth();
  var pct = wholePct(attainmentPct(achieved, target));
  var kpi = function (cls, label, value, unit) {
    return '<div class="hm-kpi ' + cls + '"><span class="l">' + label + "</span>" + value +
      (unit ? '<span class="u">' + unit + "</span>" : "") + "</div>";
  };
  var money = function (v) { return '<span class="n">' + hmMoney(v) + "</span>"; };
  return '<div class="hm-kpis">' +
    kpi("", "المستهدف الإجمالي", target ? money(target) : '<span class="n none">—</span>', target ? "" : "لم يُحدَّد مستهدف بعد") +
    kpi("", "المحقق الإجمالي", money(achieved), "من الصفقات الرابحة") +
    kpi("lead", "نسبة الإنجاز", pct === null ? '<span class="n none">—</span>' : '<span class="n">' + fmtN(pct) + "٪</span>", pct === null ? "بلا مستهدف" : "من المستهدف") +
    kpi("", "الفرص المفتوحة", '<span class="n">' + fmtN(st.openCount) + "</span>", hmMoney(st.openValue)) +
    "</div>";
}

/* The whole executive opening, in the prototype's order. */
function vHomeExec() {
  return '<div class="hm">' + vHomeKpis() + vHomeHealth() + vHomePartners() + "</div>";
}
`;
