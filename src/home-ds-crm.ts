// home-ds-crm.ts — «الرئيسية», laid out as the founder's reference (Nexora AI Analytics).
//
// THE LAYOUT IS THE FOUNDER'S, THE FIGURES ARE THE RECORDS'. He supplied the reference on
// 2026-09-19 and asked for it exactly: four KPI cards with mini-charts, a wide chart beside a
// pipeline list, then three cards — a recent-activity table, a goal with a progress bar, and a
// donut with a legend. Every slot below keeps that shape and is filled from what Massar stores.
//
// WHERE THE REFERENCE INVENTS, THIS DOES NOT. The specimen carries six months of revenue, growth
// percentages under every figure, and a portfolio split. This company has one month of history, no
// closed deal, and one recorded target. So a slot with nothing behind it says so — the three typed
// absences (PORT-SPEC §4), never a dash and never a zero standing in for a number nobody recorded.
// A change line is printed only where a real past exists: counts carry created_at, so «+N في آخر 30
// يومًا» is measured; revenue has no month unlike another, so it says «لا صفقة مغلقة» instead.
//
// MOTION. This surface repaints on every route change and every app open, so nothing animates on
// paint — no growing bars, no staggered cards.
//
// SCOPED. The markup is wrapped in .ds6, the only place massar-ds-crm.ts can reach.
//
// (No backticks anywhere below, including in comments: this is one template literal.)

export const HOME_DS_JS = `
/* The year the performance read is keyed by. pcQuarters carries it; fall back to the calendar
   year rather than inventing a fiscal one. */
function hdsYear() {
  return (typeof pcQuarters !== "undefined" && pcQuarters && pcQuarters.year)
    ? Number(pcQuarters.year) : new Date().getFullYear();
}

/* Every count on this page comes from here, so a summary and the card under it cannot disagree.
   That was Astra's finding 5: the rail said six products, the page said "five of six", the truth
   was eight and seven. Three numbers, one fact, none of them derived from the others. */
function hdsFacts() {
  var year = hdsYear();
  var perf = (typeof pcPerf !== "undefined" && pcPerf && pcPerf[year]) ? pcPerf[year] : null;
  var rows = [];
  if (perf) { for (var k in perf) { if (Object.prototype.hasOwnProperty.call(perf, k)) rows.push(perf[k]); } }

  var withTarget = rows.filter(function (p) { return p.annualTarget !== null && p.annualTarget !== undefined; });
  var achieved = 0, openValue = 0, openLines = 0, unpriced = 0, recorded = 0;
  rows.forEach(function (p) {
    achieved += Number(p.achieved) || 0;
    openValue += Number(p.openValue) || 0;
    openLines += Number(p.openLines) || 0;
    unpriced += Number(p.unpricedOpenLines) || 0;
  });
  withTarget.forEach(function (p) { recorded += Number(p.annualTarget) || 0; });

  /* When exactly one product carries the only target, the target has a NAME and a SCOPE, and
     saying them is the difference between a company figure and a product figure. */
  var only = withTarget.length === 1 ? withTarget[0] : null;
  var scope = "";
  if (only) {
    var qs = (only.quarters || []).filter(function (q) { return q.target !== null && q.target !== undefined; });
    scope = qs.length === 1 ? ("الربع " + hdsQName(qs[0].quarter) + " فقط")
      : (qs.length && qs.length < 4 ? (fmtN(qs.length) + " أرباع من أربعة") : "السنة كاملة");
  }
  return {
    year: year, loaded: !!perf, products: rows.length, rows: rows,
    withTarget: withTarget.length, noTarget: rows.length - withTarget.length,
    recorded: recorded, achieved: achieved,
    openValue: openValue, openLines: openLines, unpriced: unpriced,
    onlyProduct: only ? only.product : "", onlyScope: scope
  };
}

/* The open lines, priced first, each with how long it has stood still. opDays is days in the
   CURRENT STAGE (stage_at, falling back to created_at) — the only movement signal the ledger
   actually stores. It is not the age of the deal, and the card says so. */
function hdsLines() {
  var rows = (typeof oppRows !== "undefined" && oppRows) ? oppRows : [];
  var open = rows.filter(function (l) { return opIsOpen(l); });
  return open.map(function (l) {
    return { id: l.id, account: l.account_name || "", product: l.product || "",
             stage: l.stage, source: l.source || "", value: opValue(l), days: opDays(l),
             /* Carried so the discount-off-list rollup reads the SAME array this screen renders. */
             quotedListPrice: l.quoted_list_price == null ? null : Number(l.quoted_list_price),
             qty: Number(l.qty || 1), years: Number(l.years || 1) };
  }).sort(function (a, b) {
    if (!a.value !== !b.value) return a.value ? -1 : 1;   /* priced first */
    return b.days - a.days;
  });
}

/* A year is a label, not a quantity. fmtN groups thousands and printed «2,026» on the live
   page the first time this shipped. */
function hdsYearTxt(y) { return String(y); }
function hdsQName(q) { return ["", "الأول", "الثاني", "الثالث", "الرابع"][Number(q)] || String(q); }

/* Arabic counts are four-way, never «n + noun». opPl carries the business tier's rule and
   returns PLAIN TEXT, so it is what goes inside an aria-label. */
function hdsPl(n, one, two, few, many) {
  return (typeof opPl === "function") ? opPl(n, one, two, few, many) : (fmtN(n) + " " + many);
}
/* The counted noun ALONE, for the places where the figure is already printed in its own slot
   beside the label. Arabic agreement is four-way and depends on the count even when the count
   is not repeated next to the word: «6 بنود» takes جمع القلة, «11 بندًا» takes التمييز. */
function hdsNoun(n, one, two, few, many) {
  n = Math.abs(Number(n) || 0) % 100;
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return few;
  return many;
}
function hdsN(v) { return '<span class="m-n">' + fmtN(v) + "</span>"; }
/* Money and percent go INSIDE the isolate or they render on the wrong side of the digits. */
function hdsMoney(v) { return '<span class="m-n">' + fmtN(Math.round(v)) + " ر.س</span>"; }

/* kind: "owed" a number someone owes, "unset" a classification nobody made, "none" a
   legitimate nothing. Drawing all three the same is how a page of dashes teaches the reader
   to stop seeing dashes. */
function hdsNil(t, kind) {
  return '<span class="m-nil--' + (kind || "none") + '">' + esc(t) + "</span>";
}

/* Bind the counts this screen prints to the arrays it renders them from. A figure marked with
   dsFig is re-derived on every paint; if the markup and the records ever disagree, the number is
   outlined and the console names the key. Astra's finding 5 was three numbers for one fact — that
   is now a runtime error rather than something the next reviewer has to notice. */
function hdsBind() {
  dsD("products",  function () { return hdsFacts().products; });
  dsD("noTarget",  function () { return hdsFacts().noTarget; });
  dsD("withTarget",function () { return hdsFacts().withTarget; });
  dsD("nLines",    function () { return hdsLines().length; });
  dsD("unpriced",  function () { return hdsLines().filter(function (l) { return !l.value; }).length; });
  dsD("priced",    function () { return hdsLines().filter(function (l) { return l.value > 0; }).length; });
  dsD("maxDays",   function () {
    var ls = hdsLines(); if (!ls.length) return 0;
    return Math.max.apply(null, ls.map(function (l) { return l.days; }));
  });
  dsD("acN",       function () { return hdsAccounts().total; });
  dsD("acNoOwner", function () { return hdsAccounts().noOwner; });
}

/* ---------- icons ----------
   Inline paths rather than a <symbol> sprite: the shell owns <body>, this screen owns a fragment,
   and a sprite defined inside a fragment that gets replaced on every route change is a sprite
   whose <use> references break the moment another screen paints over it. */
var HDS_ICONS = {
  stages: '<path d="M20 5H7m13 7H4m16 7H10"/><circle cx="4" cy="5" r="1"/><circle cx="7" cy="19" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l-3 2"/>',
  campaign: '<path d="m4 9 13-5v16L4 15Zm0 0v6H2V9m6 8 1 4h4l-2-5m9-7 2-1m-2 8 2 1"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  wallet: '<path d="M20 8H5a2 2 0 0 1 0-4h13v4M4 8v12h16V8m0 5h-5v3h5"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/>',
  check: '<path d="m5 13 4 4L19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  lift: '<path d="M12 19V5m-6 6 6-6 6 6"/>'
};
function hdsIcon(n) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (HDS_ICONS[n] || "") + "</svg>";
}

/* ============================================================================================
   THE LAYOUT, AS THE FOUNDER SPECIFIED IT (Nexora AI Analytics, 2026-09-19: «must be like this
   exact»): a row of four KPI cards each with an icon, a figure, a change line and a small chart;
   a wide chart card beside a pipeline list; then three cards — a recent-activity table, a goal
   with a progress bar, and a donut with a legend.

   EVERY SLOT IS FILLED FROM THE RECORDS. The reference is a specimen full of invented history; this
   company has one month of it. So each slot keeps its SHAPE and takes the nearest thing Massar
   actually stores, and where the records hold nothing the slot says so rather than drawing a line
   that implies a past nobody recorded:

     Total Revenue        -> الإيراد المحقق, with the year's real month-by-month wins (all zero).
     New Customers        -> الحسابات, and how many arrived in the last 30 days (created_at).
     Total Deals          -> البنود المفتوحة, and how many were opened in the last 30 days.
     Total Expenses       -> المستهدف المسجّل, with the four quarters, the recorded one filled.
     Revenue Overview     -> حركة البنود: opened and closed per month, from created_at and stage_at.
     Sales Pipeline       -> the live stage ladder, counts and value, each as a share of the book.
     Recent Transactions  -> آخر الأحداث from the message ledger (sent/delivered/seen/replied).
     Savings Goal         -> the recorded target and what has been won against it.
     Portfolio Allocation -> the open lines by stage, as a donut with its legend.

   A CHANGE LINE IS MEASURED OR IT IS ABSENT. «12.5%+ vs last 30 days» under every figure is the
   reference's habit, not a fact: a delta needs a past. Counts have created_at, so theirs are real;
   revenue has no month that differs from any other, so it says «لا صفقة مغلقة» instead of «٪0».
   ============================================================================================ */

var HX_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
                 "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/* Rows keyed by month index for the fiscal year on screen: what was opened, and what was closed.
   stage_at is when a line ENTERED its current stage, so for a line that is now won or lost it is
   the close; for an open line it is not a close and is not counted as one. */
function hdsMonthly(year) {
  var rows = (typeof oppRows !== "undefined" && oppRows) ? oppRows : [];
  var opened = [], closed = [], won = [], i;
  for (i = 0; i < 12; i++) { opened.push(0); closed.push(0); won.push(0); }
  rows.forEach(function (l) {
    var c = Number(l.created_at) || 0;
    if (c) { var d = new Date(c); if (d.getFullYear() === year) opened[d.getMonth()]++; }
    var isClosed = typeof opIsOpen === "function" ? !opIsOpen(l) : false;
    if (isClosed && l.stage_at) {
      var e = new Date(Number(l.stage_at));
      if (e.getFullYear() === year) {
        closed[e.getMonth()]++;
        if (typeof opIsWon === "function" && opIsWon(l)) won[e.getMonth()] += opValue(l);
      }
    }
  });
  return { opened: opened, closed: closed, won: won };
}

/* How many of a set arrived in the last 30 days. Real, because created_at is real — and stated as
   a count over a named window rather than as a percentage against a month nobody recorded. */
function hdsLast30(list, key) {
  var since = Date.now() - 30 * 86400000, n = 0;
  (list || []).forEach(function (x) { if (Number(x[key]) >= since) n++; });
  return n;
}

/* A sparkline over a real series. An all-zero series draws its baseline and says so — the shape of
   «nothing happened in any month», which is what the records hold. */
function hdsSpark(series, cls) {
  var max = Math.max.apply(null, series.concat([0]));
  var n = series.length, step = n > 1 ? 100 / (n - 1) : 100;
  var pts = series.map(function (v, i) {
    var y = max > 0 ? 26 - (v / max) * 22 : 26;
    return (i * step).toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  return '<svg class="hx-spark ' + (cls || "") + '" viewBox="0 0 100 28" preserveAspectRatio="none"' +
    ' aria-hidden="true" focusable="false"><polyline points="' + pts + '"/></svg>';
}
/* Small bars, one per period, used where the series is a set of discrete periods rather than a
   trend — four quarters, twelve months. A period with nothing recorded is hatched, never zero-high:
   a bar of no height and a bar nobody filled in look identical otherwise. */
function hdsMiniBars(vals, filled) {
  var max = Math.max.apply(null, vals.concat([0]));
  return '<span class="hx-mini" aria-hidden="true">' + vals.map(function (v, i) {
    /* «on» means RECORDED, not non-zero. A recorded zero is a short bar; an unrecorded period is a
       full hatched one. Drawing a recorded zero at full height made «0 حسابات لها مسؤول» look like
       every account had one — measured on the live page. */
    var on = filled ? filled(i, v) : v > 0;
    var h = on ? (max > 0 && v > 0 ? Math.max(12, Math.round((v / max) * 100)) : 6) : 100;
    return '<i class="' + (on ? "is-on" : "is-off") + '" style="--hx-h:' + h + '%"></i>';
  }).join("") + "</span>";
}

/* The account book, and how much of it has someone responsible for it. An account with no owner is
   a classification nobody made — «unset», never a number owed. */
function hdsAccounts() {
  var rows = (typeof acRows !== "undefined" && acRows) ? acRows : null;
  if (!rows) return { loaded: false, total: 0, noOwner: 0, approved: 0 };
  var book = rows.filter(function (a) { return a.approval !== "rejected"; });
  return {
    loaded: true,
    total: book.length,
    approved: book.filter(function (a) { return a.approval !== "proposed"; }).length,
    noOwner: book.filter(function (a) { return !a.ownerId; }).length
  };
}

/* ---------- the page's own controls, as the reference carries them ----------
   The specimen puts a date-range picker and a Download button on the header line, to the side of
   the title. The shell already prints the breadcrumb, the title and the subtitle, so only the two
   controls are added here — and both do the thing they name: the range filters «آخر الأحداث», and
   the download writes the figures on this screen to a CSV. A control that decides nothing would be
   the one thing the reference cannot lend us. */
var hxFrom = "", hxTo = "";
var hxSpan = 12;   /* months in the chart: 6, 12 or 24 */

window.hxSetSpan = function (n) { hxSpan = Number(n) || 12; render(false); };
document.addEventListener("change", function (ev) {
  var t = ev.target;
  if (!t || !t.getAttribute || !t.getAttribute("data-hxrange")) return;
  var a = document.getElementById("hxrange"), b = document.getElementById("hxrange_to");
  hxFrom = a ? a.value : ""; hxTo = b ? b.value : "";
  if (hxFrom && hxTo) render(false);
});
/* The CSV is built from the same arrays the cards render, so the file and the screen cannot
   disagree. A Blob, not a data: URI — a long Arabic URI is silently truncated by some browsers. */
window.hdsExport = function () {
  var f = hdsFacts(), lines = hdsLines(), ac = hdsAccounts(), m = hdsMonthly(f.year);
  var rows = [["المؤشر", "القيمة", "النطاق"],
    ["الإيراد المحقق", f.achieved, hdsYearTxt(f.year)],
    ["المستهدف المسجّل", f.recorded, hdsYearTxt(f.year)],
    ["البنود المفتوحة", lines.length, "الآن"],
    ["الحسابات", ac.total, "الآن"],
    ["حسابات بلا مسؤول", ac.noOwner, "الآن"]];
  (typeof opOpenStages === "function" ? opOpenStages() : []).forEach(function (s) {
    var mine = lines.filter(function (l) { return l.stage === s.key; });
    var v = 0; mine.forEach(function (l) { v += l.value; });
    rows.push(["مرحلة: " + s.label, mine.length, v ? v + " ر.س" : "بلا قيمة مسعّرة"]);
  });
  m.opened.forEach(function (v, i) { rows.push(["بنود فُتحت — " + HX_MONTHS[i], v, hdsYearTxt(f.year)]); });
  var csv = "\\ufeff" + rows.map(function (r) {
    return r.map(function (c) { return '"' + String(c).split('"').join('""') + '"'; }).join(",");
  }).join("\\r\\n");
  try {
    var url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    var a = document.createElement("a");
    a.href = url; a.download = "massar-home-" + hdsYearTxt(f.year) + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  } catch (e) { /* a browser that refuses the blob keeps the screen; nothing else breaks */ }
};
function hdsPageTools() {
  return '<div class="hx-tools">' +
    mDateRange({ id: "hxrange", from: hxFrom, to: hxTo, max: toISODate(new Date()),
      label: "المدى", placeholder: "كل الفترة", attrs: ' data-hxrange="1"' }) +
    '<button type="button" class="m-btn m-btn--primary hx-dl" onclick="hdsExport()">تنزيل' +
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"/></svg></button></div>';
}

/* HOW LONG IS LEFT on the quarter the target belongs to — the fact the goal card leads with, since
   the target itself is already printed in the row above. Real: the quarter's end comes from the
   sectors read, and a quarter that has passed or has not begun says so instead of counting days. */
function hdsTargetPeriod(f) {
  var only = null;
  f.rows.forEach(function (p) { if (p.annualTarget !== null && p.annualTarget !== undefined) only = only || p; });
  if (f.withTarget !== 1 || !only) return "";
  var qs = (only.quarters || []).filter(function (q) { return q.target !== null && q.target !== undefined; });
  if (qs.length !== 1) return "";
  var q = Number(qs[0].quarter);
  var cur = (typeof pcQuarters !== "undefined" && pcQuarters) ? Number(pcQuarters.currentQuarter) : null;
  if (!cur) return "";
  if (q < cur) return "انتهى الربع " + hdsQName(q);
  if (q > cur) return "لم يبدأ الربع " + hdsQName(q) + " بعد";
  var end = (typeof pcSectors !== "undefined" && pcSectors && pcSectors.periodEnd) ? Number(pcSectors.periodEnd) : NaN;
  if (!end || isNaN(end)) return "الربع " + hdsQName(q) + " جارٍ";
  var days = Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  return days
    ? ("باقٍ " + opPl(days, "يوم واحد", "يومان", "أيام", "يومًا") + " على نهاية الربع " + hdsQName(q))
    : ("ينتهي الربع " + hdsQName(q) + " اليوم");
}

/* ---------- row one: the four figures ---------- */
function hdsKpi(o) {
  return '<section class="hx-kpi">' +
    '<div class="hx-kpi__h"><span class="hx-kpi__i ' + (o.tone || "") + '">' + hdsIcon(o.icon) + "</span>" +
      '<span class="hx-kpi__k">' + o.label + "</span></div>" +
    '<div class="hx-kpi__b"><div><p class="hx-kpi__v">' + o.value + "</p>" +
      '<p class="hx-kpi__d ' + (o.deltaTone || "") + '">' +
      (o.arrow ? '<span class="hx-kpi__a" aria-hidden="true">' + o.arrow + "</span>" : "") +
      o.delta + "</p></div>" +
      '<div class="hx-kpi__c">' + (o.chart || "") + "</div></div></section>";
}
function hdsKpiRow(f, lines) {
  var year = f.year;
  var m = hdsMonthly(year);
  var ac = hdsAccounts();
  var acRowsAll = (typeof acRows !== "undefined" && acRows) ? acRows : [];
  var newAc = hdsLast30(acRowsAll, "createdAt");
  var rowsAll = (typeof oppRows !== "undefined" && oppRows) ? oppRows : [];
  var newLines = hdsLast30(rowsAll, "created_at");

  var qs = [1, 2, 3, 4].map(function (q) {
    var t = null;
    f.rows.forEach(function (p) {
      (p.quarters || []).forEach(function (x) {
        if (Number(x.quarter) === q && x.target !== null && x.target !== undefined) t = (t || 0) + Number(x.target);
      });
    });
    return t;
  });

  var h = '<div class="hx-kpis">';
  h += hdsKpi({
    icon: "wallet", tone: "is-ok", label: "الإيراد المحقق",
    value: '<span class="m-n">' + fmtN(f.achieved) + ' <small>ر.س</small></span>',
    delta: f.achieved ? ("من الصفقات الرابحة في " + hdsYearTxt(year)) : "لا صفقة مغلقة ربحًا في " + hdsYearTxt(year),
    chart: hdsSpark(m.won, "is-flat")
  });
  h += hdsKpi({
    icon: "people", tone: "is-ac", label: "الحسابات",
    value: ac.loaded ? dsFig("acN", ac.total) : hdsNil("جارٍ القراءة", "unset"),
    delta: ac.loaded
      ? (newAc ? fmtN(newAc) + " في آخر 30 يومًا" : "بلا إضافات في آخر 30 يومًا")
      : "",
    arrow: newAc ? "&#8593;" : "", deltaTone: newAc ? "is-up" : "",
    chart: ac.loaded && ac.total
      ? hdsMiniBars([ac.total - ac.noOwner, ac.noOwner], function (i) { return true; })
      : ""
  });
  h += hdsKpi({
    icon: "stages", tone: "is-ac", label: "البنود المفتوحة",
    value: dsFig("nLines", lines.length),
    delta: newLines ? fmtN(newLines) + " في آخر 30 يومًا" : "بلا بنود جديدة في آخر 30 يومًا",
    arrow: newLines ? "&#8593;" : "", deltaTone: newLines ? "is-up" : "",
    chart: hdsMiniBars(m.opened, function (i, v) { return v > 0; })
  });
  h += hdsKpi({
    icon: "target", tone: "is-warn", label: "المستهدف المسجّل",
    value: f.withTarget
      ? '<span class="m-n">' + fmtN(f.recorded) + ' <small>ر.س</small></span>'
      : hdsNil("لا مستهدف مسجّل", "owed"),
    delta: f.withTarget
      ? (hdsPl(qs.filter(function (t) { return t !== null; }).length, "ربع واحد", "ربعان", "أرباع", "ربعًا") + " من أربعة")
      : "يُحدَّد من «المستهدفات والأداء»",
    chart: hdsMiniBars(qs.map(function (t) { return t || 0; }), function (i) { return qs[i] !== null; })
  });
  return h + "</div>";
}

/* ---------- the health of the pipeline ----------
   THE REFERENCE'S SECOND LAYER, and the rule behind it has been written and unit-tested since
   Sep 4: home-domain.pipelineHealth places every open line in exactly ONE of four states, in a
   stated order of precedence, so the four counts reconcile to the open book. What was missing was
   a caller — vHome built an empty band list, so the screen never asked. This card asks, in the
   ds6 vocabulary rather than the old band markup, and every state opens the deals it counted. */
var HDS_HEALTH_TONE = { on_track: "is-ok", late: "is-warn", support: "is-ac", rejected: "is-bad" };
var HDS_HEALTH_ICON = { on_track: "check", late: "clock", support: "people", rejected: "x" };

function hdsHealthCard() {
  if (typeof pipelineHealth !== "function" || typeof hmHealth !== "function") return "";
  if (typeof hmEscLoad === "function") hmEscLoad(false);
  var h = hmHealth();
  var open = h.openCount;

  /* The escalations feed «بانتظار الدعم» alone. Until it arrives that state reads zero, which
     would be a claim we cannot make — so the card says it is still reading rather than printing
     a four-way split that does not yet add up. */
  var escReady = (typeof hmEsc !== "undefined" && hmEsc) || (typeof hmEscFailed !== "undefined" && hmEscFailed);

  var tiles = h.buckets.map(function (b) {
    var tone = HDS_HEALTH_TONE[b.key] || "";
    var pending = !escReady && (b.key === "support" || b.key === "late" || b.key === "on_track");
    /* The key travels as an HTML entity rather than an escaped quote: this module is one template
       literal, and a backslash-quote here is consumed by it before the browser sees it. */
    return '<button type="button" class="hx-hl ' + tone + '" onclick="hmOpenState(&#39;' + esc(b.key) + '&#39;)">' +
      '<span class="hx-hl__h"><span class="hx-hl__i">' + hdsIcon(HDS_HEALTH_ICON[b.key]) + "</span>" +
        '<span class="hx-hl__k">' + esc(b.label) + "</span></span>" +
      '<span class="hx-hl__v">' + (pending ? hdsNil("جارٍ القراءة", "unset") : dsFig("hl_" + b.key, b.count)) + "</span>" +
      /* Three different absences, and only one of them is owed: no lines in this state at all is a
         legitimate nothing, while lines that exist and carry no price is a number someone owes. */
      '<span class="hx-hl__m">' +
        (!b.count ? hdsNil("لا بنود", "none")
          : b.value ? hdsMoney(b.value) : hdsNil("بلا قيمة مسجّلة", "owed")) + "</span>" +
      '<span class="hx-hl__d">' + esc(b.hint) + "</span></button>";
  }).join("");

  /* The open VALUE, which the reference prints beside the open count and this screen had nowhere:
     the indicator row carries the count alone. It is the sum of the three non-lost states, so it
     is stated here rather than computed a second time somewhere else. */
  var sub = open
    ? hdsPl(open, "بند مفتوح", "بندان مفتوحان", "بنود مفتوحة", "بندًا مفتوحًا") + " · " + hdsMoney(h.openValue)
    : "لا بنود مفتوحة";

  return '<section class="hx-card hx-health">' +
    '<div class="hx-card__h"><h3 class="hx-card__t">صحة خط البيع</h3>' +
      '<span class="hx-card__n">' + sub + "</span></div>" +
    '<p class="hx-health__d">كل بند في حالة واحدة فقط — اضغط الحالة لترى بنودها.</p>' +
    '<div class="hx-hls">' + tiles + "</div></section>";
}

/* ---------- row two, left: the chart ----------
   The reference's shape, complete: a value axis on the side, a period switch, grouped bars per
   period, a legend, and a card that appears over the period the pointer is on. The series are the
   two this company records — what was opened, and what was closed — because a third invented one
   would be the specimen's «Profit», a number nobody here has. */
/* CONVERSATIONS OVER TIME — the one series this company has a real shape for, and the entity the
   product is about. It replaced «البنود شهريًا» here because that series is already told by the
   open-lines card's own mini-chart, and a screen that shows one entity four ways holds one fact.
   Buckets so the axis stays readable: a day each over 30, a week each over 90, a month over a year.
   Outbound and inbound are counted apart: one is work the system did, the other is a person
   answering. */
function hdsActivity(days) {
  var cs = (typeof cache !== "undefined" && cache && cache.contacts) ? cache.contacts : null;
  if (!cs) return null;
  var step = days <= 30 ? "day" : days <= 120 ? "week" : "month";
  var now = new Date(), buckets = [], index = {};
  var keyOf = function (d) {
    if (step === "month") return d.getFullYear() + "-" + d.getMonth();
    if (step === "week") {
      var w = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
      return w.getFullYear() + "-" + w.getMonth() + "-" + w.getDate();
    }
    return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
  };
  var labelOf = function (d) {
    if (step === "month") return HX_MONTHS[d.getMonth()];
    /* A compact date on a dense axis. The month name truncated to «أغسط» at 13 buckets, and letting
       it wrap broke the word across three lines and pushed each column's baseline to a different
       height. «30/8» cannot do either, and the tooltip carries the full date. */
    return fmtN(d.getDate()) + "/" + fmtN(d.getMonth() + 1);
  };
  var start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  var cursor = new Date(start.getTime());
  while (cursor <= now) {
    var k = keyOf(cursor);
    if (!index[k]) {
      index[k] = { k: k, label: labelOf(cursor), out: 0, inb: 0,
        full: step === "month" ? HX_MONTHS[cursor.getMonth()] + " " + cursor.getFullYear()
          : fmtN(cursor.getDate()) + " " + HX_MONTHS[cursor.getMonth()] + (step === "week" ? " — أسبوع" : "") };
      buckets.push(index[k]);
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  var since = start.getTime();
  cs.forEach(function (c) {
    if (c.test) return;
    (c.transcript || []).forEach(function (t) {
      if (!t.ts || t.ts < since) return;
      var b = index[keyOf(new Date(t.ts))];
      if (!b) return;
      if (t.role === "customer") b.inb++; else b.out++;
    });
  });
  return { step: step, buckets: buckets };
}

function hdsSeries(span) {
  var rows = (typeof oppRows !== "undefined" && oppRows) ? oppRows : [];
  var now = new Date(), out = [];
  for (var i = span - 1; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ y: d.getFullYear(), m: d.getMonth(), opened: 0, closed: 0 });
  }
  var at = function (y, m) {
    for (var j = 0; j < out.length; j++) if (out[j].y === y && out[j].m === m) return out[j];
    return null;
  };
  rows.forEach(function (l) {
    if (l.created_at) {
      var c = new Date(Number(l.created_at)), s = at(c.getFullYear(), c.getMonth());
      if (s) s.opened++;
    }
    var isClosed = typeof opIsOpen === "function" ? !opIsOpen(l) : false;
    if (isClosed && l.stage_at) {
      var e = new Date(Number(l.stage_at)), s2 = at(e.getFullYear(), e.getMonth());
      if (s2) s2.closed++;
    }
  });
  return out;
}
function hdsFlowCard(f) {
  var span = hxSpan;
  var act = hdsActivity(span === 6 ? 30 : span === 12 ? 90 : 365);
  if (!act) {
    return '<section class="hx-card hx-card--wide">' +
      '<div class="hx-card__h"><div><h3 class="hx-card__t">النشاط</h3>' +
      '<p class="m-meta">الرسائل الصادرة والواردة</p></div></div>' +
      '<div class="m-empty"><div class="m-empty__t">' + hdsNil("جارٍ القراءة", "unset") + "</div></div></section>";
  }
  var series = act.buckets.map(function (b) { return { label: b.label, full: b.full, opened: b.out, closed: b.inb }; });
  var peak = Math.max.apply(null, series.map(function (s) { return Math.max(s.opened, s.closed); }).concat([1]));
  /* Rounded up to a multiple of four so the four gridlines carry whole numbers. At a peak of 6 the
     quarter marks were 4.5 and 1.5, printed as «5» and «2» — labels a pixel-reader would check the
     bars against and find wrong. */
  var max = Math.ceil(peak / 4) * 4;
  var any = series.some(function (s) { return s.opened || s.closed; });
  var ticks = [max, (max / 4) * 3, max / 2, max / 4, 0];
  var seg = function (n, label) {
    return '<button type="button" aria-pressed="' + (span === n) + '" onclick="hxSetSpan(' + n + ')">' + label + "</button>";
  };
  var h = '<section class="hx-card hx-card--wide">' +
    '<div class="hx-card__h"><div><h3 class="hx-card__t">النشاط</h3>' +
      '<p class="m-meta">الرسائل الصادرة والواردة ' +
      (act.step === "day" ? "يومًا بيوم" : act.step === "week" ? "أسبوعًا بأسبوع" : "شهرًا بشهر") +
      " خلال " + (span === 6 ? "آخر 30 يومًا" : span === 12 ? "آخر 90 يومًا" : "آخر سنة") + "</p></div>" +
      '<div class="hx-seg" role="group" aria-label="مدى الرسم">' +
        seg(6, "30 يومًا") + seg(12, "90 يومًا") + seg(24, "سنة") + "</div></div>";
  if (!any) {
    return h + '<div class="m-empty"><div class="m-empty__t">' +
      hdsNil("لا رسائل في هذه الفترة", "none") + "</div>" +
      '<div class="m-empty__d">تظهر هنا الرسائل فور إرسالها أو ورودها.</div></div></section>';
  }
  h += '<div class="hx-flow" role="img" aria-label="' +
    esc("الرسائل: " + series.map(function (s) {
      return (s.full || s.label) + " صادرة " + s.opened + " وواردة " + s.closed;
    }).join("، ")) + '">' +
    '<div class="hx-flow__y" aria-hidden="true">' + ticks.map(function (t) {
      return '<span class="m-n">' + fmtN(t) + "</span>";
    }).join("") + "</div>" +
    '<div class="hx-flow__p">' +
      '<div class="hx-flow__g" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>' +
      '<div class="hx-flow__c" style="--hx-n:' + series.length + '" aria-hidden="true">' +
      series.map(function (s) {
        return '<div class="hx-flow__m">' +
          '<span class="hx-flow__pair">' +
            '<i class="is-open" style="--hx-h:' + Math.round((s.opened / max) * 100) + '%"></i>' +
            '<i class="is-closed" style="--hx-h:' + Math.round((s.closed / max) * 100) + '%"></i>' +
          "</span>" +
          '<span class="hx-flow__x"><span class="m-n">' + esc(s.label) + "</span></span>" +
          /* The reference's dark card, over the period the pointer is on. */
          '<span class="hx-tip"><b>' + esc(s.full || s.label) + "</b>" +
            '<span><i class="is-open"></i>صادرة<b class="m-n">' + fmtN(s.opened) + "</b></span>" +
            '<span><i class="is-closed"></i>واردة<b class="m-n">' + fmtN(s.closed) + "</b></span></span>" +
          "</div>";
      }).join("") + "</div></div></div>";
  h += '<p class="hx-legend2">' +
    '<span><i class="is-open"></i>صادرة</span>' +
    '<span><i class="is-closed"></i>واردة</span>' +
    '<span class="m-meta">من سجل الرسائل — لا تقديرات</span></p>';
  return h + "</section>";
}

/* ---------- row two, right: the pipeline ---------- */
function hdsPipelineCard(lines) {
  var stages = (typeof opOpenStages === "function") ? opOpenStages() : [];
  var total = lines.length || 1;
  var rows = stages.map(function (s) {
    var mine = lines.filter(function (l) { return l.stage === s.key; });
    var val = 0; mine.forEach(function (l) { val += l.value; });
    return { s: s, n: mine.length, val: val, pct: Math.round((mine.length / total) * 100) };
  });
  var body = lines.length
    ? '<ol class="hx-pipe">' + rows.map(function (r, i) {
        return '<li class="hx-pipe__r' + (r.n ? "" : " is-empty") + '">' +
          '<span class="hx-pipe__d t' + (i % 5) + '" aria-hidden="true"></span>' +
          '<span class="hx-pipe__t">' + esc(r.s.label) + "</span>" +
          '<span class="hx-pipe__s">' + hdsPl(r.n, "بند واحد", "بندان", "بنود", "بندًا") +
            (r.val ? " · " + hdsMoney(r.val) : "") + "</span>" +
          '<span class="hx-pipe__b" aria-hidden="true"><i class="t' + (i % 5) + '" style="--hx-w:' + r.pct + '%"></i></span>' +
          '<span class="hx-pipe__p"><span class="m-n">' + fmtN(r.pct) + "٪</span></span></li>";
      }).join("") + "</ol>"
    : '<div class="m-empty"><div class="m-empty__t">' + hdsNil("لا بنود مفتوحة", "none") + "</div></div>";
  return '<section class="hx-card">' +
    '<div class="hx-card__h"><h3 class="hx-card__t">خط البيع</h3>' +
      '<a class="hx-link" href="#board">عرض التقرير <span aria-hidden="true">&#8592;</span></a></div>' +
    body + "</section>";
}

/* ---------- row three, left: the ledger ---------- */
var HX_EV = { sent: ["أُرسلت", "is-muted", "&#8599;"], delivered: ["وصلت", "is-muted", "&#10003;"],
              read: ["شوهدت", "is-ac", "&#128065;"], customer: ["ردّ العميل", "is-ok", "&#8592;"],
              agent: ["ردّ المساعد", "is-muted", "&#8594;"], failed: ["أخفقت", "is-bad", "!"] };
function hdsEventsCard() {
  var cs = (typeof cache !== "undefined" && cache && cache.contacts) ? cache.contacts : null;
  var out = [];
  var from = hxFrom ? parseISODate(hxFrom) : null, to = hxTo ? parseISODate(hxTo) : null;
  var lo = from ? new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime() : 0;
  var hi = to ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).getTime() : Infinity;
  (cs || []).forEach(function (c) {
    if (c.test) return;
    (c.transcript || []).forEach(function (t) {
      if (t.ts && t.ts >= lo && t.ts <= hi) out.push({ ts: t.ts, kind: t.role, who: c.waName || c.phone || "", ch: "واتساب" });
    });
    var st = c.statusTimes || {};
    ["sent", "delivered", "read", "failed"].forEach(function (k) {
      if (st[k] && st[k] >= lo && st[k] <= hi) out.push({ ts: st[k], kind: k, who: c.waName || c.phone || "", ch: "واتساب" });
    });
  });
  out.sort(function (a, b) { return b.ts - a.ts; });
  var body;
  if (!cs) body = '<div class="m-empty"><div class="m-empty__t">' + hdsNil("جارٍ القراءة", "unset") + "</div></div>";
  else if (!out.length) body = '<div class="m-empty"><div class="m-empty__t">' + hdsNil("لا أحداث في هذه الفترة", "none") + "</div></div>";
  else {
    body = '<div class="hx-tblw"><table class="hx-tbl">' +
      '<colgroup><col class="c-date"><col class="c-ev"><col class="c-who"><col class="c-ch"><col class="c-st"></colgroup>' +
      "<thead><tr><th>التاريخ</th><th>الحدث</th><th>الجهة</th><th>القناة</th><th>الحالة</th></tr></thead><tbody>" +
      out.slice(0, 4).map(function (e) {
        var k = HX_EV[e.kind] || [e.kind, "is-muted", "&#8226;"];
        return "<tr><td class='hx-tbl__t'>" + esc(fmtD(e.ts)) + "</td>" +
          "<td><span class='hx-ev'><i class='" + k[1] + "'>" + k[2] + "</i>" + esc(k[0]) + "</span></td>" +
          "<td class='hx-tbl__w'>" + esc(clip(e.who, 18)) + "</td>" +
          "<td class='hx-tbl__c'>" + esc(e.ch) + "</td>" +
          "<td class='hx-tbl__s'><span class='hx-tag " + k[1] + "'>" + esc(k[0]) + "</span></td></tr>";
      }).join("") + "</tbody></table></div>";
  }
  return '<section class="hx-card">' +
    '<div class="hx-card__h"><h3 class="hx-card__t">آخر الأحداث</h3>' +
      '<a class="hx-link" href="#pipeline">عرض الكل <span aria-hidden="true">&#8592;</span></a></div>' +
    body + "</section>";
}

/* ---------- «المنتجات حسب الإنجاز» ----------
   A NEW ENTITY ON THIS SCREEN, which is the only reason it belongs here. The reference ranks the
   products on the executive board and Massar had the ranking written (products-crm vExecBand) with
   no caller, while the live home counted accounts, lines, revenue and a target and never once named
   a PRODUCT. Ranked highest first, as the reference does.

   A product with no target is not at 0٪ — there is no denominator for a percentage to be a
   percentage OF. Those collapse into one named line rather than a row of absences each. */
function hdsProductsCard(f) {
  var rows = (f.rows || []).slice();
  var withT = rows.filter(function (p) { return p.annualTarget !== null && p.annualTarget !== undefined && Number(p.annualTarget) > 0; });
  var without = rows.length - withT.length;

  var body;
  if (!withT.length) {
    body = '<div class="m-empty"><div class="m-empty__t">' + hdsNil("لا مستهدف مسجّل على أي منتج", "owed") + "</div>" +
      '<div class="m-empty__d">تُحدَّد المستهدفات من سجل المنتج أو «المستهدفات والأداء».</div></div>';
  } else {
    withT.forEach(function (p) {
      p.__pct = Math.round((Number(p.achieved) || 0) / Number(p.annualTarget) * 100);
    });
    withT.sort(function (a, b) { return b.__pct - a.__pct; });
    body = '<div class="hx-pr">' + withT.map(function (p) {
      var pct = p.__pct;
      var tone = pct >= 100 ? "is-ok" : pct >= 50 ? "is-ac" : "is-warn";
      /* The bar is capped at 100 so an overshoot cannot draw past the track, but the FIGURE is
         not: a product at 140٪ must read 140٪. */
      return '<div class="hx-pr__r"><span class="hx-pr__n">' + esc(p.product) + "</span>" +
        '<span class="hx-pr__b ' + tone + '"><i style="--m-pct:' + Math.min(100, Math.max(0, pct)) + '%"></i></span>' +
        '<span class="hx-pr__p">' + hdsN(pct) + "٪</span>" +
        '<span class="hx-pr__v">' + hdsMoney(p.achieved) + " من " + hdsMoney(p.annualTarget) +
        (Number(p.targetQuarters) < 4
          ? " · " + hdsPl(Number(p.targetQuarters), "ربع واحد", "ربعان", "أرباع", "ربعًا") + " من أربعة"
          : "") + "</span></div>";
    }).join("") + "</div>";
  }
  if (without) {
    body += '<p class="hx-pr__rest">' +
      hdsPl(without, "منتج واحد", "منتجان", "منتجات", "منتجًا") + " بلا مستهدف مسجّل — لا تُرتَّب هنا.</p>";
  }
  return '<section class="hx-card">' +
    '<div class="hx-card__h"><h3 class="hx-card__t">المنتجات حسب الإنجاز</h3>' +
      '<a class="hx-link" href="#perf">عرض التقرير <span aria-hidden="true">&#8592;</span></a></div>' +
    body + "</section>";
}

/* ---------- row three, middle: the goal ---------- */
function hdsGoalCard(f) {
  var body;
  if (!f.withTarget) {
    body = '<div class="m-empty"><div class="m-empty__t">' + hdsNil("لا مستهدف مسجّل", "owed") + "</div>" +
      '<div class="m-empty__d">يُحدَّد المستهدف من «المستهدفات والأداء».</div></div>';
  } else {
    var tAch = 0;
    f.rows.forEach(function (p) {
      (p.quarters || []).forEach(function (q) {
        if (q.target !== null && q.target !== undefined) tAch += Number(q.achieved) || 0;
      });
    });
    var pct = f.recorded > 0 ? Math.round((tAch / f.recorded) * 100) : 0;
    var left = Math.max(0, f.recorded - tAch);
    /* The KPI row already prints the target, and the revenue card already prints what was won. What
       this card is FOR is the gap between them and the time left to close it — so that leads. */
    body = '<div class="hx-goal">' +
      '<div class="hx-goal__h"><span class="hx-goal__i">' + hdsIcon("target") + "</span>" +
        "<div><b>المتبقي على المستهدف</b>" +
        '<span class="hx-goal__v">' + hdsMoney(left) + " من " + hdsMoney(f.recorded) + "</span></div></div>" +
      '<div class="hx-goal__b" role="img" aria-label="' + esc("المحقق على المستهدف " + pct + " بالمئة") + '">' +
        '<i style="--hx-w:' + Math.min(100, pct) + '%"></i></div>' +
      '<span class="hx-goal__p"><span class="m-n">' + fmtN(pct) + "٪</span></span>" +
      /* The specimen's encouragement card, carrying a fact instead of a slogan. */
      '<div class="hx-note"><span class="hx-note__i">' + hdsIcon("clock") + "</span>" +
        "<div><b>" + esc(hdsTargetPeriod(f) || (f.onlyScope || "على المنتجات ذات المستهدف")) + "</b>" +
        "<span>" + (f.onlyProduct ? esc(f.onlyProduct) + " · " : "") +
          (tAch ? "المحقق " + hdsMoney(tAch) : "لم يُسجَّل أي إغلاق ربح بعد") + "</span></div></div></div>";
  }
  return '<section class="hx-card">' +
    '<div class="hx-card__h"><h3 class="hx-card__t">المستهدف</h3>' +
      '<a class="hx-link" href="#perf">عرض التقرير <span aria-hidden="true">&#8592;</span></a></div>' +
    body + "</section>";
}

/* ---------- row three, right: the donut ---------- */
/* BY SECTOR, NOT BY STAGE (founder, 2026-09-19: redundant with the indicator above it). Split by
   stage this donut printed «50٪ · 17٪ · 17٪ · 17٪» — the same four numbers «خط البيع» lists beside
   it — and its centre repeated the open-line count from the row above. The sector split is the one
   cut of the same six lines that nothing else on this screen shows. */
/* THE CUSTOMER BOOK, BY SECTOR — a different entity from everything else on this screen. Split by
   stage this donut printed the four numbers «خط البيع» already lists; split by sector it printed a
   third view of the same six lines. The accounts are the one population no other card counts. */
function hdsDonutCard(lines) {
  var rows = (typeof acRows !== "undefined" && acRows) ? acRows : null;
  var byName = {}, order = [];
  (rows || []).forEach(function (a) {
    if (a.approval === "rejected") return;
    var k = (a.sector && String(a.sector).trim()) || "__none";
    if (!byName[k]) { byName[k] = { label: k === "__none" ? "بلا قطاع" : k, n: 0, none: k === "__none" }; order.push(k); }
    byName[k].n++;
  });
  var all = order.map(function (k) { return byName[k]; }).sort(function (a, b) { return b.n - a.n; });
  /* FIVE SLICES AND A REMAINDER. The palette holds five tones; with six sectors the sixth reused the
     first, so two different sectors were drawn in the same blue — colour naming two things at once
     is the one thing it may never do. The tail is grouped and counted instead of recoloured. */
  var parts = all;
  if (all.length > 5) {
    var tail = all.slice(4);
    var rest = { label: "قطاعات أخرى", n: 0, rest: tail.length };
    tail.forEach(function (x) { rest.n += x.n; });
    parts = all.slice(0, 4).concat([rest]);
  }
  var total = parts.reduce(function (n, x) { return n + x.n; }, 0);
  var body;
  if (!rows) {
    body = '<div class="m-empty"><div class="m-empty__t">' + hdsNil("جارٍ القراءة", "unset") + "</div></div>";
  } else if (!total) {
    body = '<div class="m-empty"><div class="m-empty__t">' + hdsNil("لا حسابات مسجّلة", "none") + "</div></div>";
  } else {
    var off = 0;
    var ring = parts.map(function (x, i) {
      var pct = (x.n / total) * 100;
      var seg = '<circle class="hx-donut__s t' + (i % 5) + '" cx="21" cy="21" r="15.9" pathLength="100"' +
        ' stroke-dasharray="' + pct.toFixed(2) + " " + (100 - pct).toFixed(2) + '"' +
        ' stroke-dashoffset="' + (-off).toFixed(2) + '"></circle>';
      off += pct;
      return seg;
    }).join("");
    body = '<div class="hx-donut">' +
      '<div class="hx-donut__r" role="img" aria-label="' +
        esc("الحسابات حسب القطاع: " + parts.map(function (x) { return x.label + " " + x.n; }).join("، ")) + '">' +
        '<svg viewBox="0 0 42 42"><circle class="hx-donut__t" cx="21" cy="21" r="15.9" pathLength="100"></circle>' + ring + "</svg>" +
        '<span class="hx-donut__c"><b class="m-n">' + fmtN(parts.length) + "</b><small>" +
          (parts.length === 1 ? "قطاع" : parts.length === 2 ? "قطاعان" : "قطاعات") + "</small></span></div>" +
      '<ul class="hx-donut__l">' + parts.map(function (x, i) {
        /* The count as well as the share: «17٪» of six lines is one line, and the reader should not
           have to do that arithmetic to know it. */
        var rest = x.rest ? hdsPl(x.rest, "قطاع", "قطاعان", "قطاعات", "قطاعًا") : "";
        return "<li" + (rest ? ' title="' + esc(x.label + " — " + rest) + '"' : "") +
          '><i class="t' + (i % 5) + '"></i><span>' + esc(x.label) + "</span>" +
          '<em>' + hdsPl(x.n, "حساب", "حسابان", "حسابات", "حسابًا") + "</em>" +
          '<b class="m-n">' + fmtN(Math.round((x.n / total) * 100)) + "٪</b></li>";
      }).join("") + "</ul></div>";
  }
  return '<section class="hx-card">' +
    '<div class="hx-card__h"><h3 class="hx-card__t">الحسابات حسب القطاع</h3>' +
      '<a class="hx-link" href="#accounts">العملاء <span aria-hidden="true">&#8592;</span></a></div>' +
    body + "</section>";
}

/* ---------- the surface ---------- */
function vHomeDs() {
  if (typeof pcLoad === "function") pcLoad(false);
  if (typeof opLoad === "function") opLoad(false);
  if (typeof pcPerfLoad === "function") pcPerfLoad(hdsYear(), false);
  if (typeof cfLoad === "function") cfLoad(false);
  if (typeof acLoad === "function") acLoad(false);

  hdsBind();
  var f = hdsFacts();
  var linesReady = (typeof oppRows !== "undefined" && oppRows);
  if (!f.loaded || !linesReady) {
    return '<div class="ds6"><section class="hx-card">' +
      '<p class="m-meta" aria-busy="true">جارٍ قراءة الأداء…</p></section></div>';
  }
  var lines = hdsLines();
  return '<div class="ds6 hx-home">' +
    hdsPageTools() +
    hdsKpiRow(f, lines) +
    '<div class="hx-r15">' + hdsHealthCard() + "</div>" +
    '<div class="hx-r2">' + hdsFlowCard(f) + hdsPipelineCard(lines) + "</div>" +
    '<div class="hx-r3">' + hdsEventsCard() + hdsGoalCard(f) + hdsDonutCard(lines) + "</div>" +
    '<div class="hx-r4">' + hdsProductsCard(f) + "</div>" +
    "</div>";
}
`;
