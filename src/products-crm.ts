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
/* ---- THE REPORT GRID: three per row ----
   The house layout for a board of reports. Three at the design target, two at --bp-lg and one at
   --bp-sm: three columns of Arabic labels below 1280px stops being readable, and a rule that
   produces an unreadable third column is not a standard, it is a shape. align-items:stretch so the
   three cards in a row share a baseline and an edge; the content inside each decides its own
   height. */
.pc-g3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--s3);
  align-items:stretch;margin-block-end:var(--s4)}
.pc-g3 .sh-sec.card3{margin-block-end:0;background:var(--paper,#fff);
  border:1px solid var(--line,#D8DCE3);border-radius:var(--r-lg,12px);
  padding:var(--s3) var(--s4) var(--s4);display:flex;flex-direction:column;min-width:0}
/* The note is the card's footer, so it sits at the bottom however tall the chart above it is. */
.pc-g3 .sh-sec.card3 .pc-note{margin-block-start:auto;padding-block-start:var(--s3)}
/* Inside a third of the width these two lose their long-form room. */
.pc-g3 .sh-hs{margin-block-end:var(--s3);max-width:none}
.pc-g3 .pcq{height:132px}
.pc-g3 .pcq .sub2{display:none}
.pc-g3 .sh-cards{gap:var(--s2)}
/* 1024, not 1280. The breakpoint is on the VIEWPORT but the grid lives in the CONTENT column,
   which is ~244px of rail plus padding narrower — so a 1280px laptop has ~980px here and fits
   three ~310px reports comfortably. Breaking at 1280 handed two columns to almost every laptop,
   which is not the standard that was asked for. */
@media (max-width:1023px){ .pc-g3{grid-template-columns:repeat(2,minmax(0,1fr))} }
@media (max-width:560px){ .pc-g3{grid-template-columns:minmax(0,1fr)} }

/* ---- the sector chart ----
   Horizontal bars, not columns. Sector names are long Arabic phrases, and DESIGN.md 6.5 is blunt
   about it: a label you truncate is a label you did not draw, so if the category name does not fit
   across, the chart is the wrong orientation. Each bar is direct-labelled with its name and its
   figure, which also removes the need for a colour-only legend (6.4). */
.pcs{display:flex;flex-direction:column;gap:var(--s3);padding:var(--s2) 0 var(--s1)}
.pcs .r{display:grid;grid-template-columns:minmax(96px,auto) 1fr minmax(72px,auto);
  gap:var(--s3);align-items:center;font-family:inherit;text-align:start;
  background:none;border:none;padding:0;width:100%}
.pcs .r.go{cursor:pointer}
.pcs .nm{font-size:12px;font-weight:600;color:var(--ink,#14161A);white-space:nowrap}
.pcs .bar{height:22px;border-radius:var(--r-sm,6px);background:var(--surface,#EFF1F5);
  overflow:hidden;display:flex}
.pcs .bar i{display:block;height:100%;border-radius:var(--r-sm,6px)}
.pcs .bar .won{background:var(--accent,#2563EB)}
.pcs .bar .open{background:var(--blue-light,#5B8DEF)}
.pcs .fig{font-size:12px;font-weight:600;color:var(--ink,#14161A);
  font-variant-numeric:tabular-nums;white-space:nowrap;text-align:end}
.pcs .fig.none{color:var(--muted,#656B76);font-weight:450}
.pcs .r.go:hover .nm{color:var(--accent-deep,#1A47BE)}
.pcs-lg{display:flex;gap:var(--s4);flex-wrap:wrap;padding-block-start:var(--s2);
  font-size:12px;color:var(--muted,#656B76)}
.pcs-lg span{display:inline-flex;align-items:center;gap:7px}
.pcs-lg i{width:10px;height:10px;border-radius:3px;flex:none}
.pcs-lg .s-won{background:var(--accent,#2563EB)}
.pcs-lg .s-open{background:var(--blue-light,#5B8DEF)}
@media (max-width:560px){ .pcs .r{grid-template-columns:1fr auto;row-gap:6px}
  .pcs .bar{grid-column:1 / 3} }

/* ---- the quarter chart ----
   Columns, not tiles. A tile gives every quarter the same area regardless of what it holds; a
   column's HEIGHT is the number, which is the whole point (DESIGN.md 6.1). */
.pcq{display:flex;align-items:stretch;gap:var(--s3);height:148px;padding:var(--s1) var(--s1) 0}
.pcq .col{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:var(--s1)}
.pcq .val{font-size:12px;font-weight:600;color:var(--ink,#14161A);white-space:nowrap;
  font-variant-numeric:tabular-nums}
/* The plotting area. Both bars sit on the same baseline and share one scale, so their heights are
   directly comparable — a bullet column rather than a stack. */
.pcq .plot{flex:1;width:100%;position:relative;display:flex;align-items:flex-end;justify-content:center}
.pcq .tgt{position:absolute;inset-inline:0;inset-block-end:0;background:var(--surface-2,#E5E8EE);
  border-start-start-radius:var(--r-sm,6px);border-start-end-radius:var(--r-sm,6px)}
.pcq .ach{position:relative;width:56%;background:var(--blue-light,#5B8DEF);
  border-start-start-radius:var(--r-sm,6px);border-start-end-radius:var(--r-sm,6px)}
.pcq .col.now .ach{background:var(--accent,#2563EB)}
/* No target is not a zero bar. Hatching is the product's texture channel for NOT YET, so the
   absence reads even in greyscale. */
.pcq .notgt{position:absolute;inset-inline:0;inset-block-end:0;height:6px;border-radius:var(--r-pill,999px);
  background-color:var(--surface,#EFF1F5);
  background-image:repeating-linear-gradient(115deg,var(--surface-2,#E5E8EE) 0 3px,transparent 3px 7px)}
.pcq .lbl{font-size:12px;color:var(--muted,#656B76);white-space:nowrap}
.pcq .col.now .lbl{color:var(--ink,#14161A);font-weight:600}
.pcq .sub2{font-size:12px;color:var(--muted,#656B76);text-align:center;line-height:1.5}
.pcq-lg{display:flex;gap:var(--s4);flex-wrap:wrap;padding:var(--s3) var(--s1) 0;
  font-size:12px;color:var(--muted,#656B76)}
.pcq-lg span{display:inline-flex;align-items:center;gap:7px}
.pcq-lg i{width:10px;height:10px;border-radius:3px;flex:none}
.pcq-lg .s-ach{background:var(--accent,#2563EB)}
.pcq-lg .s-tgt{background:var(--surface-2,#E5E8EE)}
.pcq-lg .s-no{background-color:var(--surface,#EFF1F5);
  background-image:repeating-linear-gradient(115deg,var(--surface-2,#E5E8EE) 0 3px,transparent 3px 7px)}
@media (max-width:560px){
  .pcq{height:132px;gap:var(--s2)}
  .pcq .sub2{display:none}
}
.pc-sec{margin-block-end:26px}
.pc-h{font-size:14px;font-weight:600;color:var(--ink,#14161A);margin-block-end:3px}
.pc-sub{font-size:12px;color:var(--muted,#656B76);margin-block-end:12px;max-width:70ch;line-height:1.7}
.pc-note{font-size:12px;color:var(--muted,#656B76);margin-block-start:8px;line-height:1.7;
  padding-inline-start:9px;border-inline-start:2px solid var(--line2,#D8DCE3);max-width:66ch}
.pc-assumed{font-size:12px;font-weight:600;color:#7A5600;margin-inline-start:5px}
.pc-price{font-size:12px;color:var(--ink2,#33373E);font-variant-numeric:tabular-nums}
.pc-pkg{font-size:12px;color:var(--muted,#656B76)}
.pc-q{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.pc-qc{background:var(--strip,#EFF1F5);border-radius:10px;padding:12px 14px}
.pc-qc .k{font-size:12px;color:var(--muted,#656B76);font-weight:600}
.pc-qc .v{font-size:16px;font-weight:600;margin-block:4px 2px;font-variant-numeric:tabular-nums}
.pc-qc .t{font-size:12px;color:var(--muted,#656B76);font-variant-numeric:tabular-nums}
.pc-qc.now{background:#EAF1FE}
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
  if (typeof opLoad === "function") opLoad(false);
  if (!pcCat) return '<div class="sh-tiles">' +
    '<div class="sh-tile">' + moSkeleton(2, ["w60", "w80"]) + '</div>' +
    '<div class="sh-tile">' + moSkeleton(2, ["w60", "w80"]) + '</div>' +
    '<div class="sh-tile">' + moSkeleton(2, ["w60", "w80"]) + '</div>' +
    '<div class="sh-tile">' + moSkeleton(2, ["w60", "w80"]) + '</div></div>' +
    '<div style="margin-block-start:20px">' + moSkeleton(5, ["w80", "w60", "w40"]) + '</div>';

  var withPkg = pcCat.filter(function (p) { return p.packages && p.packages.length; }).length;
  var noSector = pcCat.filter(function (p) { return !p.sector; }).length;
  var assumed = pcCat.filter(function (p) { return p.sectorAssumed; }).length;
  var pkgCount = pcCat.reduce(function (n, p) { return n + ((p.packages || []).length); }, 0);
  var h = "";

  /* ---- tiles: figure at the inline-end, the lead one on a wash ---- */
  h += '<div class="sh-tiles">' +
    '<div class="sh-tile lead"><div><div class="k">المنتجات</div>' +
      '<div class="s">في سجل الوسوم</div></div><div class="v">' + fmtN(pcCat.length) + '</div></div>' +
    '<div class="sh-tile"><div><div class="k">لها سعر منشور</div>' +
      '<div class="s">' + fmtN(pkgCount) + ' باقة · البقية «يحدده المختص»</div></div>' +
      '<div class="v">' + fmtN(withPkg) + '</div></div>' +
    '<div class="sh-tile"><div><div class="k">قطاع مُستنتَج</div>' +
      '<div class="s">تصنيف لم يؤكَّد بعد</div></div><div class="v">' + fmtN(assumed) + '</div></div>' +
    '<div class="sh-tile"><div><div class="k">بلا قطاع</div>' +
      '<div class="s">لا تدخل في أي مجموع قطاعي</div></div><div class="v">' + fmtN(noSector) + '</div></div>' +
  '</div>';

  /* ---- sectors: ONE stacked share bar, then a card each ---- */
  if (pcSectors && pcSectors.sectors) {
    var COL = ["#2563EB", "#5B8DEF", "#1E5FCC", "#A2A9B4"];
    var parts = pcSectors.sectors.map(function (sc, i) {
      return { n: sc.sector, v: (sc.achieved || 0) + (sc.weightedOpen || 0), c: COL[i % COL.length] };
    }).filter(function (p) { return p.v > 0; });

    h += '<div class="sh-sec"><div class="sh-h">القطاعات</div>' +
      '<div class="sh-hs">المحقق والمفتوح لكل قطاع سوقي. الشريط واحد لأن المقارنة المطلوبة بين الأجزاء، ' +
      'وأربعة أشرطة منفصلة تجعلها مقارنةً بالذاكرة. «بلا قطاع» جزءٌ صريح لا مرشِّح.</div>';
    h += shStack(parts);
    h += '<div class="sh-cards" style="margin-block-start:var(--s3)">';
    pcSectors.sectors.forEach(function (sc) {
      var cov = sc.coveragePct;
      var cls = sc.isUnclassified ? "crm-none" : (cov === null ? "crm-none" : (cov >= 100 ? "crm-ok" : (cov >= 70 ? "crm-warn" : "crm-bad")));
      /* data-as-visual: one cell per open opportunity in this sector. */
      var mine = (typeof oppRows !== "undefined" && oppRows ? oppRows : []).filter(function (o) {
        return (sc.products || []).indexOf(o.product) >= 0;
      });
      var units = mine.map(function (o) {
        return o.stage === "won" ? "won" : (o.stage === "lost" ? "lost" : "on");
      });
      h += '<div class="sh-card' + (sc.isUnclassified ? "" : " go") + '"' +
        (sc.isUnclassified ? "" : ' data-go="sector" data-nm="' + esc(sc.sector) + '"') + '>' +
        '<div><div class="nm">' + esc(sc.sector) + '</div>' +
          '<div class="sub">' + esc((sc.products || []).join(" · ")) + '</div>' +
          (units.length ? shUnits(units, 48) : "") + '</div>' +
        '<div class="end"><span class="money">' + pcMoney(sc.achieved) +
          (sc.target > 0 ? ' من ' + pcMoney(sc.target) : ' محقق') + '</span>' +
          '<span class="crm-st ' + cls + '"><i></i>' + (cov === null ? "بلا مستهدف" : fmtN(cov) + "٪") + '</span>' +
        '</div></div>';
    });
    h += '</div></div>';
  }

  /* ---- quarters as tiles ---- */
  if (pcQuarters && pcQuarters.quarters) {
    h += '<div class="sh-sec"><div class="sh-h">الإنجاز الربعي · ' + arYear(pcQuarters.year) + '</div>' +
      '<div class="sh-hs">الأربعة معًا، لا ربعًا في كل مرة.</div><div class="sh-tiles">';
    pcQuarters.quarters.forEach(function (q) {
      var isNow = q.quarter === pcQuarters.currentQuarter;
      h += '<div class="sh-tile' + (isNow ? " lead" : "") + '"><div>' +
        '<div class="k">الربع ' + fmtN(q.quarter) + (isNow ? " · الحالي" : "") + '</div>' +
        '<div class="s">' + (q.target > 0 ? 'من ' + pcMoney(q.target) +
          (q.coveragePct === null ? "" : " · " + fmtN(q.coveragePct) + "٪") : "بلا مستهدف") + '</div></div>' +
        '<div class="v">' + fmtN(Math.round(q.achieved)) + '</div></div>';
    });
    h += '</div><div class="pc-note"><b>' + esc(pcQuarters.valueBasis.label) + '</b><br>' +
      esc(pcQuarters.valueBasis.note) + '</div></div>';
  }

  /* ---- product x quarter grid ---- */
  if (pcQuarters && pcQuarters.byProduct && pcQuarters.byProduct.length) {
    h += '<div class="sh-sec"><div class="sh-h">المستهدف والمحقق لكل منتج · ' + arYear(pcQuarters.year) + '</div>' +
      '<div class="sh-hs">السنوي، وتوزيعه على الأرباع، والمحقق في كل ربع. المنتج بلا مستهدف يظهر بصفّ أصفار — صفٌّ مُرشَّح لا يمكن رؤية غيابه.</div>' +
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
          return '<td class="crm-money"' + (isNow ? ' style="background:var(--blue-tint)"' : '') + '>' +
            (q.target || q.achieved ? fmtN(q.achieved) + '<div class="sub">من ' + fmtN(q.target) + '</div>' : "—") + '</td>';
        }).join("") +
        '<td class="crm-money">' + fmtN(p.achieved) + '</td>' +
        '<td><span class="crm-st ' + cls + '"><i></i>' + (cov === null ? "بلا مستهدف" : fmtN(cov) + "٪") + '</span></td></tr>';
    });
    h += '</tbody></table></div></div>';
  }

  /* ---- catalogue as cards ---- */
  h += '<div class="sh-sec"><div class="sh-h">الكتالوج</div>' +
    '<div class="sh-hs">كل منتج، قطاعه، وسعره المنشور. المنتج الذي لا باقة له يعرض نص التسعير كما هو مكتوب، لا خانة فارغة تُقرأ كبيانات ناقصة.</div>';
  if (!pcCat.length) {
    h += shEmpty("box", "لا منتجات في السجل", "يظهر هنا كل وسم منتج. أضف وسمًا من «جهات الاستهداف» وسيظهر بقطاعه وباقاته.");
  } else {
    h += '<div class="sh-cards">';
    pcCat.forEach(function (p) {
      var price = (p.packages && p.packages.length)
        ? p.packages.map(function (k) {
            return esc(k.name) + " " + pcMoney(k.listPrice) + (k.scope ? " (" + esc(k.scope) + ")" : "");
          }).join(" · ")
        : esc(p.pricingNote || "لا سعر منشور");
      h += '<div class="sh-card go" data-go="product" data-nm="' + esc(p.product) + '">' +
        '<div><div class="nm">' + esc(p.product) + '</div>' +
        '<div class="sub">' + (p.sector ? esc(p.sector) : '<span style="color:var(--s-attn-text)">بلا قطاع</span>') +
          (p.sectorAssumed ? '<span class="pc-assumed" title="القطاع مُستنتَج ولم يؤكَّد">مُستنتَج</span>' : '') +
        '</div></div>' +
        '<div class="end"><span class="money" style="font-weight:450;font-size:var(--t-xs);color:var(--muted);text-align:end">' +
          price + '</span></div></div>';
    });
    h += '</div>';
  }
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
  return '<a href="#products" class="mo-more" style="display:inline-flex;align-items:center;gap:6px;' +
    'font-size:var(--t-xs);font-weight:600;color:var(--muted);text-decoration:none;margin-block-end:14px;">' +
    '<span class="mo-arrow">\u2192</span> كل المنتجات</a>';
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
  if (!pcCat) return pcBack() + moSkeleton(6, ["w60", "w80", "w40"]);
  var p = pcCat.filter(function (x) { return x.product === name; })[0];
  if (!p) return pcBack() + '<div class="crm-empty"><b>منتج غير موجود</b>لا يوجد وسم بهذا الاسم في السجل.</div>';

  var mine = pcOppsFor(function (o) { return o.product === name; });
  var open = mine.filter(function (o) { return o.stage !== "won" && o.stage !== "lost"; });
  var won  = mine.filter(function (o) { return o.stage === "won"; });
  var lost = mine.filter(function (o) { return o.stage === "lost"; });
  var openVal = open.reduce(function (n, o) { return n + pcVal(o); }, 0);

  var h = pcBack();
  h += '<div class="sh-tiles">' +
    '<div class="sh-tile lead"><div><div class="k">المفتوح</div>' +
      '<div class="s">' + fmtN(open.length) + ' فرصة</div></div>' +
      '<div class="v">' + fmtN(Math.round(openVal)) + '</div></div>' +
    '<div class="sh-tile"><div><div class="k">مربوحة</div><div class="s">' +
      pcMoney(won.reduce(function (n, o) { return n + pcVal(o); }, 0)) + '</div></div>' +
      '<div class="v">' + fmtN(won.length) + '</div></div>' +
    '<div class="sh-tile"><div><div class="k">خاسرة</div><div class="s">' +
      pcMoney(lost.reduce(function (n, o) { return n + pcVal(o); }, 0)) + '</div></div>' +
      '<div class="v">' + fmtN(lost.length) + '</div></div>' +
    '<div class="sh-tile"><div><div class="k">القطاع</div><div class="s">' +
      (p.sectorAssumed ? "مُستنتَج — لم يؤكَّد" : "مؤكَّد") + '</div></div>' +
      '<div class="v" style="font-size:var(--t-md)">' + (p.sector ? esc(p.sector) : "بلا قطاع") + '</div></div>' +
  '</div>';
  /* data-as-visual: this product's whole book, one cell per deal. */
  if (mine.length) h += '<div class="sh-sec">' + shUnits(mine.map(function (o) {
    return o.stage === "won" ? "won" : (o.stage === "lost" ? "lost" : "on"); }), 80) + '</div>';

  /* Packages, with the retire control. Retirement is the only exit: a package a deal references
     cannot be deleted, and the composite FK refuses it at the database. */
  h += '<div class="sh-sec"><div class="sh-h">الباقات</div>' +
    '<div class="sh-hs">السعر المنشور لكل باقة. الباقة لا تُحذف — تُتقاعد، لأن صفقة قد تشير إليها والمفتاح الأجنبي يرفض الحذف.</div>';
  if (!p.packages.length) {
    h += shEmpty("box", "لا باقات منشورة", p.pricingNote || "لا سعر منشور لهذا المنتج.");
  } else {
    h += '<div class="sh-cards">';
    p.packages.forEach(function (k) {
      h += '<div class="sh-card"><div><div class="nm">' + esc(k.name) + '</div>' +
        '<div class="sub">' + (k.scope ? esc(k.scope) : "—") + ' · ' + fmtN(k.years) + ' سنة</div></div>' +
        '<div class="end"><span class="money">' + pcMoney(k.listPrice) + '</span>' +
        '<button class="btn btn-ghost mini crm-focusable" data-retire="' + k.id + '" data-nm="' + esc(k.name) + '">تقاعد</button>' +
        '</div></div>';
    });
    h += '</div>';
  }
  h += '</div>';

  /* Its quarterly row from the same grid the products screen renders. */
  if (pcQuarters && pcQuarters.byProduct) {
    var pq = pcQuarters.byProduct.filter(function (x) { return x.product === name; })[0];
    if (pq) {
      h += '<div class="sh-sec"><div class="sh-h">الإنجاز الربعي · ' + arYear(pcQuarters.year) + '</div><div class="sh-tiles">';
      pq.quarters.forEach(function (q) {
        var isNow = q.quarter === pcQuarters.currentQuarter;
        h += '<div class="sh-tile' + (isNow ? " lead" : "") + '"><div><div class="k">الربع ' + fmtN(q.quarter) + '</div>' +
          '<div class="s">' + (q.target > 0 ? 'من ' + pcMoney(q.target) +
            (q.coveragePct === null ? "" : " · " + fmtN(q.coveragePct) + "٪") : "بلا مستهدف") + '</div></div>' +
          '<div class="v">' + fmtN(Math.round(q.achieved)) + '</div></div>';
      });
      h += '</div></div>';
    }
  }

  h += '<div class="sh-sec"><div class="sh-h">أعلى الفرص المفتوحة</div>';
  if (!open.length) h += shEmpty("clock", "لا فرص مفتوحة", "لا صفقة جارية على هذا المنتج الآن.");
  else {
    h += '<div class="sh-cards">';
    open.sort(function (a, b) { return pcVal(b) - pcVal(a); }).slice(0, 8).forEach(function (o) {
      h += '<div class="sh-card"><div><div class="nm">' + esc(o.account_name || "—") + '</div>' +
        '<div class="sub">' + esc(rpStage ? rpStage(o.stage) : o.stage) + '</div></div>' +
        '<div class="end"><span class="money">' + pcMoney(pcVal(o)) + '</span></div></div>';
    });
    h += '</div>';
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

/* Delegated, like the drill rows. An inline onclick carrying JSON.stringify(name) puts DOUBLE
   quotes inside a double-quoted attribute and closes it — the same bug as the drill rows, made
   twice in one file. A data attribute carries the name as data and getAttribute decodes it once. */
document.addEventListener("click", function (ev) {
  var b = ev.target && ev.target.closest ? ev.target.closest("[data-retire]") : null;
  if (!b) return;
  pcRetire(Number(b.getAttribute("data-retire")), b.getAttribute("data-nm"), b);
});

window.pcRetire = function (id, name, btn) {
  if (!window.confirm("تقاعد الباقة «" + name + "»؟ لن تظهر للبيع، وتبقى الصفقات المرتبطة بها كما هي.")) return;
  /* text-states-swap: the label changes and the button does NOT resize, so the row beneath it does
     not move under the cursor. The width is reserved from the longest state before the first click. */
  if (btn) { moReserve(btn, ["تقاعد", "جارٍ…"]); moBusy(btn, "جارٍ…"); }
  fetch("/admin/packages/" + id + "/retire", { method: "POST", headers: { "x-admin-token": TOKEN } })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (btn) moIdle(btn);
      /* The outcome is SAID, not implied by a list quietly changing under the reader. */
      moToast(j && j.ok === false ? "تعذّر تقاعد الباقة" : "تقاعدت الباقة «" + name + "»");
      pcCat = null; pcLoad(true);
    })
    .catch(function () { if (btn) moIdle(btn); moToast("تعذّر الاتصال — لم يتغيّر شيء"); });
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
  if (typeof opLoad === "function") opLoad(false);
  if (!pcSectors || !pcQuarters) return "";

  var secs = pcSectors.sectors || [];
  var prods = pcQuarters.byProduct || [];
  var anyTarget = secs.some(function (x) { return x.target > 0; }) ||
                  prods.some(function (x) { return x.annualTarget > 0; });
  var openTotal = secs.reduce(function (n, x) { return n + (x.weightedOpen || 0); }, 0);
  var openCount = secs.reduce(function (n, x) { return n + (x.openCount || 0); }, 0);
  var wonTotal = secs.reduce(function (n, x) { return n + (x.achieved || 0); }, 0);
  var COL = ["#2563EB", "#5B8DEF", "#1E5FCC", "#A2A9B4"];

  /* One card per sector, on the same components as المنتجات. This band and that screen render the
     SAME three sections, and until now they rendered them two different ways — the founder spotted
     it. Two visual languages for one set of facts is how a product starts feeling assembled. */
  function sectorCards() {
    var out = '<div class="sh-cards">';
    secs.forEach(function (sc) {
      var cov = sc.coveragePct;
      var cls = sc.isUnclassified ? "crm-none" : (cov === null ? "crm-none" : (cov >= 100 ? "crm-ok" : (cov >= 70 ? "crm-warn" : "crm-bad")));
      var mine = (typeof oppRows !== "undefined" && oppRows ? oppRows : []).filter(function (o) {
        return (sc.products || []).indexOf(o.product) >= 0;
      });
      var units = mine.map(function (o) { return o.stage === "won" ? "won" : (o.stage === "lost" ? "lost" : "on"); });
      out += '<div class="sh-card' + (sc.isUnclassified ? "" : " go") + '"' +
        (sc.isUnclassified ? "" : ' data-go="sector" data-nm="' + esc(sc.sector) + '"') + '>' +
        '<div><div class="nm">' + esc(sc.sector) + '</div>' +
        '<div class="sub">' + fmtN(sc.openCount) + ' فرصة مفتوحة</div>' +
        (units.length ? shUnits(units, 40) : "") + '</div>' +
        '<div class="end"><span class="money">' +
          (sc.target > 0 ? pcMoney(sc.achieved) + ' من ' + pcMoney(sc.target) : pcMoney(sc.weightedOpen) + ' مفتوح') +
        '</span><span class="crm-st ' + cls + '"><i></i>' +
          (cov === null ? "بلا مستهدف" : fmtN(cov) + "٪") + '</span></div></div>';
    });
    return out + '</div>';
  }

  /* ---- no target anywhere: lead with what exists, say the gap once, offer the fix ---- */
  if (!anyTarget) {
    var h0 = '<div class="sh-tiles">' +
      '<div class="sh-tile lead"><div><div class="k">المتوقع من الفرص المفتوحة</div>' +
        '<div class="s">' + fmtN(openCount) + ' فرصة · مرجّحة بوزن المرحلة</div></div>' +
        '<div class="v">' + fmtN(Math.round(openTotal)) + '</div></div>' +
      '<div class="sh-tile"><div><div class="k">المحقق</div><div class="s">في الفترة الحالية</div></div>' +
        '<div class="v">' + fmtN(Math.round(wonTotal)) + '</div></div>' +
      '<div class="sh-tile"><div><div class="k">القطاعات</div><div class="s">' + fmtN(prods.length) + ' منتجًا</div></div>' +
        '<div class="v">' + fmtN(secs.filter(function (x) { return !x.isUnclassified; }).length) + '</div></div>' +
      '<div class="sh-tile"><div><div class="k">المستهدفات</div><div class="s">لا تغطية بلا مستهدف</div></div>' +
        '<div class="v" style="font-size:var(--t-lg)">لم تُحدَّد</div></div></div>';
    h0 += '<div class="sh-sec">' + shEmpty("chart", "لا مستهدف محدَّد لهذه السنة",
      "التغطية نسبةٌ إلى رقم، وبلا مستهدف لا يوجد رقم تُنسب إليه — فالمعروض أعلاه هو ما في السجل فعلًا. " +
      "حدِّد المستهدف الربعي من «المستهدفات والأداء» وتعود لوحة التغطية كما هي.") +
      '<div style="text-align:center;margin-block-start:var(--s3)">' +
      '<a class="btn btn-teal crm-focusable" href="#perf" style="text-decoration:none;display:inline-flex;align-items:center;">حدِّد المستهدفات</a></div></div>';
    var withOpen = secs.filter(function (x) { return x.openCount > 0; });
    if (withOpen.length) {
      h0 += '<div class="sh-sec"><div class="sh-h">أين المفتوح الآن</div>' +
        '<div class="sh-hs">المتوقع من الفرص المفتوحة لكل قطاع. اضغط قطاعًا للوحته.</div>' +
        shStack(withOpen.map(function (sc, i) { return { n: sc.sector, v: sc.weightedOpen || 0, c: COL[i % COL.length] }; })) +
        '<div style="margin-block-start:var(--s3)"></div>' + sectorCards() + '</div>';
    }
    return h0;
  }

  /* ---- targets exist: the coverage layout, same components ---- */
  // THREE REPORTS PER ROW (founder, 2026-09-08). The band was a vertical stack of full-width
  // sections, so a 1440px screen showed one report and a lot of margin. Three per row is the
  // standard now; the grid drops to two at --bp-lg and one at --bp-sm, because three columns of
  // Arabic labels below 1280px stops being readable.
  var h = '<div class="pc-g3">';
  h += '<div class="sh-sec card3"><div class="sh-h">القطاعات</div>' +
    '<div class="sh-hs">اضغط قطاعًا للوحته.</div>' +
    pcSectorChart(secs) +
    '<div style="margin-block-start:var(--s3)"></div>' + sectorCards() + '</div>';

  var targeted = prods.filter(function (p) { return p.annualTarget > 0; });
  var untargeted = prods.length - targeted.length;
  if (targeted.length) {
    h += '<div class="sh-sec card3"><div class="sh-h">المنتجات حسب الإنجاز</div>' +
      '<div class="sh-hs">الأقل إنجازًا أولًا' +
      (untargeted ? ' · ' + fmtN(untargeted) + ' منتجًا بلا مستهدف لا تُرتَّب هنا' : '') + '.</div><div class="sh-cards">';
    targeted.sort(function (a, b) { return a.coveragePct - b.coveragePct; }).slice(0, 5).forEach(function (p) {
      var c = p.coveragePct;
      var cls = c >= 100 ? "crm-ok" : (c >= 70 ? "crm-warn" : "crm-bad");
      h += '<div class="sh-card go" data-go="product" data-nm="' + esc(p.product) + '">' +
        '<div><div class="nm">' + esc(p.product) + '</div>' +
        '<div class="sub">' + pcMoney(p.achieved) + ' من ' + pcMoney(p.annualTarget) + '</div></div>' +
        '<div class="end"><span class="crm-st ' + cls + '"><i></i>' + fmtN(c) + '٪</span></div></div>';
    });
    h += '</div></div>';
  }

  h += '<div class="sh-sec card3"><div class="sh-h">الإنجاز الربعي · ' + arYear(pcQuarters.year) + '</div>' +
    pcQuarterChart(pcQuarters) +
    '<div class="pc-note"><b>' + esc(pcQuarters.valueBasis.label) + '</b><br>' +
    esc(pcQuarters.valueBasis.note) + '</div></div>';
  h += '</div>';
  return h;
}

/* THE SECTOR CHART. Replaces a single stacked share bar, which answered «what proportion of the
   book is each sector» and nothing else — at three sectors that is a question nobody asks, and the
   colour key was the only way to read it.

   One horizontal bar per sector instead, split into MEACHIEVED and WEIGHTED-OPEN. Horizontal
   because sector names are long Arabic phrases: DESIGN.md 6.5 says a label you truncate is a label
   you did not draw, so a column chart here would either clip every name or turn them sideways.
   Each row is direct-labelled with its name and figure, so the colour key supports the reading
   rather than carrying it (6.4).

   A sector with nothing in it still gets a row, at «—». Dropping empty sectors would quietly
   change the denominator of what the reader thinks they are looking at. */
function pcSectorChart(secs) {
  var list = (secs || []).filter(function (sc) { return !sc.isUnclassified; });
  if (!list.length) return "";
  var vals = list.map(function (sc) {
    return { sc: sc, won: Number(sc.achieved) || 0, open: Number(sc.weightedOpen) || 0 };
  });
  var mx = 1;
  vals.forEach(function (v) { mx = Math.max(mx, v.won + v.open); });
  var anyOpen = vals.some(function (v) { return v.open > 0; });
  var anyWon = vals.some(function (v) { return v.won > 0; });

  var rows = vals.map(function (v) {
    var total = v.won + v.open;
    var wPct = Math.round(v.won / mx * 100);
    var oPct = Math.round(v.open / mx * 100);
    var bars = (v.won > 0 ? '<i class="won" style="width:' + Math.max(wPct, 1) + '%"></i>' : "") +
               (v.open > 0 ? '<i class="open" style="width:' + Math.max(oPct, 1) + '%"></i>' : "");
    return '<button class="r go" data-go="sector" data-nm="' + esc(v.sc.sector) + '">' +
      '<span class="nm">' + esc(v.sc.sector) + "</span>" +
      '<span class="bar">' + bars + "</span>" +
      '<span class="fig' + (total > 0 ? "" : " none") + '">' +
        (total > 0 ? pcMoney(total) : "—") + "</span></button>";
  }).join("");

  return '<div class="pcs">' + rows + "</div>" +
    (anyWon || anyOpen
      ? '<div class="pcs-lg">' +
          (anyWon ? '<span><i class="s-won"></i>المحقق</span>' : "") +
          (anyOpen ? '<span><i class="s-open"></i>المتوقع من المفتوح</span>' : "") +
        "</div>"
      : "");
}

/* THE QUARTER CHART. Four tiles side by side made every quarter the same size on screen no matter
   what it held, so the year had no shape: a quarter at 0 looked exactly like a quarter at target.
   This draws it, and the geometry IS the data (DESIGN.md 6.1) — a wide light bar is the TARGET and
   a narrower solid bar in front of it is the ACHIEVED, both scaled against the same maximum, so
   the gap between them is the shortfall at a glance.

   A quarter with NO target does not get a zero bar. A zero bar is a claim that nothing was
   achieved against something; no target means the question was never asked (DESIGN.md 4), so it
   draws a hatched baseline and says so in words.

   Time runs right to left, like the language (DESIGN.md 6.3): quarters render in order and the
   RTL row places الربع ١ at the inline-start, which is the right. */
function pcQuarterChart(qs) {
  var list = qs.quarters || [];
  var mx = 1;
  list.forEach(function (q) {
    mx = Math.max(mx, Number(q.target) || 0, Number(q.achieved) || 0);
  });
  var anyTarget = list.some(function (q) { return (Number(q.target) || 0) > 0; });
  var anyValue = list.some(function (q) { return (Number(q.achieved) || 0) > 0; });

  var cols = list.map(function (q) {
    var isNow = q.quarter === qs.currentQuarter;
    var tgt = Number(q.target) || 0, ach = Number(q.achieved) || 0;
    var tPct = Math.round(tgt / mx * 100);
    var aPct = Math.round(ach / mx * 100);
    var bars = tgt > 0
      ? '<span class="tgt" style="height:' + Math.max(tPct, 2) + '%"></span>' +
        (ach > 0 ? '<span class="ach" style="height:' + Math.max(aPct, 2) + '%"></span>' : "")
      : '<span class="notgt"></span>';
    // The figure above the column is the ACHIEVED. Zero achieved against a real target is a true
    // «٠»; no target at all is «—», because there is no denominator to be zero against.
    var top = tgt > 0 ? pcMoney(ach) : "—";
    var sub = tgt > 0
      ? "من " + pcMoney(tgt) + (q.coveragePct === null ? "" : " · " + fmtN(q.coveragePct) + "٪")
      : "بلا مستهدف";
    return '<div class="col' + (isNow ? " now" : "") + '">' +
      '<div class="val">' + top + "</div>" +
      '<div class="plot">' + bars + "</div>" +
      '<div class="lbl">الربع ' + fmtN(q.quarter) + (isNow ? " · الحالي" : "") + "</div>" +
      '<div class="sub2">' + sub + "</div></div>";
  }).join("");

  if (!anyTarget && !anyValue) {
    return '<div class="crm-empty" style="margin-block-end:var(--s3)"><b>لا مستهدف ولا محقق لهذه السنة</b>' +
      '<div>حدِّد المستهدف الربعي من «المستهدفات والأداء» وتظهر الأرباع هنا مرسومة.</div></div>';
  }
  // A colour-only legend is banned (DESIGN.md 6.4): each key carries its swatch AND its word.
  return '<div class="pcq">' + cols + "</div>" +
    '<div class="pcq-lg">' +
      '<span><i class="s-ach"></i>المحقق</span>' +
      '<span><i class="s-tgt"></i>المستهدف</span>' +
      (anyTarget && list.some(function (q) { return !(Number(q.target) > 0); })
        ? '<span><i class="s-no"></i>بلا مستهدف</span>' : "") +
    "</div>";
}

function vSectorDrill(name) {
  pcLoad(false);
  if (typeof opLoad === "function") opLoad(false);
  if (!pcSectors) return pcBack() + moSkeleton(6, ["w60", "w80", "w40"]);
  var sec = pcSectors.sectors.filter(function (x) { return x.sector === name; })[0];
  if (!sec) return pcBack() + '<div class="crm-empty"><b>قطاع غير موجود</b></div>';

  var h = pcBack();
  var cov = sec.coveragePct;
  h += '<div class="sh-tiles">' +
    '<div class="sh-tile lead"><div><div class="k">المحقق</div>' +
      '<div class="s">من ' + pcMoney(sec.target) + '</div></div>' +
      '<div class="v">' + fmtN(Math.round(sec.achieved)) + '</div></div>' +
    '<div class="sh-tile"><div><div class="k">المتوقع من المفتوح</div>' +
      '<div class="s">' + fmtN(sec.openCount) + ' فرصة مفتوحة</div></div>' +
      '<div class="v">' + fmtN(Math.round(sec.weightedOpen)) + '</div></div>' +
    '<div class="sh-tile"><div><div class="k">مربوحة</div><div class="s">في الفترة</div></div>' +
      '<div class="v">' + fmtN(sec.wonCount) + '</div></div>' +
    '<div class="sh-tile"><div><div class="k">التغطية</div>' +
      '<div class="s">' + (cov === null ? "بلا مستهدف" : "محقق + متوقع") + '</div></div>' +
      '<div class="v">' + (cov === null ? "—" : fmtN(cov) + "٪") + '</div></div>' +
  '</div>';

  h += '<div class="sh-sec"><div class="sh-h">منتجات القطاع حسب الإنجاز</div>' +
    '<div class="sh-hs">اضغط منتجًا لفتح لوحته.</div><div class="sh-cards">';
  (sec.products || []).forEach(function (nm) {
    var pq = (pcQuarters && pcQuarters.byProduct ? pcQuarters.byProduct : []).filter(function (x) { return x.product === nm; })[0];
    var c = pq ? pq.coveragePct : null;
    var cls = c === null ? "crm-none" : (c >= 100 ? "crm-ok" : (c >= 70 ? "crm-warn" : "crm-bad"));
    h += '<div class="sh-card go" data-go="product" data-nm="' + esc(nm) + '">' +
      '<div><div class="nm">' + esc(nm) + '</div>' +
      '<div class="sub">' + (pq ? pcMoney(pq.achieved) + " من " + pcMoney(pq.annualTarget) : "—") + '</div></div>' +
      '<div class="end"><span class="crm-st ' + cls + '"><i></i>' +
        (c === null ? "بلا مستهدف" : fmtN(c) + "٪") + '</span></div></div>';
  });
  h += '</div></div>';
  return h;
}
`;
