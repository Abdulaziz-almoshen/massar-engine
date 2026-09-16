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

/* ===== the four leading figures =====
   They used to be four identical white boxes, each holding one number in the middle of a lot of
   nothing: no point of view, no context, no way to tell at a glance whether the year is going well.
   DESIGN.md list rule 13 says a page must have a point of view — one figure leads at the size that
   says so. «نسبة الإنجاز» is that figure here, and it carries the bar it is a percentage OF. */
.hm-kpis { display:grid; grid-template-columns:1.5fr repeat(3, minmax(0,1fr)); gap:var(--s3); }
.hm-kpi { position:relative; background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg);
  padding:var(--s4); display:flex; flex-direction:column; gap:4px; min-width:0; overflow:hidden;
  /* an inner top highlight: a hairline card still has to read as a SURFACE, not as a drawn rectangle */
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9), var(--sh-0); }
.hm-kpi .l { font-size:var(--t-xs); color:var(--muted); font-weight:500; }
.hm-kpi .n { font-size:var(--t-2xl); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums;
  line-height:1.15; letter-spacing:0; }
.hm-kpi .n.none { color:var(--muted); font-size:var(--t-xl); }
.hm-kpi .u { font-size:var(--t-xs); color:var(--muted); font-weight:500; }
/* the lead tile: bigger figure, the accent ground, and the meter that gives the percentage a subject */
.hm-kpi.lead { background:linear-gradient(180deg, var(--accent-tint), var(--paper) 78%);
  border-color:var(--accent-mark); }
.hm-kpi.lead .l { color:var(--accent-deep); font-weight:600; }
.hm-kpi.lead .n { font-size:var(--t-num); font-weight:700; color:var(--accent-deep); line-height:1.05; }
.hm-kpi.lead .u { color:var(--ink-2); }
.hm-meter { height:8px; border-radius:var(--r-pill); background:var(--paper);
  box-shadow:inset 0 0 0 1px var(--accent-mark); overflow:hidden; margin-block-start:var(--s2); }
.hm-meter i { display:block; height:100%; border-radius:var(--r-pill); background:var(--accent);
  transition:width var(--slow) var(--ease); }
/* a supporting tile carries a quiet rule in its own tone, so four tiles are not four identical boxes */
.hm-kpi .rule { position:absolute; inset-block-end:0; inset-inline:0; height:2px; background:var(--tn, var(--line)); }
.hm-kpi.lead .rule { display:none; }

/* صحة خط البيع — one card per state, each one a door into its own deals */
.hm-health { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:var(--s3); }
.hm-st { position:relative; text-align:start; font-family:inherit; background:var(--paper); border:1px solid var(--line);
  border-radius:var(--r-lg); padding:var(--s4); display:flex; flex-direction:column; gap:6px; min-width:0; cursor:pointer;
  overflow:hidden; color:inherit; box-shadow:inset 0 1px 0 rgba(255,255,255,.9), var(--sh-0);
  transition:box-shadow var(--base) var(--ease), transform var(--base) var(--ease), border-color var(--fast) var(--ease); }
/* The state's own colour washes the head of the card instead of sitting as a 3px stripe nobody
   reads. The wash runs to paper well before the text, so every label keeps its measured contrast. */
.hm-st::before { content:""; position:absolute; inset-block-start:0; inset-inline:0; height:96px;
  background:linear-gradient(180deg, var(--tn-soft, var(--surface)), transparent); pointer-events:none; }
.hm-st > * { position:relative; }
.hm-st[disabled] { cursor:default; opacity:1; }
/* interior.dev: a hover lift is a promise the thing is clickable — and here it is, each card opens
   exactly the deals it counted. A disabled (zero-count) card makes no such promise. */
@media (hover:hover) and (pointer:fine) {
  .hm-st:not([disabled]):hover { box-shadow:var(--sh-3); transform:translateY(-2px); border-color:var(--tn, var(--line)); }
}
.hm-st:not([disabled]):active { transform:scale(0.98); transition-duration:120ms; }
.hm-st .t { display:flex; align-items:center; gap:7px; font-size:var(--t-sm); font-weight:600; color:var(--tn-text, var(--ink)); }
.hm-st .n { font-size:var(--t-2xl); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; line-height:1.1; }
.hm-st .n .u { font-size:var(--t-sm); font-weight:500; color:var(--tn-text, var(--muted)); }
.hm-st .hint { font-size:var(--t-xs); color:var(--muted); line-height:1.7; }
.hm-st .v { font-size:var(--t-xs); font-weight:600; color:var(--ink-2); font-variant-numeric:tabular-nums; margin-top:auto; }
/* the share of the whole pipeline — the figure above is a count, this says how big a slice it is */
.hm-sh { height:6px; border-radius:var(--r-pill); background:var(--surface-2); overflow:hidden; margin-block-start:var(--s2); }
.hm-sh i { display:block; height:100%; border-radius:var(--r-pill); background:var(--tn, var(--accent));
  transition:width var(--slow) var(--ease); }
.hm-st .go { position:absolute; inset-inline-start:var(--s3); inset-block-start:var(--s4); color:var(--accent-deep); display:flex; }
.hm-st .go svg { width:13px; height:13px; }

/* the partners' week */
.hm-pt { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); padding:var(--s4);
  display:flex; align-items:center; gap:var(--s5); flex-wrap:wrap;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9), var(--sh-0); }
/* The week's outcome as ONE bar, in the order a conversation goes: interested, not interested, no
   reply, then the untouched remainder of the target. Five columns separated by rules made the reader
   compare five numbers; a stacked bar shows the split without arithmetic. */
.hm-split { flex-basis:100%; display:flex; height:10px; border-radius:var(--r-pill); overflow:hidden;
  background:var(--surface-2); margin-block-start:var(--s2); }
.hm-split i { display:block; height:100%; transition:width var(--slow) var(--ease); }
.hm-split i.ok { background:#1E9E63; }
.hm-split i.bad { background:#D9534F; }
.hm-split i.mute { background:var(--s-off-mark, #767D89); }
.hm-legend { flex-basis:100%; display:flex; gap:var(--s3); flex-wrap:wrap; font-size:var(--t-xs); color:var(--muted); }
.hm-legend span { display:inline-flex; align-items:center; gap:6px; }
.hm-legend i { width:8px; height:8px; border-radius:2px; flex:none; }
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

/* ===== entrance =====
   Tiles rise 6px and fade in, staggered by --stagger (24ms, capped at 8 items per DESIGN.md §8).
   It plays ONCE per page load: #body is rewritten on every data load and keystroke, and an
   entrance replayed on each one is the jump §8.6 forbids — hence the .hm-in gate, set by
   vHomeExec on the first paint only. Never scale(0): the tiles start at their own size. */
.hm-in .hm-kpis > *, .hm-in .hm-health > *, .hm-in .hm-pt { animation:hmRise var(--base) var(--ease) both; }
.hm-in .hm-kpis > :nth-child(2), .hm-in .hm-health > :nth-child(2) { animation-delay:var(--stagger); }
.hm-in .hm-kpis > :nth-child(3), .hm-in .hm-health > :nth-child(3) { animation-delay:calc(var(--stagger) * 2); }
.hm-in .hm-kpis > :nth-child(4), .hm-in .hm-health > :nth-child(4) { animation-delay:calc(var(--stagger) * 3); }
.hm-in .hm-pt { animation-delay:calc(var(--stagger) * 4); }
@keyframes hmRise { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }

@media (prefers-reduced-motion: reduce) {
  .hm-ring .arc, .hm-meter i, .hm-sh i { transition:none; }
  .hm-in .hm-kpis > *, .hm-in .hm-health > *, .hm-in .hm-pt { animation:none; }
  .hm-st:not([disabled]):hover { transform:none; }
}
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
/* Mark, soft ground and text — the four-value status contract (DESIGN.md §2). The soft value is the
   card's wash; the text value is the only legal label on it. */
var HM_TONE = {
  on_track: "--tn:#1E9E63;--tn-soft:#E4F5EC;--tn-text:#12633F",
  late: "--tn:#B37F00;--tn-soft:#FFF5D6;--tn-text:#7A5600",
  support: "--tn:#2563EB;--tn-soft:#EAF1FE;--tn-text:#1A47BE",
  rejected: "--tn:#D9534F;--tn-soft:#FBE7E6;--tn-text:#8E2A27"
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
    var share = st.total ? Math.round((b.count / st.total) * 100) : 0;
    return '<button type="button" class="hm-st"' + (off ? " disabled" : "") + ' style="' + (HM_TONE[b.key] || "") + '"' +
      (off ? "" : ' onclick="hmOpenState(&quot;' + b.key + '&quot;)"') +
      ' title="' + esc(b.hint) + (off ? "" : " — افتح هذه الفرص") + '">' +
      (off ? "" : '<span class="go" aria-hidden="true">' + hmIco("chevS") + "</span>") +
      '<span class="t">' + esc(b.label) + "</span>" +
      '<span class="n">' + fmtN(b.count) + '<span class="u"> · ' + fmtN(share) + "٪</span></span>" +
      '<span class="hint">' + esc(b.hint) + "</span>" +
      '<span class="v">' + hmMoney(b.value) + "</span>" +
      '<span class="hm-sh" aria-hidden="true"><i style="width:' + share + '%"></i></span></button>';
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
    "</div>";
  /* Shares of the TARGET, so the untouched remainder is visible as the gap the bar does not fill. */
  var den = b.target || b.contacted || 0;
  var w = function (n) { return den ? Math.max(0, Math.min(100, (n / den) * 100)) : 0; };
  if (den) {
    h += '<span class="hm-split" role="img" aria-label="توزيع الأسبوع: ' +
      esc(fmtN(b.interested) + " مهتم، " + fmtN(b.notInterested) + " غير مهتم، " + fmtN(b.noReply) + " لم يرد، من " + fmtN(den)) + '">' +
      '<i class="ok" style="width:' + w(b.interested).toFixed(1) + '%"></i>' +
      '<i class="bad" style="width:' + w(b.notInterested).toFixed(1) + '%"></i>' +
      '<i class="mute" style="width:' + w(b.noReply).toFixed(1) + '%"></i></span>' +
      '<span class="hm-legend" aria-hidden="true">' +
      '<span><i style="background:#1E9E63"></i>مهتمون</span>' +
      '<span><i style="background:#D9534F"></i>غير مهتمين</span>' +
      '<span><i style="background:#767D89"></i>لم يردوا</span>' +
      '<span><i style="background:#E5E8EE"></i>لم يُتواصل بهم بعد</span></span>';
  }
  h += "</div></section>";
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
  var kpi = function (cls, tone, label, value, unit, extra) {
    return '<div class="hm-kpi ' + cls + '"' + (tone ? ' style="--tn:' + tone + '"' : "") + '><span class="l">' + label + "</span>" + value +
      (unit ? '<span class="u">' + unit + "</span>" : "") + (extra || "") +
      (cls === "lead" ? "" : '<span class="rule" aria-hidden="true"></span>') + "</div>";
  };
  var money = function (v) { return '<span class="n">' + hmMoney(v) + "</span>"; };
  /* The meter is what makes the percentage mean something: it is 49٪ OF a bar you can see. */
  var meter = pct === null ? "" :
    '<span class="hm-meter" aria-hidden="true"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></span>';
  return '<div class="hm-kpis">' +
    kpi("lead", "", "نسبة الإنجاز",
      pct === null ? '<span class="n none">لا مستهدف</span>' : '<span class="n">' + fmtN(pct) + "٪</span>",
      pct === null ? "حدِّد المستهدفات ليُحسب الإنجاز" : hmMoney(achieved) + " من " + hmMoney(target), meter) +
    kpi("", "var(--s-off)", "المستهدف الإجمالي", target ? money(target) : '<span class="n none">—</span>',
      target ? "لكل القطاعات" : "لم يُحدَّد مستهدف بعد", "") +
    kpi("", "var(--s-issued)", "المحقق الإجمالي", money(achieved), "من الصفقات الرابحة", "") +
    kpi("", "var(--accent)", "الفرص المفتوحة", '<span class="n">' + fmtN(st.openCount) + "</span>", hmMoney(st.openValue), "") +
    "</div>";
}

/* The whole executive opening, in the prototype's order.
   hmEntered gates the entrance animation to the FIRST paint: #body is rewritten on every data load,
   and an entrance that replays on each one is the jump DESIGN.md §8.6 forbids. */
var hmEntered = false;
function vHomeExec() {
  var cls = hmEntered ? "hm" : "hm hm-in";
  hmEntered = true;
  return '<div class="' + cls + '">' + vHomeKpis() + vHomeHealth() + vHomePartners() + "</div>";
}
`;
