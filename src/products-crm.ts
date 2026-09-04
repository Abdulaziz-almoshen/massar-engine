// products-crm.ts — «المنتجات»: the catalogue, its sectors, and what each product is worth.
//
// This is the screen the sector layer and the package layer were built FOR. Both shipped as
// endpoints with no UI, which meant everything behind them was invisible: the founder opened the
// product and correctly said he could not see any difference.
//
// It is the first screen written on crm-primitives.ts, which was extracted in this same cycle
// precisely so a new screen would not copy a fifth status dot and a third progress bar.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal and a backtick
// ends it. That has happened four times on this project.

export const PRODUCTS_CRM_CSS = `
.pc-sec{margin-block-end:26px}
.pc-h{font-size:13px;font-weight:600;color:var(--ink,#171717);margin-block-end:3px}
.pc-sub{font-size:11.5px;color:var(--muted,#7C7C7C);margin-block-end:12px;max-width:70ch;line-height:1.7}
.pc-note{font-size:11.5px;color:var(--muted,#7C7C7C);margin-block-start:8px;line-height:1.7;
  padding-inline-start:9px;border-inline-start:2px solid var(--line2,#E2E2E2);max-width:66ch}
.pc-assumed{font-size:10.5px;font-weight:600;color:#B54708;margin-inline-start:5px}
.pc-price{font-size:12px;color:var(--ink2,#525252);font-variant-numeric:tabular-nums}
.pc-pkg{font-size:11.5px;color:var(--muted,#7C7C7C)}
.pc-q{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.pc-qc{background:var(--strip,#F8F8F8);border-radius:10px;padding:12px 14px}
.pc-qc .k{font-size:11.5px;color:var(--muted,#7C7C7C);font-weight:600}
.pc-qc .v{font-size:17px;font-weight:700;margin-block:4px 2px;font-variant-numeric:tabular-nums}
.pc-qc .t{font-size:11px;color:var(--muted,#7C7C7C);font-variant-numeric:tabular-nums}
.pc-qc.now{background:#F1F7F6}
`;

export const PRODUCTS_CRM_JS = `
/* ============================ products-crm (client) ============================ */
var pcCat = null, pcSectors = null, pcQuarters = null, pcLoading = false;

function pcLoad(force) {
  if (pcLoading || (pcCat && !force)) return;
  pcLoading = true;
  var h = { headers: { "x-admin-token": TOKEN } };
  Promise.all([
    fetch("/admin/products", h).then(function (r) { return r.json(); }),
    fetch("/admin/sales/sectors", h).then(function (r) { return r.json(); }),
    fetch("/admin/sales/quarters", h).then(function (r) { return r.json(); })
  ]).then(function (out) {
    pcCat = out[0].products || [];
    pcSectors = out[1];
    pcQuarters = out[2];
    pcLoading = false; render(false);
  }).catch(function () { pcCat = []; pcLoading = false; render(false); });
}

/* Money, via the same helper the performance screen uses, so two screens cannot format one figure
   two ways. Arabic-Indic numerals come from fmtN. */
function pcMoney(n) { return fmtN(Math.round(Number(n) || 0)) + " ر.س"; }

/* A YEAR is not a quantity: fmtN groups thousands, so ٢٠٢٦ printed as «٢٬٠٢٦». sales-crm already
   solved this with arYear, and this screen uses that one rather than adding a second answer. */

function pcBar(pct, cap) {
  var w = Math.max(0, Math.min(100, Number(pct) || 0));
  return '<div class="crm-bar" style="max-width:' + (cap || 120) + 'px"><i style="width:' + w + '%"></i></div>';
}

function vProductsCrm() {
  pcLoad(false);
  if (!pcCat) return '<div class="crm-empty"><b>جارٍ تحميل الكتالوج…</b>القطاعات والباقات والمستهدفات، من السجل.</div>';

  var withPkg = pcCat.filter(function (p) { return p.packages && p.packages.length; }).length;
  var noSector = pcCat.filter(function (p) { return !p.sector; }).length;
  var assumed = pcCat.filter(function (p) { return p.sectorAssumed; }).length;
  var pkgCount = pcCat.reduce(function (n, p) { return n + ((p.packages || []).length); }, 0);

  var h = '';

  /* ---- the four numbers that describe the catalogue ---- */
  h += '<div class="crm-kpis">' +
    '<div class="crm-kpi"><div class="crm-k">المنتجات</div><div class="crm-v">' + fmtN(pcCat.length) + '</div>' +
      '<div class="crm-s">في سجل الوسوم</div></div>' +
    '<div class="crm-kpi"><div class="crm-k">لها سعر منشور</div><div class="crm-v">' + fmtN(withPkg) + '</div>' +
      '<div class="crm-s">' + fmtN(pkgCount) + ' باقة — البقية «يحدده المختص»</div></div>' +
    '<div class="crm-kpi"><div class="crm-k">قطاع مُستنتَج</div><div class="crm-v">' + fmtN(assumed) + '</div>' +
      '<div class="crm-s">تصنيف لم يؤكَّد بعد</div></div>' +
    '<div class="crm-kpi"><div class="crm-k">بلا قطاع</div><div class="crm-v">' + fmtN(noSector) + '</div>' +
      '<div class="crm-s">لا تدخل في أي مجموع قطاعي</div></div>' +
  '</div>';

  /* ---- the sector board ---- */
  if (pcSectors && pcSectors.sectors) {
    h += '<div class="pc-sec"><div class="pc-h">القطاعات</div>' +
      '<div class="pc-sub">المحقق والمفتوح لكل قطاع سوقي. «بلا قطاع» صفٌّ صريح لا مرشِّح: منتج بلا تصنيف يظهر بأرقامه هنا بدل أن يسقط من المجموع.</div>';
    pcSectors.sectors.forEach(function (s) {
      var cov = s.coveragePct;
      var cls = s.isUnclassified ? "crm-none" : (cov === null ? "crm-none" : (cov >= 100 ? "crm-ok" : (cov >= 70 ? "crm-warn" : "crm-bad")));
      h += '<div class="crm-row">' +
        '<span class="crm-nm">' + esc(s.sector) + '</span>' +
        '<span class="crm-sub">' + esc((s.products || []).join(" · ")) + '</span>' +
        '<span class="crm-end">' +
          '<span class="pc-price">' + pcMoney(s.achieved) + ' من ' + pcMoney(s.target) + '</span>' +
          pcBar(cov === null ? 0 : cov) +
          '<span class="crm-st ' + cls + '"><i></i>' + (cov === null ? "بلا مستهدف" : fmtN(cov) + "٪") + '</span>' +
        '</span></div>';
    });
    h += '</div>';
  }

  /* ---- the four quarters, from ONE query ---- */
  if (pcQuarters && pcQuarters.quarters) {
    h += '<div class="pc-sec"><div class="pc-h">الإنجاز الربعي · ' + arYear(pcQuarters.year) + '</div>' +
      '<div class="pc-sub">الأربعة معًا، لا ربعًا في كل مرة.</div><div class="pc-q">';
    pcQuarters.quarters.forEach(function (q) {
      var isNow = q.quarter === pcQuarters.currentQuarter;
      h += '<div class="pc-qc' + (isNow ? " now" : "") + '">' +
        '<div class="k">الربع ' + fmtN(q.quarter) + (isNow ? " · الحالي" : "") + '</div>' +
        '<div class="v">' + pcMoney(q.achieved) + '</div>' +
        '<div class="t">من ' + pcMoney(q.target) + (q.coveragePct === null ? "" : " · " + fmtN(q.coveragePct) + "٪") + '</div>' +
        pcBar(q.coveragePct === null ? 0 : q.coveragePct, 999) +
      '</div>';
    });
    h += '</div>';
    /* The basis is STATED, never implied: reading كامل العقد as سنوي is wrong by the year count. */
    h += '<div class="pc-note"><b>' + esc(pcQuarters.valueBasis.label) + '</b><br>' + esc(pcQuarters.valueBasis.note) + '</div>';
    h += '</div>';
  }

  /* ---- the catalogue itself ---- */
  h += '<div class="pc-sec"><div class="pc-h">الكتالوج</div>' +
    '<div class="pc-sub">كل منتج، قطاعه، وسعره المنشور. المنتج الذي لا باقة له يعرض نص التسعير كما هو مكتوب، لا خانة فارغة تُقرأ كبيانات ناقصة.</div>';
  pcCat.forEach(function (p) {
    var price = (p.packages && p.packages.length)
      ? p.packages.map(function (k) {
          return esc(k.name) + " " + pcMoney(k.listPrice) + (k.scope ? " <span class=\\"pc-pkg\\">(" + esc(k.scope) + ")</span>" : "");
        }).join(" · ")
      : '<span class="pc-pkg">' + esc(p.pricingNote || "لا سعر منشور") + '</span>';
    h += '<div class="crm-row">' +
      '<span class="crm-nm">' + esc(p.product) + '</span>' +
      '<span class="crm-sub">' +
        (p.sector ? esc(p.sector) : '<span style="color:#B54708">بلا قطاع</span>') +
        (p.sectorAssumed ? '<span class="pc-assumed" title="القطاع مُستنتَج من bestFor في قاعدة معرفة المساعد، ولم يؤكَّد">مُستنتَج</span>' : '') +
      '</span>' +
      '<span class="crm-end"><span class="pc-price">' + price + '</span></span>' +
    '</div>';
  });
  h += '</div>';
  return h;
}
`;
