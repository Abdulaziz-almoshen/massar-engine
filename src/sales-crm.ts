// sales-crm.ts — «المستهدفات والأداء», the management view of the commercial engine.
//
// WHY IT IS ITS OWN MODULE. `dashboard.ts` is 4,127 lines of one template literal under ADR-0001,
// and the engineering review was explicit: adding screens to it institutionalises the problem.
// The house pattern is already here — campaigns-crm, customers-crm, activity-crm, opps-crm — so
// this follows it. `dashboard.ts` gains an import, two interpolations, a nav row and a route.
//
// WHAT IT SHOWS, and why every figure on it is earned. The design record's rule for this screen is
// that nothing on it may be hand-entered except the target itself. So:
//   · target        typed by a human. The only one.
//   · achieved      summed from the stage-event ledger — deals whose WIN falls in this quarter.
//   · weighted      open deals × their stage probability. The forecast the six-stage engine
//                   could not produce at all.
//   · attainment    achieved ÷ target        — "have we made it"
//   · coverage      (achieved + weighted) ÷ target — "are we going to make it"
// The last two are separate on purpose: one ambiguous "%" was colouring the board wrongly.
//
// The arithmetic is NOT re-implemented here. Every calculation calls sales-domain through the
// browser seam, so the number on this screen and the number in the test suite are the same code.

export const SALES_CRM_CSS = `
.perf-head{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap;margin-bottom:14px}
.perf-per{display:flex;gap:6px;align-items:center}
.perf-per .q{border:1px solid var(--line,#E2E2E2);background:var(--card,#fff);border-radius:999px;
  padding:5px 13px;font-size:12.5px;cursor:pointer;color:var(--ink2,#525252);min-height:32px}
.perf-per .q.on{background:#1F7A73;border-color:#1F7A73;color:#fff;font-weight:700}
.perf-note{margin-inline-start:auto;font-size:12px;color:var(--muted,#7C7C7C);max-width:46ch;text-align:end}
.perf-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.perf-kpi{background:var(--strip,#F8F8F8);border-radius:10px;padding:13px 15px}
.perf-kpi .k{font-size:11.5px;color:var(--muted,#7C7C7C);font-weight:600}
.perf-kpi .v{font-size:21px;font-weight:700;margin-top:3px;letter-spacing:0}
.perf-kpi .s{font-size:11.5px;color:var(--muted,#7C7C7C);margin-top:2px}
.perf-tbl{width:100%;border-collapse:collapse;font-size:13.5px}
.perf-tbl th{text-align:start;font-size:11.5px;font-weight:600;color:var(--muted,#7C7C7C);
  padding:0 10px 8px 0;border-bottom:1px solid var(--line,#E2E2E2);white-space:nowrap}
.perf-tbl td{padding:0 10px 0 0;border-bottom:1px solid var(--line2,#EDEDED);height:36px;vertical-align:middle}
.perf-tbl tr:hover td{background:var(--strip,#F8F8F8)}
.perf-tbl .money{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap}
.perf-prod{font-weight:600}
.perf-sec{font-size:11.5px;color:var(--muted,#7C7C7C);font-weight:400}
.perf-bar{position:relative;height:6px;border-radius:999px;background:var(--line2,#EDEDED);
  min-width:90px;overflow:hidden}
.perf-bar i{position:absolute;inset-block:0;inset-inline-start:0;border-radius:999px;display:block}
.perf-bar .pace{position:absolute;inset-block:-2px;width:2px;background:var(--ink,#1A1A1A);opacity:.45}
.perf-rag{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;white-space:nowrap}
.perf-rag .dot{width:7px;height:7px;border-radius:999px;flex:none}
.rag-good{color:#2E6B4F} .rag-good .dot{background:#2E6B4F}
.rag-warn{color:#7A5C00} .rag-warn .dot{background:#7A5C00}
.rag-bad{color:#A32B21}  .rag-bad  .dot{background:#A32B21}
.rag-none{color:var(--muted,#7C7C7C)} .rag-none .dot{background:var(--line,#E2E2E2)}
.perf-set{border:1px solid var(--line,#E2E2E2);background:transparent;border-radius:6px;
  padding:4px 9px;font-size:12px;cursor:pointer;color:var(--ink2,#525252);min-height:30px}
.perf-set:hover{border-color:#1F7A73;color:#1F7A73}
.perf-empty{padding:26px 0;color:var(--muted,#7C7C7C);font-size:13.5px;max-width:56ch;line-height:1.6}
.perf-empty b{color:var(--ink,#1A1A1A);display:block;margin-bottom:5px;font-size:14.5px}
@media (max-width:820px){
  .perf-kpis{grid-template-columns:repeat(2,1fr)}
  .perf-sechide{display:none}
}
@media (pointer:coarse){
  .perf-per .q{min-height:44px;padding-inline:16px}
  .perf-set{min-height:44px;padding-inline:14px}
}
`;

export const SALES_CRM_JS = `
/* ===== sales-crm (generated from src/sales-crm.ts) ===== */
var perfState = { year: 0, quarter: 0, data: null, loading: false };

function perfMoney(n) {
  // fmtN carries the Arabic-Indic numerals; the currency word is separate so a zero still reads
  // as money rather than as a bare digit.
  return fmtN(Math.round(Number(n) || 0)) + " ر.س";
}

/** The one place a percentage becomes a colour. Delegates to sales-domain so the band on screen
 *  and the band in the test suite are the same function. */
function perfRag(attain, elapsed) {
  var key = ragKey(attain, elapsed);
  var label = key === "good" ? "على المسار" : key === "warn" ? "متأخّر قليلًا"
            : key === "bad" ? "متعثّر" : "بلا مستهدف";
  return '<span class="perf-rag rag-' + key + '"><i class="dot"></i>' + label + '</span>';
}

function perfBar(attain, elapsed) {
  if (attain === null) return '<div class="perf-bar"></div>';
  var key = ragKey(attain, elapsed);
  var col = key === "good" ? "#2E6B4F" : key === "warn" ? "#7A5C00" : "#A32B21";
  var w = Math.max(0, Math.min(100, attain));
  var pace = Math.max(0, Math.min(100, (Number(elapsed) || 0) * 100));
  // The tick is where the quarter is. A bar short of it is behind pace even if the colour is green.
  return '<div class="perf-bar"><i style="width:' + w.toFixed(1) + '%;background:' + col + '"></i>' +
         '<span class="pace" style="inset-inline-start:' + pace.toFixed(1) + '%"></span></div>';
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

window.perfSetTarget = async function (product) {
  var cur = 0;
  var rows = (perfState.data && perfState.data.rows) || [];
  for (var i = 0; i < rows.length; i++) if (rows[i].product === product) cur = rows[i].target;
  // Digits are typed in Latin because this is an input, not a reading: an Arabic-Indic numeral
  // pasted back into a number field is a parse failure nobody can see.
  var raw = window.prompt("المستهدف لـ «" + product + "» — الربع " + fmtN(perfState.quarter) + " من " + fmtN(perfState.year) + "\\n(بالريال، أرقام لاتينية)", String(cur || ""));
  if (raw === null) return;
  var amount = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!isFinite(amount) || amount < 0) { alertBar("قيمة غير صالحة", true); return; }
  var r = await fetch("/admin/sales/targets", {
    method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ product: product, year: perfState.year, quarter: perfState.quarter, amount: amount, by: "اللوحة" })
  });
  var d = await r.json().catch(function () { return {}; });
  if (!r.ok || !d.ok) { alertBar("تعذّر الحفظ: " + esc(d.error || r.status), true); return; }
  alertBar("حُفظ المستهدف — " + perfMoney(amount), false);
  perfLoad(perfState.year, perfState.quarter);
};

/** Period chips and the standing note. Painted on every path, including before data arrives and
 *  when the fetch failed, so the screen always has a shape. */
function perfShell(quarter, year) {
  var per = '<div class="perf-per">';
  for (var q = 1; q <= 4; q++) {
    per += '<button class="q' + (q === quarter ? " on" : "") + '" onclick="perfPick(' + q + ')">الربع ' + fmtN(q) + '</button>';
  }
  per += "</div>";
  return '<div class="perf-head">' + per +
    '<div class="perf-note">كل رقم هنا محسوب من السجل — عدا المستهدف، وهو الوحيد الذي يُكتب بيد إنسان. ' +
    'العلامة على الشريط هي موضعنا من الربع.</div></div>';
}

/** The four figures. Nulls render as «—» rather than as zero: "not loaded yet" and "zero riyals"
 *  are different facts and a dash is the honest placeholder for the first. */
function perfKpis(totT, totA, totW, totCover, totAttain, totOpen, quarter, year) {
  var dash = "—";
  return '<div class="perf-kpis">' +
    '<div class="perf-kpi"><div class="k">المستهدف</div><div class="v">' +
      (totT === null ? dash : perfMoney(totT)) + '</div>' +
      '<div class="s">' + (quarter ? "الربع " + fmtN(quarter) + " · " + fmtN(year) : "&nbsp;") + '</div></div>' +
    '<div class="perf-kpi"><div class="k">المحقق</div><div class="v">' +
      (totA === null ? dash : perfMoney(totA)) + '</div>' +
      '<div class="s">' + (totA === null ? "&nbsp;" : (totAttain === null ? "بلا مستهدف" : fmtN(Math.round(totAttain)) + "٪ من المستهدف")) + '</div></div>' +
    '<div class="perf-kpi"><div class="k">المتوقع من الفرص المفتوحة</div><div class="v">' +
      (totW === null ? dash : perfMoney(totW)) + '</div>' +
      '<div class="s">' + (totW === null ? "&nbsp;" : fmtN(totOpen) + " فرصة مرجّحة باحتمال مرحلتها") + '</div></div>' +
    '<div class="perf-kpi"><div class="k">التغطية</div><div class="v">' +
      (totCover === null || totCover === undefined ? dash : fmtN(Math.round(totCover)) + "٪") + '</div>' +
      '<div class="s">المحقق والمتوقع معًا</div></div>' +
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
      ? '<div class="perf-empty">جارٍ حساب الأداء من السجل…</div>'
      : '<div class="perf-empty"><b>تعذّر تحميل الأداء</b>' + esc(String(d.error)) +
        '<br><span style="font-size:12.5px">أعد المحاولة، وإن تكرر فالمشكلة في الاتصال بقاعدة البيانات لا في هذه الشاشة.</span></div>';
    return perfShell(perfState.quarter || 0, perfState.year || 0) + perfKpis(null, null, null, null, 0, 0, 0) + why;
  }

  var rows = d.rows || [];
  var elapsed = periodElapsedFraction(d.now, d.periodStart, d.periodEnd);

  var totT = 0, totA = 0, totW = 0, totOpen = 0;
  for (var i = 0; i < rows.length; i++) {
    totT += rows[i].target; totA += rows[i].achieved; totW += rows[i].weightedOpen; totOpen += rows[i].openCount;
  }
  // Aggregate as SUM(numerator)/SUM(target), never the average of the product percentages —
  // averaging percentages weights a tiny product the same as the biggest one.
  var totAttain = attainmentPct(totA, totT);
  var totCover = coveragePct(totA, totW, totT);

  var head = perfShell(d.quarter, d.year);
  var kpis = perfKpis(totT, totA, totW, totCover, totAttain, totOpen, d.quarter, d.year);

  if (!rows.length) {
    return head + kpis + '<div class="perf-empty"><b>لا توجد خدمات في الكتالوج بعد</b>' +
      'المستهدفات تُدخل لكل خدمة، فأضف خدمة من «معرفة الخدمة» أولًا ثم عد إلى هنا لتحديد مستهدفها.</div>';
  }

  var noTarget = 0;
  for (var j = 0; j < rows.length; j++) if (!rows[j].target) noTarget++;

  var body = "";
  for (var k = 0; k < rows.length; k++) {
    var r = rows[k];
    var at = attainmentPct(r.achieved, r.target);
    var cv = coveragePct(r.achieved, r.weightedOpen, r.target);
    body += "<tr>" +
      '<td><div class="perf-prod">' + esc(r.product) + "</div>" +
        (r.sector ? '<div class="perf-sec">' + esc(r.sector) + "</div>" : "") + "</td>" +
      '<td class="money">' + (r.target ? perfMoney(r.target) : '<span class="perf-sec">لم يُحدَّد</span>') + "</td>" +
      '<td class="money">' + perfMoney(r.achieved) + "</td>" +
      '<td class="money perf-sechide">' + perfMoney(r.weightedOpen) + "</td>" +
      "<td>" + perfBar(at, elapsed) + "</td>" +
      '<td class="money">' + (at === null ? "—" : fmtN(Math.round(at)) + "٪") + "</td>" +
      '<td class="money perf-sechide">' + (cv === null ? "—" : fmtN(Math.round(cv)) + "٪") + "</td>" +
      "<td>" + perfRag(at, elapsed) + "</td>" +
      '<td><button class="perf-set" onclick="perfSetTarget(' + JSON.stringify(r.product).replace(/"/g, "&quot;") + ')">' +
        (r.target ? "تعديل" : "تحديد المستهدف") + "</button></td>" +
      "</tr>";
  }

  var table = '<div style="overflow-x:auto"><table class="perf-tbl"><thead><tr>' +
    "<th>الخدمة</th><th>المستهدف</th><th>المحقق</th>" +
    '<th class="perf-sechide">المتوقع</th><th>التقدّم</th><th>الإنجاز</th>' +
    '<th class="perf-sechide">التغطية</th><th>الحالة</th><th></th>' +
    "</tr></thead><tbody>" + body + "</tbody></table></div>";

  // Day one is every target unset. Say so, say who fixes it, and say what the numbers still mean
  // in the meantime — an empty state that explains itself is a feature, not an apology.
  var hint = noTarget === rows.length
    ? '<div class="perf-empty"><b>لم تُحدَّد أي مستهدفات لهذا الربع</b>' +
      'الأرقام المحققة والمتوقعة أعلاه صحيحة الآن — لكن «الإنجاز» و«الحالة» تحتاج مستهدفًا لتُقاس عليه. ' +
      'اضغط «تحديد المستهدف» بجوار أي خدمة.</div>'
    : "";

  return head + kpis + table + hint;
}
`;
