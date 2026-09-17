// sales-crm.ts — «المستهدفات والأداء», the management view of the commercial engine.
//
// WHY IT IS ITS OWN MODULE. dashboard.ts is 4,127 lines of one template literal under ADR-0001,
// and the engineering review was explicit: adding screens to it institutionalises the problem.
// The house pattern is already here — campaigns-crm, customers-crm, activity-crm, opps-crm — so
// this follows it. dashboard.ts gains an import, two interpolations, a nav row and a route.
//
// WHAT IT SHOWS, and why every figure on it is earned. The design record's rule for this screen is
// that nothing on it may be hand-entered except the target itself. So:
//   · target        typed by a human. The only one.
//   · achieved      summed from the stage-event ledger — deals whose WIN falls in this quarter.
//   · weighted      open deals x their stage WEIGHT. Never a probability of winning: the ladder
//                   stores a weight per stage and that is all the figure is. It is labelled
//                   «مرجّحة بوزن المرحلة» everywhere it appears, and that label is load-bearing.
//   · attainment    achieved / target               — "have we made it"
//   · coverage      (achieved + weighted) / target  — "are we going to make it"
// The last two are separate on purpose: one ambiguous "%" was colouring the board wrongly.
//
// The arithmetic is NOT re-implemented here. Every calculation calls sales-domain through the
// browser seam, so the number on this screen and the number in the test suite are the same code.
//
// PORTED to the new design system (docs/PORT-SPEC.md). The screen body is wrapped in its own .ds6:
// the route paints vYearTargets() + vSalesPerf() into one screen, so each owns one wrapper.
//
// THE REPAIR BELOW IS LOAD-BEARING AND SURVIVES THE PORT. Every ratio is computed over the rows
// that HAVE a target and the screen states how many services it left out; a service with revenue
// and no target inflated the lead tile silently before that. The qualifying line under the table
// is the point of this screen, not clutter.
//
// SMOKE LANDMARK: «المتوقع من الفرص المفتوحة» must render from the KPI shell BEFORE the fetch
// resolves — smoke.py asserts it for #perf precisely so a slow ledger is green and a broken view
// is red. Do not move it behind the data.
//
// No backticks in this file (gate: check-crm-literals).

export const SALES_CRM_CSS = `
/* PORTED to the m-* vocabulary (docs/PORT-SPEC.md). Deleted here because the vocabulary carries
   them: the period chips (.m-seg), the KPI tiles (.m-kpis/.m-stat__*), the table, the status
   chips, the buttons and their focus ring, the empty state, every number and all three kinds of
   absence. The bespoke ok/warn/bad palette is gone with them — the status tokens are the same
   three the rest of the system already uses.

   What survives is the ONE thing the vocabulary does not carry: the attainment meter with a pace
   tick. .m-meter already draws a fill and a mark, so the tick is --m-mark rather than a private
   element; only the table-cell geometry is stated here. The tick is the honest signal on this
   screen — a fill short of it is behind pace, and that reading is POSITIONAL, not chromatic. */
.ds6 .perf-meter{margin-block:0;min-inline-size:96px}
.ds6 .perf-meter b{opacity:1;background:var(--m-ink)}
.ds6 .perf-ach{display:flex;align-items:center;gap:var(--m-2);min-inline-size:0}
.ds6 .perf-tbl .m-table{min-inline-size:960px}
.ds6 .perf-sub{display:block;font-weight:400;margin-block-start:2px}
@media (max-width:820px){
  .ds6 .perf-tbl .m-table{min-inline-size:760px}
  .ds6 .perf-sechide{display:none}
}
`;

export const SALES_CRM_JS = `
/* ===== sales-crm (generated from src/sales-crm.ts) ===== */
var perfState = { year: 0, quarter: 0, data: null, loading: false };

/* A YEAR IS NOT A QUANTITY. fmtN is Number.toLocaleString("ar-SA"), which groups, so 2026 came out
   as 2,026 — in the «المستهدف» tile at rest, not just in the dialog. Kept as a shared helper:
   products-crm.ts prints the performance year through it too. */
function arYear(n) {
  return new Intl.NumberFormat("ar-SA-u-nu-latn", { useGrouping: false }).format(Number(n) || 0);
}
/* The same year, marked as a figure so it takes the system's bidi isolation and tabular digits. */
function perfYear(n) { return '<span class="m-n">' + arYear(n) + "</span>"; }

/* Round INSIDE the helper. mPct already formats; a bare Math.round beside a string literal is
   what check-numerals looks for, and it cannot see that mPct wraps the value. */
function perfPct(v) { return mPct(Math.round(Number(v) || 0)); }

function perfMoney(n) {
  /* Digits inside .m-n, the currency word outside it — the shape the reference screen prints
     (home-ds-crm.ts), so a zero still reads as money rather than as a bare digit. */
  return mMoney(n);
}

/** The one place a percentage becomes a status word. Delegates to sales-domain so the band on
 *  screen and the band in the test suite are the same function. The three tones are the system's
 *  own ok/warn/bad, not a fourth palette: a «متعثّر» in a different red from every other bad state
 *  in the product teaches the reader that the colour means nothing. */
function perfRag(attain, elapsed) {
  var key = ragKey(attain, elapsed);
  var label = key === "good" ? "على المسار" : key === "warn" ? "متأخّر قليلًا"
            : key === "bad" ? "متعثّر" : "بلا مستهدف";
  if (key === "none") return mNil(label, "owed");
  var cls = key === "good" ? " m-chip--ok" : key === "warn" ? " m-chip--warn" : " m-chip--bad";
  return '<span class="m-chip' + cls + '">' + label + "</span>";
}

/* The attainment meter. The bar is the attainment; the tick is how far through the quarter we are.
   ONE accent fill, never a status colour: the status is carried by the chip in its own column,
   which reads for a colour-blind director too, and a green-versus-red bar never did. */
function perfBar(attain, elapsed) {
  if (attain === null) return "";
  var w = Math.max(0, Math.min(100, attain));
  var pace = Math.max(0, Math.min(100, (Number(elapsed) || 0) * 100));
  return '<span class="m-meter perf-meter" role="img" aria-label="الإنجاز مقابل موضعنا من الربع">' +
    '<i style="--m-pct:' + w.toFixed(1) + '%"></i>' +
    '<b style="--m-mark:' + pace.toFixed(1) + '%" title="موضعنا من الربع"></b></span>';
}

async function perfLoad(year, quarter) {
  perfState.loading = true;
  var qs = year ? ("?year=" + year + "&quarter=" + quarter) : "";
  try {
    var r = await fetch("/admin/sales/performance" + qs, { headers: { "x-admin-token": TOKEN } });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok || !d.ok) { perfState.data = { error: d.error || r.status }; }
    else { perfState.data = d; perfState.year = d.year; perfState.quarter = d.quarter; }
  } catch (e) {
    perfState.data = { error: String(e && e.message ? e.message : e).slice(0, 90) };
  }
  perfState.loading = false;
  render(false);
}

window.perfPick = function (q) {
  perfLoad(perfState.year || 0, q);
};

/* The product name is attacker-supplied: tags are minted from an uploaded spreadsheet cell
   (audience.ts tagsFromCell caps the length and validates no characters). It therefore never goes
   into an inline handler — an HTML attribute is decoded before the JS parser sees it, so any
   escaping done here is undone by the parser. It travels as a data attribute and is read back as
   a string, which no amount of quoting in the name can break out of. */
document.addEventListener("click", function (e) {
  var b = e.target && e.target.closest ? e.target.closest("[data-perf-product]") : null;
  if (b) window.perfSetTarget(b.getAttribute("data-perf-product"));
});

window.perfSetTarget = async function (product) {
  var cur = 0;
  var rows = (perfState.data && perfState.data.rows) || [];
  for (var i = 0; i < rows.length; i++) if (rows[i].product === product) cur = rows[i].target;
  // Digits are typed in Latin because this is an input, not a reading: an Arabic-Indic numeral
  // pasted back into a number field is a parse failure nobody can see.
  var raw = window.prompt("المستهدف لـ «" + product + "» — الربع " + fmtN(perfState.quarter) + " من " + arYear(perfState.year) + "\\n(بالريال، أرقام لاتينية)", String(cur || ""));
  if (raw === null) return;
  var amount = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!isFinite(amount) || amount < 0) { alertBar("قيمة غير صالحة", true); return; }
  var r = await fetch("/admin/sales/targets", {
    method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ product: product, year: perfState.year, quarter: perfState.quarter, amount: amount, by: "اللوحة" })
  });
  var d = await r.json().catch(function () { return {}; });
  if (!r.ok || !d.ok) { alertBar("تعذّر الحفظ: " + esc(d.error || r.status), true); return; }
  /* The product record keeps its own copy of the same rows. Drop it, or «المستهدفات والأداء» and
     the record show two different targets for one quarter until a reload. */
  if (typeof pcPerf !== "undefined") { pcPerf = {}; pcPerfFailed = {}; }
  alertBar("حُفظ المستهدف — " + fmtN(Math.round(amount)) + " ر.س", false);
  perfLoad(perfState.year, perfState.quarter);
};

/** Period chips. Painted on every path, including before data arrives and when the fetch failed,
 *  so the screen always has a shape. */
function perfShell(quarter, year) {
  var per = '<div class="m-seg" role="group" aria-label="الربع">';
  for (var q = 1; q <= 4; q++) {
    per += '<button type="button" aria-pressed="' + (q === quarter) + '" onclick="perfPick(' + q + ')">الربع ' + mN(q) + "</button>";
  }
  per += "</div>";
  // THE BASIS IS STATED ON THE SCREEN, because it was never decided. The plan named this as its
  // single unresolved business question — bookings, ACV, or TCV — and the code shipped one
  // answer: sale_price x qty x years, the whole contract booked into the quarter it was won.
  // The explanatory note was removed on the founder's instruction (2026-09-06). The basis it
  // described is still stated where a figure is actually read against a target — DESIGN.md's
  // VALUE_BASIS_NOTE renders under the quarters on المنتجات and under every report table.
  return '<header class="m-head"><div class="m-section-head__t">' +
    '<h2 class="m-h2">المستهدفات والأداء</h2>' +
    '<p class="m-meta">' + (year ? "الربع " + mN(quarter) + " من " + perfYear(year) : "الربع الحالي") + "</p></div>" +
    '<div class="m-head__a">' + per + "</div></header>";
}

/** The four figures. A value that has not arrived is an absence of the «unset» kind — «not loaded
 *  yet» and «zero riyals» are different facts, and drawing both as a dash is what PORT-SPEC §4
 *  exists to stop.
 *
 *  «المتوقع من الفرص المفتوحة» is the smoke landmark for #perf and renders on every path. */
function perfKpis(totT, totA, totW, totCover, totAttain, totOpen, quarter, year) {
  var waiting = mNil("لم تصل بعد", "unset");
  var tile = function (cls, k, v, s) {
    return '<div class="m-card ' + cls + '"><span class="m-stat__k">' + k + "</span>" +
      '<span class="m-stat__v">' + v + "</span>" +
      '<span class="m-stat__s">' + s + "</span></div>";
  };
  return '<div class="m-kpis">' +
    tile("m-stat--ac", "التغطية",
      totCover === null || totCover === undefined
        ? (totT === null ? waiting : mNil("بلا مستهدف", "owed"))
        : perfPct(totCover),
      "المحقق والمتوقع معًا مقابل المستهدف") +
    tile("", "المستهدف",
      totT === null ? waiting : (totT ? perfMoney(totT) : mNil("لم يُحدَّد", "owed")),
      quarter ? "الربع " + mN(quarter) + " · " + perfYear(year) : "الربع الحالي") +
    tile("", "المحقق", totA === null ? waiting : perfMoney(totA),
      totA === null ? "من سجل المراحل"
        : (totAttain === null ? "لا مستهدف يُقاس عليه" : perfPct(totAttain) + " من المستهدف")) +
    /* «مرجّحة بوزن المرحلة» — a weighting the ladder stores, never a probability of winning. */
    tile("", "المتوقع من الفرص المفتوحة", totW === null ? waiting : perfMoney(totW),
      totW === null ? "من الفرص المفتوحة"
        : mPlOf(totOpen, opNOpp(totOpen)) + " مرجّحة بوزن المرحلة") +
    "</div>";
}

function vSalesPerf() {
  if (!perfState.data && !perfState.loading) { perfLoad(0, 0); }
  var d = perfState.data;

  // The SHELL paints before the fetch resolves — period chips and KPI frames first, numbers when
  // they arrive. Returning a bare "loading" line instead meant the screen had nothing at rest: a
  // reader saw one sentence, and the smoke test correctly called that a broken render.
  if (!d || d.error) {
    var why = !d
      ? '<section class="m-card" aria-busy="true"><p class="m-meta">جارٍ حساب الأداء من السجل…</p>' +
        moSkeleton(3, ["w40", "w80", "w60"]) + "</section>"
      : '<div class="m-alert" role="alert"><span class="m-alert__t">تعذّر تحميل الأداء</span>' +
        '<span class="m-alert__d">' + esc(String(d.error)) +
        " — أعد المحاولة، وإن تكرر فالمشكلة في الاتصال بقاعدة البيانات لا في هذه الشاشة.</span></div>";
    return '<div class="ds6">' + perfShell(perfState.quarter || 0, perfState.year || 0) +
      perfKpis(null, null, null, null, 0, 0, 0) + why + "</div>";
  }

  var rows = d.rows || [];
  var elapsed = periodElapsedFraction(d.now, d.periodStart, d.periodEnd);

  // Aggregate as SUM(numerator)/SUM(target), never the average of the product percentages —
  // averaging percentages weights a tiny product the same as the biggest one.
  //
  // And aggregate over ONE population. db.salesPerformance emits COALESCE(tgt.amount, 0), so an
  // unset target arrives as 0 and is indistinguishable in a sum: the denominator covered only the
  // targeted services while the numerator covered the whole catalogue, and the lead tile was
  // inflated by exactly the revenue of every untargeted one. The guard below only fired when NO
  // service had a target; the partial case is the normal case here and it was silent.
  var totT = 0, totA = 0, totW = 0, totOpen = 0, offA = 0, offCount = 0;
  for (var i = 0; i < rows.length; i++) {
    totOpen += rows[i].openCount;
    if (Number(rows[i].target) > 0) {
      totT += rows[i].target; totA += rows[i].achieved; totW += rows[i].weightedOpen;
    } else {
      offCount++; offA += Number(rows[i].achieved) || 0;
    }
  }
  var totAttain = attainmentPct(totA, totT);
  var totCover = coveragePct(totA, totW, totT);

  /* The service counts printed both in the qualifying line and in the table's foot are bound to
     the rows they are counted from (PORT-SPEC §6): a summary that disagrees with the table under
     it is the defect this mechanism exists for. */
  dsD("perfServices", function () { return ((perfState.data && perfState.data.rows) || []).length; });
  dsD("perfTargeted", function () {
    return ((perfState.data && perfState.data.rows) || []).filter(function (r) { return Number(r.target) > 0; }).length;
  });
  dsD("perfNoTarget", function () {
    return ((perfState.data && perfState.data.rows) || []).filter(function (r) { return !Number(r.target); }).length;
  });

  var h = '<div class="ds6">' + perfShell(d.quarter, d.year) +
    perfKpis(totT, totA, totW, totCover, totAttain, totOpen, d.quarter, d.year);

  if (!rows.length) {
    return h + '<section class="m-card m-empty"><p class="m-empty__t">لا توجد خدمات في الكتالوج بعد</p>' +
      '<p class="m-empty__d">المستهدفات تُدخل لكل خدمة، فأضف خدمة من «المنتجات» أولًا ثم عد إلى هنا لتحديد مستهدفها.</p>' +
      "</section></div>";
  }

  var body = "";
  for (var k = 0; k < rows.length; k++) {
    var r = rows[k];
    var at = attainmentPct(r.achieved, r.target);
    var cv = coveragePct(r.achieved, r.weightedOpen, r.target);
    /* THREE absences, one row, and they are not the same fact. The target is a number someone
       OWES, and it is marked once, in the column that owes it. «الإنجاز» and «التغطية» are then
       simply unmeasurable — a legitimate nothing — and marking them owed as well would put three
       red dashes on one row for one missing value, which is how a reader learns to ignore all
       three. */
    body += "<tr>" +
      '<td class="m-td-n">' + esc(r.product) +
        (r.sector ? '<span class="perf-sub m-meta">' + esc(r.sector) + "</span>" : "") + "</td>" +
      '<td class="m-td-v">' + (r.target ? perfMoney(r.target) : mNil("لم يُحدَّد", "owed")) + "</td>" +
      '<td class="m-td-v">' + perfMoney(r.achieved) + "</td>" +
      '<td class="m-td-v perf-sechide">' + perfMoney(r.weightedOpen) + "</td>" +
      '<td><span class="perf-ach">' + perfBar(at, elapsed) +
        (at === null ? mNil("لم يُقَس", "none") : perfPct(at)) + "</span></td>" +
      '<td class="m-td-v perf-sechide">' + (cv === null ? mNil("لم يُقَس", "none") : perfPct(cv)) + "</td>" +
      "<td>" + perfRag(at, elapsed) + "</td>" +
      '<td><button class="m-btn" data-perf-product="' + esc(r.product) + '">' +
        (r.target ? "تعديل" : "تحديد المستهدف") + "</button></td>" +
      "</tr>";
  }

  h += '<section class="m-card m-card--pad0 perf-tbl"><div class="m-tablewrap">' +
    '<table class="m-table"><thead><tr>' +
    "<th>الخدمة</th><th>المستهدف</th><th>المحقق</th>" +
    '<th class="perf-sechide">المتوقع</th><th>الإنجاز مقابل مضيّ الربع</th>' +
    '<th class="perf-sechide">التغطية</th><th>الحالة</th><th></th>' +
    "</tr></thead><tbody>" + body + "</tbody></table></div></section>";

  // Day one is every target unset. Say so, say who fixes it, and say what the numbers still mean
  // in the meantime — an empty state that explains itself is a feature, not an apology.
  // The PARTIAL case needs saying too: a percentage measured on part of the catalogue reads as
  // the whole one unless the page states what it left out. Both counts go through dsFig.
  if (offCount === rows.length) {
    h += '<section class="m-card m-empty"><p class="m-empty__t">لم تُحدَّد أي مستهدفات لهذا الربع</p>' +
      '<p class="m-empty__d">الأرقام المحققة والمتوقعة أعلاه صحيحة الآن — لكن «الإنجاز» و«التغطية» و«الحالة» ' +
      "تحتاج مستهدفًا لتُقاس عليه. اضغط «تحديد المستهدف» بجوار أي خدمة.</p></section>";
  } else if (offCount) {
    h += '<p class="m-status m-status--warn">النسب محسوبة على ' +
      dsFig("perfTargeted", rows.length - offCount) + " من " + dsFig("perfServices", rows.length) +
      " خدمة · " + dsFig("perfNoTarget", offCount) + " بلا مستهدف لهذا الربع" +
      (offA ? "، ومحققها " + perfMoney(offA) + " غير داخل في النسبة" : "") + ".</p>";
  }

  return h + "</div>";
}
`;
