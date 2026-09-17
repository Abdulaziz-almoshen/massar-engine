// year-targets-crm.ts — «المستهدفات» as the prototype states it: the YEAR, per product, with its
// quarterly split, grouped by sector.
//
// Massar already had the numbers — «المستهدفات والأداء» reports a quarter at a time, and the product
// record holds the four quarters of one product. What nobody could see on one screen was the year:
// what each product is asked to sell, what it has sold, and how the target was spread across the
// quarters. That is the question a plan is reviewed against.
//
// Every figure is read from /admin/sales/quarters, which computes them from the stage ledger. This
// file only groups and draws; the one attainment rule stays in sales-domain.
//
// PORTED to the new design system (docs/PORT-SPEC.md). The screen body is wrapped in its own .ds6;
// the route paints vYearTargets() + vSalesPerf() into one screen, so each owns one wrapper. Every
// figure goes through .m-n (or through opMoneyShort, which carries its own bdi — see the CSS note),
// every empty cell states WHICH KIND of absence it is, and the two counts printed both in the KPI
// strip and in the qualification under it are bound with dsD/dsFig.
//
// THE REPAIRS BELOW ARE LOAD-BEARING AND SURVIVE THE PORT. The ratio covers only the products that
// HAVE a target and says how many it left out; a product-level percentage measured on part of the
// year says «مستهدف N من أربعة أرباع» rather than wearing the year's name. Those captions are the
// point of this screen, not clutter to be tidied away.
//
// No backticks in this file (gate: check-crm-literals).

export const YEAR_TARGETS_CSS = `
/* PORTED to the m-* vocabulary (docs/PORT-SPEC.md). Deleted here because the vocabulary carries
   them: the KPI tiles (.m-kpis/.m-stat__*), the card and its header, the table, the pill, the
   empty state, every number and all three kinds of absence. What survives is the one thing the
   vocabulary does not have — the quarterly split drawn as four small meters in a single cell.

   MONEY. opMoneyShort stays as the money formatter rather than being re-wrapped in .m-n: it emits
   a bdi element, which supplies the bidi isolation .m-n exists to give, and it carries the
   counted-noun rule for «ألف/آلاف/مليون/ملايين». exec-reports-crm.ts states tabular figures on
   .ds6 bdi once, for every ported screen. */
.ds6 .yt{display:flex;flex-direction:column;gap:var(--m-4)}
.ds6 .yt-sec .m-card__h{padding-inline:var(--m-5);padding-block:var(--m-4);margin-block-end:0;
  border-block-end:1px solid var(--m-line);align-items:baseline;flex-wrap:wrap}
.ds6 .yt-tbl .m-table{min-inline-size:900px}
.ds6 .yt-sub{display:block;font-weight:400;margin-block-start:2px}

/* The quarterly split: four columns in one cell, each the quarter's achieved against its own
   target. The bar is .m-meter, so it grows on the system's own curve. */
.ds6 .yt-q{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.ds6 .yt-qc{display:flex;flex-direction:column;gap:4px;min-inline-size:0}
.ds6 .yt-qc .k{font-size:var(--m-t-micro);color:var(--m-mut)}
.ds6 .yt-qc .v{font-size:var(--m-t-micro);color:var(--m-ink-2);white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis}
.ds6 .yt-qc.cur .k{color:var(--m-ac-deep);font-weight:600}
.ds6 .yt-qc.over .m-meter i{background:var(--m-ok)}
/* A quarter nobody set a target for is a HATCHED track, not an empty one: an empty track and a
   zero-progress track are different facts and they drew identically. */
.ds6 .yt-qc.none .m-meter{background:repeating-linear-gradient(135deg,var(--m-sunk),
  var(--m-sunk) 4px,var(--m-paper) 4px,var(--m-paper) 8px)}
@media (max-width:900px){
  .ds6 .yt-tbl .m-table{min-inline-size:640px}
  .ds6 .yt-q{grid-template-columns:repeat(2,minmax(0,1fr))}
}
`;

export const YEAR_TARGETS_JS = `
/* The sector a product sells into — the catalogue's own mapping, never re-derived here. */
function ytSectorOf(product) {
  var cat = (typeof pcCat !== "undefined" && pcCat) || [];
  for (var i = 0; i < cat.length; i++) if (cat[i].product === product) return cat[i].sector || "";
  return "";
}
function ytDivisionOf(product) {
  var cat = (typeof pcCat !== "undefined" && pcCat) || [];
  for (var i = 0; i < cat.length; i++) if (cat[i].product === product) return cat[i].division || "";
  return "";
}
function ytMoney(v) { return typeof opMoneyShort === "function" ? opMoneyShort(v) : fmtN(Math.round(v || 0)) + " ر.س"; }
/* The attainment pill's tone is a CLASSIFICATION of the figure beside it, which is the only reason
   it is allowed to be a colour at all. It reads from the m-* status tokens, never from a fourth
   palette of its own. */
function ytTone(pct) {
  return pct === null ? "--tn-soft:var(--m-sunk);--tn-text:var(--m-mut)"
    : pct >= 100 ? "--tn-soft:var(--m-ok-dim);--tn-text:var(--m-ok)"
    : pct >= 70 ? "--tn-soft:var(--m-ac-dim);--tn-text:var(--m-ac-deep)"
    : "--tn-soft:var(--m-warn-dim);--tn-text:var(--m-warn)";
}
function ytPill(pct) {
  return '<span class="m-chip m-chip--plain" style="' + ytTone(pct) +
    ';background:var(--tn-soft);color:var(--tn-text)">' +
    (pct === null ? mNil("بلا مستهدف", "owed") : mPct(pct)) + "</span>";
}
/* A YEAR IS NOT A QUANTITY: fmtN groups thousands and printed «2,026» the first time this shipped. */
function ytYear(y) { return '<span class="m-n">' + String(y) + "</span>"; }

/* The two counts this screen prints TWICE — once in the KPI strip and once in the qualification
   under it — are bound to the rows they are counted from, so the strip and the sentence beneath it
   cannot drift apart (PORT-SPEC §6). */
function ytRows() {
  var q = (typeof pcQuarters !== "undefined" && pcQuarters) || null;
  return q ? (q.byProduct || []) : [];
}
function ytHasTarget(r) { return r.annualTarget !== null && r.annualTarget !== undefined; }
function ytBind() {
  dsD("ytProducts", function () { return ytRows().length; });
  dsD("ytTargeted", function () { return ytRows().filter(ytHasTarget).length; });
  dsD("ytNoTarget", function () { return ytRows().filter(function (r) { return !ytHasTarget(r); }).length; });
}

function vYearTargets() {
  if (typeof pcLoad === "function") pcLoad(false);
  var q = (typeof pcQuarters !== "undefined" && pcQuarters) || null;
  if (!q) return "";
  ytBind();
  var rows = q.byProduct || [];
  var year = q.year;
  var cur = q.currentQuarter;

  /* A ratio has to have the SAME population on both sides. This summed annualTarget with
     «|| 0», which silently drops an untargeted product from the denominator, while achieved
     kept summing every product — so a product with revenue and no target inflated the
     percentage without ever appearing in what it was measured against. Attainment could pass
     100٪ with real targets unmet, and «المتبقّي» could read 0 at the same time.
     Targeted products decide the ratio; the rest are counted and stated, never folded in. */
  var targeted = rows.filter(ytHasTarget);
  var target = 0, achieved = 0;
  targeted.forEach(function (r) { target += Number(r.annualTarget) || 0; achieved += Number(r.achieved) || 0; });
  var outsideAch = 0, outside = rows.length - targeted.length;
  rows.forEach(function (r) { if (!ytHasTarget(r)) outsideAch += Number(r.achieved) || 0; });
  var pct = typeof wholePct === "function" ? wholePct(attainmentPct(achieved, target)) : null;
  var left = Math.max(0, target - achieved);

  var tile = function (cls, k, v, s) {
    return '<div class="m-card ' + cls + '"><span class="m-stat__k">' + k + "</span>" +
      '<span class="m-stat__v">' + v + "</span>" +
      '<span class="m-stat__s">' + s + "</span></div>";
  };
  var h = '<div class="ds6"><div class="yt">';
  h += '<p class="m-meta">السنة المالية ' + ytYear(year) + "</p>";
  h += '<div class="m-kpis">' +
    tile("", "إجمالي المستهدف", target ? ytMoney(target) : mNil("لم يُحدَّد مستهدف", "owed"),
      target ? "لكل المنتجات التي حُدِّد لها مستهدف" : "لم يُسجَّل مستهدف على أي منتج") +
    tile("", "إجمالي المحقق", ytMoney(achieved),
      outside ? ("من المنتجات المستهدفة وحدها · " + ytMoney(outsideAch) + " خارج النسبة") : "من الصفقات الرابحة") +
    tile("", "المتبقّي للمستهدف", target ? ytMoney(left) : mNil("بلا مستهدف", "owed"),
      target ? (left ? "حتى نهاية السنة" : "تحقق المستهدف") : "لا شيء يُقاس عليه") +
    tile("m-stat--ac", "نسبة الإنجاز", pct === null ? mNil("بلا مستهدف", "owed") : mPct(pct),
      pct === null ? "لا مستهدف مسجّل" : "من المستهدف المسجّل") +
    "</div>";

  /* The qualification, stated where the figure is read and not in a footnote: a percentage over
     partial coverage reads as the company's number, and it is not one while products carry no
     target at all. Both counts go through dsFig — they are printed in the strip above too. */
  if (outside) {
    h += '<p class="m-status m-status--warn">النسبة محسوبة على ' +
      dsFig("ytTargeted", targeted.length) + " من " + dsFig("ytProducts", rows.length) +
      " منتجات · " + dsFig("ytNoTarget", outside) + " بلا مستهدف لهذه السنة، ومحققها خارج النسبة.</p>";
  } else if (rows.length) {
    h += '<p class="m-meta">كل ' + mPl(rows.length, "منتج واحد", "منتجان", "منتجات", "منتجًا") +
      " يحمل مستهدفًا مسجّلًا لهذه السنة.</p>";
  }

  /* Grouped by sector, in the catalogue's order, with anything unmapped last and named as such. */
  var groups = [], byName = {};
  rows.forEach(function (r) {
    var sec = ytSectorOf(r.product) || "بلا قطاع";
    if (!byName[sec]) { byName[sec] = { sector: sec, rows: [], target: 0, achieved: 0 }; groups.push(byName[sec]); }
    byName[sec].rows.push(r);
    byName[sec].target += Number(r.annualTarget) || 0;
    byName[sec].achieved += Number(r.achieved) || 0;
  });
  groups.sort(function (a, b) {
    if ((a.sector === "بلا قطاع") !== (b.sector === "بلا قطاع")) return a.sector === "بلا قطاع" ? 1 : -1;
    return b.target - a.target;
  });

  if (!groups.length) {
    return h + '<section class="m-card m-empty"><p class="m-empty__t">لا منتجات في الكتالوج بعد</p>' +
      '<p class="m-empty__d">يظهر المستهدف السنوي هنا فور إضافة أول منتج.</p></section></div></div>';
  }

  groups.forEach(function (g) {
    var gp = typeof wholePct === "function" ? wholePct(attainmentPct(g.achieved, g.target)) : null;
    h += '<section class="m-card m-card--pad0 yt-sec yt-tbl"><div class="m-card__h">' +
      '<h2 class="m-card__t">' + esc(g.sector) + "</h2>" +
      '<span class="m-meta">' + ytMoney(g.achieved) + " من " +
        (g.target ? ytMoney(g.target) : mNil("بلا مستهدف", "owed")) +
        (gp === null ? "" : " · " + mPct(gp)) + " · " +
        mPl(g.rows.length, "منتج واحد", "منتجان", "منتجات", "منتجًا") + "</span></div>";
    h += '<div class="m-tablewrap"><table class="m-table"><thead><tr>' +
      "<th>المنتج</th><th>المستهدف السنوي</th><th>المحقق</th><th>الإنجاز</th>" +
      "<th>التوزيع الربعي</th></tr></thead><tbody>";
    g.rows.forEach(function (r) {
      var rp = typeof wholePct === "function" ? wholePct(attainmentPct(r.achieved, r.annualTarget)) : null;
      var qtrs = Number(r.targetQuarters) || 0;
      var div = ytDivisionOf(r.product);
      var qs = r.quarters || [];
      var top = 0;
      qs.forEach(function (x) { top = Math.max(top, Number(x.target) || 0, Number(x.achieved) || 0); });
      h += '<tr><td class="m-td-n">' + esc(r.product) +
        (div ? '<span class="yt-sub m-meta">' + esc(div) + "</span>" : "") + "</td>" +
        '<td class="m-td-v">' + (ytHasTarget(r) ? ytMoney(r.annualTarget) : mNil("لم يُحدَّد", "owed")) + "</td>" +
        '<td class="m-td-v">' + ytMoney(r.achieved) + "</td>" +
        /* annualTarget is NOT an annual target: db.ts builds it from only the quarters that carry a
           target row and reports how many in targetQuarters, while achieved covers the whole year.
           A product targeted in Q1 alone that won all year printed «400٪» under the year's name.
           The percentage is still shown — it is the only one there is — but it says what it was
           measured on, the way the two sibling screens already do. */
        "<td>" + ytPill(rp) +
          (rp !== null && qtrs > 0 && qtrs < 4
            ? '<span class="yt-sub m-meta">مستهدف ' + mN(qtrs) + " من أربعة أرباع</span>"
            : "") + "</td>" +
        '<td><span class="yt-q">' + qs.map(function (x) {
          var t = Number(x.target) || 0, a = Number(x.achieved) || 0;
          var w = top > 0 ? Math.min(100, Math.round((a / top) * 100)) : 0;
          var cls = (x.quarter === cur ? " cur" : "") + (t > 0 && a >= t ? " over" : "") + (t > 0 ? "" : " none");
          var said = t > 0 ? ytMoney(a) + " من " + ytMoney(t)
            : a ? ytMoney(a) + " بلا مستهدف للربع" : "بلا مستهدف للربع";
          return '<span class="yt-qc' + cls + '" title="' + esc("الربع " + fmtN(x.quarter)) + '">' +
            '<span class="k">ر<span class="m-n">' + fmtN(x.quarter) + "</span></span>" +
            '<span class="m-meter" role="img" aria-label="' + esc(said) + '">' +
              '<i style="--m-pct:' + w + '%"></i></span>' +
            '<span class="v">' + (t > 0 || a ? ytMoney(a) : mNil("بلا مستهدف", "owed")) + "</span></span>";
        }).join("") + "</span></td></tr>";
    });
    h += "</tbody></table></div></section>";
  });
  return h + "</div></div>";
}
`;
