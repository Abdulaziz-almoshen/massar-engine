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
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/>'
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

/* ---------- row one: the four figures ---------- */
function hdsKpi(o) {
  return '<section class="hx-kpi">' +
    '<div class="hx-kpi__h"><span class="hx-kpi__i ' + (o.tone || "") + '">' + hdsIcon(o.icon) + "</span>" +
      '<span class="hx-kpi__k">' + o.label + "</span></div>" +
    '<div class="hx-kpi__b"><div><p class="hx-kpi__v">' + o.value + "</p>" +
      '<p class="hx-kpi__d ' + (o.deltaTone || "") + '">' + o.delta + "</p></div>" +
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

  /* The quarters of the year, with the recorded ones filled — the same four the targets card draws,
     read from the same rows. */
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
      ? (newAc ? "+" + fmtN(newAc) + " في آخر 30 يومًا" : "بلا إضافات في آخر 30 يومًا")
      : "",
    deltaTone: newAc ? "is-up" : "",
    chart: ac.loaded && ac.total
      ? hdsMiniBars([ac.total - ac.noOwner, ac.noOwner], function (i) { return i === 0; })
      : ""
  });
  h += hdsKpi({
    icon: "stages", tone: "is-ac", label: "البنود المفتوحة",
    value: dsFig("nLines", lines.length),
    delta: newLines ? "+" + fmtN(newLines) + " في آخر 30 يومًا" : "بلا بنود جديدة في آخر 30 يومًا",
    deltaTone: newLines ? "is-up" : "",
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

/* ---------- row two, left: the wide chart ---------- */
function hdsFlowCard(f) {
  var m = hdsMonthly(f.year);
  var max = Math.max.apply(null, m.opened.concat(m.closed).concat([1]));
  var any = m.opened.concat(m.closed).some(function (v) { return v > 0; });
  var body = "";
  if (!any) {
    body = '<div class="m-empty"><div class="m-empty__t">' + hdsNil("لا حركة مسجّلة في " + hdsYearTxt(f.year), "none") + "</div>" +
      '<div class="m-empty__d">تظهر هنا البنود فور فتحها أو إغلاقها.</div></div>';
  } else {
    body = '<div class="hx-flow" role="img" aria-label="' +
      esc("البنود المفتوحة والمغلقة شهريًا في " + f.year) + '">' +
      '<div class="hx-flow__g" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
      '<div class="hx-flow__c" aria-hidden="true">' +
      m.opened.map(function (v, i) {
        var c = m.closed[i];
        return '<div class="hx-flow__m">' +
          '<span class="hx-flow__pair">' +
            '<i class="is-open" style="--hx-h:' + Math.round((v / max) * 100) + '%"' +
              (v ? ' data-v="' + fmtN(v) + '"' : "") + "></i>" +
            '<i class="is-closed" style="--hx-h:' + Math.round((c / max) * 100) + '%"' +
              (c ? ' data-v="' + fmtN(c) + '"' : "") + "></i>" +
          "</span>" +
          '<span class="hx-flow__x">' + HX_MONTHS[i] + "</span></div>";
      }).join("") + "</div></div>";
    body += '<p class="hx-legend2">' +
      '<span><i class="is-open"></i>بنود فُتحت</span>' +
      '<span><i class="is-closed"></i>بنود أُغلقت</span>' +
      '<span class="m-meta">من تاريخ الإنشاء وتاريخ دخول المرحلة الحالية</span></p>';
  }
  return '<section class="hx-card hx-card--wide">' +
    '<div class="hx-card__h"><div><h3 class="hx-card__t">حركة البنود</h3>' +
      '<p class="m-meta">ما فُتح وما أُغلق شهرًا بشهر في ' + hdsYearTxt(f.year) + "</p></div>" +
      '<a class="hx-link" href="#opps">كل الفرص <span aria-hidden="true">&#8592;</span></a></div>' +
    body + "</section>";
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
    ? '<ol class="hx-pipe">' + rows.map(function (r) {
        return '<li class="hx-pipe__r' + (r.n ? "" : " is-empty") + '">' +
          '<span class="hx-pipe__d" aria-hidden="true"></span>' +
          '<span class="hx-pipe__t">' + esc(r.s.label) + "</span>" +
          '<span class="hx-pipe__s">' + hdsPl(r.n, "بند واحد", "بندان", "بنود", "بندًا") +
            (r.val ? " · " + hdsMoney(r.val) : "") + "</span>" +
          '<span class="hx-pipe__b" aria-hidden="true"><i style="--hx-w:' + r.pct + '%"></i></span>' +
          '<span class="hx-pipe__p"><span class="m-n">' + fmtN(r.pct) + "٪</span></span></li>";
      }).join("") + "</ol>"
    : '<div class="m-empty"><div class="m-empty__t">' + hdsNil("لا بنود مفتوحة", "none") + "</div></div>";
  return '<section class="hx-card">' +
    '<div class="hx-card__h"><div><h3 class="hx-card__t">خط البيع</h3>' +
      '<p class="m-meta">البنود المفتوحة على السلّم، وحصة كل مرحلة</p></div>' +
      '<a class="hx-link" href="#board">اللوحة <span aria-hidden="true">&#8592;</span></a></div>' +
    body + "</section>";
}

/* ---------- row three, left: the ledger ---------- */
var HX_EV = { sent: ["أُرسلت", "is-muted"], delivered: ["وصلت", "is-muted"], read: ["شوهدت", "is-ac"],
              customer: ["ردّ العميل", "is-ok"], agent: ["ردّ المساعد", "is-muted"], failed: ["أخفقت", "is-bad"] };
function hdsEventsCard() {
  var cs = (typeof cache !== "undefined" && cache && cache.contacts) ? cache.contacts : null;
  var out = [];
  (cs || []).forEach(function (c) {
    if (c.test) return;
    (c.transcript || []).forEach(function (t) {
      if (t.ts) out.push({ ts: t.ts, kind: t.role, who: c.waName || c.phone || "", text: t.text || "" });
    });
    var st = c.statusTimes || {};
    ["sent", "delivered", "read", "failed"].forEach(function (k) {
      if (st[k]) out.push({ ts: st[k], kind: k, who: c.waName || c.phone || "", text: "" });
    });
  });
  out.sort(function (a, b) { return b.ts - a.ts; });
  var body;
  if (!cs) body = '<div class="m-empty"><div class="m-empty__t">' + hdsNil("جارٍ القراءة", "unset") + "</div></div>";
  else if (!out.length) body = '<div class="m-empty"><div class="m-empty__t">' + hdsNil("لا أحداث مسجّلة", "none") + "</div></div>";
  else {
    body = '<table class="hx-tbl"><thead><tr><th>الحدث</th><th>الجهة</th><th>الوقت</th></tr></thead><tbody>' +
      out.slice(0, 5).map(function (e) {
        var k = HX_EV[e.kind] || [e.kind, "is-muted"];
        return "<tr><td><span class='hx-tag " + k[1] + "'>" + esc(k[0]) + "</span></td>" +
          "<td class='hx-tbl__w'>" + esc(clip(e.who, 22)) + "</td>" +
          "<td class='hx-tbl__t'>" + esc(fmtD(e.ts)) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }
  return '<section class="hx-card">' +
    '<div class="hx-card__h"><div><h3 class="hx-card__t">آخر الأحداث</h3>' +
      '<p class="m-meta">من سجل الرسائل — لا تقديرات</p></div>' +
      '<a class="hx-link" href="#pipeline">السجل <span aria-hidden="true">&#8592;</span></a></div>' +
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
    body = '<div class="hx-goal">' +
      '<p class="hx-goal__v">' + hdsMoney(tAch) + ' <span class="hx-goal__of">من ' + hdsMoney(f.recorded) + "</span></p>" +
      '<div class="hx-goal__b" role="img" aria-label="' + esc("المحقق على المستهدف " + pct + " بالمئة") + '">' +
        '<i style="--hx-w:' + Math.min(100, pct) + '%"></i>' +
        '<b class="m-n">' + fmtN(pct) + "٪</b></div>" +
      '<p class="m-meta">' + (f.onlyProduct ? esc(f.onlyProduct) + " · " : "") +
        (f.onlyScope ? esc(f.onlyScope) : "على المنتجات ذات المستهدف") + "</p>" +
      '<p class="hx-goal__n">' + (tAch ? "المتبقي " + hdsMoney(Math.max(0, f.recorded - tAch))
        : "لم يُسجَّل أي إغلاق ربح على هذا المستهدف بعد.") + "</p></div>";
  }
  return '<section class="hx-card">' +
    '<div class="hx-card__h"><div><h3 class="hx-card__t">المستهدف</h3>' +
      '<p class="m-meta">ما تحقق منه حتى الآن</p></div>' +
      '<a class="hx-link" href="#perf">المستهدفات <span aria-hidden="true">&#8592;</span></a></div>' +
    body + "</section>";
}

/* ---------- row three, right: the donut ---------- */
function hdsDonutCard(lines) {
  var stages = (typeof opOpenStages === "function") ? opOpenStages() : [];
  var parts = stages.map(function (s) {
    return { label: s.label, n: lines.filter(function (l) { return l.stage === s.key; }).length };
  }).filter(function (x) { return x.n > 0; });
  var total = parts.reduce(function (n, x) { return n + x.n; }, 0);
  var body;
  if (!total) {
    body = '<div class="m-empty"><div class="m-empty__t">' + hdsNil("لا بنود مفتوحة", "none") + "</div></div>";
  } else {
    var off = 0;
    var ring = parts.map(function (x, i) {
      var pct = (x.n / total) * 100;
      var seg = '<circle class="hx-donut__s t' + (i % 4) + '" cx="21" cy="21" r="15.9" pathLength="100"' +
        ' stroke-dasharray="' + pct.toFixed(2) + " " + (100 - pct).toFixed(2) + '"' +
        ' stroke-dashoffset="' + (-off).toFixed(2) + '"></circle>';
      off += pct;
      return seg;
    }).join("");
    body = '<div class="hx-donut">' +
      '<div class="hx-donut__r" role="img" aria-label="' +
        esc("توزيع البنود المفتوحة: " + parts.map(function (x) { return x.label + " " + x.n; }).join("، ")) + '">' +
        '<svg viewBox="0 0 42 42"><circle class="hx-donut__t" cx="21" cy="21" r="15.9" pathLength="100"></circle>' + ring + "</svg>" +
        '<span class="hx-donut__c"><b class="m-n">' + fmtN(total) + "</b><small>بنود</small></span></div>" +
      '<ul class="hx-donut__l">' + parts.map(function (x, i) {
        return '<li><i class="t' + (i % 4) + '"></i><span>' + esc(x.label) + "</span>" +
          '<b class="m-n">' + fmtN(Math.round((x.n / total) * 100)) + "٪</b></li>";
      }).join("") + "</ul></div>";
  }
  return '<section class="hx-card">' +
    '<div class="hx-card__h"><div><h3 class="hx-card__t">توزيع البنود المفتوحة</h3>' +
      '<p class="m-meta">حصة كل مرحلة من البنود</p></div></div>' +
    body + "</section>";
}

/* ---------- the surface ---------- */
function vHomeDs() {
  /* Every loader is idempotent, guards its own in-flight flag, and ends in render(false), so
     calling them here is safe and the screen repaints itself as each one lands. #home is off the
     5s tick (R14), so none of them inherits a poll. */
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
    hdsKpiRow(f, lines) +
    '<div class="hx-r2">' + hdsFlowCard(f) + hdsPipelineCard(lines) + "</div>" +
    '<div class="hx-r3">' + hdsEventsCard() + hdsGoalCard(f) + hdsDonutCard(lines) + "</div>" +
    '<p class="hx-foot">المسجّل يظهر بقيمته. ما ينقص التسجيل يبقى ظاهرًا، وما يساوي صفرًا يبقى صفرًا.</p>' +
    "</div>";
}
`;
