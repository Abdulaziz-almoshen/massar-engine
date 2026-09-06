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
    var COL = ["#306DB5", "#629CCD", "#416CAD", "#A9B4C0"];
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
  var COL = ["#306DB5", "#629CCD", "#416CAD", "#A9B4C0"];

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
  var h = '<div class="sh-sec"><div class="sh-h">القطاعات</div>' +
    '<div class="sh-hs">اضغط قطاعًا للوحته، أو منتجًا للوحة منتجه.</div>' +
    shStack(secs.map(function (sc, i) {
      return { n: sc.sector, v: (sc.achieved || 0) + (sc.weightedOpen || 0), c: COL[i % COL.length] };
    }).filter(function (p) { return p.v > 0; })) +
    '<div style="margin-block-start:var(--s3)"></div>' + sectorCards() + '</div>';

  var targeted = prods.filter(function (p) { return p.annualTarget > 0; });
  var untargeted = prods.length - targeted.length;
  if (targeted.length) {
    h += '<div class="sh-sec"><div class="sh-h">المنتجات حسب الإنجاز</div>' +
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

  h += '<div class="sh-sec"><div class="sh-h">الإنجاز الربعي الإجمالي · ' + arYear(pcQuarters.year) + '</div><div class="sh-tiles">';
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
  return h;
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
