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
.pc-h{font-size:14px;font-weight:600;color:var(--ink,#212529);margin-block-end:3px}
.pc-sub{font-size:12px;color:var(--muted,#536170);margin-block-end:12px;max-width:70ch;line-height:1.7}
.pc-note{font-size:12px;color:var(--muted,#536170);margin-block-start:8px;line-height:1.7;
  padding-inline-start:9px;border-inline-start:2px solid var(--line2,#CBD7E4);max-width:66ch}
.pc-assumed{font-size:12px;font-weight:600;color:#7A5600;margin-inline-start:5px}
.pc-price{font-size:12px;color:var(--ink2,#3A3A3A);font-variant-numeric:tabular-nums}
.pc-pkg{font-size:12px;color:var(--muted,#536170)}
.pc-q{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.pc-qc{background:var(--strip,#F4F6F9);border-radius:10px;padding:12px 14px}
.pc-qc .k{font-size:12px;color:var(--muted,#536170);font-weight:600}
.pc-qc .v{font-size:16px;font-weight:600;margin-block:4px 2px;font-variant-numeric:tabular-nums}
.pc-qc .t{font-size:12px;color:var(--muted,#536170);font-variant-numeric:tabular-nums}
.pc-qc.now{background:#EAF1F8}
/* Four quarters at 84px each on a phone is four unreadable columns. Two rows of two. 560 = --bp-sm
   (DESIGN.md 2); a media query cannot read a custom property. */
@media (max-width:560px){
  .pc-q{grid-template-columns:repeat(2,1fr)}
  .pc-sub,.pc-note{max-width:none}
}
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
      h += '<div class="crm-row crm-click" data-go="sector" data-nm="' + esc(s.sector) + '">' +
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

  /* ---- the brief's own grid: product x quarter ---- */
  if (pcQuarters && pcQuarters.byProduct && pcQuarters.byProduct.length) {
    h += '<div class="pc-sec"><div class="pc-h">المستهدف والمحقق لكل منتج · ' + arYear(pcQuarters.year) + '</div>' +
      '<div class="pc-sub">السنوي، وتوزيعه على الأرباع، والمحقق في كل ربع. المنتج بلا مستهدف يظهر بصفّ أصفار — صفٌّ مُرشَّح لا يمكن رؤية غيابه.</div>' +
      '<div class="crm-scroll"><table class="crm-tbl"><thead><tr><th>المنتج</th><th class="crm-money">السنوي</th>' +
      [1,2,3,4].map(function (q) { return '<th class="crm-money">ر' + fmtN(q) + '</th>'; }).join("") +
      '<th class="crm-money">المحقق</th><th>الإنجاز</th></tr></thead><tbody>';
    pcQuarters.byProduct.forEach(function (p) {
      var cov = p.coveragePct;
      var cls = cov === null ? "crm-none" : (cov >= 100 ? "crm-ok" : (cov >= 70 ? "crm-warn" : "crm-bad"));
      h += '<tr><td>' + esc(p.product) + '</td>' +
        '<td class="crm-money">' + (p.annualTarget ? fmtN(p.annualTarget) : "—") + '</td>' +
        p.quarters.map(function (q) {
          var isNow = q.quarter === pcQuarters.currentQuarter;
          return '<td class="crm-money"' + (isNow ? ' style="background:#EAF1F8"' : '') + '>' +
            (q.target || q.achieved ? fmtN(q.achieved) + '<div class="pc-pkg">من ' + fmtN(q.target) + '</div>' : "—") + '</td>';
        }).join("") +
        '<td class="crm-money">' + fmtN(p.achieved) + '</td>' +
        '<td><span class="crm-st ' + cls + '"><i></i>' + (cov === null ? "بلا مستهدف" : fmtN(cov) + "٪") + '</span></td></tr>';
    });
    h += '</tbody></table></div></div>';
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
    h += '<div class="crm-row crm-click" data-go="product" data-nm="' + esc(p.product) + '">' +
      '<span class="crm-nm">' + esc(p.product) + '</span>' +
      '<span class="crm-sub">' +
        (p.sector ? esc(p.sector) : '<span style="color:#7A5600">بلا قطاع</span>') +
        (p.sectorAssumed ? '<span class="pc-assumed" title="القطاع مُستنتَج من bestFor في قاعدة معرفة المساعد، ولم يؤكَّد">مُستنتَج</span>' : '') +
      '</span>' +
      '<span class="crm-end"><span class="pc-price">' + price + '</span></span>' +
    '</div>';
  });
  h += '</div>';
  return h;
}
`;

export const PRODUCTS_DRILL_JS = `
/* ============================ product / sector drill-downs ============================
   Built entirely from data the products screen and the opportunity board already load — pcCat,
   pcQuarters and oppRows. No new endpoint: a drill-down that refetches what is already in memory
   adds a spinner and a failure mode for nothing. */

function pcBack() {
  return '<a href="#products" style="display:inline-flex;align-items:center;gap:6px;font-size:var(--t-xs);' +
    'font-weight:600;color:var(--muted);text-decoration:none;margin-block-end:14px;">\u2192 كل المنتجات</a>';
}

function pcOppsFor(pred) {
  return (typeof oppRows !== "undefined" && oppRows ? oppRows : []).filter(pred);
}

/* Value uses the ONE definition, via the same arithmetic the server sums. */
function pcVal(o) {
  return Math.round((Number(o.sale_price) || 0) * (Number(o.qty) || 1) * (Number(o.years) || 1) *
    (1 - (Number(o.discount) || 0) / 100));
}

function vProductDrill(name) {
  pcLoad(false);
  if (typeof opLoad === "function") opLoad(false);
  if (!pcCat) return pcBack() + '<div class="crm-empty"><b>جارٍ التحميل…</b></div>';
  var p = pcCat.filter(function (x) { return x.product === name; })[0];
  if (!p) return pcBack() + '<div class="crm-empty"><b>منتج غير موجود</b>لا يوجد وسم بهذا الاسم في السجل.</div>';

  var mine = pcOppsFor(function (o) { return o.product === name; });
  var open = mine.filter(function (o) { return o.stage !== "won" && o.stage !== "lost"; });
  var won  = mine.filter(function (o) { return o.stage === "won"; });
  var lost = mine.filter(function (o) { return o.stage === "lost"; });
  var openVal = open.reduce(function (n, o) { return n + pcVal(o); }, 0);

  var h = pcBack();
  h += '<div class="crm-kpis">' +
    '<div class="crm-kpi crm-lead"><div class="crm-k">المفتوح</div><div class="crm-v">' + pcMoney(openVal) + '</div>' +
      '<div class="crm-s">' + fmtN(open.length) + ' فرصة</div></div>' +
    '<div class="crm-kpi"><div class="crm-k">مربوحة</div><div class="crm-v">' + fmtN(won.length) + '</div>' +
      '<div class="crm-s">' + pcMoney(won.reduce(function (n, o) { return n + pcVal(o); }, 0)) + '</div></div>' +
    '<div class="crm-kpi"><div class="crm-k">خاسرة</div><div class="crm-v">' + fmtN(lost.length) + '</div>' +
      '<div class="crm-s">' + pcMoney(lost.reduce(function (n, o) { return n + pcVal(o); }, 0)) + '</div></div>' +
    '<div class="crm-kpi"><div class="crm-k">القطاع</div><div class="crm-v" style="font-size:var(--t-lg)">' +
      (p.sector ? esc(p.sector) : "بلا قطاع") + '</div>' +
      '<div class="crm-s">' + (p.sectorAssumed ? "مُستنتَج — لم يؤكَّد" : "مؤكَّد") + '</div></div>' +
  '</div>';

  /* Packages, with the retire control. Retirement is the only exit: a package a deal references
     cannot be deleted, and the composite FK refuses it at the database. */
  h += '<div class="pc-sec"><div class="pc-h">الباقات</div>' +
    '<div class="pc-sub">السعر المنشور لكل باقة. الباقة لا تُحذف — تُتقاعد، لأن صفقة قد تشير إليها والمفتاح الأجنبي يرفض الحذف.</div>';
  if (!p.packages.length) {
    h += '<div class="crm-empty"><b>لا باقات منشورة</b>' + esc(p.pricingNote || "لا سعر منشور لهذا المنتج.") + '</div>';
  } else {
    p.packages.forEach(function (k) {
      h += '<div class="crm-row"><span class="crm-nm">' + esc(k.name) + '</span>' +
        '<span class="crm-sub">' + (k.scope ? esc(k.scope) : "—") + ' · ' + fmtN(k.years) + ' سنة</span>' +
        '<span class="crm-end"><span class="pc-price">' + pcMoney(k.listPrice) + '</span>' +
        '<button class="btn btn-ghost mini crm-focusable" onclick="pcRetire(' + k.id + ',' + JSON.stringify(k.name) + ')">تقاعد</button>' +
        '</span></div>';
    });
  }
  h += '</div>';

  /* Its quarterly row from the same grid the products screen renders. */
  if (pcQuarters && pcQuarters.byProduct) {
    var pq = pcQuarters.byProduct.filter(function (x) { return x.product === name; })[0];
    if (pq) {
      h += '<div class="pc-sec"><div class="pc-h">الإنجاز الربعي · ' + arYear(pcQuarters.year) + '</div><div class="pc-q">';
      pq.quarters.forEach(function (q) {
        var isNow = q.quarter === pcQuarters.currentQuarter;
        h += '<div class="pc-qc' + (isNow ? " now" : "") + '"><div class="k">الربع ' + fmtN(q.quarter) + '</div>' +
          '<div class="v">' + pcMoney(q.achieved) + '</div>' +
          '<div class="t">من ' + pcMoney(q.target) + (q.coveragePct === null ? "" : " · " + fmtN(q.coveragePct) + "٪") + '</div>' +
          pcBar(q.coveragePct === null ? 0 : q.coveragePct, 999) + '</div>';
      });
      h += '</div></div>';
    }
  }

  h += '<div class="pc-sec"><div class="pc-h">أعلى الفرص المفتوحة</div>';
  if (!open.length) h += '<div class="crm-empty"><b>لا فرص مفتوحة</b>لا صفقة جارية على هذا المنتج.</div>';
  else {
    open.sort(function (a, b) { return pcVal(b) - pcVal(a); }).slice(0, 8).forEach(function (o) {
      h += '<div class="crm-row"><span class="crm-nm">' + esc(o.account_name || "—") + '</span>' +
        '<span class="crm-sub">' + esc(rpStage ? rpStage(o.stage) : o.stage) + '</span>' +
        '<span class="crm-end"><span class="pc-price">' + pcMoney(pcVal(o)) + '</span></span></div>';
    });
  }
  h += '</div>';
  return h;
}

/* ONE delegated listener for every drill row. No code in an attribute: JSON.stringify emits double
   quotes that close a double-quoted attribute, and esc() turns them into &quot; which then has to
   survive a decode — the exact shape of the stored XSS this project already fixed. A data attribute
   carries the name as DATA and the handler reads it with getAttribute, which decodes once, safely. */
document.addEventListener("click", function (ev) {
  var row = ev.target && ev.target.closest ? ev.target.closest("[data-go]") : null;
  if (!row) return;
  var kind = row.getAttribute("data-go"), nm = row.getAttribute("data-nm");
  if (!kind || !nm) return;
  location.hash = kind + "/" + encodeURIComponent(nm);
});

window.pcRetire = function (id, name) {
  if (!window.confirm("تقاعد الباقة «" + name + "»؟ لن تظهر للبيع، وتبقى الصفقات المرتبطة بها كما هي.")) return;
  fetch("/admin/packages/" + id + "/retire", { method: "POST", headers: { "x-admin-token": TOKEN } })
    .then(function (r) { return r.json(); })
    .then(function () { pcCat = null; pcLoad(true); })
    .catch(function () { /* the list reloads on the next paint either way */ });
};

/* The mockup's V.exec, as a band at the top of الرئيسية.
 *
 * A DELIBERATE DEPARTURE from the mockup, stated rather than slipped in. The mockup switched a
 * state.role between four homes: exec, sector manager, product manager, sales rep. Three of those
 * four are now real DESTINATIONS in the product — #sector/<name>, #product/<name>, and /rep, which
 * is a separate page on a phone. A mode toggle that re-renders one screen into four is chrome on
 * top of navigation that already exists, and it hides three views behind a control instead of
 * putting them one click away. So: the exec band lives on الرئيسية, and every row in it is a link
 * into the role board it summarises.
 *
 * #home is off the 5s tick (R14), so this band does not inherit a poll. */
function vExecBand() {
  pcLoad(false);
  if (!pcSectors || !pcQuarters) return "";
  var h = '<div class="pc-sec"><div class="pc-h">القطاعات</div>' +
    '<div class="pc-sub">اضغط قطاعًا للوحته، أو منتجًا للوحة منتجه.</div>';
  pcSectors.sectors.forEach(function (sc) {
    var cov = sc.coveragePct;
    var cls = sc.isUnclassified ? "crm-none" : (cov === null ? "crm-none" : (cov >= 100 ? "crm-ok" : (cov >= 70 ? "crm-warn" : "crm-bad")));
    h += '<div class="crm-row' + (sc.isUnclassified ? "" : " crm-click") + '"' +
      (sc.isUnclassified ? "" : ' data-go="sector" data-nm="' + esc(sc.sector) + '"') + '>' +
      '<span class="crm-nm">' + esc(sc.sector) + '</span>' +
      '<span class="crm-sub">' + fmtN(sc.openCount) + ' فرصة مفتوحة</span>' +
      '<span class="crm-end"><span class="pc-price">' + pcMoney(sc.achieved) + ' من ' + pcMoney(sc.target) + '</span>' +
      pcBar(cov === null ? 0 : cov) +
      '<span class="crm-st ' + cls + '"><i></i>' + (cov === null ? "بلا مستهدف" : fmtN(cov) + "٪") + '</span></span></div>';
  });
  h += '</div>';

  var bp = (pcQuarters.byProduct || []).slice().sort(function (a, b) {
    var ac = a.coveragePct === null ? 999 : a.coveragePct, bc = b.coveragePct === null ? 999 : b.coveragePct;
    return ac - bc;   /* worst attainment first: this band exists to show where to worry */
  }).slice(0, 5);
  if (bp.length) {
    h += '<div class="pc-sec"><div class="pc-h">المنتجات حسب الإنجاز</div>' +
      '<div class="pc-sub">الأقل إنجازًا أولًا. المنتج بلا مستهدف يُعرض أخيرًا، لأن غياب المستهدف ليس تعثّرًا.</div>';
    bp.forEach(function (p) {
      var c = p.coveragePct;
      var cls = c === null ? "crm-none" : (c >= 100 ? "crm-ok" : (c >= 70 ? "crm-warn" : "crm-bad"));
      h += '<div class="crm-row crm-click" data-go="product" data-nm="' + esc(p.product) + '">' +
        '<span class="crm-nm">' + esc(p.product) + '</span>' +
        '<span class="crm-end"><span class="pc-price">' + pcMoney(p.achieved) + ' من ' + pcMoney(p.annualTarget) + '</span>' +
        pcBar(c === null ? 0 : c) +
        '<span class="crm-st ' + cls + '"><i></i>' + (c === null ? "بلا مستهدف" : fmtN(c) + "٪") + '</span></span></div>';
    });
    h += '</div>';
  }

  h += '<div class="pc-sec"><div class="pc-h">الإنجاز الربعي الإجمالي · ' + arYear(pcQuarters.year) + '</div><div class="pc-q">';
  pcQuarters.quarters.forEach(function (q) {
    var isNow = q.quarter === pcQuarters.currentQuarter;
    h += '<div class="pc-qc' + (isNow ? " now" : "") + '"><div class="k">الربع ' + fmtN(q.quarter) + (isNow ? " · الحالي" : "") + '</div>' +
      '<div class="v">' + pcMoney(q.achieved) + '</div>' +
      '<div class="t">من ' + pcMoney(q.target) + (q.coveragePct === null ? "" : " · " + fmtN(q.coveragePct) + "٪") + '</div>' +
      pcBar(q.coveragePct === null ? 0 : q.coveragePct, 999) + '</div>';
  });
  h += '</div><div class="pc-note"><b>' + esc(pcQuarters.valueBasis.label) + '</b><br>' + esc(pcQuarters.valueBasis.note) + '</div></div>';
  return h;
}

function vSectorDrill(name) {
  pcLoad(false);
  if (typeof opLoad === "function") opLoad(false);
  if (!pcSectors) return pcBack() + '<div class="crm-empty"><b>جارٍ التحميل…</b></div>';
  var sec = pcSectors.sectors.filter(function (x) { return x.sector === name; })[0];
  if (!sec) return pcBack() + '<div class="crm-empty"><b>قطاع غير موجود</b></div>';

  var h = pcBack();
  var cov = sec.coveragePct;
  h += '<div class="crm-kpis">' +
    '<div class="crm-kpi crm-lead"><div class="crm-k">المحقق</div><div class="crm-v">' + pcMoney(sec.achieved) + '</div>' +
      '<div class="crm-s">من ' + pcMoney(sec.target) + '</div></div>' +
    '<div class="crm-kpi"><div class="crm-k">المتوقع من المفتوح</div><div class="crm-v">' + pcMoney(sec.weightedOpen) + '</div>' +
      '<div class="crm-s">' + fmtN(sec.openCount) + ' فرصة مفتوحة</div></div>' +
    '<div class="crm-kpi"><div class="crm-k">مربوحة</div><div class="crm-v">' + fmtN(sec.wonCount) + '</div>' +
      '<div class="crm-s">في الفترة</div></div>' +
    '<div class="crm-kpi"><div class="crm-k">التغطية</div><div class="crm-v">' +
      (cov === null ? "—" : fmtN(cov) + "٪") + '</div>' +
      '<div class="crm-s">' + (cov === null ? "بلا مستهدف" : "محقق + متوقع") + '</div></div>' +
  '</div>';

  h += '<div class="pc-sec"><div class="pc-h">منتجات القطاع حسب الإنجاز</div>' +
    '<div class="pc-sub">اضغط منتجًا لفتح لوحته.</div>';
  (sec.products || []).forEach(function (nm) {
    var pq = (pcQuarters && pcQuarters.byProduct ? pcQuarters.byProduct : []).filter(function (x) { return x.product === nm; })[0];
    var c = pq ? pq.coveragePct : null;
    var cls = c === null ? "crm-none" : (c >= 100 ? "crm-ok" : (c >= 70 ? "crm-warn" : "crm-bad"));
    h += '<div class="crm-row crm-click" data-go="product" data-nm="' + esc(nm) + '">' +
      '<span class="crm-nm">' + esc(nm) + '</span>' +
      '<span class="crm-end">' +
        '<span class="pc-price">' + (pq ? pcMoney(pq.achieved) + " من " + pcMoney(pq.annualTarget) : "—") + '</span>' +
        pcBar(c === null ? 0 : c) +
        '<span class="crm-st ' + cls + '"><i></i>' + (c === null ? "بلا مستهدف" : fmtN(c) + "٪") + '</span>' +
      '</span></div>';
  });
  h += '</div>';
  return h;
}
`;
