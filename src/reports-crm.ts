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
/* قبول المنتجات — one row per product, worst first */
/* auto-fit, because the «قليلة البيانات» tile only appears when it has a count — a fixed four-column
   grid left it orphaned on a row of its own. */
.ac-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(196px,1fr));gap:var(--s3);margin-block-end:var(--s4)}
.ac-tile{background:var(--paper);border:1px solid var(--line);border-radius:var(--r-lg);padding:var(--s4);
  display:flex;flex-direction:column;gap:4px;border-inline-start:3px solid var(--tn,var(--line))}
.ac-tile .n{font-size:var(--t-2xl);font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums;line-height:1.15}
.ac-tile .l{font-size:var(--t-xs);color:var(--muted)}
.ac-tbl{background:var(--paper);border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden}
.ac-r{display:grid;grid-template-columns:minmax(0,1.5fr) 150px 64px 64px 64px 118px minmax(0,1.1fr);
  align-items:center;gap:var(--s3);padding:var(--s3) var(--s4);border-top:1px solid var(--line-soft);font-size:var(--t-sm)}
.ac-r:first-of-type{border-top:0}
.ac-r.hdr{font-size:var(--t-xs);font-weight:600;color:var(--muted);background:var(--surface);border-top:0}
.ac-r .nm{font-weight:600;color:var(--ink);overflow-wrap:anywhere}
.ac-r .nm .sub{display:block;font-weight:400;margin-block-start:2px}
.ac-r .sub{font-size:var(--t-xs);color:var(--muted)}
.ac-r .num{font-variant-numeric:tabular-nums;color:var(--ink-2);font-size:var(--t-xs)}
.ac-pill{display:inline-flex;align-items:center;gap:6px;font-size:var(--t-xs);font-weight:500;
  border-radius:var(--r-pill);padding:3px 10px;background:var(--tn-soft,var(--surface-2));color:var(--tn-text,var(--ink-2))}
.ac-why{font-size:var(--t-xs);color:var(--ink-2);overflow-wrap:anywhere}
.ac-why .none{color:var(--muted)}
@media (max-width:820px){
  .ac-r{grid-template-columns:minmax(0,1fr) auto;row-gap:4px}
  .ac-r.hdr{display:none}
  .ac-r .num,.ac-why{grid-column:1 / -1}
}
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

/* «التقارير» has two faces. «نظرة تنفيذية» answers the CPO's questions about the whole pipeline
   (pipeline-report-domain.ts); «تقارير التعثّر» is the original four — which deal is stuck, on whom. */
var rpMode = "exec";
window.rpSetMode = function (m) { rpMode = m === "stuck" || m === "kpis" || m === "accept" ? m : "exec"; render(false); };
function vReportsCrm() {
  var h = '<div class="rp-tabs rp-modes" role="group" aria-label="نوع التقرير">' +
    '<button class="rp-tab' + (rpMode === "exec" ? " on" : "") + '" aria-pressed="' + (rpMode === "exec") + '" onclick="rpSetMode(&quot;exec&quot;)">نظرة تنفيذية</button>' +
    '<button class="rp-tab' + (rpMode === "stuck" ? " on" : "") + '" aria-pressed="' + (rpMode === "stuck") + '" onclick="rpSetMode(&quot;stuck&quot;)">تقارير التعثّر</button>' +
    '<button class="rp-tab' + (rpMode === "accept" ? " on" : "") + '" aria-pressed="' + (rpMode === "accept") + '" onclick="rpSetMode(&quot;accept&quot;)">قبول المنتجات</button>' +
    '<button class="rp-tab' + (rpMode === "kpis" ? " on" : "") + '" aria-pressed="' + (rpMode === "kpis") + '" onclick="rpSetMode(&quot;kpis&quot;)">مؤشرات الأداء</button>' +
    '<i class="ind"></i></div>';
  setTimeout(function () { moveInd(document.querySelector(".rp-modes")); }, 0);
  return h + (rpMode === "exec" ? vReportsExec()
    : rpMode === "accept" ? vReportsAccept()
    : rpMode === "kpis" && typeof vReportsKpis === "function" ? vReportsKpis()
    : vReportsStuck());
}

function vReportsStuck() {
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
  setTimeout(function () { moveInd(document.querySelector(".rp-tabs:not(.rp-modes)")); }, 0);

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
  /* BR-RPT-004: the row IS the deal — «#opps/<id>» is the record's own URL, so a blocked deal opens
     where it can be acted on, and the link is shareable. A row whose opportunity id never arrived
     stays inert rather than linking somewhere plausible. */
  cur.rows.forEach(function (r) {
    var inner = '<div><div class="nm">' + esc(r.account || "—") + '</div>' +
      '<div class="sub">' + esc(r.product) + ' · ' + esc(rpStage(r.stage)) +
        (r.dept ? ' · ' + esc(r.dept) : '') + '</div></div>' +
      '<div class="end"><span class="money">' + fmtN(Math.round(r.value)) + ' ر.س</span>' +
      rpAge(r.daysWaiting) + '</div>';
    h += r.oppId
      ? '<a class="sh-card go" href="#opps/' + fmtId(r.oppId) + '" title="افتح هذه الفرصة">' + inner +
        '<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);">افتح فرصة ' + esc(r.account || r.product) + "</span></a>"
      : '<div class="sh-card">' + inner + '</div>';
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

/* ============================ قبول المنتجات ============================
   The prototype's last report, and the one Massar could not produce: how the market RECEIVED each
   product. Every figure here is a count of real lines — the classification is acceptance-domain's,
   and the denominator is printed beside every rate, because «100٪» of one decided deal and of forty
   are different findings. */
var AC_TONE = {
  accepted: "--tn:#12633F;--tn-soft:#E6F3EC;--tn-text:#12633F",
  struggling: "--tn:#B37F00;--tn-soft:#FBF2DC;--tn-text:#7A5600",
  rejected: "--tn:#8E2A27;--tn-soft:#FBE9E8;--tn-text:#8E2A27",
  unsold: "--tn:#A2A9B4;--tn-soft:var(--surface-2);--tn-text:var(--muted)",
  thin: "--tn:#5B8DEF;--tn-soft:var(--accent-tint);--tn-text:var(--accent-deep)"
};
/* annualTarget is NOT an annual target: db.ts builds it from only the quarters that have a
   target row, and says how many in targetQuarters. achieved is the whole fiscal year. So a
   product targeted in Q1 alone for 100,000 that won 400,000 across the year printed «400٪».
   attainmentPct only returns null when the sum is 0, so the all-missing case was caught and the
   partial case — the common one here — was not. Both sibling screens already disclose this;
   this one dropped it. Returns the percentage AND its basis so the caller can qualify it. */
function acAttainOf(product) {
  var rows = (typeof pcQuarters !== "undefined" && pcQuarters && pcQuarters.byProduct) || [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].product === product) {
      var qs = Number(rows[i].targetQuarters) || 0;
      if (!qs) return null;
      var pc = typeof wholePct === "function" ? wholePct(attainmentPct(rows[i].achieved, rows[i].annualTarget)) : null;
      return pc === null ? null : { pct: pc, quarters: qs, partial: qs < 4 };
    }
  }
  return null;
}
function vReportsAccept() {
  if (typeof opLoad === "function") opLoad(false);
  if (typeof pcLoad === "function") pcLoad(false);
  var rows = (typeof oppRows !== "undefined" && oppRows) ? oppRows : null;
  var h = '<div class="rp-q">تقييم المنتجات من ناحية قبول العملاء — يصنّف كل منتج بنتائج صفقاته المحسومة: ما بيع جيدًا، وما تعثّر، وما جرّبه العملاء ورفضوه، وما لم يُحسم فيه شيء بعد.</div>';
  if (!rows) {
    return h + (typeof oppFailed !== "undefined" && oppFailed
      ? '<div class="rp-state" role="alert">تعذّر تحميل الفرص.<button class="btn btn-ghost" onclick="opRetry()">أعد المحاولة</button></div>'
      : moSkeleton(4, ["w40", "w80", "w60"]));
  }
  var cat = ((typeof pcCat !== "undefined" && pcCat) || []).filter(function (p) { return !p.archived; }).map(function (p) { return p.product; });
  var list = productAcceptance(rows.map(function (l) {
    return { product: l.product, stage: l.stage, lostReason: l.lost_reason };
  }), cat, isWonStage, isLostStage, acAttainOf);
  if (!list.length) {
    return h + shEmpty("chart", "لا منتجات بعد", "يظهر هذا التقرير حين يُسجَّل أول منتج في «المنتجات».");
  }
  var totals = acceptanceTotals(list);
  h += '<div class="ac-tiles">' + totals.filter(function (t) { return t.key !== "thin" || t.count; }).map(function (t) {
    return '<div class="ac-tile" style="' + (AC_TONE[t.key] || "") + '"><span class="n">' + fmtN(t.count) + "</span>" +
      '<span class="l">' + esc(t.label) + "</span>" +
      '<span class="l">' + esc(ACCEPT_HINTS[t.key] || "") + "</span></div>";
  }).join("") + "</div>";
  h += '<div class="ac-tbl">' +
    '<div class="ac-r hdr"><span>المنتج</span><span>حالة القبول</span><span>مبيعة</span><span>خاسرة</span><span>مفتوحة</span><span>نسبة الإنجاز</span><span>أبرز سبب عدم القبول</span></div>';
  list.forEach(function (r) {
    var why = r.topReason
      ? esc((typeof LOSS_REASON_LABELS !== "undefined" && LOSS_REASON_LABELS[r.topReason]) || r.topReason) +
        (r.topReasonCount > 1 ? ' <span class="none">(' + fmtN(r.topReasonCount) + ")</span>" : "")
      : r.lost ? '<span class="none">لم يُسجَّل سبب</span>' : '<span class="none">—</span>';
    h += '<div class="ac-r"><span class="nm">' + esc(r.product) +
      (r.decided ? '<span class="sub">فوز ' + fmtN(r.winRatePct) + "٪ · " + fmtN(r.won) + " من " + fmtN(r.decided) + " محسومة</span>" : '<span class="sub">لا صفقة محسومة</span>') + "</span>" +
      '<span><span class="ac-pill" style="' + (AC_TONE[r.state] || "") + '">' + esc(ACCEPT_LABELS[r.state]) + "</span></span>" +
      '<span class="num">' + fmtN(r.won) + "</span>" +
      '<span class="num">' + fmtN(r.lost) + "</span>" +
      '<span class="num">' + fmtN(r.open) + "</span>" +
      /* A percentage measured against a partial year cannot be printed bare: it reads as the
         year's. Say what it was measured on, the way the two sibling screens already do. */
      '<span class="num">' + (r.attainmentPct === null
        ? '<span class="crm-none">بلا مستهدف</span>'
        : (fmtN(r.attainmentPct.pct) + "٪" +
           (r.attainmentPct.partial
             ? " · مستهدف " + fmtN(r.attainmentPct.quarters) + " من أربعة أرباع"
             : " من المستهدف"))) + "</span>" +
      '<span class="ac-why">' + why + "</span></div>";
  });
  h += "</div>";
  h += '<div class="rp-basis"><b>كيف صُنِّف كل منتج؟</b><br>' +
    "بنسبة الفوز بين الصفقات المحسومة وحدها: " + fmtN(ACCEPT_GOOD_PCT) + "٪ فأكثر «مقبولة»، ودون " + fmtN(ACCEPT_BAD_PCT) + "٪ «غير مقبولة»، وما بينهما «متعثّرة». " +
    "المنتج الذي لم تُحسم له صفقة «لم يُبع بعد» مهما كثرت فرصه المفتوحة — الفرصة المفتوحة سؤال لا إجابة. وصفقة محسومة واحدة لا تكفي لحكم.</div>";
  return h;
}
`;
