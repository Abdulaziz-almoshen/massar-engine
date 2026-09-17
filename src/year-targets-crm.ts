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
// No backticks in this file (gate: check-crm-literals).

export const YEAR_TARGETS_CSS = `
.yt { display:flex; flex-direction:column; gap:var(--s4); margin-block-end:var(--s5); }
.yt-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:var(--s3); }
.yt-kpi { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); padding:var(--s4);
  display:flex; flex-direction:column; gap:4px; min-width:0; }
.yt-kpi .l { font-size:var(--t-xs); color:var(--muted); }
.yt-kpi .n { font-size:var(--t-2xl); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; line-height:1.15; }
.yt-kpi .n.none { color:var(--muted); }
.yt-kpi .s { font-size:var(--t-xs); color:var(--muted); }
.yt-kpi.lead .n { color:var(--accent-deep); }

.yt-sec { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); overflow:hidden; }
.yt-hd { display:flex; align-items:baseline; gap:var(--s3); padding:var(--s3) var(--s4); border-bottom:1px solid var(--line-soft); flex-wrap:wrap; }
.yt-hd h3 { margin:0; font-size:var(--t-sm); font-weight:600; color:var(--ink); }
.yt-hd .s { font-size:var(--t-xs); color:var(--muted); font-variant-numeric:tabular-nums; }
.yt-hd .sp { flex:1; }
.yt-r { display:grid; grid-template-columns:minmax(0,1.3fr) 130px 130px 104px minmax(220px,1.2fr);
  align-items:center; gap:var(--s3); padding:var(--s3) var(--s4); border-top:1px solid var(--line-soft); font-size:var(--t-sm); }
.yt-r:first-of-type { border-top:0; }
.yt-r.hdr { font-size:var(--t-xs); font-weight:600; color:var(--muted); background:var(--surface); border-top:0; }
.yt-r .nm { font-weight:600; color:var(--ink); overflow-wrap:anywhere; }
.yt-r .nm .sub { display:block; font-weight:400; font-size:var(--t-xs); color:var(--muted); margin-block-start:2px; }
.yt-r .num { font-variant-numeric:tabular-nums; color:var(--ink-2); }
.yt-r .num.none { color:var(--muted); }
.yt-pct { display:inline-flex; align-items:center; gap:6px; font-size:var(--t-xs); font-weight:600;
  border-radius:var(--r-pill); padding:3px 10px; background:var(--tn-soft,var(--surface-2)); color:var(--tn-text,var(--ink-2)); }
/* the quarterly split: four columns, each the quarter's achieved against its own target */
.yt-q { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; }
.yt-qc { display:flex; flex-direction:column; gap:3px; min-width:0; }
.yt-qc .k { font-size:var(--t-xs); color:var(--muted); font-variant-numeric:tabular-nums; }
.yt-qc .bar { height:8px; border-radius:var(--r-pill); background:var(--surface-2); overflow:hidden; }
.yt-qc .bar i { display:block; height:100%; background:var(--accent); border-radius:var(--r-pill);
  transition:width 320ms cubic-bezier(0.23, 1, 0.32, 1); }
.yt-qc.cur .k { color:var(--accent-deep); font-weight:600; }
.yt-qc.over .bar i { background:var(--s-ok-text, #12633F); }
.yt-qc.none .bar { background:repeating-linear-gradient(135deg,var(--surface-2),var(--surface-2) 4px,var(--paper) 4px,var(--paper) 8px); }
.yt-qc .v { font-size:var(--t-xs); color:var(--ink-2); font-variant-numeric:tabular-nums; }
.yt-state { padding:var(--s5) var(--s4); text-align:center; font-size:var(--t-sm); color:var(--muted); line-height:1.9; }

@media (prefers-reduced-motion: reduce) { .yt-qc .bar i { transition:none; } }
@media (max-width: 900px) {
  .yt-r { grid-template-columns:minmax(0,1fr) auto; row-gap:6px; }
  .yt-r.hdr { display:none; }
  .yt-q { grid-column:1 / -1; }
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
function ytTone(pct) {
  return pct === null ? "--tn-soft:var(--surface-2);--tn-text:var(--muted)"
    : pct >= 100 ? "--tn-soft:#E6F3EC;--tn-text:#12633F"
    : pct >= 70 ? "--tn-soft:var(--accent-tint);--tn-text:var(--accent-deep)"
    : "--tn-soft:#FBF2DC;--tn-text:#7A5600";
}

function vYearTargets() {
  if (typeof pcLoad === "function") pcLoad(false);
  var q = (typeof pcQuarters !== "undefined" && pcQuarters) || null;
  if (!q) return "";
  var rows = q.byProduct || [];
  var year = q.year;
  var cur = q.currentQuarter;

  /* A ratio has to have the SAME population on both sides. This summed annualTarget with
     «|| 0», which silently drops an untargeted product from the denominator, while achieved
     kept summing every product — so a product with revenue and no target inflated the
     percentage without ever appearing in what it was measured against. Attainment could pass
     100٪ with real targets unmet, and «المتبقّي» could read 0 at the same time.
     Targeted products decide the ratio; the rest are counted and stated, never folded in. */
  var targeted = rows.filter(function (r) { return r.annualTarget !== null && r.annualTarget !== undefined; });
  var target = 0, achieved = 0;
  targeted.forEach(function (r) { target += Number(r.annualTarget) || 0; achieved += Number(r.achieved) || 0; });
  var outsideAch = 0, outside = rows.length - targeted.length;
  rows.forEach(function (r) {
    if (r.annualTarget === null || r.annualTarget === undefined) outsideAch += Number(r.achieved) || 0;
  });
  var pct = typeof wholePct === "function" ? wholePct(attainmentPct(achieved, target)) : null;
  var left = Math.max(0, target - achieved);

  var h = '<div class="yt"><div class="yt-kpis">' +
    /* A YEAR is not a quantity: fmtN would print «2,026». Same defect the campaign chain shipped once. */
    '<div class="yt-kpi"><span class="l">إجمالي المستهدف · ' + esc(String(year)) + '</span>' +
      (target ? '<span class="n">' + ytMoney(target) + "</span>" : '<span class="n none">—</span>') +
      '<span class="s">' + (target
        ? ("لكل المنتجات التي حُدِّد لها مستهدف" + (outside ? " · " + fmtN(outside) + " خارجها" : ""))
        : "لم يُحدَّد مستهدف بعد") + "</span></div>" +
    '<div class="yt-kpi"><span class="l">إجمالي المحقق</span><span class="n">' + ytMoney(achieved) + "</span>" +
      '<span class="s">' + (outside
        ? ("من المنتجات المستهدفة · " + ytMoney(outsideAch) + " خارج النسبة")
        : "من الصفقات الرابحة") + "</span></div>" +
    '<div class="yt-kpi"><span class="l">المتبقّي للمستهدف</span>' +
      (target ? '<span class="n">' + ytMoney(left) + "</span>" : '<span class="n none">—</span>') +
      '<span class="s">' + (target ? (left ? "حتى نهاية السنة" : "تحقق المستهدف") : "بلا مستهدف") + "</span></div>" +
    '<div class="yt-kpi lead"><span class="l">نسبة الإنجاز</span>' +
      (pct === null ? '<span class="n none">—</span>' : '<span class="n">' + fmtN(pct) + "٪</span>") +
      '<span class="s">' + (pct === null ? "بلا مستهدف" : "من المستهدف") + "</span></div>" +
    "</div>";

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
    return h + '<div class="yt-sec"><div class="yt-state">لا منتجات في الكتالوج بعد — يظهر المستهدف السنوي هنا فور إضافة أول منتج.</div></div></div>';
  }

  groups.forEach(function (g) {
    var gp = typeof wholePct === "function" ? wholePct(attainmentPct(g.achieved, g.target)) : null;
    h += '<section class="yt-sec"><div class="yt-hd"><h3>' + esc(g.sector) + "</h3>" +
      '<span class="s">' + ytMoney(g.achieved) + " من " + (g.target ? ytMoney(g.target) : "بلا مستهدف") +
      (gp === null ? "" : " · " + fmtN(gp) + "٪") + "</span><span class=\\"sp\\"></span>" +
      '<span class="s">' + fmtN(g.rows.length) + (g.rows.length === 1 ? " منتج" : " منتجات") + "</span></div>";
    h += '<div class="yt-r hdr"><span>المنتج</span><span>المستهدف السنوي</span><span>المحقق</span><span>الإنجاز</span><span>التوزيع الربعي</span></div>';
    g.rows.forEach(function (r) {
      var rp = typeof wholePct === "function" ? wholePct(attainmentPct(r.achieved, r.annualTarget)) : null;
      var div = ytDivisionOf(r.product);
      var qs = r.quarters || [];
      var top = 0;
      qs.forEach(function (x) { top = Math.max(top, Number(x.target) || 0, Number(x.achieved) || 0); });
      h += '<div class="yt-r"><span class="nm">' + esc(r.product) +
        (div ? '<span class="sub">' + esc(div) + "</span>" : "") + "</span>" +
        '<span class="num' + (r.annualTarget ? "" : " none") + '">' + (r.annualTarget ? ytMoney(r.annualTarget) : "لم يُحدَّد") + "</span>" +
        '<span class="num">' + ytMoney(r.achieved) + "</span>" +
        '<span><span class="yt-pct" style="' + ytTone(rp) + '">' + (rp === null ? "—" : fmtN(rp) + "٪") + "</span></span>" +
        '<span class="yt-q">' + qs.map(function (x) {
          var t = Number(x.target) || 0, a = Number(x.achieved) || 0;
          var w = top > 0 ? Math.min(100, Math.round((a / top) * 100)) : 0;
          var cls = (x.quarter === cur ? " cur" : "") + (t > 0 && a >= t ? " over" : "") + (t > 0 ? "" : " none");
          var said = t > 0 ? ytMoney(a) + " من " + ytMoney(t) : a ? ytMoney(a) + " بلا مستهدف للربع" : "بلا مستهدف للربع";
          return '<span class="yt-qc' + cls + '" title="' + esc("الربع " + fmtN(x.quarter) + ": " + said) + '">' +
            '<span class="k">ر' + fmtN(x.quarter) + "</span>" +
            '<span class="bar"><i style="width:' + w + '%"></i></span>' +
            '<span class="v">' + (t > 0 || a ? ytMoney(a) : "—") + "</span></span>";
        }).join("") + "</span></div>";
    });
    h += "</section>";
  });
  return h + "</div>";
}
`;
