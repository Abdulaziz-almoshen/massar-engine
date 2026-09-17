// home-ds-crm.ts — «الرئيسية», rebuilt on the new design system.
//
// WHY THIS REPLACES THE DECK. A GPT review (massar-ds/review/ASTRA-FINAL.md) blocked the previous
// home on five findings, and every one was the same defect: the page printed figures the records do
// not contain. The worst of them divided a target by twelve to draw a monthly series — but the one
// target on record is annual on a SINGLE product, and the other products have no target at all.
// Dividing it produced a "required to date" figure for periods nobody ever set a target for.
//
// The fix is not a restyle. It is reading the field that already carries the distinction:
// ProductPerformanceRow.annualTarget is `number | null`, and null means NO TARGET RECORDED, which is
// not the same as a target of zero. Every figure below traces to a stored value or is not shown.
//
// Nothing here computes an attainment percentage while products are missing targets. A percentage
// over partial coverage reads as company performance and is not: it is one product's quarter
// wearing the whole company's name.
//
// SCOPED. The markup is wrapped in .ds6, which is the only place massar-ds-crm.ts can reach. The
// bands below the surface still render in the old system until they are ported in turn.
//
// (No backticks anywhere below, including in comments: this is one template literal.)

export const HOME_DS_JS = `
/* The year the performance read is keyed by. pcQuarters carries it; fall back to the calendar
   year rather than inventing a fiscal one. */
function hdsYear() {
  return (typeof pcQuarters !== "undefined" && pcQuarters && pcQuarters.year)
    ? Number(pcQuarters.year) : new Date().getFullYear();
}

/* Every count on this page comes from here, so a summary and the table under it cannot disagree.
   That was finding 5: the rail said six products, the page said "five of six", the truth was
   eight and seven. Three numbers, one fact, none of them derived from the others. */
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
    scope = qs.length === 1 ? ("الربع " + fmtN(qs[0].quarter) + " فقط")
      : (qs.length && qs.length < 4 ? (fmtN(qs.length) + " أرباع من أربعة") : "السنة كاملة");
  }
  return {
    year: year, loaded: !!perf, products: rows.length,
    withTarget: withTarget.length, noTarget: rows.length - withTarget.length,
    recorded: recorded, achieved: achieved,
    openValue: openValue, openLines: openLines, unpriced: unpriced,
    onlyProduct: only ? only.product : "", onlyScope: scope
  };
}

/* The open lines, priced first, each with how long it has stood still. opDays is days in the
   current stage, which is the only movement signal the ledger actually stores. */
function hdsLines() {
  var rows = (typeof oppRows !== "undefined" && oppRows) ? oppRows : [];
  var open = rows.filter(function (l) { return opIsOpen(l); });
  return open.map(function (l) {
    return { id: l.id, account: l.account_name || "", product: l.product || "",
             stage: l.stage, value: opValue(l), days: opDays(l) };
  }).sort(function (a, b) {
    if (!a.value !== !b.value) return a.value ? -1 : 1;   /* priced first */
    return b.days - a.days;
  });
}

/* A year is a label, not a quantity. fmtN groups thousands and printed «2,026» on the live
   page the first time this shipped. */
function hdsYearTxt(y) { return String(y); }

/* Arabic counts are four-way, never «n + noun». opPl carries the business tier's rule. */
function hdsPl(n, one, two, few, many) {
  return (typeof opPl === "function") ? opPl(n, one, two, few, many) : (fmtN(n) + " " + many);
}

function hdsN(v) { return '<span class="m-n">' + fmtN(v) + "</span>"; }

/* Bind the counts this screen prints to the arrays it renders them from. A figure marked here
   is re-derived on every paint; if the markup and the records ever disagree, the number is
   outlined and the console says which key. Astra's finding 5 was three numbers for one fact
   (nav said six products, home said "five of six", the truth was eight) — that is now a runtime
   error rather than something the next reviewer has to notice. */
function hdsBind() {
  dsD("products",  function () { return hdsFacts().products; });
  dsD("noTarget",  function () { return hdsFacts().noTarget; });
  dsD("nLines",    function () { return hdsLines().length; });
  dsD("unpriced",  function () { return hdsLines().filter(function (l) { return !l.value; }).length; });
  dsD("priced",    function () { return hdsLines().filter(function (l) { return l.value > 0; }).length; });
  dsD("staleN",    function () { return hdsLines().filter(function (l) { return l.days >= 30; }).length; });
}
/* kind: "owed" a number someone owes, "unset" a classification nobody made, "none" a
   legitimate nothing. Drawing all three the same is how a page of dashes teaches the reader
   to stop seeing dashes. */
function hdsNil(t, kind) {
  return '<span class="m-td-nil m-nil--' + (kind || "none") + '">' + esc(t) + "</span>";
}

/* ---------- the revenue surface ---------- */
function hdsRevenue(f, lines) {
  var priced = lines.filter(function (l) { return l.value > 0; });
  var pricedValue = 0; priced.forEach(function (l) { pricedValue += l.value; });

  var h = '<section class="m-card m-card--revenue" aria-labelledby="hdsRev">';
  h += '<div class="m-revenue__main">';
  h += '<h2 class="m-label" id="hdsRev">الإيراد المحقق</h2>';
  h += '<p class="m-revenue__value">' + hdsN(f.achieved) + "<span>ر.س</span></p>";
  h += '<p class="m-body">' + (f.achieved
    ? ("من الصفقات الرابحة المسجّلة في " + hdsYearTxt(f.year))
    : ("لا صفقات رابحة مسجّلة في " + hdsYearTxt(f.year))) + "</p>";
  if (!f.achieved) {
    h += '<p class="m-status m-status--warn">لا توجد إيرادات محققة حتى الآن</p>';
  }
  if (priced.length) {
    h += '<div class="m-actions"><a class="m-btn m-btn--primary" href="#opps">' +
         "مراجعة البنود المسعّرة</a></div>";
  }
  h += "</div>";

  h += '<div class="m-revenue__context"><dl class="m-facts">';
  h += "<div><dt>المستهدف المسجّل</dt>";
  if (f.withTarget) {
    h += '<dd class="m-facts__value">' + hdsN(f.recorded) + " ر.س</dd>";
    h += "<dd>" + (f.onlyProduct
      ? (esc(f.onlyProduct) + (f.onlyScope ? " · " + esc(f.onlyScope) : ""))
      : ("على " + fmtN(f.withTarget) + " منتجات")) + "</dd>";
  } else {
    h += '<dd class="m-facts__value">' + hdsNil("لا مستهدف مسجّل", "owed") + "</dd>";
    h += "<dd>لم يُسجَّل مستهدف على أي منتج في " + hdsYearTxt(f.year) + "</dd>";
  }
  h += "</div>";

  h += "<div><dt>قيمة البنود المفتوحة المسعّرة</dt>";
  h += '<dd class="m-facts__value">' + hdsN(pricedValue) + " ر.س</dd>";
  h += "<dd>" + (lines.length
    ? (dsFig("priced", priced.length) + " مسعّر من " + dsFig("nLines", lines.length) +
       (f.unpriced ? ("؛ " + fmtN(f.unpriced) + " بلا تسعير") : ""))
    : "لا بنود مفتوحة") + "</dd></div></dl>";

  /* The qualification. Without it the figure above reads as the company's number, and it is not
     one while most products carry no target to read it against. */
  if (f.noTarget) {
    h += '<p class="m-revenue__qualification">' + dsFig("noTarget", f.noTarget) +
         " من " + dsFig("products", f.products) +
         " منتجات بلا مستهدف. لا يمكن تقييم تحقيق مستهدف الشركة.</p>";
    h += '<a class="m-link" href="#perf">استكمال المستهدفات &#8592;</a>';
  } else if (f.products) {
    h += '<p class="m-revenue__qualification">كل المنتجات تحمل مستهدفًا مسجّلًا.</p>';
    h += '<a class="m-link" href="#perf">المستهدفات والأداء &#8592;</a>';
  }
  h += "</div></section>";
  return h;
}

/* ---------- the open lines, as rows or as how long each has stood still ---------- */
/* Two indicators, not a table. Each is a fact the revenue figure above depends on, and each
   opens the screen that owns the records behind it. */
window.hdsPipelineBand = function () {
  var f = hdsFacts(), lines = hdsLines();
  if (!f.loaded) return "";
  return hdsPipelineIndicators(f, lines);
};

function hdsPipelineIndicators(f, lines) {
  if (!lines.length) {
    return '<div class="ds6"><div class="m-empty"><div class="m-empty__t">' +
      'لا بنود مفتوحة</div><div class="m-empty__d">' +
      "تظهر هنا فور تسجيل أول فرصة في «فرص البيع».</div></div></div>";
  }
  var priced = lines.filter(function (l) { return l.value > 0; });
  var pricedValue = 0; priced.forEach(function (l) { pricedValue += l.value; });
  var days = lines.map(function (l) { return l.days; });
  var lo = Math.min.apply(null, days), hi = Math.max.apply(null, days);
  var unpriced = lines.length - priced.length;

  var row = function (href, label, value, note, pct, tone) {
    /* Its own row, not .m-seg-row: that class is a label/bar/value triplet sized for a segment
       list, and dropping a second line into its label cell ran «مسعّرة» straight into its own
       note. Three explicit areas instead, so the note has somewhere to live. */
    return '<a class="hds-ind" href="' + href + '">' +
      '<span class="hds-ind__k">' + label + "</span>" +
      '<span class="hds-ind__v">' + value + "</span>" +
      '<span class="hds-ind__b"><i class="' + (tone || "") +
        '" style="--m-pct:' + pct + '%"></i></span>' +
      '<span class="hds-ind__s">' + note + "</span></a>";
  };

  return '<div class="ds6"><div class="m-segs">' +
    row("#opps", "مسعّرة",
        hdsN(pricedValue) + " ر.س",
        hdsPl(priced.length, "بند واحد", "بندان", "بنود", "بندًا") + " من " + fmtN(lines.length) +
        (unpriced ? "؛ الباقي لا يدخل أي مجموع" : ""),
        Math.round((priced.length / lines.length) * 100), "ok") +
    row("#board", "بلا حركة",
        hdsN(hi) + " يومًا",
        lo === hi ? "كل البنود" : ("المدى " + fmtN(lo) + "\u2013" + fmtN(hi) + " يومًا"),
        100, hi >= 30 ? "low" : "mid") +
    "</div></div>";
}

/* ---------- the surface ---------- */
function vHomeDs() {
  if (typeof pcLoad === "function") pcLoad(false);
  if (typeof opLoad === "function") opLoad(false);
  if (typeof pcPerfLoad === "function") pcPerfLoad(hdsYear(), false);

  hdsBind();
  var f = hdsFacts();
  var linesReady = (typeof oppRows !== "undefined" && oppRows);
  if (!f.loaded || !linesReady) {
    return '<div class="ds6"><section class="m-card m-card--revenue">' +
      '<div class="m-revenue__main"><p class="m-body" aria-busy="true">جارٍ قراءة الأداء…</p>' +
      "</div></section></div>";
  }
  var lines = hdsLines();
  return '<div class="ds6">' +
    '<p class="m-meta m-home__dateline">السنة المالية <span class="m-n">' +
      hdsYearTxt(f.year) + '</span></p>' +
    hdsRevenue(f, lines) +
    /* The six-row ledger and the blockers list moved to «فرص البيع» (founder, 2026-09-17).
       الرئيسية answers «are we going to hit the number», and a table of every open line answers
       a different question — one the screen that owns those records already answers better, with
       filters, sorting and a board. What stays is the two indicators that bear on the figure
       above it: how much of the pipeline carries a price, and how long it has stood still. */

    "</div>";
}
`;
