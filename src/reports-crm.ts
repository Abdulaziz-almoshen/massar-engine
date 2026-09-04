// reports-crm.ts — «التقارير»: the four reports the stage document names, on screen at last.
//
// They were computable for a while and «التقارير» stayed «قريبًا», which is the same gap as a table
// with a writer and no reader. Each report carries its own question and its own written empty
// state, both from reports-domain.ts, so the screen cannot describe a report differently from the
// query that answers it.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included.

export const REPORTS_CRM_CSS = `
.rp-tabs{display:flex;gap:2px;flex-wrap:wrap;margin-block-end:18px;border-block-end:1px solid var(--line,#EDEDED)}
.rp-tab{appearance:none;background:transparent;border:0;border-radius:0;cursor:pointer;font-family:inherit;
  font-size:13px;font-weight:450;color:var(--muted,#7C7C7C);letter-spacing:0;padding:8px 11px;
  border-block-end:2px solid transparent;margin-block-end:-1px;display:inline-flex;align-items:center;gap:7px}
.rp-tab:hover{color:var(--ink,#171717)}
.rp-tab.on{color:var(--ink,#171717);font-weight:600;border-block-end-color:var(--teal,#1F7A73)}
.rp-tab .n{font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--muted,#7C7C7C)}
.rp-tab.on .n{color:var(--teal,#1F7A73)}
.rp-q{font-size:12.5px;color:var(--ink2,#525252);margin-block-end:4px}
.rp-tot{font-size:11.5px;color:var(--muted,#7C7C7C);margin-block-end:14px;font-variant-numeric:tabular-nums}
.rp-days{font-variant-numeric:tabular-nums;font-weight:600}
.rp-basis{font-size:11.5px;color:var(--muted,#7C7C7C);margin-block-start:18px;line-height:1.7;
  padding-inline-start:9px;border-inline-start:2px solid var(--line2,#E2E2E2);max-width:66ch}
`;

export const REPORTS_CRM_JS = `
/* ============================ reports-crm (client) ============================ */
var rpList = null, rpPick = null, rpData = {}, rpLoading = false;

function rpLoad() {
  if (rpLoading || rpList) return;
  rpLoading = true;
  fetch("/admin/reports", { headers: { "x-admin-token": TOKEN } })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      rpList = j.reports || [];
      rpLoading = false;
      if (!rpPick && rpList.length) rpOpen(rpList[0].id);
      else render(false);
    })
    .catch(function () { rpList = []; rpLoading = false; render(false); });
}

function rpOpen(id) {
  rpPick = id;
  if (rpData[id]) { render(false); return; }
  fetch("/admin/reports/" + encodeURIComponent(id), { headers: { "x-admin-token": TOKEN } })
    .then(function (r) { return r.json(); })
    .then(function (j) { rpData[id] = j; render(false); })
    .catch(function () { rpData[id] = { rows: [], count: 0, error: true }; render(false); });
}
window.rpOpen = rpOpen;

/* Days waiting is the only number on this screen that decides anything, so it carries the state
   dot. Thresholds are deliberately blunt — two weeks is stale, a month is stuck. */
/* The stage LABEL comes from SALES_STAGES, which sales-domain serialises into the browser — the
   same ladder the server validates against, so the screen cannot name a stage the engine does not
   have. An unknown key prints itself rather than an empty cell. */
function rpStage(k) {
  var s = (typeof SALES_STAGES !== "undefined" ? SALES_STAGES : []).filter(function (x) { return x.key === k; })[0];
  return s ? s.label : String(k || "—");
}

function rpAge(d) {
  var n = Number(d) || 0;
  var cls = n >= 30 ? "crm-bad" : (n >= 14 ? "crm-warn" : "crm-none");
  return '<span class="crm-st ' + cls + '"><i></i><span class="rp-days">' + fmtN(n) + '</span> يومًا</span>';
}

function vReportsCrm() {
  rpLoad();
  if (!rpList) return '<div class="crm-empty"><b>جارٍ تحميل التقارير…</b></div>';
  if (!rpList.length) return '<div class="crm-empty"><b>لا تقارير</b>لم يُعرَّف أي تقرير.</div>';

  var h = '<div class="rp-tabs">';
  rpList.forEach(function (r) {
    var d = rpData[r.id];
    h += '<button class="rp-tab' + (r.id === rpPick ? " on" : "") + '" onclick="rpOpen(\\'' + r.id + '\\')">' +
      esc(r.title) + (d ? '<span class="n">' + fmtN(d.count) + '</span>' : '') + '</button>';
  });
  h += '</div>';

  var cur = rpData[rpPick];
  if (!cur) return h + '<div class="crm-empty"><b>جارٍ الحساب…</b></div>';

  h += '<div class="rp-q">' + esc(cur.report.question) + '</div>';

  /* An empty result and a broken query look identical to the reader, so the report says which. */
  if (cur.empty) {
    h += '<div class="crm-empty"><b>' + esc(cur.empty.title) + '</b>' + esc(cur.empty.body) + '</div>';
    return h;
  }

  h += '<div class="rp-tot">' + fmtN(cur.count) + ' فرصة · ' + fmtN(Math.round(cur.totalValue)) + ' ر.س</div>';
  h += '<div class="crm-scroll"><table class="crm-tbl"><thead><tr>' +
    '<th>الجهة</th><th>المنتج</th><th>المرحلة</th><th>الإدارة</th><th>منذ</th><th class="crm-money">القيمة</th>' +
    '</tr></thead><tbody>';
  cur.rows.forEach(function (r) {
    h += '<tr>' +
      '<td>' + esc(r.account || "—") + '</td>' +
      '<td>' + esc(r.product) + '</td>' +
      '<td>' + esc(rpStage(r.stage)) + '</td>' +
      '<td>' + esc(r.dept || "—") + '</td>' +
      '<td>' + rpAge(r.daysWaiting) + '</td>' +
      '<td class="crm-money">' + fmtN(Math.round(r.value)) + ' ر.س</td>' +
    '</tr>';
  });
  h += '</tbody></table></div>';

  /* Same words as «المنتجات». The accounting basis is undecided and the screen says so rather than
     letting the reader assume one. */
  if (cur.valueBasis) {
    h += '<div class="rp-basis"><b>' + esc(cur.valueBasis.label) + '</b><br>' + esc(cur.valueBasis.note) + '</div>';
  }
  return h;
}
`;
