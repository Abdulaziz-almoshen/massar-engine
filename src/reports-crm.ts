// reports-crm.ts — «التقارير»: the four reports the stage document names, on screen at last.
//
// They were computable for a while and «التقارير» stayed «قريبًا», which is the same gap as a table
// with a writer and no reader. Each report carries its own question and its own written empty
// state, both from reports-domain.ts, so the screen cannot describe a report differently from the
// query that answers it.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included.

export const REPORTS_CRM_CSS = `
.rp-tabs{position:relative;display:flex;gap:2px;flex-wrap:wrap;margin-block-end:18px;
  border-block-end:1px solid var(--line-soft)}
.rp-tab{appearance:none;background:transparent;border:0;border-radius:0;cursor:pointer;font-family:inherit;
  font-size:14px;font-weight:450;color:var(--muted,#656B76);letter-spacing:0;padding:8px 11px;
  border-block-end:2px solid transparent;margin-block-end:-1px;display:inline-flex;align-items:center;gap:7px}
.rp-tab:hover{color:var(--ink,#14161A)}
.rp-tab.on{color:var(--ink);font-weight:600}
/* Same sliding indicator as the door tabs, from the same moveInd helper — one pattern, one
   implementation. Two strips that slide differently is how a product starts feeling assembled. */
.rp-tabs .ind{position:absolute;inset-block-end:0;inset-inline-start:0;height:2px;background:var(--blue);
  border-radius:var(--r-pill) var(--r-pill) 0 0;width:0;transform:translateX(0);
  transition:transform var(--base) var(--ease),width var(--base) var(--ease);pointer-events:none}
.rp-tabs .ind.noanim{transition:none}
.rp-tab .n{font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--muted,#656B76)}
.rp-tab.on .n{color:var(--teal,#2563EB)}
.rp-q{font-size:12px;color:var(--ink2,#33373E);margin-block-end:4px}
.rp-tot{font-size:12px;color:var(--muted,#656B76);margin-block-end:14px;font-variant-numeric:tabular-nums}
.rp-days{font-variant-numeric:tabular-nums;font-weight:600}
.rp-basis{font-size:12px;color:var(--muted,#656B76);margin-block-start:18px;line-height:1.7;
  padding-inline-start:9px;border-inline-start:2px solid var(--line2,#D8DCE3);max-width:66ch}
`;

export const REPORTS_CRM_JS = `
/* ============================ reports-crm (client) ============================ */
var rpList = null, rpPick = null, rpData = {}, rpLoading = false, rpRoll = null;

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

function rpRollLoad() {
  if (rpRoll) return;
  rpRoll = "loading";
  fetch("/admin/reports/rollups", { headers: { "x-admin-token": TOKEN } })
    .then(function (r) { return r.json(); })
    .then(function (j) { rpRoll = j; render(false); })
    .catch(function () { rpRoll = { byDept: [], byReason: [], failed: true }; render(false); });
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
  if (!rpList) return moSkeleton(4, ["w40", "w80", "w60"]);
  if (!rpList.length) return '<div class="crm-empty"><b>لا تقارير</b>لم يُعرَّف أي تقرير.</div>';

  var h = '<div class="rp-tabs">';
  rpList.forEach(function (r) {
    var d = rpData[r.id];
    h += '<button class="rp-tab' + (r.id === rpPick ? " on" : "") + '" onclick="rpOpen(\\'' + r.id + '\\')">' +
      esc(r.title) + (d ? '<span class="n">' + fmtN(d.count) + '</span>' : '') + '</button>';
  });
  h += '<i class="ind"></i></div>';

  /* Placed after the strip is in the DOM; render() writes innerHTML, so the measure has to wait a
     frame or getBoundingClientRect reads zeros. */
  setTimeout(function () { moveInd(document.querySelector(".rp-tabs")); }, 0);

  var cur = rpData[rpPick];
  if (!cur) return h + moSkeleton(4, ["w60", "w80", "w40"]);

  h += '<div class="rp-q">' + esc(cur.report.question) + '</div>';

  /* An empty result and a broken query look identical to the reader, so the report says which. */
  if (cur.empty) {
    h += shEmpty("clock", cur.empty.title, cur.empty.body);
    return h;
  }

  h += '<div class="rp-tot">' + fmtN(cur.count) + ' فرصة · ' + fmtN(Math.round(cur.totalValue)) + ' ر.س</div>';
  h += '<div class="sh-cards">';
  cur.rows.forEach(function (r) {
    h += '<div class="sh-card"><div><div class="nm">' + esc(r.account || "—") + '</div>' +
      '<div class="sub">' + esc(r.product) + ' · ' + esc(rpStage(r.stage)) +
        (r.dept ? ' · ' + esc(r.dept) : '') + '</div></div>' +
      '<div class="end"><span class="money">' + fmtN(Math.round(r.value)) + ' ر.س</span>' +
      rpAge(r.daysWaiting) + '</div></div>';
  });
  h += '</div>';

  h += vReportRollups();

  /* Same words as «المنتجات». The accounting basis is undecided and the screen says so rather than
     letting the reader assume one. */
  if (cur.valueBasis) {
    h += '<div class="rp-basis"><b>' + esc(cur.valueBasis.label) + '</b><br>' + esc(cur.valueBasis.note) + '</div>';
  }
  return h;
}

/* The mockup's other two report blocks. «أين تتعثّر الصفقات» answers a different question from the
   four named reports: not WHICH deals, but WHO is holding them. Ordered by the OLDEST blockage, not
   by count — a department sitting on one deal for forty days is a worse problem than one holding six
   for three, and sorting by count buries the row the block exists to surface. */
function vReportRollups() {
  rpRollLoad();
  if (!rpRoll || rpRoll === "loading") return '<div class="rp-sec">' + moSkeleton(3, ["w60", "w40"]) + '</div>';

  var h = '<div class="rp-sec"><div class="rp-h">أين تتعثّر الصفقات</div>' +
    '<div class="rp-hs">الإجراءات المفتوحة حسب الإدارة المسؤولة، مرتّبة بالأقدم توقّفًا لا بالأكثر عددًا.</div>';
  if (!rpRoll.byDept.length) {
    h += shEmpty("clock", rpRoll.empty.dept.title, rpRoll.empty.dept.body);
  } else {
    h += '<div class="mo-stagger sh-cards">';
    rpRoll.byDept.forEach(function (d) {
      h += '<div class="sh-card"><div><div class="nm">' + esc(d.dept) + '</div>' +
        '<div class="sub">' + fmtN(d.openCount) + ' إجراء مفتوح</div></div>' +
        '<div class="end"><span class="money">' + fmtN(Math.round(d.value)) + ' ر.س</span>' +
        rpAge(d.oldestDays) + '</div></div>';
    });
    h += '</div>';
  }
  h += '</div>';

  h += '<div class="rp-sec"><div class="rp-h">الخسائر حسب السبب</div>' +
    '<div class="rp-hs">كل صفقة مغلقة خسارةً، حسب النتيجة التي أغلقتها. النتيجة تُقرأ من السجل ومن النشاط معًا: نتيجة تُسجَّل على صفقة خاسرة أصلًا لا تُنتج انتقال مرحلة، فلا تصل السجل.</div>';
  if (!rpRoll.byReason.length) {
    h += shEmpty("chart", rpRoll.empty.reason.title, rpRoll.empty.reason.body);
  } else {
    var top = rpRoll.byReason[0].value || 1;
    /* One stacked bar over the reasons, then a card each — the same treatment the sector board
       gets, because the question is identical in shape: which part is biggest. */
    var COLR = ["#D9534F", "#B37F00", "#1E5FCC", "#767D89", "#5B8DEF"];
    h += shStack(rpRoll.byReason.map(function (r, i) {
      return { n: r.label, v: r.value || 0, c: COLR[i % COLR.length] }; }));
    h += '<div class="sh-cards" style="margin-block-start:var(--s3)">';
    rpRoll.byReason.forEach(function (r) {
      h += '<div class="sh-card"><div><div class="nm">' + esc(r.label) + '</div>' +
        '<div class="sub">' + fmtN(r.count) + ' صفقة</div></div>' +
        '<div class="end"><span class="money">' + fmtN(Math.round(r.value)) + ' ر.س</span></div></div>';
    });
    h += '</div>';
  }
  h += '</div>';
  return h;
}
`;
