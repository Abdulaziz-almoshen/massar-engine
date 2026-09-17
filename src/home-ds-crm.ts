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

/* opStage() resolves a stage KEY against the live, admin-editable ladder. Printing the raw key
   would show the reader an identifier the admin never chose. */
function hdsStage(k) {
  if (typeof opStage !== "function") return String(k || "");
  var s = opStage(k);
  return (s && s.label) ? s.label : String(k || "");
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
function hdsLedger(lines) {
  if (!lines.length) {
    return '<section class="m-card m-card--ledger"><header class="m-section-head">' +
      '<div class="m-section-head__t"><h2 class="m-h2">فرص البيع المفتوحة</h2>' +
      '<p class="m-meta">لا بنود مفتوحة. تظهر هنا فور تسجيل أول فرصة.</p></div></header></section>';
  }
  var days = lines.map(function (l) { return l.days; });
  var lo = Math.min.apply(null, days), hi = Math.max.apply(null, days);

  var h = '<section class="m-card m-card--ledger" aria-labelledby="hdsPipe">';
  h += '<header class="m-section-head"><div class="m-section-head__t">';
  h += '<h2 class="m-h2" id="hdsPipe">فرص البيع المفتوحة</h2>';
  h += '<p class="m-meta">' + hdsPl(lines.length, "بند واحد", "بندان", "بنود", "بندًا") +
     " · بلا حركة منذ " +
       (lo === hi ? hdsN(lo) : (hdsN(lo) + "&#8211;" + hdsN(hi))) + " يومًا</p></div>";
  h += '<div class="m-seg" role="group" aria-label="طريقة العرض">' +
       '<button type="button" data-v="list" aria-pressed="true" onclick="hdsView(&quot;list&quot;)">قائمة</button>' +
       '<button type="button" data-v="chart" aria-pressed="false" onclick="hdsView(&quot;chart&quot;)">مدة الركود</button>' +
       "</div></header>";

  h += '<div class="m-view"><div class="m-view__p" id="hdsList"><div class="m-tablewrap">';
  h += '<table class="m-table m-ledger"><thead><tr><th>العميل</th><th>المنتج</th>' +
       "<th>المرحلة</th><th>القيمة</th><th>بلا حركة</th></tr></thead><tbody>";
  h += lines.map(function (l) {
    return "<tr" + (l.value ? "" : ' class="m-ledger__unpriced"') + ">" +
      '<td class="m-td-n">' + esc(l.account) + "</td>" +
      "<td>" + esc(l.product) + "</td>" +
      '<td><span class="m-chip">' + esc(hdsStage(l.stage)) + "</span></td>" +
      '<td class="m-td-v">' + (l.value ? hdsN(l.value) : hdsNil("لم يُسعَّر", "owed")) + "</td>" +
      '<td class="m-td-v">' + hdsN(l.days) + "</td></tr>";
  }).join("");
  h += "</tbody></table></div></div>";

  /* The same numbers the table prints, drawn. Not a rate, not an average — so switching the view
     cannot change what the page claims. */
  h += '<div class="m-view__p" id="hdsChart" hidden><div class="m-aging">';
  h += lines.map(function (l) {
    var pct = hi ? Math.round((l.days / hi) * 100) : 0;
    return '<div class="m-aging__r"><span class="m-aging__k">' +
      esc(l.account) + " · " + esc(l.product) + "</span>" +
      '<span class="m-aging__b"><i style="--m-pct:' + pct + '%"' +
      (l.value ? ' class="is-priced"' : "") + "></i></span>" +
      '<span class="m-aging__v">' + hdsN(l.days) + " يومًا</span></div>";
  }).join("");
  h += "</div></div></div></section>";
  return h;
}

/* One crossfade, both sides symmetric. An asymmetric swap reads as one panel shoving the other
   out of the way rather than as one surface changing. */
window.hdsView = function (v) {
  var wrap = document.querySelector(".ds6 .m-card--ledger");
  if (!wrap) return;
  [].forEach.call(wrap.querySelectorAll(".m-seg button"), function (b) {
    b.setAttribute("aria-pressed", b.getAttribute("data-v") === v ? "true" : "false");
  });
  [].forEach.call(wrap.querySelectorAll(".m-view__p"), function (p) {
    var on = p.id === (v === "list" ? "hdsList" : "hdsChart");
    if (on) { p.hidden = false; requestAnimationFrame(function () { p.removeAttribute("data-away"); }); }
    else { p.setAttribute("data-away", ""); setTimeout(function () { p.hidden = true; }, 120); }
  });
};

/* ---------- what is blocking the sale ---------- */
function hdsDecisions(f, lines) {
  var items = [];
  if (f.unpriced) {
    items.push(["#opps", hdsPl(f.unpriced, "بند واحد", "بندان", "بنود", "بندًا") +
      " بلا تسعير من " + fmtN(f.openLines || lines.length),
      "قيمة خط البيع تُقرأ من البنود المسعّرة وحدها. الباقي لا يدخل أي مجموع.", "تسعير البنود"]);
  }
  if (f.noTarget) {
    items.push(["#perf", fmtN(f.noTarget) + " منتجات بلا مستهدف من " + fmtN(f.products),
      f.onlyProduct
        ? ("المستهدف الوحيد المسجّل على " + f.onlyProduct + (f.onlyScope ? "، " + f.onlyScope : "") + ".")
        : "لا يمكن قياس الإنجاز على منتج بلا مستهدف.", "تسجيل المستهدفات"]);
  }
  var stale = lines.filter(function (l) { return l.days >= 30; });
  if (stale.length) {
    items.push(["#board", hdsPl(stale.length, "بند واحد", "بندان", "بنود", "بندًا") +
      " بلا حركة منذ 30 يومًا أو أكثر",
      "لا حركة مسجّلة على هذه البنود منذ آخر تغيّر مرحلة.", "فتح اللوحة"]);
  }
  if (!items.length) return "";
  /* A DIV, not an <aside>. dashboard.ts:240 styles the bare tag as the navigation rail
     (background #EFF1F5, later the dark --rail-2), and this column rendered dark-on-dark on the
     first deploy. role gives back the semantics the tag was carrying. */
  return '<div class="m-home__decisions" role="complementary" aria-labelledby="hdsDec">' +
    '<h2 class="m-h2" id="hdsDec">ما يعطّل البيع</h2>' +
    items.map(function (it) {
      return '<div class="m-decision"><h3 class="m-decision__title">' + esc(it[1]) + "</h3>" +
        '<p class="m-meta">' + esc(it[2]) + "</p>" +
        '<a class="m-link" href="' + it[0] + '">' + esc(it[3]) + " &#8592;</a></div>";
    }).join("") + "</div>";
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
    '<div class="m-home__work">' + hdsLedger(lines) + hdsDecisions(f, lines) + "</div>" +
    "</div>";
}
`;
